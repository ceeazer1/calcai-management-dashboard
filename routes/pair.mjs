import express from "express";

// Proxy pairing management to calcai-server with graceful fallback
// POST /api/pair/reset/:deviceId -> attempts to invalidate website pairing for the MAC
// Fallback: generate a fresh pairing code so the user can re-pair
export function pairAdmin() {
  const router = express.Router();

  const SERVER_BASE = (process.env.CALCAI_SERVER_BASE || process.env.FLY_SERVER_BASE || process.env.SERVER_BASE || "https://calcai-server.fly.dev").replace(/\/+$/, "");
  const ADMIN_TOKEN = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN || process.env.DEVICES_SERVICE_TOKEN || "";

  // Normalize id to 12-hex MAC without colons
  function normalizeId(raw) {
    return String(raw || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  }

  router.post("/reset/:deviceId", async (req, res) => {
    try {
      const deviceId = normalizeId(req.params.deviceId);
      if (!deviceId || deviceId.length !== 12) {
        return res.status(400).json({ ok: false, error: "bad_deviceId" });
      }

      let rotated = null;
      // Try server reset (rotate code + clear web tokens)
      const tryResetUrl = `${SERVER_BASE}/api/pair/reset/${deviceId}`;
      try {
        const resp = await fetch(tryResetUrl, {
          method: "POST",
          headers: {
            ...(ADMIN_TOKEN ? { "X-Service-Token": ADMIN_TOKEN } : {}),
          },
        });
        if (resp.ok) rotated = await resp.json().catch(() => ({}));
      } catch (_) {}

      // Always clear notes so the calculator shows pairing/setup again
      try {
        await fetch(`${SERVER_BASE}/api/notes/${deviceId}`, {
          method: "DELETE",
          headers: {
            ...(ADMIN_TOKEN ? { "X-Service-Token": ADMIN_TOKEN } : {}),
          },
        });
      } catch {}

      if (rotated && rotated.ok) {
        return res.json({ ok: true, mode: "reset", ...rotated });
      }

      // Fallback: ensure a code exists to guide re-pair
      const mac = deviceId;
      const startUrl = `${SERVER_BASE}/api/pair/start?mac=${encodeURIComponent(mac)}`;
      const s = await fetch(startUrl);
      if (!s.ok) {
        const text = await s.text().catch(() => "");
        return res.status(502).json({ ok: false, error: "pair_start_failed", detail: text });
      }
      const code = await s.text().catch(() => "");
      return res.json({ ok: true, mode: "fallback_code", code });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "reset_failed" });
    }
  });

  // Get current pairing code for a device (persistent)
  router.get("/code/:deviceId", async (req, res) => {
    try {
      const deviceId = normalizeId(req.params.deviceId);
      if (!deviceId || deviceId.length !== 12) {
        return res.status(400).json({ ok: false, error: "bad_deviceId" });
      }
      const url = `${SERVER_BASE}/api/pair/start?mac=${encodeURIComponent(deviceId)}`;
      const r = await fetch(url);
      const text = await r.text().catch(() => "");
      if (!r.ok) return res.status(502).json({ ok: false, error: "pair_code_failed", detail: text });
      return res.json({ ok: true, code: text });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "code_failed" });
    }
  });

  return router;
}

