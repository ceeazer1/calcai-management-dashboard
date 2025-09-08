import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";


// Ensure firmware directory (persistent if possible, else /tmp) and define devices file path
let firmwareDir = process.env.FIRMWARE_DIR || path.join(process.cwd(), "firmware");
try {
  if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true });
  fs.accessSync(firmwareDir, fs.constants.W_OK);
} catch {
  // Fallback to tmp on platforms like Vercel where repo FS is read-only
  firmwareDir = path.join(os.tmpdir(), "firmware");
  try { if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true }); } catch {}
}
const devicesFile = path.join(process.cwd(), "devices.json");

export function ota() {
  const router = express.Router();

  // Upstream Fly server base for device updates (proxy writes there)
  const SERVER_BASE = process.env.CALCAI_SERVER_BASE || process.env.FLY_SERVER_BASE || process.env.SERVER_BASE || "http://localhost:3000";
  const FORWARD_TOKEN = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN || process.env.DEVICES_SERVICE_TOKEN;

  // Configure multer for in-memory uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      // Only accept .bin files
      if (file.originalname.endsWith('.bin')) {
        cb(null, true);
      } else {
        cb(new Error('Only .bin files are allowed'), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Load devices from file
  function loadDevices() {
    try {
      if (fs.existsSync(devicesFile)) {
        return JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
    return {};
  }

  // Save devices to file
  function saveDevices(devices) {
    try {
      fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2));
    } catch (error) {
      console.error('Error saving devices:', error);
    }
  }

  // Upload firmware endpoint
  router.post("/upload", upload.single('firmware'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No firmware file uploaded" });
    }

    const version = (req.body.version || '').trim() || 'firmware';
    const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
    const description = req.body.description || '';

    const filepath = path.join(firmwareDir, `${safeVersion}.bin`);
    try {
      fs.writeFileSync(filepath, req.file.buffer);
      console.log(`Firmware saved: ${filepath} (${req.file.size} bytes)`);
    } catch (e) {
      console.error('Failed to save firmware:', e);
      return res.status(500).json({ error: 'Failed to save firmware' });
    }

    // Forward a copy to Fly server persistent storage so OTA downloads never 404
    try {
      const body = JSON.stringify({ version: safeVersion, dataBase64: req.file.buffer.toString('base64') });
      const resp = await fetch(`${SERVER_BASE}/api/ota/firmware/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(FORWARD_TOKEN ? { 'X-Service-Token': FORWARD_TOKEN } : {}) },
        body,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.warn(`[ota] forward to Fly failed ${resp.status}: ${txt}`);
      } else {
        const j = await resp.json().catch(() => ({}));
        console.log(`[ota] forwarded firmware to Fly:`, j);
      }
    } catch (e) {
      console.warn('[ota] error forwarding firmware to Fly:', e?.message || e);
    }

    res.json({
      success: true,
      version: safeVersion,
      filename: `${safeVersion}.bin`,
      size: req.file.size,
      description: description
    });
  });

  // List available firmware versions
  router.get("/firmware/list", (req, res) => {
    try {
      const files = fs.readdirSync(firmwareDir)
        .filter(file => file.endsWith('.bin'))
        .map(file => {
          const stats = fs.statSync(path.join(firmwareDir, file));
          return {
            version: path.basename(file, '.bin'),
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      res.json(files);
    } catch (error) {
      console.error('Error listing firmware:', error);
      res.status(500).json({ error: "Failed to list firmware" });
    }
  });

  // Push update to devices (proxy to Fly persistent registry)
  router.post("/push-update", async (req, res) => {
    try {
      const { version, deviceIds, allDevices } = req.body || {};
      if (!version) {
        return res.status(400).json({ error: "Firmware version required" });
      }

      // Skip local FS existence check in serverless; Fly will fetch via public token-protected route
      // Optionally we could HEAD the public route here, but it's non-blocking for now.

      // If pushing to ALL devices, ask the Fly server to set flags in its own persistent store
      if (allDevices) {
        try {
          const resp = await fetch(`${SERVER_BASE}/api/devices/update-all`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(FORWARD_TOKEN ? { 'X-Service-Token': FORWARD_TOKEN } : {}),
            },
            body: JSON.stringify({ version }),
          });
          if (resp.ok) {
            const json = await resp.json().catch(() => ({}));
            const updatedCount = json.devicesUpdated || 0;
            console.log(`Pushed update ${version} to ${updatedCount} devices (via update-all)`);
            return res.json({ success: true, version, devicesUpdated: updatedCount, message: `Update pushed to ${updatedCount} device(s)` });
          } else {
            const text = await resp.text().catch(() => '');
            console.error(`[ota] update-all failed ${resp.status}: ${text}`);
            return res.status(resp.status).json({ error: `update_all_failed_${resp.status}`, detail: text });
          }
        } catch (e) {
          console.error('[ota] update-all proxy error:', e?.message || e);
          return res.status(500).json({ error: 'update_all_proxy_failed' });
        }
      }

      // Otherwise, resolve target device IDs from provided list (single-device push)
      let targets = Array.isArray(deviceIds) ? [...deviceIds] : [];
      let updatedCount = 0;
      for (const id of targets) {
        try {
          const u = await fetch(`${SERVER_BASE}/api/devices/update/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(FORWARD_TOKEN ? { 'X-Service-Token': FORWARD_TOKEN } : {}),
            },
            body: JSON.stringify({ updateAvailable: true, targetFirmware: version }),
          });
          if (u.ok) updatedCount++;
        } catch (e) {
          console.error('[ota] update proxy error:', e?.message || e);
        }
      }

      console.log(`Pushed update ${version} to ${updatedCount} devices`);
      return res.json({ success: true, version, devicesUpdated: updatedCount, message: `Update pushed to ${updatedCount} device(s)` });
    } catch (e) {
      console.error('[ota] push-update error:', e?.message || e);
      return res.status(500).json({ error: 'push_update_failed' });
    }
  });

  // Cancel pending updates (proxy to Fly persistent registry)
  router.post("/cancel-update", async (req, res) => {
    try {
      const { deviceIds, allDevices } = req.body || {};

      // Resolve targets
      let targets = Array.isArray(deviceIds) ? [...deviceIds] : [];
      if (allDevices) {
        try {
          const resp = await fetch(`${SERVER_BASE}/api/devices/list-public`, {
            headers: { ...(FORWARD_TOKEN ? { "X-Service-Token": FORWARD_TOKEN } : {}) },
          });
          if (resp.ok) {
            const json = await resp.json().catch(() => ({}));
            targets = Object.keys(json || {});
          }
        } catch (e) {
          console.error('[ota] fetch list-public failed:', e?.message || e);
        }
      }

      let cancelledCount = 0;
      for (const id of targets) {
        try {
          const u = await fetch(`${SERVER_BASE}/api/devices/update/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(FORWARD_TOKEN ? { 'X-Service-Token': FORWARD_TOKEN } : {}),
            },
            body: JSON.stringify({ updateAvailable: false, targetFirmware: null }),
          });
          if (u.ok) cancelledCount++;
        } catch (e) {
          console.error('[ota] cancel update proxy error:', e?.message || e);
        }
      }

      return res.json({ success: true, devicesCancelled: cancelledCount, message: `Updates cancelled for ${cancelledCount} device(s)` });
    } catch (e) {
      console.error('[ota] cancel-update error:', e?.message || e);
      return res.status(500).json({ error: 'cancel_update_failed' });
    }
  });

  // Delete firmware file
  router.delete("/firmware/:version", (req, res) => {
    const { version } = req.params;
    const firmwarePath = path.join(firmwareDir, `${version}.bin`);

    if (!fs.existsSync(firmwarePath)) {
      return res.status(404).json({ error: "Firmware file not found" });
    }

    try {
      fs.unlinkSync(firmwarePath);
      console.log(`Deleted firmware: ${version}`);
      res.json({ success: true, message: `Firmware ${version} deleted` });
    } catch (error) {
      console.error('Error deleting firmware:', error);
      res.status(500).json({ error: "Failed to delete firmware" });
    }
  });

  return router;
}
