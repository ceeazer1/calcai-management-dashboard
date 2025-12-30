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
  // Charge.payment_method_details is the most reliable source for human labels.
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

// Stripe sends raw body, we need to handle it properly
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // If webhook secret is configured, verify signature
    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err) {
        console.error('[webhook] Signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body) as Stripe.Event;
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only send email for successful payments
      if (session.payment_status === 'paid') {
        const email = session.customer_details?.email;
        const customerName = session.customer_details?.name || session.shipping_details?.name || 'Customer';

        if (email) {
          try {
            // Retrieve session with expanded payment intent + latest charge so we can show payment method
            const full = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['payment_intent', 'payment_intent.latest_charge'],
            });
            const pi = full.payment_intent && typeof full.payment_intent === 'object' ? (full.payment_intent as Stripe.PaymentIntent) : null;
            const paymentMethod = formatPaymentMethod(pi);

            // Fetch line items separately
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            const items = lineItems.data.map((item) => ({
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
              paymentMethod: paymentMethod || undefined,
            });

            console.log(`[webhook] Confirmation email sent to ${email} for order ${session.id}`);
          } catch (emailError) {
            console.error('[webhook] Failed to send confirmation email:', emailError);
            // Don't fail the webhook - Stripe would retry
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[webhook] Error:', e);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

// Stripe requires this for proper webhook handling
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

