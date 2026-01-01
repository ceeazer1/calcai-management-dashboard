import { NextRequest, NextResponse } from "next/server";
import { createEbayUserId, getEbayUserId, setEbayUserIdCookie } from "@/lib/ebay-user";
import { deleteUserTokenRecord } from "@/lib/ebay-user-token";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const existingUid = getEbayUserId(req);
  const uid = existingUid || createEbayUserId();

  await deleteUserTokenRecord(uid).catch(() => {});

  const res = NextResponse.json({ ok: true, disconnected: true });
  if (!existingUid) setEbayUserIdCookie(res, uid);
  res.headers.set("Cache-Control", "no-store");
  return res;
}







