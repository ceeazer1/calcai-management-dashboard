import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";

interface PriceSnapshot {
  ts: number;
  price: { value: number; currency: string } | null;
  shippingCost: { value: number; currency: string } | null;
  availabilityStatus: string | null;
}

function snapshotsKey(uid: string, itemId: string) {
  return `ebay:user:${uid}:snapshots:${encodeURIComponent(itemId)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const itemId = decodeURIComponent(params.itemId || "").trim();
  if (!itemId) return NextResponse.json({ ok: false, error: "missing_item_id" }, { status: 400 });

  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const kv = getKvClient();
    const v = await kv.get<unknown>(snapshotsKey(uid, itemId));
    const snapshots = Array.isArray(v) ? (v as PriceSnapshot[]) : [];
    snapshots.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const res = NextResponse.json({ ok: true, itemId, snapshots });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[ebay/watchlist/history] error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}


