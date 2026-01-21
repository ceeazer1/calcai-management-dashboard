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

    const allOrders = [
      ...customOrdersWithShipments,
      ...squareOrdersWithShipments,
      ...websiteOrdersWithShipments
    ].sort((a, b) => (b.created || 0) - (a.created || 0));

    // Dedup by ID just in case
    const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.id, item])).values());

    return NextResponse.json({ orders: uniqueOrders });

  } catch (e) {
    console.error('[orders/list] KV fetch error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
