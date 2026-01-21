import { getKvClient } from '@/lib/kv'; const kv=getKvClient(); const keys = await kv.keys('orders:*'); console.log(keys);
