import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    const kv = getKvClient();
    const approved = await kv.get("clawdbot:ebay_approved") as any[];
    return NextResponse.json({ ok: true, items: approved || [] });
}

export async function DELETE(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId } = await req.json();
        const approved = (await kv.get("clawdbot:ebay_approved") as any[]) || [];
        const updated = approved.filter((i: any) => i.itemId !== itemId);
        await kv.set("clawdbot:ebay_approved", updated);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
