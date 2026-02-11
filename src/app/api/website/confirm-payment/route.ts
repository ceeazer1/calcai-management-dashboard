import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";

function corsResponse(data: any, status: number = 200) {
    return new NextResponse(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        }
    });
}

export async function OPTIONS() {
    return corsResponse({}, 200);
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("x-api-key");
        const secureKey = process.env.WEBSITE_API_KEY || "CALCAI_SECURE_PUSH_2026";

        if (!authHeader || authHeader !== secureKey) {
            return corsResponse({ error: "Unauthorized" }, 401);
        }

        const { orderId, txId } = await req.json();

        if (!orderId) {
            return corsResponse({ error: "Missing orderId" }, 400);
        }

        const kv = getKvClient();
        const orderKey = `order:${orderId}`;
        const order: any = await kv.get(orderKey);

        if (!order) {
            return corsResponse({ error: " Order not found" }, 404);
        }

        // Only process if it's not already paid
        if (order.status === "paid") {
            return corsResponse({ ok: true, message: "Already paid" });
        }

        // Update order status
        order.status = "paid";
        order.paymentStatus = "paid";
        order.notes = (order.notes || "") + `\n[Auto-Confirmed via Blockchain Watcher] TX: ${txId || "unknown"}`;

        await kv.set(orderKey, order);

        // Update in the main list too
        const ordersKey = "orders:square:imported";
        const orders: any[] = await kv.get(ordersKey) || [];
        const index = orders.findIndex(o => o.id === orderId);
        if (index !== -1) {
            orders[index].status = "paid";
            orders[index].paymentStatus = "paid";
            await kv.set(ordersKey, orders);
        }

        // NOW send the confirmation email
        try {
            await sendOrderConfirmationEmail({
                to: order.customerEmail,
                customerName: order.customerName || "Customer",
                orderId: orderId,
                amount: order.amount,
                currency: order.currency || "usd",
                items: order.items || [],
                paymentMethod: "Bitcoin",
                shippingMethod: order.shippingMethod
            });
            console.log(`[confirm-payment] Email sent for order ${orderId}`);
        } catch (emailErr) {
            console.error("[confirm-payment] Email failed:", emailErr);
        }

        return corsResponse({ ok: true, message: "Payment confirmed and email sent" });
    } catch (err: any) {
        console.error("[confirm-payment] Error:", err);
        return corsResponse({ error: err.message }, 500);
    }
}
