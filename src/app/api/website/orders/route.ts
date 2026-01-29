import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";

function corsResponse(data: any, status: number = 200) {
    const body = JSON.stringify(data);
    const response = new NextResponse(body, {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        }
    });
    return response;
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("x-api-key");
        const secureKey = process.env.WEBSITE_API_KEY || "CALCAI_SECURE_PUSH_2026";

        if (!authHeader || authHeader !== secureKey) {
            return corsResponse({ error: "Unauthorized" }, 401);
        }

        const body = await req.json();
        const { order } = body;

        if (!order) {
            return corsResponse({ error: "Invalid order data" }, 400);
        }

        const kv = getKvClient();

        // Generate a unique order ID
        const orderId = `btc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Store order in KV with pending status (awaiting BTC payment)
        const orderRecord = {
            id: orderId,
            type: "btc",
            created: Math.floor(Date.now() / 1000),
            amount: order.amount,
            currency: order.currency || "usd",
            status: "pending", // Will be updated to "complete" when BTC payment confirmed
            paymentStatus: "awaiting_payment",
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            shippingAddress: order.shippingAddress,
            shippingMethod: order.shippingMethod,
            items: order.items || [],
            paymentMethod: order.paymentMethod || "BTC",
            notes: order.notes,
        };

        // Store in KV
        const ordersKey = "orders:all";
        const existingOrders = await kv.get(ordersKey) || [];
        const ordersList = Array.isArray(existingOrders) ? existingOrders : [];
        ordersList.unshift(orderRecord);
        await kv.set(ordersKey, ordersList);

        // Also store individually for quick lookup
        await kv.set(`order:${orderId}`, orderRecord);

        console.log(`[api/website/orders] BTC Order created: ${orderId}`);

        // TODO: Integrate with BTCPay Server to create invoice
        // For now, return success with order ID
        // In a full implementation, you would:
        // 1. Call BTCPay API to create an invoice
        // 2. Return the invoice ID for the frontend to display
        // 3. Set up a webhook to receive payment confirmations from BTCPay

        // Send confirmation email (order received, awaiting payment)
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
        } catch (emailErr) {
            console.error("[api/website/orders] Email failed:", emailErr);
        }

        return corsResponse({
            ok: true,
            orderId: orderId,
            // invoiceId: null, // Will be populated when BTCPay is integrated
            message: "Order created successfully. Awaiting BTC payment."
        });

    } catch (e: any) {
        console.error("[api/website/orders] fatal error:", e);
        return corsResponse({
            error: "Internal Server Error",
            message: e.message || String(e)
        }, 500);
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    return response;
}
