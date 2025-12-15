import { NextRequest, NextResponse } from "next/server";

const EDGE_BASE = process.env.EDGE_WORKER_URL || "https://ai.calcai.cc";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mac: string }> }
) {
  try {
    const { mac } = await params;
    const r = await fetch(`${EDGE_BASE}/ai/admin/model/${encodeURIComponent(mac)}`, {
      headers: { "X-Admin-Token": ADMIN_TOKEN },
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    console.error("[users-admin/model] error:", e);
    return NextResponse.json({ ok: false, error: "proxy_error" }, { status: 500 });
  }
}

