import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { loadUserTokenRecord } from "@/lib/ebay-user-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  const rec = await loadUserTokenRecord(uid).catch(() => null);
  const now = Date.now();
  const connected = !!rec && !!rec.refreshToken && (rec.refreshTokenExpiresAt === 0 || rec.refreshTokenExpiresAt > now);

  const res = NextResponse.json({
    ok: true,
    connected,
    accessTokenExpiresAt: rec?.accessTokenExpiresAt || null,
    refreshTokenExpiresAt: rec?.refreshTokenExpiresAt || null,
    scope: rec?.scope || null,
  });
  if (!existingUid) setEbayUserIdCookie(res, uid);
  res.headers.set("Cache-Control", "no-store");
  return res;
}







