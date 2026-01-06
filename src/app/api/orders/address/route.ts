import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Store shipping address for a Hoodpay payment
// Call this from your website after creating the Hoodpay payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, address } = body as {
      paymentId?: string;
      address?: {
        name?: string;
        email?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
        shippingMethod?: string;
        shippingAmount?: number;
      };
    };

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    }

    if (!address || !address.line1) {
      return NextResponse.json({ error: "address with line1 required" }, { status: 400 });
    }

    const kv = getKvClient();
    await kv.set(`orders:address:${paymentId}`, address);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[orders/address] error:", e);
    return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
  }
}

// Get shipping address for a payment
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    }

    const kv = getKvClient();
    const address = await kv.get(`orders:address:${paymentId}`);

    return NextResponse.json({ address: address || null });
  } catch (e: any) {
    console.error("[orders/address] error:", e);
    return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
  }
}

