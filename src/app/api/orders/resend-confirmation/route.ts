import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendOrderConfirmationEmail } from '@/lib/email';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = await req.json();

    if (!orderId || !email) {
      return NextResponse.json(
        { ok: false, error: 'orderId and email required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // Fetch the session to get order details
    const session = await stripe.checkout.sessions.retrieve(orderId, {
      expand: ['line_items', 'customer_details', 'payment_intent'],
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const customerName = session.customer_details?.name || session.shipping_details?.name || 'Customer';
    const items = (session.line_items?.data || []).map((item) => ({
      description: item.description || 'Item',
      quantity: item.quantity || 1,
      amount: item.amount_total || 0,
    }));

    await sendOrderConfirmationEmail({
      to: email,
      customerName,
      orderId: session.id,
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      items,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[orders/resend-confirmation] Error:', e);
    return NextResponse.json(
      { ok: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

