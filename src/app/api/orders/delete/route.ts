import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

const CUSTOM_ORDERS_KEY = "orders:custom:list";
const SQUARE_ORDERS_KEY = "orders:square:imported";

export async function DELETE(req: NextRequest) {
    try {
        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json({ error: "orderId required" }, { status: 400 });
        }

        const kv = getKvClient();
        let deleted = false;

        // 1. Try to delete from Custom Orders
        const customOrders = await kv.get<any[]>(CUSTOM_ORDERS_KEY) || [];
        const updatedCustom = customOrders.filter(o => o.id !== orderId);

        if (updatedCustom.length !== customOrders.length) {
            await kv.set(CUSTOM_ORDERS_KEY, updatedCustom);
            deleted = true;
        }

        // 2. Try to delete from Square Orders (The cache)
        const squareOrders = await kv.get<any[]>(SQUARE_ORDERS_KEY) || [];
        const updatedSquare = squareOrders.filter(o => o.id !== orderId);

        if (updatedSquare.length !== squareOrders.length) {
            await kv.set(SQUARE_ORDERS_KEY, updatedSquare);
            deleted = true;
        }

        if (deleted) {
            // Also cleanup shipment info
            await kv.del(`orders:shipment:${orderId}`);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: "Order not found in any list" }, { status: 404 });
    } catch (e: any) {
        console.error("[api/orders/delete] DELETE error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
