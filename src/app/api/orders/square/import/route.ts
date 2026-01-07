import { NextResponse } from 'next/server';
import { getSquareClient } from '@/lib/square';
import { getKvClient } from '@/lib/kv';

const SQUARE_ORDERS_KEY = 'orders:square:imported';

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

        // Fetch orders from Square
        const response = await square.orders.search({
            locationIds: process.env.SQUARE_LOCATION_IDS?.split(',') || undefined,
            query: {
                filter: {
                    stateFilter: {
                        states: ['COMPLETED', 'OPEN']
                    }
                },
                sort: {
                    sortField: 'CREATED_AT',
                    sortOrder: 'DESC',
                },
            },
            limit: 100,
        });

        const orders = response.orders || [];

        // Transform Square orders to our format
        const transformedOrders = await Promise.all(
            orders.map(async (order: any) => {
                // Get customer info if customer_id exists
                let customerEmail = '';
                let customerName = '';

                if (order.customerId) {
                    try {
                        const customerResponse = await square.customers.get({ customerId: order.customerId });
                        customerEmail = customerResponse.customer?.emailAddress || '';
                        customerName = `${customerResponse.customer?.givenName || ''} ${customerResponse.customer?.familyName || ''}`.trim();
                    } catch (e) {
                        console.error(`Failed to fetch customer ${order.customerId}:`, e);
                    }
                }

                // Extract shipping address
                let shippingAddress = null;
                if (order.fulfillments && order.fulfillments.length > 0) {
                    const shipmentFulfillment = order.fulfillments.find((f: any) => f.type === 'SHIPMENT');
                    if (shipmentFulfillment?.shipmentDetails?.recipient?.address) {
                        const addr = shipmentFulfillment.shipmentDetails.recipient.address;
                        shippingAddress = {
                            line1: addr.addressLine1 || '',
                            line2: addr.addressLine2 || undefined,
                            city: addr.locality || '',
                            state: addr.administrativeDistrictLevel1 || '',
                            postal_code: addr.postalCode || '',
                            country: addr.country || 'US',
                        };

                        // Get customer name from recipient if not already set
                        if (!customerName) {
                            customerName = shipmentFulfillment.shipmentDetails.recipient.displayName || '';
                        }
                        if (!customerEmail) {
                            customerEmail = shipmentFulfillment.shipmentDetails.recipient.emailAddress || '';
                        }
                    }
                }

                // Extract line items
                const items = (order.lineItems || []).map((item: any) => ({
                    description: item.name || 'Unknown Item',
                    quantity: parseInt(item.quantity || '1'),
                    amount: parseInt(item.totalMoney?.amount || '0'),
                }));

                // Determine status
                let status = 'open';
                if (order.state === 'COMPLETED') status = 'complete';
                else if (order.state === 'CANCELED') status = 'expired';
                else if (order.state === 'DRAFT') status = 'pending';

                return {
                    id: order.id || '',
                    type: 'square' as const,
                    created: order.createdAt ? Math.floor(new Date(order.createdAt).getTime() / 1000) : 0,
                    amount: parseInt(order.totalMoney?.amount || '0'),
                    currency: order.totalMoney?.currency?.toLowerCase() || 'usd',
                    status,
                    paymentStatus: order.state || 'unknown',
                    customerEmail,
                    customerName,
                    shippingAddress,
                    items,
                    receiptUrl: order.receiptUrl,
                    notes: order.note,
                };
            })
        );

        // Store in KV for caching
        await kv.set(SQUARE_ORDERS_KEY, transformedOrders);

        return NextResponse.json({
            ok: true,
            count: transformedOrders.length,
            orders: transformedOrders
        });
    } catch (e) {
        console.error('[orders/square/import] Error:', e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Failed to import orders from Square' },
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
