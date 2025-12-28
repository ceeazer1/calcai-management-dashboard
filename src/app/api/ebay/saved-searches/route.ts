import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { getKvClient } from "@/lib/kv";
import type { EbayBuyingOption, EbayMarketplaceId } from "@/lib/ebay";

export const runtime = "nodejs";

interface SavedSearchQuery {
  keyword: string;
  marketplaceId: EbayMarketplaceId;
  buyingOptions: EbayBuyingOption[];
  conditionIds: number[];
  minPrice: number | null;
  maxPrice: number | null;
  itemLocationCountry: string | null;
  sort: string | null;
}

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: number;
  query: SavedSearchQuery;
}

function searchesKey(uid: string) {
  return `ebay:user:${uid}:saved_searches`;
}

function normalizeQuery(input: any): SavedSearchQuery | null {
  const keyword = String(input?.keyword || "").trim();
  if (!keyword) return null;

  const marketplaceId = String(input?.marketplaceId || input?.marketplace || "EBAY_US")
    .trim()
    .toUpperCase() as EbayMarketplaceId;

  const buyingOptions = Array.isArray(input?.buyingOptions)
    ? (input.buyingOptions.map((x: any) => String(x).toUpperCase()) as EbayBuyingOption[])
    : [];

  const conditionIds = Array.isArray(input?.conditionIds)
    ? (input.conditionIds.map((n: any) => Number(n)).filter((n: any) => Number.isInteger(n)) as number[])
    : [];

  const minPrice = input?.minPrice === null || input?.minPrice === "" ? null : Number(input?.minPrice);
  const maxPrice = input?.maxPrice === null || input?.maxPrice === "" ? null : Number(input?.maxPrice);
  const min = Number.isFinite(minPrice) ? minPrice : null;
  const max = Number.isFinite(maxPrice) ? maxPrice : null;

  const itemLocationCountry = input?.itemLocationCountry
    ? String(input.itemLocationCountry).trim().toUpperCase()
    : null;

  const sort = input?.sort ? String(input.sort).trim() : null;

  return {
    keyword,
    marketplaceId,
    buyingOptions,
    conditionIds,
    minPrice: min,
    maxPrice: max,
    itemLocationCountry,
    sort,
  };
}

export async function GET(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const kv = getKvClient();
    const v = await kv.get<unknown>(searchesKey(uid));
    const searches = Array.isArray(v) ? (v as SavedSearch[]) : [];
    searches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const res = NextResponse.json({ ok: true, searches });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[ebay/saved-searches] GET error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const body = await req.json().catch(() => ({}));
    const query = normalizeQuery(body?.query || body);
    if (!query) return NextResponse.json({ ok: false, error: "missing_keyword" }, { status: 400 });

    const name =
      (typeof body?.name === "string" && body.name.trim()) ||
      `${query.keyword}${query.marketplaceId ? ` (${query.marketplaceId})` : ""}`;

    const kv = getKvClient();
    const existing = await kv.get<unknown>(searchesKey(uid));
    const list: SavedSearch[] = Array.isArray(existing) ? (existing as SavedSearch[]) : [];

    const next: SavedSearch = {
      id: randomUUID(),
      name: String(name).slice(0, 80),
      createdAt: Date.now(),
      query,
    };
    const updated = [next, ...list].slice(0, 50);
    await kv.set(searchesKey(uid), updated);

    const res = NextResponse.json({ ok: true, search: next, searches: updated });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    return res;
  } catch (e) {
    console.error("[ebay/saved-searches] POST error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  try {
    const kv = getKvClient();
    const existing = await kv.get<unknown>(searchesKey(uid));
    const list: SavedSearch[] = Array.isArray(existing) ? (existing as SavedSearch[]) : [];
    const updated = list.filter((s) => s.id !== id);
    await kv.set(searchesKey(uid), updated);
    const res = NextResponse.json({ ok: true, searches: updated });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    return res;
  } catch (e) {
    console.error("[ebay/saved-searches] DELETE error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}



