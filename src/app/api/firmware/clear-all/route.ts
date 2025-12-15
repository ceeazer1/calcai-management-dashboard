import { NextResponse } from 'next/server';

const API_BASE = process.env.CALCAI_SERVER_URL || 'https://calcai-server.fly.dev';

export async function DELETE() {
  try {
    const r = await fetch(`${API_BASE}/api/ota/firmware/clear-all`, {
      method: 'DELETE',
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    console.error('[firmware/clear-all] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

