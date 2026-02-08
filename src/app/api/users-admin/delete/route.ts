import { NextResponse } from "next/server";

const EDGE_BASE = process.env.EDGE_WORKER_URL || "https://ai.calcai.cc";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const email = body.email;
        if (!email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });

        const r = await fetch(`${EDGE_BASE}/ai/admin/user/delete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Token": ADMIN_TOKEN
            },
            body: JSON.stringify({ email }),
            cache: "no-store",
        });

        const data = await r.json();
        return NextResponse.json(data, { status: r.status });
    } catch (e) {
        console.error("[users-admin/delete] error:", e);
        return NextResponse.json({ ok: false, error: "proxy_error" }, { status: 500 });
    }
}
