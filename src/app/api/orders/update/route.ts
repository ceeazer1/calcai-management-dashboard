import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

const CUSTOM_ORDERS_KEY = "orders:custom:list";
const SQUARE_ORDERS_KEY = "orders:square:imported";
const WEBSITE_ORDERS_KEY = "orders:website:list";
const MANUAL_EDITS_KEY = "orders:manual:overrides"; // Persistent storage for manual edits

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, updates } = body;

        if (!orderId || !updates) {
            return NextResponse.json({ error: "Missing orderId or updates" }, { status: 400 });
        }

        const kv = getKvClient();

        // Load existing manual overrides
        const manualEdits = await kv.get<Record<string, any>>(MANUAL_EDITS_KEY) || {};

        // Merge the updates into the override for this specific order
        manualEdits[orderId] = {
            ...(manualEdits[orderId] || {}),
            ...updates,
            lastEdited: Date.now(),
        };

        // Save back to KV
        await kv.set(MANUAL_EDITS_KEY, manualEdits);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[api/orders/update] error:", e);
        return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
    }
}
