import express from "express";
import { stripe } from "../lib/stripe.mjs";

export function orders() {
  const router = express.Router();

  // List recent orders from Stripe Checkout Sessions
  router.get("/list", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
      const sessions = await stripe.listCheckoutSessions({ limit });

      // Map minimal fields for table
      const results = (sessions.data || []).map(s => ({
        id: s.id,
        date: new Date((s.created || 0) * 1000).toISOString(),
        customer: s.customer_details?.name || s.customer_details?.email || '—',
        email: s.customer_details?.email || null,
        amount: (s.amount_total || 0) / 100,
        currency: (s.currency || 'usd').toUpperCase(),
        status: s.payment_status || s.status,
      }));

      res.json({ orders: results });
    } catch (e) {
      console.error('Stripe list error:', e);
      res.status(500).json({ error: 'Failed to list orders' });
    }
  });

  // Get order details by Session ID
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const session = await stripe.retrieveSession(id);

      // get line items
      const itemsResp = await stripe.listSessionLineItems(id, { limit: 100 });
      const paymentIntentId = session.payment_intent;
      let brand = null, last4 = null, receipt_url = null;
      if (paymentIntentId) {
        const pi = await stripe.retrievePaymentIntent(paymentIntentId.toString());
        const charge = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge : null;
        if (charge && charge.payment_method_details?.card) {
          brand = charge.payment_method_details.card.brand;
          last4 = charge.payment_method_details.card.last4;
        }
        receipt_url = charge?.receipt_url || null;
      }

      const out = {
        id: session.id,
        date: new Date((session.created || 0) * 1000).toISOString(),
        status: session.payment_status || session.status,
        amount: (session.amount_total || 0) / 100,
        currency: (session.currency || 'usd').toUpperCase(),
        customer: session.customer_details?.name || null,
        email: session.customer_details?.email || null,
        phone: session.customer_details?.phone || null,
        address: session.customer_details?.address || null,
        shipping_details: session.shipping_details || null,
        line_items: (itemsResp.data || []).map(li => ({
          description: li.description,
          quantity: li.quantity,
          amount_subtotal: (li.amount_subtotal || 0) / 100,
          amount_total: (li.amount_total || 0) / 100,
          currency: (li.currency || 'usd').toUpperCase(),
        })),
        payment_method: brand ? { brand, last4 } : null,
        receipt_url,
        stripe_dashboard_url: `https://dashboard.stripe.com/${session.livemode ? '' : 'test/'}checkouts/sessions/${session.id}`,
      };

      res.json(out);
    } catch (e) {
      console.error('Stripe detail error:', e);
      res.status(500).json({ error: 'Failed to retrieve order' });
    }
  });

  return router;
}

