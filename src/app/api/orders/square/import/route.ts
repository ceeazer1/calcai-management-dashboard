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
                        states: ['COMPLETED', 'OPEN', 'CANCELED', 'DRAFT']
                    },
                    dateTimeFilter: {
                        updatedAt: {
                            startAt: oneYearAgo.toISOString()
                        }
                    }
                },
                sort: {
                    sortField: 'UPDATED_AT',
                    sortOrder: 'DESC',
                },
            },
            limit: 500,
        });

        const orders = response.orders || (response as any).result?.orders || [];

        // Transform Square orders to our format
        const transformedOrdersResults = await Promise.all(
            orders.map(async (order: any) => {
                try {
                    // Get customer info if customer_id exists
                    let customerEmail = '';
                    let customerName = '';

                    let squareCustomerId = order.customerId || order.tenders?.[0]?.customerId || order.tenders?.[0]?.customer_id;

                    if (squareCustomerId) {
                        try {
                            // Use retrieve(id) for newest Square SDK
                            const customerResponse = await (square as any).customers.retrieve(squareCustomerId);
                            customerEmail = (customerResponse as any).customer?.emailAddress || (customerResponse as any).result?.customer?.emailAddress || '';
                            const cust = (customerResponse as any).customer || (customerResponse as any).result?.customer;
                            if (cust) {
                                customerName = `${cust.givenName || ''} ${cust.familyName || ''}`.trim();
                            }
                        } catch (e) {
                            console.warn(`[square/import] Failed to fetch customer ${order.customerId}`);
                        }
                    }

                    // Extract shipping address and contact info from any fulfillment
                    let shippingAddress = null;
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

                    // Extract line items
                    const items = (order.lineItems || []).map((item: any) => ({
                        description: item.name || 'Unknown Item',
                        quantity: parseInt(String(item.quantity || '1')),
                        amount: parseInt(String(item.totalMoney?.amount || '0')),
                    }));

                    // Determine status
                    let status = 'open';
                    const orderState = (order.state || '').toUpperCase();

                    const isExplicitlyClosed = orderState === 'COMPLETED' || !!order.closedAt;
                    const isPaid = (order.tenders && order.tenders.length > 0) ||
                        (orderState === 'COMPLETED' && parseInt(String(order.totalMoney?.amount || '0')) > 0);

                    // If it's explicitly closed in Square, it's Complete.
                    if (isExplicitlyClosed) {
                        status = 'complete';
                    } else if (isPaid) {
                        // If it's paid but not closed, it shows as "Paid" (This replaces "Open")
                        status = 'paid';
                    } else if (orderState === 'CANCELED') {
                        status = 'expired';
                    } else if (orderState === 'DRAFT') {
                        status = 'pending';
                    } else {
                        status = 'open';
                    }

                    // Extract shipping method from line items if present
                    let shippingMethod = undefined;
                    if (order.lineItems) {
                        const shippingItem = order.lineItems.find((li: any) => li.name?.startsWith('Shipping ('));
                        if (shippingItem) {
                            const match = shippingItem.name.match(/\(([^)]+)\)/);
                            if (match) shippingMethod = match[1];
                        }
                    }

                    // Fallback: Check order notes for email patterns
                    if (!customerEmail && order.note) {
                        const emailMatch = order.note.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                        if (emailMatch) {
                            customerEmail = emailMatch[0];
                        }
                    }

                    const result: any = {
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
                        shippingMethod,
                        items,
                        receiptUrl: order.receiptUrl,
                        notes: order.note,
                    };

                    // Fallback: If paymentId or customerEmail is missing, try to find it via Payments API
                    if ((!result.paymentId || !result.customerEmail || !result.shippingAddress) && result.status !== 'canceled') {
                        try {
                            // @ts-ignore - SDK types might vary
                            const paymentsResp: any = await square.payments.list({ orderId: order.id } as any);
                            const payments = paymentsResp.payments || paymentsResp.result?.payments || [];
                            const payment = payments.find((p: any) => p.status === 'COMPLETED' || p.status === 'APPROVED' || p.status === 'AUTHORIZED');

                            if (payment) {
                                if (!result.paymentId) result.paymentId = payment.id;
                                if (!result.customerEmail) result.customerEmail = payment.buyerEmailAddress;

                                // Get shipping address from payment if order fulfillment was missing it
                                if (!result.shippingAddress && payment.shippingAddress) {
                                    const addr = payment.shippingAddress;
                                    result.shippingAddress = {
                                        line1: addr.addressLine1 || '',
                                        line2: addr.addressLine2 || undefined,
                                        city: addr.locality || '',
                                        state: addr.administrativeDistrictLevel1 || '',
                                        postal_code: addr.postalCode || '',
                                        country: addr.country || 'US',
                                    };
                                }
                            }
                        } catch (e: any) {
                            console.warn(`[square/import] Failed to fetch payment details for order ${order.id}: ${e.message}`);
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
