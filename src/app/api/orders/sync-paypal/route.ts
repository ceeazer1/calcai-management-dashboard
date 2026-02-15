import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { getPayPalAccessToken } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const kv = getKvClient();
        const accessToken = await getPayPalAccessToken();

        const isSandbox = !process.env.PAYPAL_CLIENT_ID?.startsWith('AR');
        const baseUrl = isSandbox
            ? "https://api-m.sandbox.paypal.com"
            : "https://api-m.paypal.com";

        // 1. Fetch recent transactions from PayPal
        // We look for 'CAPTURE' transactions in the last few days
        const searchUrl = new URL(`${baseUrl}/v1/reporting/transactions`);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // Sync last 7 days
        searchUrl.searchParams.set('start_date', startDate.toISOString().split('.')[0] + 'Z');
        searchUrl.searchParams.set('end_date', new Date().toISOString().split('.')[0] + 'Z');
        searchUrl.searchParams.set('fields', 'all');
        searchUrl.searchParams.set('page_size', '100');

        const transRes = await fetch(searchUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!transRes.ok) {
            const err = await transRes.text();
            throw new Error(`PayPal Transaction search failed: ${err}`);
        }

        const transData = await transRes.json();
        const transactions = transData.transaction_details || [];

        // 2. Identify unique PayPal Order IDs from successful captures
        const paypalOrderIds = new Set<string>();
        transactions.forEach((tx: any) => {
            const info = tx.transaction_info;
            // Standard PayPal checkout transaction code is T0001 or similar
            // We look for the custom order ID we stored in metadata if possible
            if (info.transaction_status === 'S' || info.transaction_status === 'P') {
                // If it's a checkout Order, it might have the checkout ID in external_reference
                // But safer to just look for transaction records that are payments
                if (info.transaction_event_code === 'T0006' || info.transaction_event_code === 'T0000') {
                    // Try to get the Order ID or just use transaction ID
                    // Actually, Orders V2 API uses Order IDs. 
                    // Transaction logs have 'transaction_id'.
                }
            }
        });

        // Better way: Fetch Orders from PayPal using recent search is hard because there's no "List Orders" API that's clean.
        // However, we can use the Webhook approach for real-time, or just fetch the transactions and map them.

        // Let's use the transaction list and fetch details for each one
        const ORDERS_KEY = "orders:square:imported";
        const existingOrders = await kv.get<any[]>(ORDERS_KEY) || [];
        const existingIds = new Set(existingOrders.map(o => o.paypalOrderId || o.id));

        let syncedCount = 0;
        const newOrders = [];

        for (const tx of transactions) {
            const info = tx.transaction_info;
            const payer = tx.payer_info;
            const cart = tx.cart_info;

            const txId = info.transaction_id;
            if (existingIds.has(txId)) continue;

            // Only process payments (T0000, T0001, T0006, etc)
            if (!['T0000', 'T0001', 'T0006', 'T0011'].includes(info.transaction_event_code)) continue;

            // Try to extract shipping method from description (e.g., "Shipping via USPS Priority Mail")
            const description = info.transaction_subject || "";
            let shippingMethod = "Standard";
            if (description.includes("Shipping via ")) {
                shippingMethod = description.split("Shipping via ")[1];
            }

            const orderRecord = {
                id: `pp_${txId}`,
                paypalOrderId: txId,
                type: "paypal_sync",
                created: Math.floor(new Date(info.transaction_initiation_date).getTime() / 1000),
                amount: Math.round(parseFloat(info.transaction_amount.value) * 100),
                currency: info.transaction_amount.currency_code.toLowerCase(),
                status: "paid",
                paymentStatus: "paid",
                customerEmail: payer?.email_address || "",
                customerName: [payer?.payer_name?.given_name, payer?.payer_name?.surname].filter(Boolean).join(" "),
                customerPhone: payer?.phone_number || "",
                shippingAddress: payer?.address ? {
                    line1: payer.address.line1,
                    line2: payer.address.line2,
                    city: payer.address.city,
                    state: payer.address.state,
                    postal_code: payer.address.postal_code,
                    country: payer.address.country_code
                } : null,
                items: cart?.item_details?.map((item: any) => ({
                    description: item.item_name,
                    quantity: parseInt(item.item_quantity),
                    amount: Math.round(parseFloat(item.item_unit_price.value) * 100)
                })) || [{ description: "CalcAI Calculator", quantity: 1, amount: Math.round(parseFloat(info.transaction_amount.value) * 100) }],
                paymentMethod: "PayPal",
                shippingMethod: shippingMethod,
                notes: `Synced from PayPal. ${description}`,
            };

            newOrders.push(orderRecord);
            syncedCount++;
        }

        if (newOrders.length > 0) {
            const updatedOrders = [...newOrders, ...existingOrders];
            await kv.set(ORDERS_KEY, updatedOrders);
        }

        return NextResponse.json({ ok: true, syncedCount });
    } catch (e: any) {
        console.error("[api/orders/sync-paypal] error:", e);
        return NextResponse.json({ error: e.message || "Sync failed" }, { status: 500 });
    }
}
