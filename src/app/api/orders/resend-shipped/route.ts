import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendShippedEmail } from "@/lib/email";
import { getHoodpayClient } from "@/lib/hoodpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function kvKey(orderId: string) {
  return `orders:shipment:${orderId}`;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = (await req.json()) as { orderId?: string; email?: string };
    if (!orderId || !email) {
      return NextResponse.json({ error: "orderId and email required" }, { status: 400 });
    }

    const kv = getKvClient();
    
    // Get shipment record from KV
    const shipment = await kv.get<{
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
      service?: string;
    }>(kvKey(orderId));

    if (!shipment || !shipment.trackingNumber) {
      return NextResponse.json({ error: "No shipment found for this order" }, { status: 404 });
    }

    let customerName = "Customer";

    // Check if this is a custom order
    if (orderId.startsWith("custom_")) {
      const customOrders = await kv.get<any[]>("orders:custom:list") || [];
      const order = customOrders.find(o => o.id === orderId);
      if (order) {
        customerName = order.customerName || "Customer";
      }
    } else {
      // Get customer name from Hoodpay or address storage
      const address = await kv.get<any>(`orders:address:${orderId}`);
      if (address?.name) {
        customerName = address.name;
      } else {
        try {
          const hoodpay = getHoodpayClient();
          if (hoodpay) {
            const response = await hoodpay.payments.get(orderId);
            if (response.data?.name) {
              customerName = response.data.name;
            }
          }
        } catch (e) {
          // Ignore - use default
        }
      }
    }

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
