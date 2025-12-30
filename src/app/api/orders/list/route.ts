import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getKvClient } from '@/lib/kv';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function GET() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch recent checkout sessions (completed ones = orders)
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      expand: ['data.line_items', 'data.customer_details', 'data.payment_intent'],
    });

    const kv = getKvClient();
    const shipmentKeys = sessions.data.map((s) => `orders:shipment:${s.id}`);
    const shipments = await Promise.all(shipmentKeys.map((k) => kv.get<any>(k)));

    const orders = sessions.data.map((session, idx) => {
      const pi = session.payment_intent as Stripe.PaymentIntent | null;
      const shipping = session.shipping_details?.address || session.customer_details?.address;
      
      return {
        id: session.id,
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

    return NextResponse.json({ orders });
  } catch (e) {
    console.error('[orders/list] Error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}


