import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";


// Ensure firmware directory and define devices file path
const firmwareDir = path.join(process.cwd(), "firmware");
try { if (!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir, { recursive: true }); } catch {}
const devicesFile = path.join(process.cwd(), "devices.json");

export function ota() {
  const router = express.Router();

  // In-memory storage for serverless environment
  // Note: In production, you'd want to use cloud storage like AWS S3, Vercel Blob, etc.
  let firmwareData = {};

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
  router.post("/upload", upload.single('firmware'), (req, res) => {
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

  // Push update to specific devices
  router.post("/push-update", (req, res) => {
    const { version, deviceIds, allDevices } = req.body;

    if (!version) {
      return res.status(400).json({ error: "Firmware version required" });
    }

    // Check if firmware file exists
    const firmwarePath = path.join(firmwareDir, `${version}.bin`);
    if (!fs.existsSync(firmwarePath)) {
      return res.status(404).json({ error: "Firmware file not found" });
    }

    const devices = loadDevices();
    let updatedCount = 0;

    if (allDevices) {
      // Update all devices
      Object.keys(devices).forEach(deviceId => {
        devices[deviceId].updateAvailable = true;
        devices[deviceId].targetFirmware = version;
        updatedCount++;
      });
    } else if (deviceIds && Array.isArray(deviceIds)) {
      // Update specific devices
      deviceIds.forEach(deviceId => {
        if (devices[deviceId]) {
          devices[deviceId].updateAvailable = true;
          devices[deviceId].targetFirmware = version;
          updatedCount++;
        }
      });
    }

    saveDevices(devices);

    console.log(`Pushed update ${version} to ${updatedCount} devices`);

    res.json({
      success: true,
      version: version,
      devicesUpdated: updatedCount,
      message: `Update pushed to ${updatedCount} device(s)`
    });
  });

  // Cancel pending updates
  router.post("/cancel-update", (req, res) => {
    const { deviceIds, allDevices } = req.body;

    const devices = loadDevices();
    let cancelledCount = 0;

    if (allDevices) {
      // Cancel for all devices
      Object.keys(devices).forEach(deviceId => {
        if (devices[deviceId].updateAvailable) {
          devices[deviceId].updateAvailable = false;
          devices[deviceId].targetFirmware = null;
          cancelledCount++;
        }
      });
    } else if (deviceIds && Array.isArray(deviceIds)) {
      // Cancel for specific devices
      deviceIds.forEach(deviceId => {
        if (devices[deviceId] && devices[deviceId].updateAvailable) {
          devices[deviceId].updateAvailable = false;
          devices[deviceId].targetFirmware = null;
          cancelledCount++;
        }
      });
    }

    saveDevices(devices);

    res.json({
      success: true,
      devicesCancelled: cancelledCount,
      message: `Updates cancelled for ${cancelledCount} device(s)`
    });
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
