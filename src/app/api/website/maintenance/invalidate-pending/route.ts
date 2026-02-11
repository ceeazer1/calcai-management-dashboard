import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function GET() {
    try {
        const kv = getKvClient();
        const ordersKey = "orders:square:imported";
        const orders: any[] = await kv.get(ordersKey) || [];

        if (orders.length === 0) {
            return NextResponse.json({ message: "No orders found." });
        }

        let updatedCount = 0;
        const updatedOrders = orders.map(order => {
            // If order is more than 2 hours old and still pending/awaiting_payment, mark as expired
            const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 60 * 60);

            if ((order.status === "pending" || order.paymentStatus === "awaiting_payment") && order.created < twoHoursAgo) {
                updatedCount++;
                return {
                    ...order,
                    status: "expired",
                    paymentStatus: "expired",
                    notes: (order.notes || "") + "\n[Auto-Invalidated via Maintenance Script]"
                };
            }
            return order;
        });

        if (updatedCount > 0) {
            await kv.set(ordersKey, updatedOrders);
        }

        return NextResponse.json({
            success: true,
            invalidatedCount: updatedCount,
            totalCount: orders.length,
            message: `Marked ${updatedCount} old pending orders as expired.`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
