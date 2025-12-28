import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureEbayUserId } from "@/lib/ebay-user";
import { buildEbayAuthorizeUrl } from "@/lib/ebay-user-token";

export const runtime = "nodejs";

const STATE_COOKIE = "calcai_ebay_oauth_state";
const RETURN_COOKIE = "calcai_ebay_oauth_return";

function safeReturnPath(v: string | null): string {
  const raw = (v || "").trim();
  if (!raw) return "/ebay";
  if (!raw.startsWith("/")) return "/ebay";
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  const state = randomUUID();

  let authUrl: string;
  try {
    authUrl = buildEbayAuthorizeUrl(state);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || "oauth_config_error") }, { status: 500 });
  }

  const res = NextResponse.redirect(authUrl);
  ensureEbayUserId(req, res);

  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 60 * 10,
  });
  res.cookies.set(RETURN_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 60 * 10,
  });

  return res;
}


