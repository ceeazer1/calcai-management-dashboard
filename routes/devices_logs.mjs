import express from "express";
import { getDevices, upsertDevice } from "./devices_store.mjs";

// Public logs ingest for forwarded device logs from calcai-server
export function devicesLogsPublic() {
  const router = express.Router();
  router.use(express.json({ limit: "500kb" }));

  router.post("/logs-ingest", (req, res) => {
    const required = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN;
    const token = req.header("X-Service-Token") || req.header("x-service-token");
    if (required && token !== required) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const { mac, chipId = "", lines = [] } = req.body || {};
    if (!mac || !Array.isArray(lines)) return res.status(400).json({ ok: false, error: "mac and lines required" });

    try {
      // Upsert device if needed
      upsertDevice({ mac, chipId });
      // Store last N lines on the device record in memory
      const devices = getDevices();
      const id = mac.replace(/:/g, '').toLowerCase();
      const arr = devices[id].logs || [];
      const appended = arr.concat(lines).slice(-500); // keep last 500 lines
      devices[id].logs = appended;
      res.json({ ok: true, stored: appended.length });
    } catch (e) {
      console.error("[dashboard-logs] error:", e?.message || e);
      res.status(500).json({ ok: false });
    }
  });

  return router;
}

