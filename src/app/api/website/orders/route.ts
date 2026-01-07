import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";

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

        // Load current cached orders
        const existing = await kv.get<any[]>(SQUARE_ORDERS_KEY) || [];

        // Check if the order already exists to avoid duplicates
        const exists = existing.some(o => o.id === order.id);

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
