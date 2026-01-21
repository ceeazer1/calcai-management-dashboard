import { getKvClient } from '@/lib/kv'; const kv=getKvClient(); const orders = await kv.get('orders:square:imported'); console.log(JSON.stringify(orders ? orders.slice(0, 3) : [], null, 2));
