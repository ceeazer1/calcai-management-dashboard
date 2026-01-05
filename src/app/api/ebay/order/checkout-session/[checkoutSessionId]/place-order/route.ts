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

function isEnabled() {
  const v = (process.env.EBAY_ORDER_API_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ checkoutSessionId: string }> }) {
  if (!isEnabled()) {
    return NextResponse.json(
      { ok: false, error: "disabled", message: "Order API is disabled. Set EBAY_ORDER_API_ENABLED=1." },
      { status: 501 }
    );
  }

  const { checkoutSessionId: raw } = await params;
  const checkoutSessionId = decodeURIComponent(String(raw || "")).trim();
  if (!checkoutSessionId) return NextResponse.json({ ok: false, error: "missing_checkout_session_id" }, { status: 400 });

  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const body = await req.json().catch(() => ({}));
    const confirm = body?.confirm === true || body?.confirm === "true" || body?.confirm === 1;
    if (!confirm) return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });

    const token = await getValidUserAccessToken(uid);
    const endpoint = `${getApiBaseUrl()}/buy/order/v1/checkout_session/${encodeURIComponent(checkoutSessionId)}/place_order`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const txt = await r.text();
    let j: any = null;
    try {
      j = JSON.parse(txt);
    } catch {
      // ignore
    }

    if (!r.ok) {
      const msg = j?.errors?.[0]?.message || j?.message || txt.slice(0, 400) || "place_order_failed";
      const res = NextResponse.json({ ok: false, error: "ebay_error", message: msg, raw: j || txt }, { status: r.status });
      if (!existingUid) setEbayUserIdCookie(res, uid);
      return res;
    }

    const res = NextResponse.json({ ok: true, raw: j }, { status: 200 });
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









