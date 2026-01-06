import { NextResponse } from 'next/server';
import { getKvClient } from '@/lib/kv';
import { getHoodpayClient } from '@/lib/hoodpay';

type CustomOrder = {
  id: string;
  type: "custom";
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

export async function GET() {
  const hoodpay = getHoodpayClient();
  if (!hoodpay) {
    return NextResponse.json(
      { error: 'Hoodpay not configured. Set HOODPAY_API_KEY and HOODPAY_BUSINESS_ID.' },
      { status: 500 }
    );
  }

  try {
    const kv = getKvClient();

    // Fetch payments from Hoodpay
    const paymentsResponse = await hoodpay.payments.list({
      pageSize: 100,
      pageNumber: 1,
    });

    const payments = paymentsResponse.data || [];
    
    // Get shipment records for all payments
    const shipmentKeys = payments.map((p) => `orders:shipment:${p.id}`);
    const shipments = await Promise.all(shipmentKeys.map((k) => kv.get<any>(k)));

    // Get shipping addresses from KV (stored when order is placed)
    const addressKeys = payments.map((p) => `orders:address:${p.id}`);
    const addresses = await Promise.all(addressKeys.map((k) => kv.get<any>(k)));

    const hoodpayOrders = payments.map((payment, idx) => {
      // Map Hoodpay status to our status
      const status = payment.status?.toLowerCase() || 'unknown';
      let mappedStatus = status;
      if (status === 'completed' || status === 'complete') mappedStatus = 'complete';
      if (status === 'cancelled' || status === 'canceled') mappedStatus = 'expired';
      if (status === 'expired') mappedStatus = 'expired';

      const address = addresses[idx];
      
      return {
        id: payment.id,
        type: "hoodpay" as const,
        created: Math.floor(new Date(payment.createdAt).getTime() / 1000),
        amount: Math.round((payment.endAmount || 0) * 100), // Convert to cents
        currency: payment.currency || 'usd',
        status: mappedStatus,
        paymentStatus: status,
        customerEmail: payment.customerEmail || payment.customer?.email || '',
        customerName: payment.name || '',
        shippingAddress: address ? {
          line1: address.line1 || '',
          line2: address.line2 || undefined,
          city: address.city || '',
          state: address.state || '',
          postal_code: address.postal_code || '',
          country: address.country || '',
        } : null,
        items: [{
          description: payment.description || payment.name || 'CalcAI Product',
          quantity: 1,
          amount: Math.round((payment.endAmount || 0) * 100),
        }],
        paymentMethod: payment.selectedPaymentMethod || payment.paymentMethod || 'Crypto',
        shipment: shipments[idx] || null,
      };
    });

    // Fetch custom orders from KV
    const customOrders = await kv.get<CustomOrder[]>(CUSTOM_ORDERS_KEY) || [];
    
    // Get shipments for custom orders
    const customShipmentKeys = customOrders.map((o) => `orders:shipment:${o.id}`);
    const customShipments = await Promise.all(customShipmentKeys.map((k) => kv.get<any>(k)));
    
    const customOrdersWithShipments = customOrders.map((order, idx) => ({
      ...order,
      shipment: customShipments[idx] || null,
    }));

    // Combine and sort by created date (newest first)
    const allOrders = [...hoodpayOrders, ...customOrdersWithShipments].sort((a, b) => b.created - a.created);

    return NextResponse.json({ orders: allOrders });
  } catch (e) {
    console.error('[orders/list] Error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
