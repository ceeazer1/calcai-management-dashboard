import express from "express";
import fs from "fs";
import path from "path";

export function devices() {
  const router = express.Router();
  
  // In-memory storage for serverless environment
  // Note: In production, you'd want to use a database like Vercel KV or external service
  let devicesData = {};

  // Load devices from memory (fallback data)
  function loadDevices() {
    // In serverless environment, return in-memory data or default
    if (Object.keys(devicesData).length === 0) {
      // Initialize with some default data if needed
      devicesData = {
        "sample-device": {
          id: "sample-device",
          name: "Sample CalcAI Device",
          lastSeen: new Date().toISOString(),
          version: "1.0.0",
          status: "offline"
        }
      };
    }
    return devicesData;
  }

  // Save devices to memory
  function saveDevices(devices) {
    // In serverless environment, just update in-memory data
    // In production, you'd save to a database
    devicesData = devices;
    console.log('Devices updated in memory:', Object.keys(devices).length, 'devices');
  }
  
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
  
  // Get all devices (for dashboard)
  router.get("/list", (req, res) => {
    const devices = loadDevices();
    
    // Mark devices as offline if not seen in 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    Object.values(devices).forEach(device => {
      if (new Date(device.lastSeen) < fiveMinutesAgo) {
        device.status = 'offline';
      }
    });
    
    saveDevices(devices);
    res.json(devices);
  });
  
  // Update device settings
  router.put("/update/:deviceId", (req, res) => {
    const { deviceId } = req.params;
    const updates = req.body;
    
    const devices = loadDevices();
    const device = devices[deviceId];
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Update allowed fields
    const allowedFields = ['name', 'updateAvailable', 'targetFirmware'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        device[field] = updates[field];
      }
    });
    
    saveDevices(devices);
    res.json({ success: true, device: device });
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
