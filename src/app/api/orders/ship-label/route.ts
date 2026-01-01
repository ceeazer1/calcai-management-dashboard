import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShipmentRecord = {
  provider: "shippo";
  status: "label_created";
  shippedAt: number; // ms since epoch
  carrier: string;
  service: string;
  rate: {
    amount: number; // cents
    currency: string;
  };
  labelUrl: string;
  trackingNumber: string;
  trackingUrl?: string;
  transactionId: string;
  rateId: string;
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function kvKey(orderId: string) {
  return `orders:shipment:${orderId}`;
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

function numEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toShippoAddress(from: boolean, session: Stripe.Checkout.Session) {
  if (from) {
    // Hardcoded return address for CalcAI
    return {
      name: "CalcAI",
      company: "",
      street1: "209 S Broadway",
      street2: "",
      city: "South Amboy",
      state: "NJ",
      zip: "08879",
      country: "US",
      phone: "",
      email: "",
    };
  }

  const addr = session.shipping_details?.address || session.customer_details?.address;
  const name = session.shipping_details?.name || session.customer_details?.name || "";
  if (!addr) throw new Error("Order missing shipping address");
  return {
    name: name || "Customer",
    street1: addr.line1 || "",
    street2: addr.line2 || "",
    city: addr.city || "",
    state: addr.state || "",
    zip: addr.postal_code || "",
    country: addr.country || "US",
  };
}

async function shippoFetch(path: string, init: RequestInit) {
  const token = mustEnv("SHIPPO_API_TOKEN");
  const url = `https://api.goshippo.com${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!r.ok) {
    const msg = json?.detail || json?.message || text || "shippo_error";
    throw new Error(`Shippo error (${r.status}): ${msg}`);
  }
  return json;
}

function centsFromAmount(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    // Load order from Stripe
    const session = await stripe.checkout.sessions.retrieve(orderId, {
      expand: ["shipping_cost.shipping_rate"],
    });

    if (!session || typeof session !== "object") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build Shippo shipment
    const parcel = {
      length: String(numEnv("SHIP_PARCEL_LENGTH_IN", 8)),
      width: String(numEnv("SHIP_PARCEL_WIDTH_IN", 6)),
      height: String(numEnv("SHIP_PARCEL_HEIGHT_IN", 4)),
      distance_unit: "in",
      weight: String(numEnv("SHIP_PARCEL_WEIGHT_OZ", 16)),
      mass_unit: "oz",
    };

    const addressFrom = toShippoAddress(true, session);
    const addressTo = toShippoAddress(false, session);
    
    console.log("[ship-label] Creating shipment with:", {
      address_from: addressFrom,
      address_to: addressTo,
      parcel,
    });

    const shipment = await shippoFetch("/shipments/", {
      method: "POST",
      body: JSON.stringify({
        async: false,
        address_from: addressFrom,
        address_to: addressTo,
        parcels: [parcel],
      }),
    });
    
    console.log("[ship-label] Shipment response:", JSON.stringify(shipment, null, 2));

    // Check for address validation issues
    if (shipment?.messages && Array.isArray(shipment.messages) && shipment.messages.length > 0) {
      console.log("[ship-label] Shipment messages:", JSON.stringify(shipment.messages, null, 2));
    }
    
    const rates: any[] = Array.isArray(shipment?.rates) ? shipment.rates : [];
    if (!rates.length) {
      const validationErrors = shipment?.messages?.map((m: any) => m?.text).filter(Boolean).join("; ") || "";
      throw new Error(`No shipping rates returned. ${validationErrors}`.trim());
    }

    // Prefer USPS; otherwise fall back to the overall cheapest.
    const uspsRates = rates.filter((r) => String(r?.provider || "").toUpperCase() === "USPS");
    const pool = uspsRates.length ? uspsRates : rates;
    pool.sort((a, b) => centsFromAmount(a?.amount) - centsFromAmount(b?.amount));
    const best = pool[0];
    if (!best?.object_id) {
      throw new Error("Unable to select rate");
    }

    console.log("[ship-label] Purchasing label with rate:", best.object_id, "service:", best?.servicelevel?.name);
    
    const tx = await shippoFetch("/transactions/", {
      method: "POST",
      body: JSON.stringify({
        rate: best.object_id,
        label_file_type: "PDF",
        async: false,
      }),
    });

    console.log("[ship-label] Transaction response:", JSON.stringify(tx, null, 2));

    if (!tx?.status || tx.status !== "SUCCESS") {
      // Get detailed error messages from Shippo
      let msg = "Label creation failed";
      if (tx?.messages && Array.isArray(tx.messages) && tx.messages.length > 0) {
        msg = tx.messages.map((m: any) => m?.text || m?.source || JSON.stringify(m)).join("; ");
      } else if (tx?.message) {
        msg = tx.message;
      } else if (tx?.status) {
        msg = `Label status: ${tx.status}`;
      }
      console.error("[ship-label] Shippo transaction failed:", JSON.stringify(tx, null, 2));
      throw new Error(msg);
    }

    const record: ShipmentRecord = {
      provider: "shippo",
      status: "label_created",
      shippedAt: Date.now(),
      carrier: String(best?.provider || ""),
      service: String(best?.servicelevel?.name || best?.servicelevel?.token || ""),
      rate: {
        amount: centsFromAmount(best?.amount),
        currency: String(best?.currency || "USD"),
      },
      labelUrl: String(tx?.label_url || ""),
      trackingNumber: String(tx?.tracking_number || ""),
      trackingUrl: tx?.tracking_url_provider ? String(tx.tracking_url_provider) : undefined,
      transactionId: String(tx?.object_id || ""),
      rateId: String(best?.object_id || ""),
    };

    if (!record.labelUrl || !record.trackingNumber) {
      throw new Error("Label created but missing labelUrl/trackingNumber");
    }

    const kv = getKvClient();
    await kv.set(kvKey(orderId), record);

    return NextResponse.json({ ok: true, shipment: record });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "server_error";
    console.error("[orders/ship-label] error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



