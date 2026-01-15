import { NextRequest, NextResponse } from "next/server";
import { getSquareClient } from "@/lib/square";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, amount, currency, paymentId } = body;

        if (!orderId || !amount || !paymentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const client = getSquareClient();
        if (!client) {
            return NextResponse.json({ error: "Square client not initialized" }, { status: 500 });
        }

        // Even though we received an idempotency key or could make one, we'll make a fresh one here
        const idempotencyKey = `refund_${orderId}_${Date.now()}`;

        // Create Refund
        // https://developer.squareup.com/reference/square/refunds-api/refund-payment
        const response = await client.refunds.refundPayment({
            idempotencyKey,
            amountMoney: {
                amount: BigInt(amount), // Square expects BigInt for amount
                currency: currency || 'USD',
            },
            paymentId: paymentId,
            reason: "Requested via Admin Dashboard",
        });

        const refund = response.refund;

        return NextResponse.json({ ok: true, refund });

    } catch (e: any) {
        console.error("[api/orders/square-refund] Error:", e);
        // Square errors serve nicely structured JSON usually
        const msg = e.result ? JSON.stringify(e.result) : e.message;
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
