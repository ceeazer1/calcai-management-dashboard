import express from 'express';

export function smsAdmin(){
  const router = express.Router();
  router.use(express.json({ limit:'64kb' }));

  // Use global fetch when available; fall back to undici on older runtimes
  async function doFetch(url, options){
    const f = (typeof fetch !== 'undefined') ? fetch : (await import('undici')).fetch;
    return f(url, options);
  }

  let WEBSITE_BASE = (process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://calcai.cc').replace(/\/+$/, '');
  // Ensure protocol is present
  if (!/^https?:\/\//i.test(WEBSITE_BASE)) {
    WEBSITE_BASE = 'https://' + WEBSITE_BASE;
  }
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

      console.log('[sms_admin] Fetching subscribers from:', `${WEBSITE_BASE}/api/admin/sms/subscribers?${p.toString()}`);
      console.log('[sms_admin] ADMIN_API_TOKEN set:', !!ADMIN_API_TOKEN);

      const r = await doFetch(`${WEBSITE_BASE}/api/admin/sms/subscribers?${p.toString()}`, {
        headers: ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : undefined,
      });

      console.log('[sms_admin] Response status:', r.status);

      if (!r.ok){
        const txt = await r.text();
        console.error('[sms_admin] Fetch failed:', r.status, txt);
        return res.status(r.status || 502).json({ ok:false, error:'fetch_failed', status: r.status, body: txt });
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
      console.error('[sms_admin] Exception in /subscribers:', e);
      res.status(500).json({ ok:false, error:'server_error', message: e.message });
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

  // POST /api/sms-admin/broadcast { body }
  router.post('/broadcast', async (req, res) => {
    try{
      const { body } = req.body || {};
      if (!body) return res.status(400).json({ ok:false, error:'missing_body' });

      console.log('[sms_admin] Broadcasting to all subscribers');

      const r = await doFetch(`${WEBSITE_BASE}/api/admin/sms/broadcast`, {
        method:'POST', headers: {
          'Content-Type':'application/json',
          ...(ADMIN_API_TOKEN ? { 'x-admin-token': ADMIN_API_TOKEN } : {})
        }, body: JSON.stringify({ body })
      });

      const txt = await r.text();
      if (!r.ok){
        console.error('[sms_admin] Broadcast failed:', r.status, txt);
        return res.status(r.status || 502).json({ ok:false, error:'broadcast_failed', body: txt });
      }
      const j = JSON.parse(txt);
      res.json(j);
    }catch(e){
      console.error('[sms_admin] Exception in /broadcast:', e);
      res.status(500).json({ ok:false, error:'server_error', message: e.message });
    }
  });

  return router;
}

