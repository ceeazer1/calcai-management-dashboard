from '@/lib/kv' import getKvClient; const kv=getKvClient(); const orders = await kv.get('orders:square:imported'); console.log(JSON.stringify(orders, null, 2));
