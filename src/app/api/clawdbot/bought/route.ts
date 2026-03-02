import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

// GET: list bought items
export async function GET() {
    const kv = getKvClient();
    const bought = await kv.get("clawdbot:ebay_bought") as any[];
    return NextResponse.json({ ok: true, items: bought || [] });
}

// POST: move an item to bought
export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId, pricePaid } = await req.json();
        if (!itemId) return NextResponse.json({ ok: false, message: "Missing itemId" }, { status: 400 });

        // Check offered list first
        const offered = (await kv.get("clawdbot:ebay_offered") as any[]) || [];
        const item = offered.find((o: any) => o.itemId === itemId);

        // Add to bought
        const bought = (await kv.get("clawdbot:ebay_bought") as any[]) || [];
        if (!bought.some((b: any) => b.itemId === itemId)) {
            bought.push({ ...(item || { itemId }), pricePaid, boughtAt: Date.now() });
            await kv.set("clawdbot:ebay_bought", bought);
        }

        // Remove from offered
        await kv.set("clawdbot:ebay_offered", offered.filter((o: any) => o.itemId !== itemId));

        // Also remove from approved just in case
        const approved = (await kv.get("clawdbot:ebay_approved") as any[]) || [];
        await kv.set("clawdbot:ebay_approved", approved.filter((a: any) => a.itemId !== itemId));

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}

// DELETE: remove from bought
export async function DELETE(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId } = await req.json();
        const bought = (await kv.get("clawdbot:ebay_bought") as any[]) || [];
        await kv.set("clawdbot:ebay_bought", bought.filter((i: any) => i.itemId !== itemId));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
