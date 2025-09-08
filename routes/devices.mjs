import express from "express";
import fs from "fs";
import path from "path";

import { getDevices as storeGetDevices, saveDevices as storeSaveDevices, upsertDevice } from "./devices_store.mjs";

// Ensure firmware directory path used for downloads
const firmwareDir = path.join(process.cwd(), "firmware");
try { if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true }); } catch {}

// Base URL of Fly.io server for persistent device registry
const SERVER_BASE = process.env.CALCAI_SERVER_BASE || process.env.FLY_SERVER_BASE || process.env.SERVER_BASE || "http://localhost:3000";
const FORWARD_TOKEN = process.env.SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN;

export function devices() {
  const router = express.Router();

  // Use shared store helpers so public ingest and admin share the same data (still used by firmware download)
  const loadDevices = storeGetDevices;
  const saveDevices = storeSaveDevices;

  // Device registration endpoint
  router.post("/register", (req, res) => {
    const { mac, chipId, model, firmware, firstSeen } = req.body;

    if (!mac) {
      return res.status(400).json({ error: "MAC address required" });
    }

    const devices = loadDevices();
    const deviceId = mac.replace(/:/g, '').toLowerCase();

    const deviceInfo = {
      mac: mac,
      chipId: chipId || '',
      model: model || 'ESP32C3',
      firmware: firmware || '1.0.0',
      firstSeen: firstSeen || new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'online',
      name: `CalcAI-${mac.slice(-5)}`,
      updateAvailable: false,
      targetFirmware: null
    };

    // Update existing device or create new one
    if (devices[deviceId]) {
      devices[deviceId] = {
        ...devices[deviceId],
        lastSeen: new Date().toISOString(),
        status: 'online',
        firmware: firmware || devices[deviceId].firmware
      };
    } else {
      devices[deviceId] = deviceInfo;
    }

    saveDevices(devices);

    console.log(`Device registered: ${deviceId} (${mac})`);
    res.json({
      success: true,
      deviceId: deviceId,
      updateAvailable: devices[deviceId].updateAvailable,
      targetFirmware: devices[deviceId].targetFirmware
    });
  });

  // Check for updates endpoint
  router.get("/check-update/:deviceId", (req, res) => {
    const { deviceId } = req.params;
    const { currentVersion } = req.query;

    const devices = loadDevices();
    const device = devices[deviceId];

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Update last seen
    device.lastSeen = new Date().toISOString();
    device.status = 'online';
    if (currentVersion) {
      device.firmware = currentVersion;
    }

    saveDevices(devices);

    // Check if update is available
    if (device.updateAvailable && device.targetFirmware) {
      res.json({
        updateAvailable: true,
        version: device.targetFirmware,
        downloadUrl: `/api/devices/firmware/${device.targetFirmware}`
      });
    } else {
      res.json({ updateAvailable: false });
    }
  });

  // Download firmware endpoint
  router.get("/firmware/:version", (req, res) => {
    const { version } = req.params;
    const firmwarePath = path.join(firmwareDir, `${version}.bin`);

    if (!fs.existsSync(firmwarePath)) {
      return res.status(404).json({ error: "Firmware not found" });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${version}.bin"`);
    res.sendFile(path.resolve(firmwarePath));
  });

  // Get all devices (proxy to Fly server persistent registry)
  router.get("/list", async (req, res) => {
    try {
      const resp = await fetch(`${SERVER_BASE}/api/devices/list-public`, {
        headers: {
          ...(FORWARD_TOKEN ? { "X-Service-Token": FORWARD_TOKEN } : {}),
        },
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => ({}));
        return res.json(json);
      }
      // Fallback: return local store so dashboard still shows devices if Fly proxy fails
      const fallback = loadDevices();
      console.warn(`[dashboard] list proxy non-200 ${resp.status}; serving fallback store`);
      return res.status(200).json(fallback);
    } catch (e) {
      console.error("[dashboard] list proxy error:", e?.message || e);
      const fallback = loadDevices();
      return res.status(200).json(fallback);
    }
  });

  // Update device settings (proxy to Fly server persistent registry)
  router.put("/update/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const updates = req.body || {};
      const resp = await fetch(`${SERVER_BASE}/api/devices/update/${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(FORWARD_TOKEN ? { "X-Service-Token": FORWARD_TOKEN } : {}),
        },
        body: JSON.stringify({
          updateAvailable: updates.updateAvailable,
          targetFirmware: updates.targetFirmware,
        }),
      });
      const status = resp.status;
      const json = await resp.json().catch(() => ({}));
      return res.status(status).json(json);
    } catch (e) {
      console.error("[dashboard] update proxy error:", e?.message || e);
      res.status(500).json({ error: "update_proxy_failed" });
    }
  });

  // Delete device
  router.delete("/delete/:deviceId", (req, res) => {
    const { deviceId } = req.params;

    const devices = loadDevices();

    if (!devices[deviceId]) {
      return res.status(404).json({ error: "Device not found" });
    }

    delete devices[deviceId];
    saveDevices(devices);

    res.json({ success: true });
  });

  return router;
}
