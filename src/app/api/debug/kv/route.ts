import { NextResponse } from 'next/server';
import { getKvClient } from '@/lib/kv';
import { getSquareClient } from '@/lib/square';

export async function GET() {
    const kv = getKvClient();
    const square = getSquareClient();
    try {
        const keys = await (kv as any).keys('*');
        const data: any = {};
        for (const key of keys) {
            data[key] = await kv.get(key);
        }

        let locations = [];
        if (square) {
            const locResp = await square.locations.list();
            locations = locResp.locations || (locResp as any).result?.locations || [];
        }

        return NextResponse.json({ keys, data, locations });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
