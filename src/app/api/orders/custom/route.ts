import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomOrder = {
  id: string;
  type: "custom";
  created: number;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  items: { description: string; quantity: number; amount: number }[];
  notes?: string;
};

const CUSTOM_ORDERS_KEY = "orders:custom:list";

export async function GET() {
  try {
    const kv = getKvClient();
    const orders = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY);
    return NextResponse.json({ orders: orders || [] });
  } catch (e) {
    console.error("[orders/custom] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch custom orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerEmail, address, items, notes } = body as {
      customerName?: string;
      customerEmail?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
      items?: { description: string; quantity: number; price: number }[];
      notes?: string;
    };

    if (!customerName || !customerEmail) {
      return NextResponse.json({ error: "Customer name and email required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item required" }, { status: 400 });
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const newOrder: CustomOrder = {
      id: orderId,
      type: "custom",
      created: Math.floor(Date.now() / 1000),
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "usd",
      status: "complete",
      paymentStatus: "paid",
      customerEmail,
      customerName,
      shippingAddress: address && address.line1 ? {
        line1: address.line1,
        line2: address.line2,
        city: address.city || "",
        state: address.state || "",
        postal_code: address.postal_code || "",
        country: address.country || "US",
      } : null,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        amount: Math.round(item.price * 100 * item.quantity),
      })),
      notes,
    };

    const kv = getKvClient();
    const existing = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY) || [];
    existing.unshift(newOrder);
    await kv.set(CUSTOM_ORDERS_KEY, existing);

    return NextResponse.json({ ok: true, order: newOrder });
  } catch (e) {
    console.error("[orders/custom] POST error:", e);
    return NextResponse.json({ error: "Failed to create custom order" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const kv = getKvClient();
    const existing = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY) || [];
    const updated = existing.filter(o => o.id !== orderId);
    await kv.set(CUSTOM_ORDERS_KEY, updated);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[orders/custom] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}

