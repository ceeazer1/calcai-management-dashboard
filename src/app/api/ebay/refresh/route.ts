import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { getKvClient } from "@/lib/kv";
import { getEbayItem, type EbayBuyingOption, type EbayMarketplaceId, type Money } from "@/lib/ebay";

export const runtime = "nodejs";

interface WatchedItem {
  itemId: string;
  title: string;
  imageUrl: string | null;
  itemWebUrl: string | null;
  marketplaceId: EbayMarketplaceId;
  buyingOptions: EbayBuyingOption[];
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

function watchlistKey(uid: string) {
  return `ebay:user:${uid}:watchlist`;
}

function snapshotsKey(uid: string, itemId: string) {
  return `ebay:user:${uid}:snapshots:${encodeURIComponent(itemId)}`;
}

async function appendSnapshot(uid: string, itemId: string, snap: PriceSnapshot) {
  const kv = getKvClient();
  const key = snapshotsKey(uid, itemId);
  const existing = await kv.get<unknown>(key);
  const arr = Array.isArray(existing) ? (existing as PriceSnapshot[]) : [];
  const next = [...arr, snap].slice(-180);
  await kv.set(key, next);
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

export async function POST(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const body = await req.json().catch(() => ({}));
    const maxItems = Math.max(1, Math.min(200, Number(body?.maxItems ?? 50)));
    const concurrency = Math.max(1, Math.min(8, Number(body?.concurrency ?? 3)));

    const kv = getKvClient();
    const listRaw = await kv.get<unknown>(watchlistKey(uid));
    const list: WatchedItem[] = Array.isArray(listRaw) ? (listRaw as WatchedItem[]) : [];

    const items = list.slice(0, maxItems);
    const now = Date.now();

    const refreshed: { itemId: string; ok: boolean; error?: string }[] = await runPool(
      items,
      async (w) => {
        try {
          const details = await getEbayItem(w.itemId, w.marketplaceId || "EBAY_US");
          const nextW: WatchedItem = {
            ...w,
            title: details.title || w.title,
            imageUrl: details.imageUrls?.[0] || w.imageUrl,
            itemWebUrl: details.itemWebUrl || w.itemWebUrl,
            buyingOptions: details.buyingOptions || w.buyingOptions || [],
            lastRefreshedAt: now,
            lastPrice: details.price,
            lastShippingCost: details.shippingCost,
            availabilityStatus: details.availabilityStatus,
          };
          // Persist snapshot + update in-memory list element
          await appendSnapshot(uid, w.itemId, {
            ts: now,
            price: nextW.lastPrice,
            shippingCost: nextW.lastShippingCost,
            availabilityStatus: nextW.availabilityStatus,
          });
          Object.assign(w, nextW);
          return { itemId: w.itemId, ok: true };
        } catch (e: any) {
          return { itemId: w.itemId, ok: false, error: String(e?.message || "refresh_failed") };
        }
      },
      concurrency
    );

    // Save updated list (sorted newest first)
    const updated = [...list].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 500);
    await kv.set(watchlistKey(uid), updated);

    const okCount = refreshed.filter((r) => r.ok).length;
    const res = NextResponse.json({ ok: true, refreshed: okCount, total: refreshed.length, results: refreshed, items: updated });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    return res;
  } catch (e) {
    console.error("[ebay/refresh] POST error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}









