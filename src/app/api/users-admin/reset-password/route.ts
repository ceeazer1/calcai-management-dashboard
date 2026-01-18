import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";

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

        let data;
        const text = await r.text();
        try {
            data = JSON.parse(text);
        } catch {
            data = { error: text || r.statusText };
        }

        if (!r.ok) {
            console.error("[users-admin/reset-password] Upstream error:", r.status, text);
            return NextResponse.json({ ok: false, error: data.error || "upstream_error" }, { status: r.status });
        }

        // Intercept: If worker returned a debug token (since it doesn't send email yet), we send it here
        if (data.ok && data.debug_token) {
            try {
                await sendPasswordResetEmail(email, data.debug_token);
                // Clear the token from response so we don't leak it back to client if not needed
                delete data.debug_token;
                data.message = "Password reset email sent (handled by dashboard)";
            } catch (err) {
                console.error("Failed to send reset email from dashboard:", err);
                // Still return ok=true because token was generated, but maybe warn
            }
        }

        return NextResponse.json(data, { status: r.status });
    } catch (e) {
        console.error("[users-admin/reset-password] error:", e);
        return NextResponse.json({ ok: false, error: "proxy_error" }, { status: 500 });
    }
}
