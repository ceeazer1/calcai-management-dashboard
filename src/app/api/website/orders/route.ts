import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSquareClient } from "@/lib/square";

const WEBSITE_ORDERS_KEY = "orders:website:list";

function corsResponse(data: any, status: number = 200) {
    const response = NextResponse.json(data, { status });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
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

        if (!order || !order.id) {
            return corsResponse({ error: "Invalid order data" }, 400);
        }

        const kv = getKvClient();

        // 1. Actually process the payment with Square
        const square = getSquareClient();
        if (!square) {
            console.error("[api/website/orders] Square client initialization failed - check Access Token");
            return corsResponse({ error: "Square not configured on server" }, 500);
        }

        try {
            // Ensure amount is a whole number (cents)
            const rawAmount = Number(order.amount || 0);
            const amountCents = BigInt(Math.round(rawAmount));
            const locationId = process.env.SQUARE_LOCATION_ID || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

            if (!locationId) {
                console.error("[api/website/orders] Missing Location ID");
                return corsResponse({ error: "Server Configuration Error: Missing Location ID" }, 500);
            }

            console.log(`[api/website/orders] Attempting Square payment. Location: ${locationId}, Amount: ${amountCents}`);

            // Create the payment using the token as sourceId
            // The token itself (order.id) is unique and makes a great idempotency key.
            // Square limits idempotency keys to 45 chars.
            const squareAddress = order.shippingAddress ? {
                addressLine1: order.shippingAddress.line1,
                addressLine2: order.shippingAddress.line2,
                locality: order.shippingAddress.city,
                administrativeDistrictLevel1: order.shippingAddress.state,
                postalCode: order.shippingAddress.postal_code || order.shippingAddress.zip,
                country: (order.shippingAddress.country || 'US').toUpperCase()
            } : undefined;

            const squareResponse = await square.payments.create({
                sourceId: order.id,
                idempotencyKey: order.id, // Use the token as the key (it's unique and < 45 chars)
                locationId: locationId,
                amountMoney: {
                    amount: amountCents,
                    currency: (order.currency || 'USD').toUpperCase()
                },
                buyerEmailAddress: order.customerEmail,
                shippingAddress: squareAddress,
                note: `CalcAI Order: ${order.customerEmail}`
            });

            // The Square SDK returns a 'result' object in newer versions
            const result = (squareResponse as any).result || squareResponse;
            const payment = result.payment;

            if (!payment || (payment.status !== 'COMPLETED' && payment.status !== 'APPROVED')) {
                console.error("[api/website/orders] Square payment check failed. Status:", payment?.status);
                return corsResponse({
                    error: "Payment declined or skipped by Square",
                    status: payment?.status
                }, 400);
            }

            console.log(`[api/website/orders] Square payment successful: ${payment.id}`);

            // Store strings only to avoid BigInt serialization errors with KV/JSON
            order.squarePaymentId = String(payment.id);
            order.paymentStatus = String(payment.status);

        } catch (squareErr: any) {
            console.error("[api/website/orders] Square SDK Exception:", squareErr);
            // Extract specific error if available
            const squareErrors = squareErr.errors || (squareErr.result?.errors);
            const errorDetail = squareErrors?.[0]?.detail || squareErr.message || "Payment processing failed";

            return corsResponse({
                error: errorDetail,
                code: squareErrors?.[0]?.code
            }, 400);
        }

        // 2. Save to KV and send email
        // Load current cached orders
        const existing = await kv.get<any[]>(WEBSITE_ORDERS_KEY) || [];

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
            await kv.set(WEBSITE_ORDERS_KEY, existing);

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

        return corsResponse({ ok: true, orderId: order.id });
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
