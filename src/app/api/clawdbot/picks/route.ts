import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    const kv = getKvClient();
    const [picks, dismissed, approved, offered, bought] = await Promise.all([
        kv.get("clawdbot:ebay_picks") as Promise<any[]>,
        kv.get("clawdbot:ebay_dismissed") as Promise<string[]>,
        kv.get("clawdbot:ebay_approved") as Promise<any[]>,
        kv.get("clawdbot:ebay_offered") as Promise<any[]>,
        kv.get("clawdbot:ebay_bought") as Promise<any[]>,
    ]);

    // Build a master blocklist of item IDs currently in any stage of the pipeline
    const blocklist = new Set<string>(dismissed || []);

    // Helper to safely extract IDs and handle different ID formats
    const addToBlocklist = (list: any[]) => {
        (list || []).forEach(item => {
            if (item.itemId) blocklist.add(String(item.itemId));
            // Also handle cases where the itemId might contain 'v1|ID|0' format
            if (typeof item.itemId === 'string' && item.itemId.includes('|')) {
                const parts = item.itemId.split('|');
                if (parts.length >= 2) blocklist.add(parts[1]);
            }
        });
    };

    addToBlocklist(approved);
    addToBlocklist(offered);
    addToBlocklist(bought);

    // Filter out items so they never reappear if they've been moved or dismissed
    const filtered = (picks || []).filter((p: any) => {
        const id = String(p.itemId);
        let numericId = id;
        if (id.includes('|')) {
            numericId = id.split('|')[1];
        }
        return !blocklist.has(id) && !blocklist.has(numericId);
    });

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
