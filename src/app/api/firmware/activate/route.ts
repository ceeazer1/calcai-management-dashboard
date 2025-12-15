import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CALCAI_SERVER_URL || 'https://calcai-server.fly.dev';

export async function POST(req: NextRequest) {
  try {
    const { version } = await req.json();
    if (!version) {
      return NextResponse.json({ ok: false, error: 'version_required' }, { status: 400 });
    }

    const r = await fetch(`${API_BASE}/api/ota/firmware/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    console.error('[firmware/activate] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

