import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getEndpointUrl(req: NextRequest) {
  // Must match exactly what eBay has on file (scheme + host + path, no querystring)
  return `${req.nextUrl.origin}${req.nextUrl.pathname}`;
}

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code") || "";
  if (!challengeCode) {
    return NextResponse.json({ error: "Missing challenge_code" }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN || "";
  if (!verificationToken) {
    return NextResponse.json(
      { error: "Server misconfigured: missing EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN" },
      { status: 500 },
    );
  }

  const endpoint = getEndpointUrl(req);
  const challengeResponse = crypto
    .createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpoint)
    .digest("hex");

  // eBay expects: { "challengeResponse": "<sha256 hex>" }
  return NextResponse.json({ challengeResponse }, { status: 200 });
}

export async function POST(req: NextRequest) {
  // eBay will POST account deletion notifications here after verification.
  // If you store any user data tied to the notified user, delete it here.
  const payload = await req.json().catch(() => null);
  console.log("eBay account deletion notification received", payload);
  return NextResponse.json({ ok: true }, { status: 200 });
}


