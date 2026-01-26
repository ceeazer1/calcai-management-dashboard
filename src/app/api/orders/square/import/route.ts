import { NextResponse } from 'next/server';
import { getSquareClient } from '@/lib/square';
import { getKvClient } from '@/lib/kv';

const SQUARE_ORDERS_KEY = 'orders:square:imported';

// Helper to handle BigInt serialization
const replacer = (key: string, value: any) => {
    return typeof value === 'bigint' ? value.toString() : value;
};

export async function POST() {
    const square = getSquareClient();

    if (!square) {
        return NextResponse.json(
            { error: 'Square not configured. Set SQUARE_ACCESS_TOKEN in environment variables.' },
            { status: 500 }
        );
    }

    try {
        const kv = getKvClient();

        // Fetch orders from Square (Reduced limit to prevent timeouts)
        let locationIds = process.env.SQUARE_LOCATION_IDS?.split(',') || undefined;

        if (!locationIds) {
            try {
                const locResp = await square.locations.list();
                const locations = locResp.locations || (locResp as any).result?.locations || [];
                if (locations.length > 0) {
                    locationIds = locations.map((l: any) => l.id);
                }
            } catch (e) {
                console.warn("[square/import] Failed to auto-detect locations:", e);
            }
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const response = await square.orders.search({
            locationIds,
            query: {
                filter: {
                    stateFilter: {
                        states: ['OPEN']
                    }
                },
                sort: {
                    sortField: 'UPDATED_AT',
                    sortOrder: 'DESC',
                },
            },
            limit: 100,
        });

        const orders = response.orders || (response as any).result?.orders || [];

        // Transform Square orders to our format (OPTIMIZED: No extra API calls inside loop)
        const transformedOrders = orders.map((order: any) => {
            try {
                let customerEmail = '';
                let customerName = '';
                let shippingAddress = null;

                // 1. Try to get details from fulfillments (Fastest & most accurate for online orders)
                if (order.fulfillments && order.fulfillments.length > 0) {
                    for (const f of order.fulfillments) {
                        const details = (f as any).shipmentDetails || (f as any).pickupDetails || (f as any).deliveryDetails;
                        const recipient = details?.recipient;

                        if (recipient) {
                            if (!customerEmail) customerEmail = recipient.emailAddress || '';
                            if (!customerName) customerName = recipient.displayName || '';

                            if (!shippingAddress && recipient.address) {
                                const addr = recipient.address;
                                shippingAddress = {
                                    line1: addr.addressLine1 || '',
                                    line2: addr.addressLine2 || undefined,
                                    city: addr.locality || '',
                                    state: addr.administrativeDistrictLevel1 || '',
                                    postal_code: addr.postalCode || '',
                                    country: addr.country || 'US',
                                };
                            }
                        }
                    }
                }

                // Fallback: Check order notes for email patterns
                if (!customerEmail && order.note) {
                    const emailMatch = order.note.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (emailMatch) {
                        customerEmail = emailMatch[0];
                    }
                }

                // 2. Determine line items
                const items = (order.lineItems || []).map((item: any) => ({
                    description: item.name || 'Unknown Item',
                    quantity: parseInt(String(item.quantity || '1')),
                    amount: parseInt(String(item.totalMoney?.amount || '0')),
                }));

                // 3. Determine status
                let status = 'open';
                const orderState = (order.state || '').toUpperCase();
                const isExplicitlyClosed = orderState === 'COMPLETED' || !!order.closedAt;
                const isPaid = (order.tenders && order.tenders.length > 0) ||
                    (orderState === 'COMPLETED' && parseInt(String(order.totalMoney?.amount || '0')) > 0);

                if (isExplicitlyClosed) status = 'complete';
                else if (isPaid) status = 'paid';
                else if (orderState === 'CANCELED') status = 'expired';
                else if (orderState === 'DRAFT') status = 'pending';
                else status = 'open';

                // Extract shipping method from line items if present
                let shippingMethod = undefined;
                if (order.lineItems) {
                    const shippingItem = order.lineItems.find((li: any) => li.name?.startsWith('Shipping ('));
                    if (shippingItem) {
                        const match = shippingItem.name.match(/\(([^)]+)\)/);
                        if (match) shippingMethod = match[1];
                    }
                }

                const result: any = {
                    id: order.id,
                    type: 'square' as const,
                    created: order.createdAt ? Math.floor(new Date(order.createdAt).getTime() / 1000) : 0,
                    amount: parseInt(String(order.totalMoney?.amount || '0')),
                    currency: order.totalMoney?.currency?.toLowerCase() || 'usd',
                    status,
                    paymentStatus: order.state || 'unknown',
                    paymentId: order.tenders?.[0]?.paymentId || order.tenders?.[0]?.payment_id || order.tenders?.[0]?.id || undefined,
                    customerEmail,
                    customerName,
                    shippingAddress,
                    shippingMethod,
                    items,
                    receiptUrl: order.receiptUrl,
                    notes: order.note,
                };

                // Filter out orders that don't have enough data to be useful
                if (!result.id || !result.customerEmail || result.amount === 0) {
                    console.warn(`[square/import] Skipping order ${order.id} due to missing essential data.`);
                    return null;
                }

                return result;
            } catch (err) {
                console.error(`Error transforming order ${order?.id}:`, err);
                return null;
            }
        }).filter(Boolean); // Filter out nulls

        // Sanitize transformed orders to ensure no BigInts remain (for KV and Response)
        const sanitizedOrders = JSON.parse(JSON.stringify(transformedOrders, replacer));

        // Store in KV for caching
        await kv.set(SQUARE_ORDERS_KEY, sanitizedOrders);

        return NextResponse.json({
            ok: true,
            count: sanitizedOrders.length,
            orders: sanitizedOrders
        });
    } catch (e: any) {
        console.error('[orders/square/import] Error:', e);
        return NextResponse.json(
            {
                error: e.message || 'An unknown error occurred',
                type: e.constructor?.name || 'UnknownError',
                details: typeof e === 'object' ? JSON.stringify(e, replacer) : String(e)
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const kv = getKvClient();
        const cachedOrders = await kv.get<any[]>(SQUARE_ORDERS_KEY);

        return NextResponse.json({
            ok: true,
            orders: cachedOrders || [],
            cached: !!cachedOrders
        });
    } catch (e) {
        console.error('[orders/square/import] Error fetching cached:', e);
        return NextResponse.json(
            { error: 'Failed to fetch cached Square orders' },
            { status: 500 }
        );
    }
}
