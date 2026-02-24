import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    const kv = getKvClient();
    const picks = await kv.get("clawdbot:ebay_picks") as any[];
    return NextResponse.json({ ok: true, items: picks || [] });
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
