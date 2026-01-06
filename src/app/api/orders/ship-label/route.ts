import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";
import { sendShippedEmail } from "@/lib/email";
import { getHoodpayClient } from "@/lib/hoodpay";

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

    // Get shipping address from KV
    let address: AddressData | null = null;
    let customerEmail: string | undefined;
    let customerName: string | undefined;

    // Check if custom order
    if (orderId.startsWith("custom_")) {
      const customOrders = await kv.get<any[]>("orders:custom:list") || [];
      const order = customOrders.find(o => o.id === orderId);
      
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      
      if (order.shippingAddress) {
        address = {
          name: order.customerName,
          line1: order.shippingAddress.line1,
          line2: order.shippingAddress.line2,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postal_code: order.shippingAddress.postal_code,
          country: order.shippingAddress.country,
        };
      }
      customerEmail = order.customerEmail;
      customerName = order.customerName;
    } else {
      // Hoodpay order - get address from KV
      address = await kv.get<AddressData>(`orders:address:${orderId}`);
      
      if (!address) {
        // Try to get email from Hoodpay
        try {
          const hoodpay = getHoodpayClient();
          if (hoodpay) {
            const response = await hoodpay.payments.get(orderId);
            if (response.data) {
              customerEmail = response.data.customerEmail || response.data.customer?.email;
              customerName = response.data.name;
            }
          }
        } catch (e) {
          console.log("[ship-label] Could not fetch Hoodpay payment:", e);
        }
      } else {
        customerEmail = address.email;
        customerName = address.name;
      }
    }

    if (!address || !address.line1) {
      return NextResponse.json({ error: "No shipping address found for this order" }, { status: 400 });
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

    const addressFrom = toShippoAddress(true, null);
    const addressTo = toShippoAddress(false, address);
    
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
    
    let tx = await shippoFetch("/transactions/", {
      method: "POST",
      body: JSON.stringify({
        rate: best.object_id,
        label_file_type: "PDF",
        async: false,
      }),
    });

    console.log("[ship-label] Initial transaction response:", tx?.status, tx?.object_id);

    // Poll if status is QUEUED (common in test mode)
    if (tx?.status === "QUEUED" && tx?.object_id) {
      const maxAttempts = 10;
      const delay = 1000;
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`[ship-label] Polling transaction ${tx.object_id}, attempt ${i + 1}/${maxAttempts}`);
        
        tx = await shippoFetch(`/transactions/${tx.object_id}`, {
          method: "GET",
        });
        
        if (tx?.status === "SUCCESS" || tx?.status === "ERROR") {
          break;
        }
      }
    }

    console.log("[ship-label] Final transaction response:", JSON.stringify(tx, null, 2));

    if (!tx?.status || tx.status !== "SUCCESS") {
      let msg = "Label creation failed";
      if (tx?.messages && Array.isArray(tx.messages) && tx.messages.length > 0) {
        msg = tx.messages.map((m: any) => m?.text || m?.source || JSON.stringify(m)).join("; ");
      } else if (tx?.message) {
        msg = tx.message;
      } else if (tx?.status) {
        msg = `Label status: ${tx.status} (still processing, try again in a moment)`;
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

    await kv.set(kvKey(orderId), record);

    // Send shipped email to customer
    try {
      if (customerEmail) {
        await sendShippedEmail({
          to: customerEmail,
          customerName: customerName || "Customer",
          orderId,
          trackingNumber: record.trackingNumber,
          trackingUrl: record.trackingUrl,
          carrier: record.carrier,
          service: record.service,
        });
        console.log("[ship-label] Shipped email sent to", customerEmail);
      }
    } catch (emailErr) {
      console.error("[ship-label] Failed to send shipped email:", emailErr);
    }

    return NextResponse.json({ ok: true, shipment: record });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "server_error";
    console.error("[orders/ship-label] error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
