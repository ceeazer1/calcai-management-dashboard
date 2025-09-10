import express from "express";
import fs from "fs";
import path from "path";

// Lightweight settings store for website product page controls.
// NOTE: On serverless (Vercel), file writes may be ephemeral. For durability,
// move to a KV/DB later. This mirrors devices_store.mjs best-effort persistence.

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "website-settings.json");

let settings = {
  price: 174.99,
  compareAt: 199.99,
  inStock: true,
  stockCount: 12,
};

function loadFromDisk() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf8");
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object") {
        settings = { ...settings, ...parsed };
      }
    }
  } catch (e) {
    console.warn("[website_settings] loadFromDisk failed:", e?.message || e);
  }
}

function saveToDisk() {
  try {
    try { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    fs.writeFileSync(dataFile, JSON.stringify(settings, null, 2), "utf8");
  } catch (e) {
    // Non-fatal on serverless
  }
}

export function website() {
  // Initialize from disk once per cold start
  loadFromDisk();

  const router = express.Router();

  // Get current settings (admin)
  router.get("/settings", (req, res) => {
    res.json(settings);
  });

  // Update settings (admin)
  router.post("/settings", (req, res) => {
    const { price, compareAt, inStock, stockCount } = req.body || {};

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

    settings = next;
    saveToDisk();
    res.json({ ok: true, settings });
  });

  return router;
}

// Public, read-only router for the website to consume (no auth)
export function websitePublic() {
  loadFromDisk();
  const router = express.Router();
  router.get("/settings", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json(settings);
  });
  return router;
}

