const { getKvClient } = require('./src/lib/kv');
const kv = getKvClient();

async function listAllKeys() {
    console.log('--- KV ALL KEYS LIST ---');
    try {
        const keys = await kv.keys('*');
        console.log('Total keys:', keys.length);
        console.log('Keys:', JSON.stringify(keys, null, 2));
    } catch (err) {
        console.error('Failed to list keys:', err);
    }
}

listAllKeys();
