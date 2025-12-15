"use client";

import { useState, useEffect } from "react";

interface MaintenanceSettings {
  enabled: boolean;
  until: string;
  discordUrl: string;
}

interface WebsiteSettings {
  price: number;
  compareAt: number | null;
  inStock: boolean;
  stockCount: number | null;
  preorderEnabled: boolean;
  preorderPrice: number | null;
  preorderShipDate: string;
  maintenance: MaintenanceSettings;
  storage?: string;
}

function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function localInputToISO(local: string): string {
  if (!local) return "";
  try {
    const d = new Date(local);
    if (isNaN(d.getTime())) return "";
    return d.toISOString();
  } catch {
    return "";
  }
}

export default function WebsitePage() {
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [inStock, setInStock] = useState(true);
  const [stockCount, setStockCount] = useState("");
  const [preorderEnabled, setPreorderEnabled] = useState(false);
  const [preorderPrice, setPreorderPrice] = useState("");
  const [preorderShipDate, setPreorderShipDate] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceUntil, setMaintenanceUntil] = useState("");
  const [maintenanceDiscordUrl, setMaintenanceDiscordUrl] = useState("");
  const [storage, setStorage] = useState("");
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>("loading…");
  const [alert, setAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showAlert = (msg: string, type: "success" | "error") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadSettings = async () => {
    try {
      const r = await fetch("/api/website/settings");
      if (!r.ok) throw new Error("Failed to load");
      const j: WebsiteSettings = await r.json();
      setPrice(j.price?.toString() ?? "");
      setCompareAt(j.compareAt?.toString() ?? "");
      setInStock(!!j.inStock);
      setStockCount(j.stockCount?.toString() ?? "");
      setPreorderEnabled(!!j.preorderEnabled);
      setPreorderPrice(j.preorderPrice?.toString() ?? "");
      setPreorderShipDate(j.preorderShipDate || "");
      setMaintenanceEnabled(!!j.maintenance?.enabled);
      setMaintenanceUntil(isoToLocalInput(j.maintenance?.until || ""));
      setMaintenanceDiscordUrl(j.maintenance?.discordUrl || "");
      setStorage(j.storage || "");
      refreshLive();
    } catch {
      showAlert("Failed to load settings", "error");
    }
  };

  const refreshLive = async () => {
    try {
      setLiveStatus("loading…");
      const r = await fetch("/api/website-public/settings", { cache: "no-store" });
      const j = await r.json();
      const m = j?.maintenance || {};
      const enabled = !!m.enabled;
      setLiveStatus(`${enabled ? "ENABLED" : "DISABLED"}${m.until ? ` • until ${m.until}` : ""}`);
    } catch {
      setLiveStatus("error");
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        price: Number(price),
        compareAt: compareAt === "" ? null : Number(compareAt),
        inStock,
        stockCount: stockCount === "" ? null : Number(stockCount),
        preorderEnabled,
        preorderPrice: preorderPrice === "" ? null : Number(preorderPrice),
        preorderShipDate,
        maintenance: {
          enabled: maintenanceEnabled,
          until: localInputToISO(maintenanceUntil),
          discordUrl: maintenanceDiscordUrl,
        },
      };
      const r = await fetch("/api/website/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      showAlert("Saved successfully!", "success");
      if (j.storage) setStorage(j.storage);
      refreshLive();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      showAlert(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">Website Settings</h1>

      {alert && (
        <div className={`mb-4 p-3 rounded-lg ${alert.type === "error" ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>
          {alert.msg}
        </div>
      )}

      {storage && (
        <div className={`mb-4 p-2 rounded text-sm ${storage === "kv" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>
          Storage: {storage === "kv" ? "Vercel KV (durable)" : "Ephemeral file (set KV_REST_API_URL and KV_REST_API_TOKEN)"}
        </div>
      )}

      {/* Maintenance Mode */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Maintenance Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-white">
              <input type="checkbox" checked={maintenanceEnabled} onChange={(e) => setMaintenanceEnabled(e.target.checked)} className="w-4 h-4" />
              Enable Maintenance (lock site)
            </label>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Countdown Until</label>
            <input type="datetime-local" value={maintenanceUntil} onChange={(e) => setMaintenanceUntil(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-neutral-400 mb-1">Discord URL (optional)</label>
            <input type="url" value={maintenanceDiscordUrl} onChange={(e) => setMaintenanceDiscordUrl(e.target.value)} placeholder="https://discord.gg/..." className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <strong className="text-white">Live public status:</strong>
          <span className={liveStatus.includes("ENABLED") ? "text-red-400" : "text-green-400"}>{liveStatus}</span>
          <button onClick={refreshLive} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1 rounded text-white text-sm ml-auto">
            Refresh
          </button>
        </div>
      </div>

      {/* Pricing & Stock */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Pricing & Stock</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-neutral-400 mb-1">Price (USD)</label>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="174.99" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Compare-at (optional)</label>
            <input type="number" step="0.01" min="0" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="199.99" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Stock Count</label>
            <input type="number" step="1" min="0" value={stockCount} onChange={(e) => setStockCount(e.target.value)} placeholder="12" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
            <small className="text-neutral-500">Shown on the website as &quot;In stock: N&quot;.</small>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Stock Status</label>
            <select value={inStock ? "true" : "false"} onChange={(e) => setInStock(e.target.value === "true")} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white">
              <option value="true">In Stock</option>
              <option value="false">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preorder */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Preorder Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-white">
              <input type="checkbox" checked={preorderEnabled} onChange={(e) => setPreorderEnabled(e.target.checked)} className="w-4 h-4" />
              Enable Preorder Button
            </label>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Preorder Price (USD)</label>
            <input type="number" step="0.01" min="0" value={preorderPrice} onChange={(e) => setPreorderPrice(e.target.value)} placeholder="200.00" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-neutral-400 mb-1">Preorder Ship Date (optional)</label>
            <input type="text" value={preorderShipDate} onChange={(e) => setPreorderShipDate(e.target.value)} placeholder="Oct 27" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
            <small className="text-neutral-500">Leave empty to hide ship date text.</small>
          </div>
        </div>
      </div>

      <button onClick={saveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg text-white font-semibold">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

