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

        // 1. Create a Square Order first (so all details are in Square)
        const square = getSquareClient();
        if (!square) {
            console.error("[api/website/orders] Square client initialization failed");
            return corsResponse({ error: "Square not configured on server" }, 500);
        }

        try {
            const locationId = process.env.SQUARE_LOCATION_ID || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
            if (!locationId) {
                return corsResponse({ error: "Missing Location ID" }, 500);
            }

            // Construct Line Items
            const lineItems = (order.items || []).map((item: any) => ({
                name: item.description,
                quantity: String(item.quantity || "1"),
                basePriceMoney: {
                    amount: BigInt(Math.round(Number(item.amount))),
                    currency: (order.currency || 'USD').toUpperCase()
                }
            }));

            // Add Shipping as a line item if not already included
            const shippingAmount = order.amount - (order.items || []).reduce((sum: number, i: any) => sum + (i.amount * i.quantity), 0);
            if (shippingAmount > 0) {
                lineItems.push({
                    name: `Shipping (${order.shippingMethod || 'Standard'})`,
                    quantity: "1",
                    basePriceMoney: {
                        amount: BigInt(Math.round(shippingAmount)),
                        currency: (order.currency || 'USD').toUpperCase()
                    }
                });
            }

            // Create the order in Square
            const orderRequest = {
                order: {
                    locationId: locationId,
                    lineItems,
                    customerId: order.customerId,
                    fulfillments: [{
                        type: 'SHIPMENT',
                        state: 'PROPOSED',
                        shipmentDetails: {
                            recipient: {
                                displayName: order.customerName,
                                emailAddress: order.customerEmail,
                                address: {
                                    addressLine1: order.shippingAddress?.line1,
                                    addressLine2: order.shippingAddress?.line2,
                                    locality: order.shippingAddress?.city,
                                    administrativeDistrictLevel1: order.shippingAddress?.state,
                                    postalCode: order.shippingAddress?.postal_code || order.shippingAddress?.zip,
                                    country: (order.shippingAddress?.country || 'US').toUpperCase()
                                }
                            }
                        }
                    }],
                    note: order.notes || `Order via Website`
                },
                idempotencyKey: `${order.id}_order`
            };

            const orderResponse = await square.orders.create(orderRequest as any);
            const squareOrder = (orderResponse as any).result?.order || orderResponse.order;

            // 2. Process the payment linked to this order
            const amountCents = BigInt(Math.round(Number(order.amount)));
            const paymentResponse = await square.payments.create({
                sourceId: order.id,
                idempotencyKey: order.id,
                locationId: locationId,
                orderId: squareOrder.id, // LINK THE PAYMENT TO THE ORDER
                amountMoney: {
                    amount: amountCents,
                    currency: (order.currency || 'USD').toUpperCase()
                },
                buyerEmailAddress: order.customerEmail,
                note: `Order: ${order.customerEmail}`
            });

            const payment = (paymentResponse as any).result?.payment || paymentResponse.payment;

            if (!payment || (payment.status !== 'COMPLETED' && payment.status !== 'APPROVED')) {
                return corsResponse({ error: "Payment failed", status: payment?.status }, 400);
            }

            console.log(`[api/website/orders] Square Order & Payment successful: ${squareOrder.id}`);

            // 3. Send confirmation email (immediate notification)
            try {
                const shippingMethod = order.notes?.includes("Shipping via")
                    ? order.notes.split("Shipping via ")[1]
                    : undefined;

                await sendOrderConfirmationEmail({
                    to: order.customerEmail,
                    customerName: order.customerName || "Customer",
                    orderId: squareOrder.id, // Use Square Order ID here
                    amount: order.amount,
                    currency: order.currency || "usd",
                    items: order.items || [],
                    paymentMethod: order.paymentMethod,
                    shippingMethod: shippingMethod
                });
            } catch (emailErr) {
                console.error("[api/website/orders] Email failed:", emailErr);
            }

            return corsResponse({ ok: true, orderId: squareOrder.id });

        } catch (err: any) {
            console.error("[api/website/orders] Square Transaction Error:", err);
            const errors = err.errors || err.result?.errors;
            return corsResponse({
                error: errors?.[0]?.detail || err.message || "Transaction failed"
            }, 400);
        }
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
