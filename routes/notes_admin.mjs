import express from "express";

export function notesAdmin() {
  const router = express.Router();

  const SERVER_BASE = (process.env.CALCAI_SERVER_BASE || process.env.FLY_SERVER_BASE || process.env.SERVER_BASE || "https://calcai-server.fly.dev").replace(/\/+$/, "");
  const ADMIN_TOKEN = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN || process.env.DEVICES_SERVICE_TOKEN || "";

  function normalizeId(raw) {
    return String(raw || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  }

  // GET notes for a device (proxy)
  router.get("/:deviceId", async (req, res) => {
    try {
      const deviceId = normalizeId(req.params.deviceId);
      if (!deviceId || deviceId.length !== 12) {
        return res.status(400).json({ ok: false, error: "bad_deviceId" });
      }
      const url = `${SERVER_BASE}/api/notes/${encodeURIComponent(deviceId)}`;
      const r = await fetch(url, {
        headers: {
          ...(ADMIN_TOKEN ? { "X-Service-Token": ADMIN_TOKEN } : {}),
        },
      });
      const text = await r.text().catch(() => "");
      if (!r.ok) return res.status(502).json({ ok: false, error: "notes_failed" });
      return res.json({ ok: true, text });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "proxy_error" });
    }
  });

  return router;
}

