import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { getEbayItem, type Money } from "@/lib/ebay";

export const runtime = "nodejs";

interface WatchedItem {
  itemId: string;
  title: string;
  imageUrl: string | null;
  itemWebUrl: string | null;
  marketplaceId: string;
  buyingOptions: string[];
  addedAt: number;
  lastRefreshedAt: number | null;
  lastPrice: Money | null;
  lastShippingCost: Money | null;
  availabilityStatus: string | null;
}

interface PriceSnapshot {
  ts: number;
  price: Money | null;
  shippingCost: Money | null;
  availabilityStatus: string | null;
}

const USERS_KEY = "ebay:users";

function watchlistKey(uid: string) {
  return `ebay:user:${uid}:watchlist`;
}

function snapshotsKey(uid: string, itemId: string) {
  return `ebay:user:${uid}:snapshots:${encodeURIComponent(itemId)}`;
}

async function runPool<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let next = 0;
  const runners = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function appendSnapshot(uid: string, itemId: string, snap: PriceSnapshot) {
  const kv = getKvClient();
  const key = snapshotsKey(uid, itemId);
  const existing = await kv.get<unknown>(key);
  const arr = Array.isArray(existing) ? (existing as PriceSnapshot[]) : [];
  const next = [...arr, snap].slice(-180);
  await kv.set(key, next);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const expected = (process.env.EBAY_CRON_TOKEN || "").trim();
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const maxUsers = Math.max(1, Math.min(200, Number(url.searchParams.get("maxUsers") || 25)));
  const maxItems = Math.max(1, Math.min(200, Number(url.searchParams.get("maxItems") || 25)));
  const concurrency = Math.max(1, Math.min(6, Number(url.searchParams.get("concurrency") || 2)));
  const now = Date.now();

  try {
    const kv = getKvClient();
    const usersRaw = await kv.get<unknown>(USERS_KEY);
    const users = (Array.isArray(usersRaw) ? (usersRaw as string[]) : []).slice(0, maxUsers);

    const perUserResults = await runPool(
      users,
      async (uid) => {
        const wlRaw = await kv.get<unknown>(watchlistKey(uid));
        const list: WatchedItem[] = Array.isArray(wlRaw) ? (wlRaw as WatchedItem[]) : [];
        const items = list.slice(0, maxItems);

        const refreshed = await runPool(
          items,
          async (w) => {
            try {
              const details = await getEbayItem(w.itemId, (w.marketplaceId || "EBAY_US") as any);
              w.title = details.title || w.title;
              w.imageUrl = details.imageUrls?.[0] || w.imageUrl;
              w.itemWebUrl = details.itemWebUrl || w.itemWebUrl;
              w.buyingOptions = details.buyingOptions || w.buyingOptions || [];
              w.lastRefreshedAt = now;
              w.lastPrice = details.price;
              w.lastShippingCost = details.shippingCost;
              w.availabilityStatus = details.availabilityStatus;
              await appendSnapshot(uid, w.itemId, {
                ts: now,
                price: w.lastPrice,
                shippingCost: w.lastShippingCost,
                availabilityStatus: w.availabilityStatus,
              });
              return { itemId: w.itemId, ok: true };
            } catch (e: any) {
              return { itemId: w.itemId, ok: false, error: String(e?.message || "refresh_failed") };
            }
          },
          concurrency
        );

        await kv.set(watchlistKey(uid), list.slice(0, 500));
        return { uid, refreshed: refreshed.filter((r) => r.ok).length, total: refreshed.length };
      },
      2
    );

    const totals = perUserResults.reduce(
      (acc, r) => {
        acc.users += 1;
        acc.items += r.total;
        acc.refreshed += r.refreshed;
        return acc;
      },
      { users: 0, items: 0, refreshed: 0 }
    );

    return NextResponse.json({ ok: true, ...totals, perUser: perUserResults });
  } catch (e) {
    console.error("[ebay/cron-refresh] error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}


