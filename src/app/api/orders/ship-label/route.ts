import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendShippedEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShipmentRecord = {
  provider: "shippo";
  status: "label_created";
  shippedAt: number;
  carrier: string;
  service: string;
  rate: {
    amount: number;
    currency: string;
  };
  labelUrl: string;
  trackingNumber: string;
  trackingUrl?: string;
  transactionId: string;
  rateId: string;
};

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

interface AddressData {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  email?: string;
}

function toShippoAddress(from: boolean, address?: AddressData | null) {
  if (from) {
    return {
      name: "CalcAI",
      company: "",
      street1: "209 S Broadway",
      street2: "",
      city: "South Amboy",
      state: "NJ",
      zip: "08879",
      country: "US",
      phone: "7324051352",
      email: "info@calcai.cc",
    };
  }

  if (!address || !address.line1) {
    throw new Error("Order missing shipping address");
  }

  return {
    name: address.name || "Customer",
    street1: address.line1 || "",
    street2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    zip: address.postal_code || "",
    country: address.country || "US",
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

    const kv = getKvClient();

    // 1. Try Custom Order
    const customOrders = await kv.get<any[]>("orders:custom:list") || [];
    let orderFound = customOrders.find(o => o.id === orderId);

    // 2. Try Square Order
    if (!orderFound) {
      const squareOrders = await kv.get<any[]>("orders:square:imported") || [];
      orderFound = squareOrders.find(o => o.id === orderId);
    }

    if (!orderFound) {
      // Fallback for older orders or manual address storage
      const legacyAddress = await kv.get<AddressData>(`orders:address:${orderId}`);
      if (legacyAddress) {
        orderFound = {
          customerName: legacyAddress.name,
          customerEmail: legacyAddress.email,
          shippingAddress: legacyAddress
        };
      }
    }

    if (!orderFound) {
      return NextResponse.json({ error: "Order not found in records" }, { status: 404 });
    }

    const address: AddressData = {
      name: orderFound.customerName,
      line1: orderFound.shippingAddress?.line1,
      line2: orderFound.shippingAddress?.line2,
      city: orderFound.shippingAddress?.city,
      state: orderFound.shippingAddress?.state,
      postal_code: orderFound.shippingAddress?.postal_code || orderFound.shippingAddress?.postalCode,
      country: orderFound.shippingAddress?.country || "US",
    };

    if (!address.line1) {
      return NextResponse.json({ error: "No shipping address found for this order" }, { status: 400 });
    }

    // Build Shippo shipment
    const parcel = {
      length: String(numEnv("SHIP_PARCEL_LENGTH_IN", 8)),
      width: String(numEnv("SHIP_PARCEL_WIDTH_IN", 6)),
      height: String(numEnv("SHIP_PARCEL_HEIGHT_IN", 4)),
      distance_unit: "in",
      weight: String(orderFound.weight_oz || numEnv("SHIP_PARCEL_WEIGHT_OZ", 32)),
      mass_unit: "oz",
    };

    const addressFrom = toShippoAddress(true, null);
    const addressTo = toShippoAddress(false, address);

    const shipment = await shippoFetch("/shipments/", {
      method: "POST",
      body: JSON.stringify({
        async: false,
        address_from: addressFrom,
        address_to: addressTo,
        parcels: [parcel],
      }),
    });

    const rates: any[] = Array.isArray(shipment?.rates) ? shipment.rates : [];
    if (!rates.length) {
      const validationErrors = shipment?.messages?.map((m: any) => m?.text).filter(Boolean).join("; ") || "";
      throw new Error(`No shipping rates returned. ${validationErrors}`.trim());
    }

    // Rate Selection Logic
    let selectedMethod = orderFound.shippingMethod; // e.g. 'usps_priority'

    // Fallback: Check notes if shippingMethod is missing
    if (!selectedMethod && orderFound.notes) {
      const note = orderFound.notes.toLowerCase();
      if (note.includes('priority mail express')) {
        selectedMethod = 'usps_priority_express';
      } else if (note.includes('priority mail')) {
        selectedMethod = 'usps_priority';
      } else if (note.includes('ground advantage')) {
        selectedMethod = 'usps_ground_advantage';
      }
    }

    console.log(`[ship-label] Order ${orderId} detected method: ${selectedMethod}`);

    let best = null;

    if (selectedMethod) {
      // Log all available rates for debugging if there's a mismatch
      console.log(`[ship-label] Available rates to match:`, rates.map(r => r.servicelevel?.token));

      // Try to find exact match for the selected service level token
      best = rates.find((r) => {
        const token = String(r?.servicelevel?.token || "").toLowerCase();
        const target = selectedMethod.toLowerCase();

        // Exact match or contains (for cases like usps_priority_mail vs usps_priority)
        return token === target ||
          (target === 'usps_priority' && token === 'usps_priority_mail') ||
          (target === 'usps_priority_express' && token === 'usps_priority_mail_express');
      });
    }

    if (best) {
      console.log(`[ship-label] Successfully matched rate: ${best.servicelevel?.token}`);
    } else {
      console.log(`[ship-label] No exact match for ${selectedMethod}. Falling back to cheapest USPS.`);
      // Prefer USPS; otherwise fall back to the overall cheapest.
      const uspsRates = rates.filter((r) => String(r?.provider || "").toUpperCase() === "USPS");
      const pool = uspsRates.length ? uspsRates : rates;
      pool.sort((a, b) => centsFromAmount(a?.amount) - centsFromAmount(b?.amount));
      best = pool[0];
    }

    if (!best?.object_id) {
      throw new Error("Unable to select rate");
    }

    console.log(`[ship-label] Purchasing rate: ${best.servicelevel?.name} (${best.amount} ${best.currency})`);

    let tx = await shippoFetch("/transactions/", {
      method: "POST",
      body: JSON.stringify({
        rate: best.object_id,
        label_file_type: "PDF",
        async: false,
      }),
    });

    // Poll if status is QUEUED
    if (tx?.status === "QUEUED" && tx?.object_id) {
      const maxAttempts = 10;
      const delay = 1000;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        tx = await shippoFetch(`/transactions/${tx.object_id}`, { method: "GET" });
        if (tx?.status === "SUCCESS" || tx?.status === "ERROR") break;
      }
    }

    if (!tx?.status || tx.status !== "SUCCESS") {
      let msg = "Label creation failed";
      if (tx?.messages && Array.isArray(tx.messages) && tx.messages.length > 0) {
        msg = tx.messages.map((m: any) => m?.text || m?.source || JSON.stringify(m)).join("; ");
      } else if (tx?.message) {
        msg = tx.message;
      }
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

    await kv.set(kvKey(orderId), record);

    // Send shipped email
    if (orderFound.customerEmail) {
      try {
        await sendShippedEmail({
          to: orderFound.customerEmail,
          customerName: orderFound.customerName || "Customer",
          orderId,
          trackingNumber: record.trackingNumber,
          trackingUrl: record.trackingUrl,
          carrier: record.carrier,
          service: record.service,
        });
      } catch (emailErr) {
        console.error("[ship-label] Failed to send email:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, shipment: record });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "server_error";
    console.error("[orders/ship-label] error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
