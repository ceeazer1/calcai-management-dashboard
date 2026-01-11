import { NextRequest, NextResponse } from "next/server";
import { sendOrderConfirmationEmail, sendShippedEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
    try {
        const { type, email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const testOrderId = "order_test_1234567890";
        const testCustomerName = "Test User";

        if (type === "confirmation") {
            await sendOrderConfirmationEmail({
                to: email,
                customerName: testCustomerName,
                orderId: testOrderId,
                amount: 8999,
                currency: "usd",
                items: [
                    {
                        description: "CalcAI - TI-84 Plus with ChatGPT (Test)",
                        quantity: 1,
                        amount: 8999,
                    },
                ],
                paymentMethod: "Visa •••• 4242",
                shippingMethod: "USPS Ground Advantage",
                shippingAmount: 0,
            });
        } else if (type === "shipped") {
            await sendShippedEmail({
                to: email,
                customerName: testCustomerName,
                orderId: testOrderId,
                trackingNumber: "9400100000000000000000",
                trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
                carrier: "USPS",
                service: "Ground Advantage",
            });
        } else {
            return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
        }

        return NextResponse.json({ ok: true, message: `Test ${type} email sent to ${email}` });
    } catch (error: any) {
        console.error("[api/testing/email] Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
