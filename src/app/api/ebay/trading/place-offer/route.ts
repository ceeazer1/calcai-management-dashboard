import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { getValidUserAccessToken } from "@/lib/ebay-user-token";

export const runtime = "nodejs";

function getApiBaseUrl() {
  const override = process.env.EBAY_API_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const env = (process.env.EBAY_ENV || "production").toLowerCase();
  return env === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function siteIdForMarketplace(marketplaceId: string): string {
  const id = String(marketplaceId || "").toUpperCase();
  if (id === "EBAY_US") return "0";
  if (id === "EBAY_CA") return "2";
  if (id === "EBAY_GB") return "3";
  if (id === "EBAY_AU") return "15";
  if (id === "EBAY_DE") return "77";
  return "0";
}

function currencyForMarketplace(marketplaceId: string): string {
  const id = String(marketplaceId || "").toUpperCase();
  if (id === "EBAY_US") return "USD";
  if (id === "EBAY_CA") return "CAD";
  if (id === "EBAY_GB") return "GBP";
  if (id === "EBAY_AU") return "AUD";
  if (id === "EBAY_DE") return "EUR";
  return "USD";
}

function parseTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseMany(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

export async function POST(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const body = await req.json().catch(() => ({}));
    const itemId = String(body?.itemId || "").trim();
    const marketplaceId = String(body?.marketplaceId || body?.marketplace || "EBAY_US")
      .trim()
      .toUpperCase();
    const action = String(body?.action || "").trim().toLowerCase();
    const amount = Number(body?.amount);
    const confirm = body?.confirm === true || body?.confirm === "true" || body?.confirm === 1;

    if (!itemId) return NextResponse.json({ ok: false, error: "missing_item_id" }, { status: 400 });
    if (!confirm) return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
    }

    const actionValue = action === "bid" ? "Bid" : action === "best_offer" ? "BestOffer" : "";
    if (!actionValue) return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });

    const token = await getValidUserAccessToken(uid);
    const endpoint = `${getApiBaseUrl()}/ws/api.dll`;
    const currency = currencyForMarketplace(marketplaceId);
    const amt = amount.toFixed(2);

    // Note: Trading API uses XML. OAuth user token is passed via X-EBAY-API-IAF-TOKEN header.
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<PlaceOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${escapeXml(itemId)}</ItemID>
  <Offer>
    <Action>${actionValue}</Action>
    <MaxBid currencyID="${currency}">${amt}</MaxBid>
    <Quantity>1</Quantity>
  </Offer>
</PlaceOfferRequest>`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "PlaceOffer",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-SITEID": siteIdForMarketplace(marketplaceId),
        "X-EBAY-API-IAF-TOKEN": token,
      },
      body: xml,
      cache: "no-store",
    });

    const txt = await r.text();
    const ack = parseTag(txt, "Ack") || "";
    const shortMessages = parseMany(txt, "ShortMessage");
    const longMessages = parseMany(txt, "LongMessage");
    const errors = [...shortMessages, ...longMessages].filter(Boolean).slice(0, 10);
    const ok = r.ok && (ack.toLowerCase() === "success" || ack.toLowerCase() === "warning");

    const res = NextResponse.json({
      ok,
      ack: ack || null,
      errors,
      raw: txt.slice(0, 4000),
    }, { status: ok ? 200 : 502 });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    const msg = String(e?.message || "unknown");
    const status = msg === "ebay_not_connected" ? 401 : 500;
    const res = NextResponse.json({ ok: false, error: "server_error", message: msg }, { status });
    if (!existingUid) setEbayUserIdCookie(res, uid);
    return res;
  }
}


