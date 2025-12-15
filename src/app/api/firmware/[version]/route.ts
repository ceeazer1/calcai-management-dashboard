import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CALCAI_SERVER_URL || 'https://calcai-server.fly.dev';

type RouteContext = { params: Promise<{ version: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { version } = await context.params;
    if (!version) {
      return NextResponse.json({ ok: false, error: 'version_required' }, { status: 400 });
    }

    const r = await fetch(`${API_BASE}/api/ota/firmware/${encodeURIComponent(version)}`, {
      method: 'DELETE',
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    console.error('[firmware/delete] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

