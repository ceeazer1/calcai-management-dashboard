import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

// POST: add/update tracking on a bought item
export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId, tracking, carrier } = await req.json();
        if (!itemId) return NextResponse.json({ ok: false, message: "Missing itemId" }, { status: 400 });

        const idMatch = (a: string, b: string) => String(a) === String(b) || String(a).includes(String(b)) || String(b).includes(String(a));

        const bought = (await kv.get("clawdbot:ebay_bought") as any[]) || [];
        let found = false;
        const updated = bought.map((item: any) => {
            if (idMatch(item.itemId, itemId)) {
                found = true;
                return { ...item, tracking: tracking || item.tracking, carrier: carrier || item.carrier, shippedAt: Date.now() };
            }
            return item;
        });

        if (found) {
            await kv.set("clawdbot:ebay_bought", updated);
        }

        return NextResponse.json({ ok: true, updated: found });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
