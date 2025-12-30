import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendOrderConfirmationEmail } from '@/lib/email';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function formatPaymentMethod(pi: Stripe.PaymentIntent | null | undefined): string | null {
  if (!pi) return null;
  const charge = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge : null;
  const details = charge?.payment_method_details as Stripe.Charge.PaymentMethodDetails | null | undefined;
  if (!details) return null;

  if (details.type === 'card' && details.card) {
    const brand = (details.card.brand || 'Card').toUpperCase();
    const last4 = details.card.last4 ? `•••• ${details.card.last4}` : '';
    const wallet = details.card.wallet?.type ? ` (${details.card.wallet.type})` : '';
    return `${brand} ${last4}${wallet}`.trim();
  }

  return details.type ? details.type.replace(/_/g, ' ') : null;
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
      expand: ['line_items', 'customer_details', 'payment_intent', 'payment_intent.latest_charge'],
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

    const pi = session.payment_intent && typeof session.payment_intent === 'object' ? (session.payment_intent as Stripe.PaymentIntent) : null;
    const paymentMethod = formatPaymentMethod(pi);

    await sendOrderConfirmationEmail({
      to: email,
      customerName,
      orderId: session.id,
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      items,
      paymentMethod: paymentMethod || undefined,
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

