import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getKvClient } from '@/lib/kv';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

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
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  try {
    const kv = getKvClient();

    // Fetch recent checkout sessions (completed ones = orders)
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      expand: ['data.line_items', 'data.customer_details', 'data.payment_intent'],
    });

    const shipmentKeys = sessions.data.map((s) => `orders:shipment:${s.id}`);
    const shipments = await Promise.all(shipmentKeys.map((k) => kv.get<any>(k)));

    const stripeOrders = sessions.data.map((session, idx) => {
      const pi = session.payment_intent as Stripe.PaymentIntent | null;
      const shipping = session.shipping_details?.address || session.customer_details?.address;
      
      return {
        id: session.id,
        type: "stripe" as const,
        created: session.created,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: session.status || 'unknown',
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || '',
        customerName: session.customer_details?.name || session.shipping_details?.name || '',
        shippingAddress: shipping
          ? {
              line1: shipping.line1 || '',
              line2: shipping.line2 || undefined,
              city: shipping.city || '',
              state: shipping.state || '',
              postal_code: shipping.postal_code || '',
              country: shipping.country || '',
            }
          : null,
        items: (session.line_items?.data || []).map((item) => ({
          description: item.description || 'Item',
          quantity: item.quantity || 1,
          amount: item.amount_total || 0,
        })),
        receiptUrl: pi?.latest_charge
          ? `https://dashboard.stripe.com/payments/${typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge.id}`
          : undefined,
        shipment: shipments[idx] || null,
      };
    });

    // Fetch custom orders from KV
    const customOrders = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY) || [];
    
    // Get shipments for custom orders
    const customShipmentKeys = customOrders.map((o) => `orders:shipment:${o.id}`);
    const customShipments = await Promise.all(customShipmentKeys.map((k) => kv.get<any>(k)));
    
    const customOrdersWithShipments = customOrders.map((order, idx) => ({
      ...order,
      shipment: customShipments[idx] || null,
    }));

    // Combine and sort by created date (newest first)
    const allOrders = [...stripeOrders, ...customOrdersWithShipments].sort((a, b) => b.created - a.created);

    return NextResponse.json({ orders: allOrders });
  } catch (e) {
    console.error('[orders/list] Error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}


