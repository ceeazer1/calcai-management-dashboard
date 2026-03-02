import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    const kv = getKvClient();
    const [picks, dismissed] = await Promise.all([
        kv.get("clawdbot:ebay_picks") as Promise<any[]>,
        kv.get("clawdbot:ebay_dismissed") as Promise<string[]>,
    ]);
    const dismissedSet = new Set(dismissed || []);
    // Filter out dismissed items so they never reappear
    const filtered = (picks || []).filter((p: any) => !dismissedSet.has(p.itemId));
    return NextResponse.json({ ok: true, items: filtered });
}

export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { items } = await req.json();
        if (!Array.isArray(items)) {
            return NextResponse.json({ ok: false, message: "items must be an array" }, { status: 400 });
        }
        await kv.set("clawdbot:ebay_picks", items);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
