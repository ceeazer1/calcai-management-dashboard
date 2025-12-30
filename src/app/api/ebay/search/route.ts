import { NextRequest, NextResponse } from "next/server";
import { ensureEbayUserId } from "@/lib/ebay-user";
import { searchEbayItemSummaries, type EbayBuyingOption, type EbayMarketplaceId } from "@/lib/ebay";

export const runtime = "nodejs";

function parseBool(v: string | null): boolean | null {
  if (v === null) return null;
  const s = v.trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return null;
}

function parseBuyingOptions(sp: URLSearchParams): EbayBuyingOption[] {
  const raw = sp.get("buyingOptions");
  if (raw) {
    return raw
      .split(/[,\s]+/g)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as EbayBuyingOption[];
  }
  const fixed = parseBool(sp.get("fixed")) ?? parseBool(sp.get("buyFixed"));
  const auction = parseBool(sp.get("auction")) ?? parseBool(sp.get("buyAuction"));
  const out: EbayBuyingOption[] = [];
  if (fixed) out.push("FIXED_PRICE");
  if (auction) out.push("AUCTION");
  return out;
}

function parseConditionIds(sp: URLSearchParams): number[] {
  const raw = sp.get("conditionIds") || sp.get("conditionId") || sp.get("condition") || "";
  const v = raw.trim().toLowerCase();
  if (!v) return [];
  if (/^\d+(?:,\d+)*$/.test(v)) return v.split(",").map((n) => Number(n)).filter((n) => Number.isInteger(n));
  if (v === "new") return [1000];
  if (v === "used") return [3000];
  if (v === "refurbished") return [2000];
  if (v === "for_parts" || v === "parts" || v === "not_working") return [7000];
  return [];
}

function parseNum(sp: URLSearchParams, key: string): number | null {
  const raw = sp.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSort(sp: URLSearchParams): string | null {
  const raw = (sp.get("sort") || "").trim();
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "best" || v === "best_match" || v === "bestmatch") return "bestMatch";
  if (v === "price_asc" || v === "priceasc" || v === "price+") return "price";
  if (v === "price_desc" || v === "pricedesc" || v === "price-") return "-price";
  if (v === "ending_soon" || v === "endingsoon" || v === "ending") return "endingSoonest";
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") || url.searchParams.get("q") || "").trim();
  if (!keyword) {
    return NextResponse.json({ ok: false, error: "missing_keyword" }, { status: 400 });
  }

  const marketplaceId = (url.searchParams.get("marketplace") || url.searchParams.get("marketplaceId") || "EBAY_US")
    .trim()
    .toUpperCase() as EbayMarketplaceId;

  const buyingOptions = parseBuyingOptions(url.searchParams);
  const conditionIds = parseConditionIds(url.searchParams);
  const minPrice = parseNum(url.searchParams, "minPrice");
  const maxPrice = parseNum(url.searchParams, "maxPrice");
  const itemLocationCountry = (url.searchParams.get("itemLocationCountry") || url.searchParams.get("location") || "")
    .trim()
    .toUpperCase();
  const sort = parseSort(url.searchParams);
  const limit = parseNum(url.searchParams, "limit") ?? 20;
  const offset = parseNum(url.searchParams, "offset") ?? 0;

  try {
    const data = await searchEbayItemSummaries({
      keyword,
      marketplaceId,
      buyingOptions: buyingOptions.length ? buyingOptions : undefined,
      conditionIds: conditionIds.length ? conditionIds : undefined,
      minPrice,
      maxPrice,
      itemLocationCountry: itemLocationCountry || null,
      sort: (sort || undefined) as any,
      limit: Number(limit),
      offset: Number(offset),
    });

    const res = NextResponse.json({
      ok: true,
      total: data.total,
      nextOffset: data.nextOffset,
      items: data.items,
    });
    ensureEbayUserId(req, res);
    return res;
  } catch (e: any) {
    console.error("[ebay/search] error:", e);
    const status = typeof e?.status === "number" ? e.status : 502;
    return NextResponse.json({ ok: false, error: "ebay_error", message: String(e?.message || "unknown") }, { status });
  }
}





