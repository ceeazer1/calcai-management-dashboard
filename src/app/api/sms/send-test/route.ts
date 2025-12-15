import { NextRequest, NextResponse } from 'next/server';

const WEBSITE_BASE = (process.env.WEBSITE_URL || 'https://www.calcai.cc').replace(/\/+$/, '');
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const { to, body } = await req.json();
    if (!to || !body) {
      return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 });
    }

    const r = await fetch(`${WEBSITE_BASE}/api/admin/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : {}),
      },
      body: JSON.stringify({ to, body }),
    });

    const txt = await r.text();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'send_failed', body: txt }, { status: r.status || 502 });
    }

    const j = JSON.parse(txt);
    return NextResponse.json(j);
  } catch (e) {
    console.error('[sms/send-test] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

