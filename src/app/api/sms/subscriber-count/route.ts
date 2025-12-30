import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Ensure WEBSITE_URL has https:// prefix
const rawUrl = (process.env.WEBSITE_URL || "https://www.calcai.cc").replace(/\/+$/, "");
const WEBSITE_BASE = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN || "";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "subscribed").trim();

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    // We only need the count; keep payload minimal.
    params.set("limit", "1");
    params.set("offset", "0");

    const r = await fetch(`${WEBSITE_BASE}/api/admin/sms/subscribers?${params.toString()}`, {
      headers: ADMIN_API_TOKEN ? { "x-admin-token": ADMIN_API_TOKEN } : {},
      cache: "no-store",
    });

    const txt = await r.text();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "fetch_failed", status: r.status, body: txt }, { status: r.status || 502 });
    }

    const j = JSON.parse(txt);
    const total = Number(j?.total || 0);
    return NextResponse.json({ ok: true, total: Number.isFinite(total) ? total : 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sms/subscriber-count] Error:", msg);
    return NextResponse.json({ ok: false, error: "server_error", message: msg }, { status: 500 });
  }
}





