import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getHoodpayClient } from "@/lib/hoodpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = (await req.json()) as { orderId?: string; email?: string };

    if (!orderId || !email) {
      return NextResponse.json({ error: "orderId and email required" }, { status: 400 });
    }

    const kv = getKvClient();

    // Check if this is a custom order
    if (orderId.startsWith("custom_")) {
      const customOrders = await kv.get<any[]>("orders:custom:list") || [];
      const order = customOrders.find(o => o.id === orderId);
      
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      await sendOrderConfirmationEmail({
        to: email,
        customerName: order.customerName || "Customer",
        orderId,
        amount: order.amount,
        currency: order.currency || "usd",
        items: order.items || [],
      });

      return NextResponse.json({ ok: true });
    }

    // Hoodpay order
    const hoodpay = getHoodpayClient();
    if (!hoodpay) {
      return NextResponse.json({ error: "Hoodpay not configured" }, { status: 500 });
    }

    let payment;
    try {
      const response = await hoodpay.payments.get(orderId);
      payment = response.data;
    } catch (e) {
      return NextResponse.json({ error: "Order not found in Hoodpay" }, { status: 404 });
    }

    if (!payment) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get shipping address from KV
    const address = await kv.get<any>(`orders:address:${orderId}`);

    const amount = Math.round((payment.endAmount || 0) * 100);
    const currency = payment.currency || "usd";
    const paymentMethod = payment.selectedPaymentMethod || payment.paymentMethod || "Crypto";

    await sendOrderConfirmationEmail({
      to: email,
      customerName: address?.name || payment.name || "Customer",
      orderId,
      amount,
      currency,
      items: [{
        description: payment.description || payment.name || "CalcAI Product",
        quantity: 1,
        amount,
      }],
      paymentMethod,
      shippingMethod: address?.shippingMethod,
      shippingAmount: address?.shippingAmount ? Math.round(address.shippingAmount * 100) : undefined,
      shippingCurrency: currency,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[resend-confirmation] error:", e);
    return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
  }
}
