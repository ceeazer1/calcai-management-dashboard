import { NextResponse } from 'next/server';
import { getKvClient } from '@/lib/kv';

export async function GET() {
    const kv = getKvClient();
    try {
        const keys = await (kv as any).keys('*');
        const data: any = {};
        for (const key of keys) {
            data[key] = await kv.get(key);
        }
        return NextResponse.json({ keys, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
