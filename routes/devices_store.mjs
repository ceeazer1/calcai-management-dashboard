// Shared device store with best-effort file persistence.
// NOTE: In production, replace with a durable database (KV/SQL). On serverless,
// file writes may be ephemeral, but this still prevents devices disappearing
// within a single process and in local dev persists to devices.json.

import fs from "fs";
import path from "path";

let devicesData = {};
const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "devices.json");

function loadFromDisk() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf8");
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object") {
        devicesData = parsed;
      }
    }
  } catch (e) {
    console.warn("[devices_store] loadFromDisk failed:", e?.message || e);
  }
}

function saveToDisk() {
  try {
    // Ensure directory exists
    try { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    fs.writeFileSync(dataFile, JSON.stringify(devicesData, null, 2), "utf8");
  } catch (e) {
    // Non-fatal on serverless
  }
}

export function getDevices() {
  if (Object.keys(devicesData).length === 0) {
    loadFromDisk();
  }
  return devicesData;
}

export function saveDevices(devices) {
  devicesData = devices || {};
  saveToDisk();
}

export function upsertDevice({ mac, chipId = "", model = "ESP32", firmware = "1.0.0", firstSeen }) {
  if (!mac) throw new Error("mac required");
  const devices = getDevices();
  const deviceId = mac.replace(/:/g, '').toLowerCase();
  const now = new Date().toISOString();

  const existing = devices[deviceId] || {};
  devices[deviceId] = {
    id: deviceId,
    name: existing.name || `CalcAI-${mac.slice(-5)}`,
    mac,
    chipId: chipId || existing.chipId || "",
    model: model || existing.model || "ESP32",
    firmware: firmware || existing.firmware || "1.0.0",
    firstSeen: existing.firstSeen || firstSeen || now,
    lastSeen: now,
    status: 'online',
    updateAvailable: existing.updateAvailable || false,
    targetFirmware: existing.targetFirmware || null,
    logs: existing.logs || [],
  };

  saveDevices(devices);
  return { deviceId, device: devices[deviceId] };
}
