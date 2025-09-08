import express from "express";
import fs from "fs";
import path from "path";
import os from "os";

// Public (token-protected) firmware download route for OTA
// This allows the Fly server to fetch firmware binaries using an X-Service-Token
// without requiring a browser session cookie.

// Use the same directory logic as OTA upload: prefer process env or repo dir if writable, else fall back to tmp
let firmwareDir = process.env.FIRMWARE_DIR || path.join(process.cwd(), "firmware");
try {
  if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true });
  // try to access (may throw on read-only)
  fs.accessSync(firmwareDir, fs.constants.R_OK);
} catch {
  firmwareDir = path.join(os.tmpdir(), "firmware");
  try { if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true }); } catch {}
}

function checkToken(req, res) {
  // Accept either DASHBOARD_SERVICE_TOKEN or DEVICES_SERVICE_TOKEN
  const required = process.env.DASHBOARD_SERVICE_TOKEN || process.env.DEVICES_SERVICE_TOKEN;
  if (!required) return true; // if not configured, allow
  const headerToken = req.header("X-Service-Token") || req.header("x-service-token");
  if (!headerToken || headerToken !== required) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

export function firmwarePublic() {
  const router = express.Router();

  // GET /api/devices/firmware/:version
  router.get("/:version", (req, res) => {
    if (!checkToken(req, res)) return;
    const { version } = req.params;
    const firmwarePath = path.join(firmwareDir, `${version}.bin`);

    if (!fs.existsSync(firmwarePath)) {
      return res.status(404).json({ error: "Firmware not found" });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${version}.bin"`);
    res.sendFile(path.resolve(firmwarePath));
  });

  return router;
}

