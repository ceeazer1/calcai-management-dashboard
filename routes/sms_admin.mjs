import express from 'express';

export function smsAdmin(){
  const router = express.Router();
  router.use(express.json({ limit:'64kb' }));

  // Use global fetch when available; fall back to undici on older runtimes
  async function doFetch(url, options){
    const f = (typeof fetch !== 'undefined') ? fetch : (await import('undici')).fetch;
    return f(url, options);
  }

  const WEBSITE_BASE = (process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://calcai.cc').replace(/\/+$/, '');
  const ADMIN_API_TOKEN = (process.env.ADMIN_API_TOKEN || '').toString();

  // GET /api/sms-admin/subscribers?status=&search=&page=&limit=&format=csv|json
  router.get('/subscribers', async (req, res) => {
    try{
      const { status = '', search = '', page = '1', limit = '50', format = 'json' } = req.query;
      const p = new URLSearchParams();
      if (status) p.set('status', String(status));
      if (search) p.set('search', String(search));
      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(500, Math.max(1, parseInt(limit)));
      p.set('limit', String(pageSize));
      p.set('offset', String((pageNum-1)*pageSize));

      const r = await doFetch(`${WEBSITE_BASE}/api/admin/sms/subscribers?${p.toString()}`, {
        headers: ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : undefined,
      });
      if (!r.ok){
        const txt = await r.text();
        return res.status(r.status || 502).json({ ok:false, error:'fetch_failed', body: txt });
      }
      const j = await r.json();
      if (format === 'csv'){
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sms-subscribers.csv"');
        const rows = (j.rows||[]).map(r => [r.phone, r.status, r.source||'', r.consent_ts||''].map(v => '"'+String(v??'').replace(/"/g,'""')+'"').join(','));
        res.send(['phone,status,source,consent_ts', ...rows].join('\n'));
        return;
      }
      res.json(j);
    }catch(e){
      res.status(500).json({ ok:false, error:'server_error' });
    }
  });

  // POST /api/sms-admin/send-test { to, body }
  router.post('/send-test', async (req, res) => {
    try{
      const { to, body } = req.body || {};
      if (!to || !body) return res.status(400).json({ ok:false, error:'missing_params' });
      const r = await doFetch(`${WEBSITE_BASE}/api/admin/sms/send`, {
        method:'POST', headers: {
          'Content-Type':'application/json',
          ...(ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : {})
        }, body: JSON.stringify({ to, body })
      });
      const txt = await r.text();
      if (!r.ok) return res.status(r.status || 502).json({ ok:false, error:'send_failed', body: txt });
      const j = JSON.parse(txt);
      res.json(j);
    }catch(e){
      res.status(500).json({ ok:false, error:'server_error' });
    }
  });

  return router;
}

