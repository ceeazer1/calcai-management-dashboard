import { NextResponse } from 'next/server';

const API_BASE = process.env.CALCAI_SERVER_URL || 'https://calcai-server.fly.dev';

export async function GET() {
  try {
    const bust = Date.now();
    const r = await fetch(`${API_BASE}/api/ota/firmware/active?t=${bust}`, { cache: 'no-store' });
    if (!r.ok) {
      return NextResponse.json({ version: null }, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('[firmware/active] Error:', e);
    return NextResponse.json({ version: null }, { status: 500 });
  }
}

