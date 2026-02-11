import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    try {
        const kv = getKvClient();
        const oldKey = "orders:all";
        const newKey = "orders:square:imported";

        const oldOrders: any[] = await kv.get(oldKey) || [];
        if (oldOrders.length === 0) {
            return NextResponse.json({ message: "No orders found in legacy storage." });
        }

        const currentOrders: any[] = await kv.get(newKey) || [];

        // Merge and dedup by ID
        const merged = [...oldOrders, ...currentOrders];
        const unique = Array.from(new Map(merged.map(o => [o.id, o])).values());

        // Sort by created date (newest first)
        unique.sort((a, b) => (b.created || 0) - (a.created || 0));

        await kv.set(newKey, unique);

        // Clean up old key? Maybe leave it just in case, but we can clear it if we're sure
        // await kv.del(oldKey);

        return NextResponse.json({
            success: true,
            mergedCount: oldOrders.length,
            totalCount: unique.length,
            message: "Legacy orders have been merged into the dashboard list."
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
