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

      // Try a hypothetical server endpoint first (if implemented later)
      const tryResetUrl = `${SERVER_BASE}/api/pair/reset/${deviceId}`;
      try {
        const resp = await fetch(tryResetUrl, {
          method: "POST",
          headers: {
            ...(ADMIN_TOKEN ? { "X-Service-Token": ADMIN_TOKEN } : {}),
          },
        });
        if (resp.ok) {
          const json = await resp.json().catch(() => ({}));
          return res.json({ ok: true, mode: "reset", ...json });
        }
      } catch (_) {}

      // Fallback: generate a brand-new pairing code so user must re-pair
      // Note: This does not invalidate existing browser tokens on the server.
      // Those tokens are in-memory and clear on server restart. This fallback
      // at least provides the admin with a new code to guide users through setup.
      const mac = deviceId; // server accepts mac without colons
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

  return router;
}

