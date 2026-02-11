import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";

// BTCPay Server Configuration
const BTCPAY_URL = "https://btc.calcai.cc";
const BTCPAY_STORE_ID = "6kZiuhRu7hMzr18iMCdTgum78M8pYNxAjmsNDKkDGuLD";
const BTCPAY_API_KEY = "061cdfa6f84d09babffd6160a0d2b3ee937b30a7";

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

        // 1. Create Invoice in BTCPay Server
        let invoiceId = null;
        try {
            const btcpayResponse = await fetch(`${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`, {
                method: "POST",
                headers: {
                    "Authorization": `token ${BTCPAY_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: order.amount / 100, // Convert cents to dollars
                    currency: (order.currency || "USD").toUpperCase(),
                    metadata: {
                        orderId: order.id || `web_${Date.now()}`,
                        customerName: order.customerName,
                        customerEmail: order.customerEmail,
                        items: order.items
                    },
                    checkout: {
                        speedPolicy: "HighSpeed",
                        paymentMethods: ["BTC"], // Requesting only on-chain BTC for maximum compatibility
                        expirationMinutes: 90,
                        monitoringMinutes: 90,
                        paymentTolerance: 0,
                        redirectAutomatically: false
                    }
                })
            });

            if (btcpayResponse.ok) {
                const btcpayData = await btcpayResponse.json();
                invoiceId = btcpayData.id;
                console.log(`[api/website/orders] BTCPay Invoice created: ${invoiceId}`);
            } else {
                const errorData = await btcpayResponse.json();
                console.error(`[api/website/orders] BTCPay Error Status: ${btcpayResponse.status}`);
                console.error(`[api/website/orders] BTCPay Error Details:`, JSON.stringify(errorData));

                if (btcpayResponse.status === 422) {
                    console.error("[api/website/orders] 422 Error - Check Store Price Provider and Wallet.");
                }
            }
        } catch (btcpayErr) {
            console.error("[api/website/orders] Failed to connect to BTCPay:", btcpayErr);
            // We continue anyway to allow for emergency manual payments
        }

        const kv = getKvClient();

        // 2. Generate a local tracking ID
        const localOrderId = `btc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // 3. Store order in KV
        const orderRecord = {
            id: localOrderId,
            btcpayInvoiceId: invoiceId,
            type: "btc",
            created: Math.floor(Date.now() / 1000),
            amount: order.amount,
            currency: order.currency || "usd",
            status: "pending",
            paymentStatus: "awaiting_payment",
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            shippingAddress: order.shippingAddress,
            shippingMethod: order.shippingMethod,
            items: order.items || [],
            paymentMethod: "BTC",
            notes: order.notes,
        };

        const ordersKey = "orders:all";
        const existingOrders = await kv.get(ordersKey) || [];
        const ordersList = Array.isArray(existingOrders) ? existingOrders : [];
        ordersList.unshift(orderRecord);
        await kv.set(ordersKey, ordersList);
        await kv.set(`order:${localOrderId}`, orderRecord);

        // 4. Send confirmation email (only for non-BTC orders initially)
        // For BTC, we wait until payment is confirmed to send the "Order Confirmed" email
        if (order.paymentMethod !== "BTC") {
            try {
                await sendOrderConfirmationEmail({
                    to: order.customerEmail,
                    customerName: order.customerName || "Customer",
                    orderId: localOrderId,
                    amount: order.amount,
                    currency: order.currency || "usd",
                    items: order.items || [],
                    paymentMethod: order.paymentMethod || "Credit Card",
                    shippingMethod: order.shippingMethod
                });
            } catch (emailErr) {
                console.error("[api/website/orders] Email failed:", emailErr);
            }
        }

        return corsResponse({
            ok: true,
            orderId: localOrderId,
            invoiceId: invoiceId,
            message: invoiceId ? "Invoice created" : "Order created (BTCPay Error)"
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
