import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = (await req.json()) as { orderId?: string; email?: string };

    if (!orderId || !email) {
      return NextResponse.json({ error: "orderId and email required" }, { status: 400 });
    }

    const kv = getKvClient();

    // 1. Try Custom Order
    const customOrders = await kv.get<any[]>("orders:custom:list") || [];
    let order = customOrders.find(o => o.id === orderId);

    // 2. Try Square Order
    if (!order) {
      const squareOrders = await kv.get<any[]>("orders:square:imported") || [];
      order = squareOrders.find(o => o.id === orderId);
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found in records" }, { status: 404 });
    }

    await sendOrderConfirmationEmail({
      to: email,
      customerName: order.customerName || "Customer",
      orderId,
      amount: order.amount,
      currency: order.currency || "usd",
      items: order.items || [],
      paymentMethod: order.paymentMethod || "Credit Card",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[resend-confirmation] error:", e);
    return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
  }
}
