import { NextResponse } from 'next/server';
import { getKvClient } from '@/lib/kv';

type CustomOrder = {
  id: string;
  type: "custom" | "square";
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
const SQUARE_ORDERS_KEY = "orders:square:imported";

export async function GET() {
  const kv = getKvClient();

  try {
    // Fetch custom orders from KV
    const customOrders = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY) || [];

    // Get shipments for custom orders
    const customShipmentKeys = customOrders.map((o) => `orders:shipment:${o.id}`);
    const customShipments = await Promise.all(customShipmentKeys.map((k) => kv.get<any>(k)));

    const customOrdersWithShipments = customOrders.map((order, idx) => ({
      ...order,
      shipment: customShipments[idx] || null,
    }));

    // Fetch Square orders from cache
    // Fetch Square orders from cache (Legacy storage location for website orders)
    const rawSquareOrders = await kv.get<any[]>(SQUARE_ORDERS_KEY) || [];

    // Get shipments for ALL Square orders (including overwritten website orders)
    const squareShipmentKeys = rawSquareOrders.map((o) => `orders:shipment:${o.id}`);
    const squareShipments = await Promise.all(squareShipmentKeys.map((k) => kv.get<any>(k)));

    const squareOrdersWithShipments = rawSquareOrders.map((order, idx) => ({
      ...order,
      shipment: squareShipments[idx] || null,
    }));

    // Combine all sources
    const websiteOrders = await kv.get<any[]>("orders:website:list") || [];

    // Get shipments for website orders
    const websiteOrdersWithShipments = websiteOrders.map((order) => {
      return order;
    });

    // Combine all sources
    // WE PUT SQUARE LAST so that if an ID exists in both Website Push and Square Sync,
    // the more detailed Square Sync data "wins" the deduplication.
    const allOrdersRaw = [
      ...customOrdersWithShipments,
      ...websiteOrdersWithShipments,
      ...squareOrdersWithShipments
    ];

    // Fetch and Apply Manual Overrides
    const manualEdits = await kv.get<Record<string, any>>("orders:manual:overrides") || {};

    const allOrders = allOrdersRaw.map(order => {
      let finalStatus = order.status;

      // WORKFLOW LOGIC:
      // Since you manage shipping/fulfillment ON THIS DASHBOARD (not on Square):
      // 1. If we have a local shipment record (label created) -> That order is "Complete" for you.
      // 2. If Square Sync already marked it as COMPLETED -> That order is "Complete".
      // 3. If Square Sync marked it as PAID -> Keep it as "Paid".
      // 4. Otherwise -> It's "Open" (To-Do).

      const currentStatus = String(order.status).toLowerCase();

      if (order.shipment?.status === "label_created" || currentStatus === "complete") {
        finalStatus = "complete";
      } else if (currentStatus === "paid") {
        finalStatus = "paid";
      } else if (currentStatus === "expired" || currentStatus === "canceled") {
        finalStatus = "expired";
      } else if (currentStatus === "pending") {
        finalStatus = "pending";
      } else {
        finalStatus = "open";
      }

      const updatedOrder = { ...order, status: finalStatus };

      if (manualEdits[order.id]) {
        return { ...updatedOrder, ...manualEdits[order.id], manuallyEdited: true };
      }
      return updatedOrder;
    }).sort((a, b) => (b.created || 0) - (a.created || 0));

    // Dedup by ID - Square data will overwrite website data because it came later in the array
    const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.id, item])).values());

    return new NextResponse(JSON.stringify({ orders: uniqueOrders }), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (e) {
    console.error('[orders/list] KV fetch error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

