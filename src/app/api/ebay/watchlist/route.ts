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

const USERS_KEY = "ebay:users";

function watchlistKey(uid: string) {
  return `ebay:user:${uid}:watchlist`;
}

function snapshotsKey(uid: string, itemId: string) {
  return `ebay:user:${uid}:snapshots:${encodeURIComponent(itemId)}`;
}

async function loadJsonArray<T>(key: string): Promise<T[]> {
  const kv = getKvClient();
  const v = await kv.get<unknown>(key);
  return Array.isArray(v) ? (v as T[]) : [];
}

async function saveJson(key: string, value: unknown): Promise<void> {
  const kv = getKvClient();
  await kv.set(key, value);
}

async function delKey(key: string): Promise<void> {
  const kv = getKvClient();
  if (typeof kv.del === "function") await kv.del(key);
}

async function trackUser(uid: string) {
  const kv = getKvClient();
  const users = (await kv.get<unknown>(USERS_KEY)) as unknown;
  const arr = Array.isArray(users) ? (users as string[]) : [];
  if (!arr.includes(uid)) {
    const next = [...arr, uid].slice(-5000);
    await kv.set(USERS_KEY, next);
  }
}

async function appendSnapshot(uid: string, itemId: string, snap: PriceSnapshot) {
  const key = snapshotsKey(uid, itemId);
  const kv = getKvClient();
  const existing = (await kv.get<unknown>(key)) as unknown;
  const arr = Array.isArray(existing) ? (existing as PriceSnapshot[]) : [];
  const next = [...arr, snap].slice(-180);
  await kv.set(key, next);
}

export async function GET(req: NextRequest) {
  try {
    const existingUid = getEbayUserId(req);
    const uid = existingUid || createEbayUserId();
    const items = await loadJsonArray<WatchedItem>(watchlistKey(uid));
    items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const res = NextResponse.json({ ok: true, items });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[ebay/watchlist] GET error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();
  await trackUser(uid).catch(() => {});

  try {
    const body = await req.json().catch(() => ({}));
    const itemId = String(body?.itemId || "").trim();
    if (!itemId) return NextResponse.json({ ok: false, error: "missing_item_id" }, { status: 400 });

    const marketplaceId = String(body?.marketplaceId || body?.marketplace || "EBAY_US")
      .trim()
      .toUpperCase() as EbayMarketplaceId;

    const action = String(body?.action || "toggle").toLowerCase();

    const key = watchlistKey(uid);
    const kv = getKvClient();
    const existing = (await kv.get<unknown>(key)) as unknown;
    const list: WatchedItem[] = Array.isArray(existing) ? (existing as WatchedItem[]) : [];
    const idx = list.findIndex((x) => x.itemId === itemId);

    const shouldRemove = (action === "remove") || (action === "toggle" && idx >= 0);
    if (shouldRemove) {
      const next = list.filter((x) => x.itemId !== itemId);
      await kv.set(key, next);
      await delKey(snapshotsKey(uid, itemId));
      const res = NextResponse.json({ ok: true, action: "removed", items: next });
      if (!existingUid) setEbayUserIdCookie(res, uid);
      return res;
    }

    // Add
    const details = await getEbayItem(itemId, marketplaceId);
    const now = Date.now();
    const watched: WatchedItem = {
      itemId: details.itemId || itemId,
      title: details.title || itemId,
      imageUrl: details.imageUrls?.[0] || null,
      itemWebUrl: details.itemWebUrl || null,
      marketplaceId,
      buyingOptions: details.buyingOptions || [],
      addedAt: now,
      lastRefreshedAt: now,
      lastPrice: details.price,
      lastShippingCost: details.shippingCost,
      availabilityStatus: details.availabilityStatus,
    };

    const next = [watched, ...list.filter((x) => x.itemId !== watched.itemId)].slice(0, 500);
    await kv.set(key, next);
    await appendSnapshot(uid, watched.itemId, {
      ts: now,
      price: watched.lastPrice,
      shippingCost: watched.lastShippingCost,
      availabilityStatus: watched.availabilityStatus,
    });

    const res = NextResponse.json({ ok: true, action: "added", item: watched, items: next });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    return res;
  } catch (e: any) {
    console.error("[ebay/watchlist] POST error:", e);
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json({ ok: false, error: "server_error", message: String(e?.message || "unknown") }, { status });
  }
}


