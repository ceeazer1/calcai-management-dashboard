import express from "express";

export function ownerAdmin(){
  const router = express.Router();
  const SERVER_BASE = (process.env.CALCAI_SERVER_BASE || process.env.FLY_SERVER_BASE || process.env.SERVER_BASE || "https://calcai-server.fly.dev").replace(/\/+$/, "");
  const ADMIN_TOKEN = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN || process.env.DEVICES_SERVICE_TOKEN || "";

  function normalizeId(raw){ return String(raw||"").toLowerCase().replace(/[^0-9a-f]/g, ""); }

  // GET owner username for a device
  router.get('/:deviceId', async (req, res) => {
    try {
      const deviceId = normalizeId(req.params.deviceId);
      if (!deviceId || deviceId.length !== 12) return res.status(400).json({ ok:false, error:'bad_deviceId' });
      const url = `${SERVER_BASE}/api/admin/devices/${encodeURIComponent(deviceId)}/owner`;
      const r = await fetch(url, { headers: { ...(ADMIN_TOKEN ? { 'X-Service-Token': ADMIN_TOKEN } : {}) } });
      const j = await r.json().catch(()=>({ ok:false }));
      if (!r.ok) return res.status(502).json({ ok:false, error: j.error || 'owner_failed' });
      return res.json(j);
    } catch { return res.status(500).json({ ok:false, error:'proxy_error' }); }
  });

  // POST reset password for owner of device (returns tempPassword)
  router.post('/:deviceId/reset', async (req, res) => {
    try {
      const deviceId = normalizeId(req.params.deviceId);
      if (!deviceId || deviceId.length !== 12) return res.status(400).json({ ok:false, error:'bad_deviceId' });
      const url = `${SERVER_BASE}/api/admin/devices/${encodeURIComponent(deviceId)}/reset-password`;
      const r = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', ...(ADMIN_TOKEN ? { 'X-Service-Token': ADMIN_TOKEN } : {}) } });
      const j = await r.json().catch(()=>({ ok:false }));
      if (!r.ok) return res.status(502).json({ ok:false, error: j.error || 'reset_failed' });
      return res.json(j);
    } catch { return res.status(500).json({ ok:false, error:'proxy_error' }); }
  });

  return router;
}

