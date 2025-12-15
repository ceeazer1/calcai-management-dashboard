import { NextRequest, NextResponse } from 'next/server';

const WEBSITE_BASE = (process.env.WEBSITE_URL || 'https://calcai.cc').replace(/\/+$/, '');
// Website expects ADMIN_API_TOKEN header, dashboard may have ADMIN_TOKEN
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN || '';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '50';
    const format = url.searchParams.get('format') || 'json';

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(500, Math.max(1, parseInt(limit)));
    params.set('limit', String(pageSize));
    params.set('offset', String((pageNum - 1) * pageSize));

    const fetchUrl = `${WEBSITE_BASE}/api/admin/sms/subscribers?${params.toString()}`;
    console.log('[sms/subscribers] Fetching:', fetchUrl);
    console.log('[sms/subscribers] Token set:', !!ADMIN_API_TOKEN);

    const r = await fetch(fetchUrl, {
      headers: ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : {},
      cache: 'no-store',
    });

    console.log('[sms/subscribers] Response status:', r.status);

    if (!r.ok) {
      const txt = await r.text();
      console.error('[sms/subscribers] Fetch failed:', r.status, txt);
      return NextResponse.json({ ok: false, error: 'fetch_failed', status: r.status, body: txt }, { status: r.status || 502 });
    }

    const j = await r.json();

    if (format === 'csv') {
      const rows = (j.rows || []).map((row: { phone: string; status: string; source?: string; consent_ts?: string }) => 
        [row.phone, row.status, row.source || '', row.consent_ts || '']
          .map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"')
          .join(',')
      );
      const csv = ['phone,status,source,consent_ts', ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sms-subscribers.csv"',
        },
      });
    }

    return NextResponse.json(j);
  } catch (e) {
    console.error('[sms/subscribers] Error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

