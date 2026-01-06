import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getHoodpayClient } from "@/lib/hoodpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hoodpay webhook events
// The webhook sends payment data when status changes
interface HoodpayWebhookPayload {
  id: string;
  status: string;
  name?: string;
  description?: string;
  endAmount: number;
  currency: string;
  customerEmail?: string;
  customer?: { email: string };
  selectedPaymentMethod?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as HoodpayWebhookPayload;
    
    console.log("[webhook] Hoodpay event received:", JSON.stringify(body, null, 2));

    const paymentId = body.id;
    const status = body.status?.toLowerCase();

    if (!paymentId) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
    }

    // Only process completed payments
    if (status !== "completed" && status !== "complete") {
      console.log(`[webhook] Ignoring status: ${status}`);
      return NextResponse.json({ received: true });
    }

    const customerEmail = body.customerEmail || body.customer?.email;
    if (!customerEmail) {
      console.log("[webhook] No customer email, skipping confirmation email");
      return NextResponse.json({ received: true });
    }

    // Get shipping address from KV if stored
    const kv = getKvClient();
    const address = await kv.get<any>(`orders:address:${paymentId}`);

    // Try to get more details from Hoodpay API
    let paymentDetails = body;
    try {
      const hoodpay = getHoodpayClient();
      if (hoodpay) {
        const response = await hoodpay.payments.get(paymentId);
        if (response.data) {
          paymentDetails = response.data as any;
        }
      }
    } catch (e) {
      console.log("[webhook] Could not fetch payment details:", e);
    }

    const amount = Math.round((paymentDetails.endAmount || 0) * 100);
    const currency = paymentDetails.currency || "usd";
    const paymentMethod = paymentDetails.selectedPaymentMethod || paymentDetails.paymentMethod || "Crypto";

    // Send confirmation email
    await sendOrderConfirmationEmail({
      to: customerEmail,
      customerName: address?.name || paymentDetails.name || "Customer",
      orderId: paymentId,
      amount,
      currency,
      items: [{
        description: paymentDetails.description || paymentDetails.name || "CalcAI Product",
        quantity: 1,
        amount,
      }],
      paymentMethod,
      shippingMethod: address?.shippingMethod,
      shippingAmount: address?.shippingAmount ? Math.round(address.shippingAmount * 100) : undefined,
      shippingCurrency: currency,
    });

    console.log(`[webhook] Confirmation email sent to ${customerEmail} for payment ${paymentId}`);

    return NextResponse.json({ received: true, emailSent: true });
  } catch (e) {
    console.error("[webhook] Error processing Hoodpay webhook:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// Allow GET for webhook verification if needed
export async function GET() {
  return NextResponse.json({ status: "ok", service: "hoodpay-webhook" });
}
