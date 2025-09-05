// Simple shared in-memory device store for serverless environments
// NOTE: In production, replace with a database (e.g., KV, Postgres).

let devicesData = {};

export function getDevices() {
  if (Object.keys(devicesData).length === 0) {
    devicesData = {
      "sample-device": {
        id: "sample-device",
        name: "Sample CalcAI Device",
        lastSeen: new Date().toISOString(),
        version: "1.0.0",
        status: "offline",
      },
    };
  }
  return devicesData;
}

export function saveDevices(devices) {
  devicesData = devices;
}

export function upsertDevice({ mac, chipId = "", model = "ESP32", firmware = "1.0.0", firstSeen }) {
  if (!mac) throw new Error("mac required");
  const devices = getDevices();
  const deviceId = mac.replace(/:/g, '').toLowerCase();
  const now = new Date().toISOString();

  if (devices[deviceId]) {
    devices[deviceId] = {
      ...devices[deviceId],
      mac,
      chipId,
      model: model || devices[deviceId].model,
      firmware: firmware || devices[deviceId].firmware,
      lastSeen: now,
      status: 'online',
    };
  } else {
    devices[deviceId] = {
      id: deviceId,
      name: `CalcAI-${mac.slice(-5)}`,
      mac,
      chipId,
      model,
      firmware,
      firstSeen: firstSeen || now,
      lastSeen: now,
      status: 'online',
      updateAvailable: false,
      targetFirmware: null,
    };
  }
  saveDevices(devices);
  return { deviceId, device: devices[deviceId] };
}

