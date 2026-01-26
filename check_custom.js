const { getKvClient } = require('./src/lib/kv');
const kv = getKvClient();

async function checkCustomList() {
    console.log('--- CHECKING CUSTOM LIST ---');
    try {
        const custom = await kv.get('orders:custom:list') || [];
        console.log('Total items in custom list:', custom.length);

        for (const o of custom) {
            if (o) {
                console.log(`- ID: ${o.id}, Name: ${o.customerName}, Status: ${o.status}`);
            }
        }
    } catch (err) {
        console.error('Failed to check custom list:', err);
    }
}

checkCustomList();
