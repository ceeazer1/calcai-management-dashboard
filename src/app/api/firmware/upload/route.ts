import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CALCAI_SERVER_URL || 'https://calcai-server.fly.dev';

export async function POST(req: NextRequest) {
  try {
    const { version, dataBase64, description } = await req.json();
    if (!version || !dataBase64) {
      return NextResponse.json({ ok: false, error: 'version_and_data_required' }, { status: 400 });
    }

    const r = await fetch(`${API_BASE}/api/ota/firmware/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, dataBase64, description }),
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    console.error('[firmware/upload] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

