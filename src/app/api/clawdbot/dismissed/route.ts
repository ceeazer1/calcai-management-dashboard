import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

// GET: list all dismissed item IDs
export async function GET() {
    const kv = getKvClient();
    const dismissed = await kv.get("clawdbot:ebay_dismissed") as string[];
    return NextResponse.json({ ok: true, items: dismissed || [] });
}

// POST: add itemId to dismissed list
export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId } = await req.json();
        if (!itemId) return NextResponse.json({ ok: false, message: "Missing itemId" }, { status: 400 });

        const dismissed = (await kv.get("clawdbot:ebay_dismissed") as string[]) || [];
        if (!dismissed.includes(itemId)) {
            dismissed.push(itemId);
            await kv.set("clawdbot:ebay_dismissed", dismissed.slice(-5000)); // keep last 5000
        }

        // Also remove from active picks
        const picks = (await kv.get("clawdbot:ebay_picks") as any[]) || [];
        await kv.set("clawdbot:ebay_picks", picks.filter((p: any) => p.itemId !== itemId));

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
