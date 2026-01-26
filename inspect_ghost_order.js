const { getSquareClient } = require('./src/lib/square');

async function inspectOrder() {
    const square = getSquareClient();
    const orderId = 'hJcYETZ8Feb6UmK4ulAlo6p1CQdZY'; // The ghost order ID

    console.log(`--- INSPECTING ORDER: ${orderId} ---`);

    try {
        const response = await square.orders.retrieve(orderId);
        const order = response.order || (response.result ? response.result.order : null);

        if (!order) {
            console.log('ORDER NOT FOUND IN SQUARE API.');
            return;
        }

        console.log('Source:', order.source);
        console.log('State:', order.state);
        console.log('Total Money:', JSON.stringify(order.totalMoney));
        console.log('Tenders:', JSON.stringify(order.tenders));
        console.log('Fulfillments:', JSON.stringify(order.fulfillments));
        console.log('Metadata:', JSON.stringify(order.metadata));
        console.log('Created At:', order.createdAt);
        console.log('Location ID:', order.locationId);

    } catch (error) {
        console.error('Inspection Failed:', error);
    }
}

inspectOrder();
