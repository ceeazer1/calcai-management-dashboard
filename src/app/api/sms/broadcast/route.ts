import { NextRequest, NextResponse } from 'next/server';

// Ensure WEBSITE_URL has https:// prefix
const rawUrl = (process.env.WEBSITE_URL || 'https://www.calcai.cc').replace(/\/+$/, '');
const WEBSITE_BASE = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const { body } = await req.json();
    if (!body) {
      return NextResponse.json({ ok: false, error: 'missing_body' }, { status: 400 });
    }

    const r = await fetch(`${WEBSITE_BASE}/api/admin/sms/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : {}),
      },
      body: JSON.stringify({ body }),
    });

    const txt = await r.text();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'broadcast_failed', body: txt }, { status: r.status || 502 });
    }

    const j = JSON.parse(txt);
    return NextResponse.json(j);
  } catch (e) {
    console.error('[sms/broadcast] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

