"use client";

import { useState, useEffect } from "react";
import { RefreshCw, RotateCcw, Save } from "lucide-react";

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
  lastUpdated?: number;
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
  const [preorderEnabledAtLoad, setPreorderEnabledAtLoad] = useState(false);
  const [preorderExpanded, setPreorderExpanded] = useState(false);
  const [preorderPrice, setPreorderPrice] = useState("");
  const [preorderShipDate, setPreorderShipDate] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceEnabledAtLoad, setMaintenanceEnabledAtLoad] = useState(false);
  const [maintenanceExpanded, setMaintenanceExpanded] = useState(false);
  const [maintenanceUntil, setMaintenanceUntil] = useState("");
  const [maintenanceDiscordUrl, setMaintenanceDiscordUrl] = useState("");
  const [storage, setStorage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number>(0);
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
      const pe = !!j.preorderEnabled;
      setPreorderEnabled(pe);
      setPreorderEnabledAtLoad(pe);
      setPreorderExpanded(false);
      setPreorderPrice(j.preorderPrice?.toString() ?? "");
      setPreorderShipDate(j.preorderShipDate || "");
      const me = !!j.maintenance?.enabled;
      setMaintenanceEnabled(me);
      setMaintenanceEnabledAtLoad(me);
      setMaintenanceExpanded(false);
      setMaintenanceUntil(isoToLocalInput(j.maintenance?.until || ""));
      setMaintenanceDiscordUrl(j.maintenance?.discordUrl || "");
      setStorage(j.storage || "");
      setLastUpdated(Number(j.lastUpdated || 0) || 0);
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
      setLiveStatus(`${enabled ? "ENABLED" : "DISABLED"}${enabled && m.until ? ` • until ${m.until}` : ""}`);
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
      if (j.settings?.lastUpdated) setLastUpdated(Number(j.settings.lastUpdated) || 0);
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

  const storageLabel =
    storage === "kv"
      ? "Vercel KV (durable)"
      : storage
        ? "Ephemeral file (set KV_REST_API_URL + KV_REST_API_TOKEN)"
        : "";

  const liveEnabled = liveStatus.toUpperCase().includes("ENABLED");
  const lastUpdatedLabel =
    lastUpdated && Number.isFinite(lastUpdated) ? new Date(lastUpdated).toLocaleString() : "—";

  const togglePreorder = () => {
    setPreorderEnabled((prev) => {
      const next = !prev;
      if (!next) setPreorderExpanded(false);
      if (next && !preorderEnabledAtLoad) setPreorderExpanded(true);
      return next;
    });
  };

  const toggleMaintenance = () => {
    setMaintenanceEnabled((prev) => {
      const next = !prev;
      if (!next) setMaintenanceExpanded(false);
      if (next && !maintenanceEnabledAtLoad) setMaintenanceExpanded(true);
      return next;
    });
  };

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Website</h1>
          </div>

          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
            {storageLabel ? (
              <span
                className={`px-3 py-1 rounded-full text-xs border ${
                  storage === "kv"
                    ? "bg-green-900/30 text-green-300 border-green-700/30"
                    : "bg-yellow-900/30 text-yellow-300 border-yellow-700/30"
                }`}
                title="Storage backend for website settings"
              >
                Storage: {storageLabel}
              </span>
            ) : null}
            {liveEnabled ? (
              <span
                className="px-3 py-1 rounded-full text-xs border bg-red-900/30 text-red-300 border-red-700/30"
                title="Public maintenance is enabled"
              >
                Maintenance enabled
              </span>
            ) : null}
            <span className="px-3 py-1 rounded-full text-xs border bg-neutral-900 text-neutral-300 border-neutral-800">
              Last updated: {lastUpdatedLabel}
            </span>

            <span className="hidden md:inline-block w-px h-6 bg-neutral-800 mx-2" aria-hidden />

            <button
              onClick={refreshLive}
              className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
              title="Refresh public status"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={loadSettings}
              className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
              title="Reload settings (discard unsaved changes)"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {alert && (
          <div className={`mb-4 p-3 rounded-lg ${alert.type === "error" ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>
            {alert.msg}
          </div>
        )}

        {/* Storefront (Pricing + Preorder + Maintenance in one tile) */}
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-white mb-1">Storefront</h2>
            <p className="text-sm text-neutral-400">
              Controls what customers see on the product page.
            </p>
          </div>

          {/* Centered content */}
          <div className="max-w-md mx-auto space-y-6 mt-5">
            {/* Pricing + Inventory (two narrow columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-400 mb-1 text-sm">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="174.99"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 text-sm">Compare-at</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={compareAt}
                  onChange={(e) => setCompareAt(e.target.value)}
                  placeholder="199.99"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className={!inStock ? "sm:col-span-2" : ""}>
                <label className="block text-neutral-400 mb-1 text-sm">Stock Status</label>
                <select
                  value={inStock ? "true" : "false"}
                  onChange={(e) => setInStock(e.target.value === "true")}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="true">In Stock</option>
                  <option value="false">Out of Stock</option>
                </select>
              </div>

              {inStock ? (
                <div>
                  <label className="block text-neutral-400 mb-1 text-sm">Stock Count</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={stockCount}
                    onChange={(e) => setStockCount(e.target.value)}
                    placeholder="12"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-xs text-neutral-500 mt-2">Shown as “In stock: N”. Leave blank to hide count.</div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-neutral-800" />

            {/* Preorder toggle + conditional fields */}
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Preorder</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreorderExpanded((v) => !v)}
                    className={[
                      "px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 hover:bg-neutral-800 transition-colors text-sm",
                      preorderEnabled ? "" : "invisible pointer-events-none",
                    ].join(" ")}
                    title={preorderExpanded ? "Hide preorder details" : "Edit preorder details"}
                  >
                    {preorderExpanded ? "Hide details" : "Edit details"}
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preorderEnabled}
                    onClick={togglePreorder}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      preorderEnabled ? "bg-blue-600 border-blue-500/40" : "bg-neutral-800 border-neutral-700"
                    }`}
                    title={preorderEnabled ? "Disable preorder" : "Enable preorder"}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        preorderEnabled ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {preorderEnabled && preorderExpanded && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 mb-1 text-sm">Preorder Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={preorderPrice}
                      onChange={(e) => setPreorderPrice(e.target.value)}
                      placeholder="200.00"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1 text-sm">Ship date (optional)</label>
                    <input
                      type="text"
                      value={preorderShipDate}
                      onChange={(e) => setPreorderShipDate(e.target.value)}
                      placeholder="Oct 27"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <div className="text-xs text-neutral-500 mt-2">Leave empty to hide ship date text.</div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-800" />

            {/* Maintenance toggle + conditional fields */}
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Maintenance Mode</div>
                  {liveEnabled ? (
                    <div className="text-xs text-neutral-500">
                      <span className="text-neutral-400">Live:</span>{" "}
                      <span className="text-neutral-300">{liveStatus}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintenanceExpanded((v) => !v)}
                    className={[
                      "px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 hover:bg-neutral-800 transition-colors text-sm",
                      maintenanceEnabled ? "" : "invisible pointer-events-none",
                    ].join(" ")}
                    title={maintenanceExpanded ? "Hide maintenance details" : "Edit maintenance details"}
                  >
                    {maintenanceExpanded ? "Hide details" : "Edit details"}
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={maintenanceEnabled}
                    onClick={toggleMaintenance}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      maintenanceEnabled ? "bg-red-600 border-red-500/40" : "bg-neutral-800 border-neutral-700"
                    }`}
                    title={maintenanceEnabled ? "Disable maintenance" : "Enable maintenance"}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        maintenanceEnabled ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {maintenanceEnabled && maintenanceExpanded && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 mb-1 text-sm">Countdown until (optional)</label>
                    <input
                      type="datetime-local"
                      value={maintenanceUntil}
                      onChange={(e) => setMaintenanceUntil(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <div className="text-xs text-neutral-500 mt-2">Uses your local time; saved as UTC ISO.</div>
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1 text-sm">Discord URL (optional)</label>
                    <input
                      type="url"
                      value={maintenanceDiscordUrl}
                      onChange={(e) => setMaintenanceDiscordUrl(e.target.value)}
                      placeholder="https://discord.gg/..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <div className="text-xs text-neutral-500 mt-2">Displayed on the maintenance screen.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

