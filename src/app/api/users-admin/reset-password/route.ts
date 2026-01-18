import { NextRequest, NextResponse } from "next/server";

const EDGE_BASE = process.env.EDGE_WORKER_URL || "https://ai.calcai.cc";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
        }

        const r = await fetch(`${EDGE_BASE}/ai/admin/reset-password`, {
            method: "POST",
            headers: {
                "X-Admin-Token": ADMIN_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email }),
            cache: "no-store",
        });

        const data = await r.json();
        return NextResponse.json(data, { status: r.status });
    } catch (e) {
        console.error("[users-admin/reset-password] error:", e);
        return NextResponse.json({ ok: false, error: "proxy_error" }, { status: 500 });
    }
}
