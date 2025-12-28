import { NextRequest, NextResponse } from "next/server";
import { ensureEbayUserId } from "@/lib/ebay-user";
import { getEbayItem, type EbayMarketplaceId } from "@/lib/ebay";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const itemId = decodeURIComponent(params.itemId || "").trim();
  if (!itemId) return NextResponse.json({ ok: false, error: "missing_item_id" }, { status: 400 });

  const url = new URL(req.url);
  const marketplaceId = (url.searchParams.get("marketplace") || url.searchParams.get("marketplaceId") || "EBAY_US")
    .trim()
    .toUpperCase() as EbayMarketplaceId;

  try {
    const item = await getEbayItem(itemId, marketplaceId);
    const res = NextResponse.json({ ok: true, item });
    ensureEbayUserId(req, res);
    return res;
  } catch (e: any) {
    console.error("[ebay/item] error:", e);
    const status = typeof e?.status === "number" ? e.status : 502;
    return NextResponse.json({ ok: false, error: "ebay_error", message: String(e?.message || "unknown") }, { status });
  }
}


