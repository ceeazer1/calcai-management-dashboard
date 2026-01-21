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
            limit: 40,
        });

        const orders = response.orders || [];

        // Transform Square orders to our format
        const transformedOrdersResults = await Promise.all(
            orders.map(async (order: any) => {
                try {
                    // Get customer info if customer_id exists
                    let customerEmail = '';
                    let customerName = '';

                    if (order.customerId) {
                        try {
                            const customerResponse = await square.customers.get({ customerId: order.customerId });
                            customerEmail = customerResponse.customer?.emailAddress || '';
                            customerName = `${customerResponse.customer?.givenName || ''} ${customerResponse.customer?.familyName || ''}`.trim();
                        } catch (e) {
                            // Ignore customer fetch errors
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
                        quantity: parseInt(String(item.quantity || '1')),
                        amount: parseInt(String(item.totalMoney?.amount || '0')),
                    }));

                    // Determine status
                    let status = 'open';
                    if (order.state === 'COMPLETED') status = 'complete';
                    else if (order.state === 'CANCELED') status = 'expired';
                    else if (order.state === 'DRAFT') status = 'pending';

                    const result = {
                        id: order.id || '',
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
                        items,
                        receiptUrl: order.receiptUrl,
                        notes: order.note,
                    };

                    // Fallback: If paymentId is missing, try to find it via Payments API (for online checkout orders)
                    if (!result.paymentId && result.status !== 'canceled') {
                        try {
                            // @ts-ignore - SDK types might vary
                            const paymentsResp: any = await square.payments.list({ orderId: order.id } as any);
                            const payments = paymentsResp.payments || paymentsResp.result?.payments || [];
                            const payment = payments.find((p: any) => p.status === 'COMPLETED' || p.status === 'APPROVED');
                            if (payment?.id) {
                                result.paymentId = payment.id;
                            }
                        } catch (e: any) {
                            // Log but don't fail the order
                            console.warn(`[square/import] Failed to fetch payment ID for order ${order.id}: ${e.message}`);
                        }
                    }

                    return result;
                } catch (innerError) {
                    console.error(`Error processing order ${order?.id}:`, innerError);
                    return null;
                }
            })
        );

        const transformedOrders = transformedOrdersResults.filter((o: any) => o !== null);

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
