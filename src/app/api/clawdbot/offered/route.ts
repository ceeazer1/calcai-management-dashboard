import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

// GET: list items with offers placed (waiting for seller response)
export async function GET() {
    const kv = getKvClient();
    const offered = await kv.get("clawdbot:ebay_offered") as any[];
    return NextResponse.json({ ok: true, items: offered || [] });
}

// POST: move an item from approved → offered
export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId, offerAmount } = await req.json();
        if (!itemId) return NextResponse.json({ ok: false, message: "Missing itemId" }, { status: 400 });

        // Fuzzy match: eBay API uses "v1|123456|0" but URL-based IDs are just "123456"
        const idMatch = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

        // Get the item from approved (try exact then fuzzy match)
        const approved = (await kv.get("clawdbot:ebay_approved") as any[]) || [];
        const item = approved.find((a: any) => idMatch(a.itemId, itemId));

        // Add to offered list
        const offered = (await kv.get("clawdbot:ebay_offered") as any[]) || [];
        if (!offered.some((o: any) => idMatch(o.itemId, itemId))) {
            offered.push({ ...(item || { itemId }), offerAmount, offeredAt: Date.now() });
            await kv.set("clawdbot:ebay_offered", offered);
        }

        // Remove from approved
        await kv.set("clawdbot:ebay_approved", approved.filter((a: any) => !idMatch(a.itemId, itemId)));

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}

// DELETE: remove from offered
export async function DELETE(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId } = await req.json();
        const offered = (await kv.get("clawdbot:ebay_offered") as any[]) || [];
        await kv.set("clawdbot:ebay_offered", offered.filter((i: any) => i.itemId !== itemId));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
