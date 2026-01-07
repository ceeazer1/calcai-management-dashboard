import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSquareClient } from "@/lib/square";

const SQUARE_ORDERS_KEY = "orders:square:imported";

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("x-api-key");
        const secureKey = process.env.WEBSITE_API_KEY || "CALCAI_SECURE_PUSH_2026";

        if (!authHeader || authHeader !== secureKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { order } = body;

        if (!order || !order.id) {
            return NextResponse.json({ error: "Invalid order data" }, { status: 400 });
        }

        const kv = getKvClient();

        // 1. Actually process the payment with Square
        const square = getSquareClient();
        if (!square) {
            return NextResponse.json({ error: "Square not configured" }, { status: 500 });
        }

        try {
            // Create the payment using the token as sourceId
            const response = await square.payments.create({
                sourceId: order.id, // This is the token from the frontend
                idempotencyKey: order.id + "_charge",
                amountMoney: {
                    amount: BigInt(order.amount),
                    currency: (order.currency || 'USD').toUpperCase()
                },
                note: `CalcAI Order: ${order.customerEmail}`
            });

            const payment = response.payment;

            // Check if payment was successful
            if (payment?.status !== 'COMPLETED' && payment?.status !== 'APPROVED') {
                return NextResponse.json({
                    error: "Payment declined or failed",
                    status: payment?.status
                }, { status: 400 });
            }

            console.log(`[api/website/orders] Square payment successful: ${payment.id}`);

            // Update the order ID and status
            order.squarePaymentId = payment.id;
            order.paymentStatus = payment.status;

        } catch (squareErr: any) {
            const error = squareErr.errors ? squareErr.errors[0] : squareErr;
            console.error("[api/website/orders] Square Payment Error:", error);
            return NextResponse.json({
                error: error.detail || "Payment failed",
                code: error.code
            }, { status: 400 });
        }

        // 2. Save to KV and send email
        // Load current cached orders
        const existing = await kv.get<any[]>(SQUARE_ORDERS_KEY) || [];

        // Check if the order already exists to avoid duplicates
        const exists = existing.some(o => o.id === order.id || (o.squarePaymentId && o.squarePaymentId === order.squarePaymentId));

        if (!exists) {
            // Prepend the new order so it shows at the top
            const newOrder = {
                ...order,
                type: "square", // Categorize as square for filtering
                created: order.created || Math.floor(Date.now() / 1000),
                paymentStatus: order.paymentStatus || "COMPLETED",
                status: order.status || "complete"
            };

            existing.unshift(newOrder);
            await kv.set(SQUARE_ORDERS_KEY, existing);

            // Send confirmation email automatically
            try {
                const shippingMethod = order.notes?.includes("Shipping via")
                    ? order.notes.split("Shipping via ")[1]
                    : undefined;

                await sendOrderConfirmationEmail({
                    to: order.customerEmail,
                    customerName: order.customerName || "Customer",
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency || "usd",
                    items: order.items || [],
                    paymentMethod: order.paymentMethod,
                    shippingMethod: shippingMethod
                });
                console.log(`[api/website/orders] Confirmation email sent to ${order.customerEmail}`);
            } catch (emailErr) {
                console.error("[api/website/orders] Failed to send confirmation email:", emailErr);
            }
        }

        const response = NextResponse.json({ ok: true, orderId: order.id });

        // Add CORS headers for the website domain
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");

        return response;
    } catch (e) {
        console.error("[api/website/orders] POST error:", e);
        return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    return response;
}
