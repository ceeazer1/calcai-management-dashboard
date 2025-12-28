import type { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const EBAY_UID_COOKIE = "calcai_ebay_uid";

export function createEbayUserId(): string {
  return randomUUID();
}

export function setEbayUserIdCookie(res: NextResponse, uid: string) {
  res.cookies.set(EBAY_UID_COOKIE, uid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function getEbayUserId(req: NextRequest): string | null {
  const v = req.cookies.get(EBAY_UID_COOKIE)?.value;
  return v && v.length >= 16 ? v : null;
}

export function ensureEbayUserId(req: NextRequest, res: NextResponse): string {
  const existing = getEbayUserId(req);
  if (existing) return existing;
  const uid = createEbayUserId();
  setEbayUserIdCookie(res, uid);
  return uid;
}


