const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set. Orders API will return configuration errors.');
}

const API_BASE = 'https://api.stripe.com/v1';

async function stripeFetch(path, params = null, method = 'GET') {
  if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');
  let url = API_BASE + path;
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  let body;
  if (method !== 'GET' && params) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    body = form.toString();
  } else if (method === 'GET' && params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) usp.append(k, String(v));
    url += `?${usp.toString()}`;
  }
  const resp = await fetch(url, { method, headers, body });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Stripe API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export const stripe = {
  async listCheckoutSessions({ limit = 25 } = {}) {
    return stripeFetch('/checkout/sessions', { limit }, 'GET');
  },
  async retrieveSession(id) {
    return stripeFetch(`/checkout/sessions/${id}`, null, 'GET');
  },
  async listSessionLineItems(id, { limit = 100 } = {}) {
    return stripeFetch(`/checkout/sessions/${id}/line_items`, { limit }, 'GET');
  },
  async retrievePaymentIntent(id) {
    // expand latest_charge to get brand/last4 and receipt
    return stripeFetch(`/payment_intents/${id}`, { 'expand[]': 'latest_charge' }, 'GET');
  }
};

