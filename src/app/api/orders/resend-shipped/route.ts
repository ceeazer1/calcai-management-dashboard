import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getKvClient } from "@/lib/kv";
import { sendShippedEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function kvKey(orderId: string) {
  return `orders:shipment:${orderId}`;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = (await req.json()) as { orderId?: string; email?: string };
    if (!orderId || !email) {
      return NextResponse.json({ error: "orderId and email required" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    // Get shipment record from KV
    const kv = getKvClient();
    const shipment = await kv.get<{
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
      service?: string;
    }>(kvKey(orderId));

    if (!shipment || !shipment.trackingNumber) {
      return NextResponse.json({ error: "No shipment found for this order" }, { status: 404 });
    }

    // Get customer name from Stripe
    const session = await stripe.checkout.sessions.retrieve(orderId);
    const customerName = session.customer_details?.name || session.shipping_details?.name || "Customer";

    await sendShippedEmail({
      to: email,
      customerName,
      orderId,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.carrier,
      service: shipment.service,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[resend-shipped] error:", e);
    return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
  }
}



