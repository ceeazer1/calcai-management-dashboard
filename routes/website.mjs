import express from "express";
import fs from "fs";
import path from "path";
import { createClient } from "@vercel/kv";

// Durable settings store for website product page controls.
// - Primary: Vercel KV (if KV_REST_API_URL and KV_REST_API_TOKEN are set)
// - Fallback: local file for dev (ephemeral on serverless)

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "website-settings.json");

const kvClient = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;
const KV_KEY = "website:settings";

if (!kvClient) {
  console.warn("[website_settings] KV not configured; using ephemeral file fallback. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
}

let settings = {
  price: 174.99,
  compareAt: 199.99,
  inStock: true,
  stockCount: 12,
  // Preorder controls
  preorderEnabled: false,
  preorderPrice: 200.00,
  preorderShipDate: "", // e.g., "Oct 27"; empty string hides date
  lastUpdated: 0,
};

async function loadFromKV() {
  if (!kvClient) return null;
  try {
    const v = await kvClient.get(KV_KEY);
    if (v && typeof v === 'object') return v;
  } catch (e) {
    console.warn("[website_settings] loadFromKV failed:", e?.message || e);
  }
  return null;
}

function loadFromDisk() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf8");
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("[website_settings] loadFromDisk failed:", e?.message || e);
  }
  return null;
}

async function saveToKV(obj) {
  if (!kvClient) return;
  try { await kvClient.set(KV_KEY, obj); } catch (e) {
    console.warn("[website_settings] saveToKV failed:", e?.message || e);
  }
}

function saveToDisk(obj) {
  try {
    try { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    // Non-fatal on serverless
  }
}

async function loadSettings() {
  // Prefer KV
  const fromKV = await loadFromKV();
  if (fromKV) {
    settings = { ...settings, ...fromKV };
    return settings;
  }
  // Fallback to disk (dev)
  const fromDisk = loadFromDisk();
  if (fromDisk) {
    settings = { ...settings, ...fromDisk };
  }
  return settings;
}

async function persistSettings() {
  // Write to KV if available; always try file as best-effort dev fallback
  await saveToKV(settings);
  try { saveToDisk(settings); } catch {}
}

export function website() {
  const router = express.Router();

  // Get current settings (admin)
  router.get("/settings", async (req, res) => {
    await loadSettings();
    res.json({ ...settings, storage: kvClient ? 'kv' : 'file' });
  });

  // Update settings (admin)
  router.post("/settings", async (req, res) => {
    const { price, compareAt, inStock, stockCount, preorderEnabled, preorderPrice, preorderShipDate } = req.body || {};

    await loadSettings();
    const next = { ...settings };

    if (price !== undefined) {
      const p = Number(price);
      if (Number.isFinite(p) && p >= 0 && p <= 999999) next.price = Number(p.toFixed(2));
      else return res.status(400).json({ error: "Invalid price" });
    }

    if (compareAt !== undefined && compareAt !== null && compareAt !== "") {
      const c = Number(compareAt);
      if (Number.isFinite(c) && c >= 0 && c <= 999999) next.compareAt = Number(c.toFixed(2));
      else return res.status(400).json({ error: "Invalid compareAt" });
    }

    if (inStock !== undefined) {
      if (typeof inStock === "boolean") next.inStock = inStock;
      else if (typeof inStock === "string") next.inStock = inStock === "true";
      else return res.status(400).json({ error: "Invalid inStock" });
    }

    if (stockCount !== undefined && stockCount !== null && stockCount !== "") {
      const s = Number(stockCount);
      if (Number.isInteger(s) && s >= 0 && s <= 1000000) next.stockCount = s;
      else return res.status(400).json({ error: "Invalid stockCount" });
    }

    // Preorder controls
    if (preorderEnabled !== undefined) {
      if (typeof preorderEnabled === "boolean") next.preorderEnabled = preorderEnabled;
      else if (typeof preorderEnabled === "string") next.preorderEnabled = preorderEnabled === "true";
      else return res.status(400).json({ error: "Invalid preorderEnabled" });
    }

    if (preorderPrice !== undefined && preorderPrice !== null && preorderPrice !== "") {
      const pp = Number(preorderPrice);
      if (Number.isFinite(pp) && pp >= 0 && pp <= 999999) next.preorderPrice = Number(pp.toFixed(2));
      else return res.status(400).json({ error: "Invalid preorderPrice" });
    }

    if (preorderShipDate !== undefined) {
      // Accept any short string like "Oct 27"; empty hides it
      if (typeof preorderShipDate === "string" && preorderShipDate.length <= 40) next.preorderShipDate = preorderShipDate.trim();
      else return res.status(400).json({ error: "Invalid preorderShipDate" });
    }

    next.lastUpdated = Date.now();
    settings = next;
    await persistSettings();
    res.json({ ok: true, settings, storage: kvClient ? 'kv' : 'file' });
  });

  return router;
}

// Public, read-only router for the website to consume (no auth)
export function websitePublic() {
  const router = express.Router();
  router.get("/settings", async (req, res) => {
    await loadSettings();
    // Restore normal behavior: do not force no-store; let default caching/ETag apply
    res.json(settings);
  });
  return router;
}

