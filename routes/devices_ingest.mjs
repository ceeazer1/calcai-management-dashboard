import express from "express";
import { upsertDevice } from "./devices_store.mjs";

// Public ingest endpoint for server-to-server forward from calcai-server
// This file is mounted WITHOUT requireAuth. It validates X-Service-Token.

export function devicesIngestPublic() {
  const router = express.Router();
  router.use(express.json({ limit: "100kb" }));

  router.post("/register-ingest", (req, res) => {
    const required = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN;
    const token = req.header("X-Service-Token") || req.header("x-service-token");
    if (required && token !== required) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const { mac, chipId, model, firmware, firstSeen, uptime, rssi } = req.body || {};
    if (!mac) return res.status(400).json({ ok: false, error: "mac required" });

    try {
      const { deviceId } = upsertDevice({ mac, chipId, model, firmware, firstSeen });
      return res.json({ ok: true, deviceId });
    } catch (e) {
      console.error("[dashboard-ingest] error:", e?.message || e);
      return res.status(500).json({ ok: false });
    }
  });

  return router;
}

