const { getKvClient } = require('./src/lib/kv');
const kv = getKvClient();

async function run() {
    console.log('--- KV DATABASE DIAGNOSTIC ---');
    try {
        const keys = await kv.keys('orders:*');
        console.log('Found Keys:', keys);

        for (const key of keys) {
            console.log(`\nInspecting Key: ${key}`);
            const data = await kv.get(key);

            if (Array.isArray(data)) {
                console.log(`- Type: Array`);
                console.log(`- Count: ${data.length}`);
                if (data.length > 0) {
                    console.log(`- Sample Item (First):`);
                    const item = data[0];
                    console.log(`  * ID: ${item.id}`);
                    console.log(`  * Name: ${item.customerName}`);
                    console.log(`  * Status: ${item.status}`);
                    console.log(`  * Date: ${new Date(item.created * 1000).toLocaleString()}`);
                }
            } else {
                console.log(`- Type: ${typeof data}`);
                if (data && typeof data === 'object') {
                    console.log(`- Keys: ${Object.keys(data).length}`);
                }
            }
        }
    } catch (err) {
        console.error('Diagnostic failed:', err);
    }
}

run();
