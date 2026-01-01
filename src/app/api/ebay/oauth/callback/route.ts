import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { exchangeAuthCodeForUserToken, saveUserTokenRecord } from "@/lib/ebay-user-token";

export const runtime = "nodejs";

const STATE_COOKIE = "calcai_ebay_oauth_state";
const RETURN_COOKIE = "calcai_ebay_oauth_return";

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const err = (url.searchParams.get("error") || "").trim();
  const errDesc = (url.searchParams.get("error_description") || "").trim();

  const cookieState = req.cookies.get(STATE_COOKIE)?.value || "";
  const returnTo = req.cookies.get(RETURN_COOKIE)?.value || "/ebay";

  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : "/ebay", url.origin);

  if (err) {
    redirectUrl.searchParams.set("ebayOauth", "error");
    redirectUrl.searchParams.set("message", errDesc || err);
    const res = NextResponse.redirect(redirectUrl);
    clearCookie(res, STATE_COOKIE);
    clearCookie(res, RETURN_COOKIE);
    return res;
  }

  if (!code) {
    redirectUrl.searchParams.set("ebayOauth", "error");
    redirectUrl.searchParams.set("message", "Missing OAuth code");
    const res = NextResponse.redirect(redirectUrl);
    clearCookie(res, STATE_COOKIE);
    clearCookie(res, RETURN_COOKIE);
    return res;
  }

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 400 });
  }

  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  try {
    const rec = await exchangeAuthCodeForUserToken(code);
    await saveUserTokenRecord(uid, rec);
  } catch (e: any) {
    redirectUrl.searchParams.set("ebayOauth", "error");
    redirectUrl.searchParams.set("message", String(e?.message || "OAuth failed"));
    const res = NextResponse.redirect(redirectUrl);
    if (!existingUid) setEbayUserIdCookie(res, uid);
    clearCookie(res, STATE_COOKIE);
    clearCookie(res, RETURN_COOKIE);
    return res;
  }

  redirectUrl.searchParams.set("ebayOauth", "ok");
  const res = NextResponse.redirect(redirectUrl);
  if (!existingUid) setEbayUserIdCookie(res, uid);
  clearCookie(res, STATE_COOKIE);
  clearCookie(res, RETURN_COOKIE);
  return res;
}







