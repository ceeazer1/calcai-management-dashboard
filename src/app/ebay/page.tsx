"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

type Money = { value: number; currency: string };

type EbayBuyingOption = "FIXED_PRICE" | "AUCTION" | "BEST_OFFER" | (string & {});
type EbayMarketplaceId = "EBAY_US" | "EBAY_GB" | "EBAY_DE" | "EBAY_AU" | "EBAY_CA" | (string & {});

interface ItemSummary {
  itemId: string;
  title: string;
  price: Money | null;
  shippingCost: Money | null;
  condition: string | null;
  endTime: string | null;
  sellerUsername: string | null;
  thumbnailUrl: string | null;
  itemWebUrl: string | null;
  buyingOptions: EbayBuyingOption[];
}

interface ItemDetail {
  itemId: string;
  title: string;
  descriptionText: string | null;
  imageUrls: string[];
  price: Money | null;
  shippingCost: Money | null;
  condition: string | null;
  endTime: string | null;
  sellerUsername: string | null;
  itemWebUrl: string | null;
  buyingOptions: EbayBuyingOption[];
  availabilityStatus: string | null;
}

interface WatchedItem {
  itemId: string;
  title: string;
  imageUrl: string | null;
  itemWebUrl: string | null;
  marketplaceId: EbayMarketplaceId;
  buyingOptions: EbayBuyingOption[];
  addedAt: number;
  lastRefreshedAt: number | null;
  lastPrice: Money | null;
  lastShippingCost: Money | null;
  availabilityStatus: string | null;
}

interface PriceSnapshot {
  ts: number;
  price: Money | null;
  shippingCost: Money | null;
  availabilityStatus: string | null;
}

const MARKETPLACES: { id: EbayMarketplaceId; label: string }[] = [
  { id: "EBAY_US", label: "eBay US (EBAY_US)" },
  { id: "EBAY_GB", label: "eBay UK (EBAY_GB)" },
  { id: "EBAY_DE", label: "eBay DE (EBAY_DE)" },
  { id: "EBAY_CA", label: "eBay CA (EBAY_CA)" },
  { id: "EBAY_AU", label: "eBay AU (EBAY_AU)" },
];

const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States (US)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "DE", label: "Germany (DE)" },
  { code: "AU", label: "Australia (AU)" },
];

const PRESET_KEYWORD = "TI-84 Plus CE";

function fmtMoney(m: Money | null | undefined) {
  if (!m) return "-";
  const v = Number(m.value);
  const cur = m.currency || "";
  if (!Number.isFinite(v)) return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(v);
  } catch {
    return `${v.toFixed(2)} ${cur}`;
  }
}

function chip(s: string) {
  return (
    <span
      key={s}
      className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200"
    >
      {s}
    </span>
  );
}

function Sparkline({ points }: { points: { ts: number; value: number }[] }) {
  const w = 260;
  const h = 70;
  const pad = 6;
  if (points.length < 2) {
    return <div className="text-xs text-neutral-500">Not enough data yet</div>;
  }

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(0.000001, maxY - minY);

  const scaleX = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const scaleY = (v: number) => pad + (1 - (v - minY) / spanY) * (h - pad * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(xs[i]).toFixed(2)} ${scaleY(p.value).toFixed(2)}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="block">
      <path d={d} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth="2" />
      <path
        d={`${d} L ${scaleX(points.length - 1)} ${h - pad} L ${scaleX(0)} ${h - pad} Z`}
        fill="rgba(59,130,246,0.12)"
        stroke="none"
      />
    </svg>
  );
}

export default function EbayPage() {
  const [customSearch, setCustomSearch] = useState(false);
  const [keyword, setKeyword] = useState(PRESET_KEYWORD);
  const [marketplaceId, setMarketplaceId] = useState<EbayMarketplaceId>("EBAY_US");
  const [buyFixed, setBuyFixed] = useState(true);
  const [buyAuction, setBuyAuction] = useState(true);
  const [condition, setCondition] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [itemLocationCountry, setItemLocationCountry] = useState<string>("");
  const [sort, setSort] = useState<string>("bestMatch");

  const [results, setResults] = useState<ItemSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string>("");

  const [watchlist, setWatchlist] = useState<WatchedItem[]>([]);
  const [watchLoading, setWatchLoading] = useState(true);

  const watchedSet = useMemo(() => new Set(watchlist.map((w) => w.itemId)), [watchlist]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailImg, setDetailImg] = useState<string>("");
  const [detailMarketplace, setDetailMarketplace] = useState<EbayMarketplaceId>("EBAY_US");
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);


  async function loadWatchlist() {
    setWatchLoading(true);
    try {
      const r = await fetch("/api/ebay/watchlist", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setWatchlist(Array.isArray(j.items) ? j.items : []);
    } catch {
      setWatchlist([]);
    }
    setWatchLoading(false);
  }

  useEffect(() => {
    loadWatchlist();
    // Auto-run preset search on first load
    void runSearchFor(PRESET_KEYWORD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearchFor(qRaw: string) {
    setSearchError("");
    const q = String(qRaw || "").trim();
    if (!q) {
      setSearchError("Keyword is required.");
      return;
    }

    const sp = new URLSearchParams();
    sp.set("keyword", q);
    sp.set("marketplaceId", marketplaceId);
    sp.set("fixed", buyFixed ? "1" : "0");
    sp.set("auction", buyAuction ? "1" : "0");
    if (condition) sp.set("condition", condition);
    if (minPrice) sp.set("minPrice", minPrice);
    if (maxPrice) sp.set("maxPrice", maxPrice);
    if (itemLocationCountry) sp.set("itemLocationCountry", itemLocationCountry);
    if (sort) sp.set("sort", sort);

    setSearchLoading(true);
    try {
      const r = await fetch(`/api/ebay/search?${sp.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.message || "Search failed");
      setResults(Array.isArray(j.items) ? j.items : []);
    } catch (e: any) {
      setResults([]);
      setSearchError(String(e?.message || "Search failed"));
    }
    setSearchLoading(false);
  }

  async function runSearch() {
    return runSearchFor(keyword);
  }

  async function runPresetSearch() {
    setCustomSearch(false);
    setKeyword(PRESET_KEYWORD);
    return runSearchFor(PRESET_KEYWORD);
  }

  async function openDetails(itemId: string, mp: EbayMarketplaceId = marketplaceId) {
    setDetailOpen(true);
    setDetailLoading(true);
    setHistory([]);
    setDetail(null);
    setDetailImg("");
    setDetailMarketplace(mp);

    try {
      const r = await fetch(`/api/ebay/item/${encodeURIComponent(itemId)}?marketplaceId=${encodeURIComponent(mp)}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.message || "Failed to load item");
      const it: ItemDetail = j.item;
      setDetail(it);
      setDetailImg(it.imageUrls?.[0] || "");
    } catch (e: any) {
      setDetail(null);
    }
    setDetailLoading(false);

    // History (if watched)
    if (watchedSet.has(itemId)) {
      setHistoryLoading(true);
      try {
        const r2 = await fetch(`/api/ebay/watchlist/${encodeURIComponent(itemId)}/history`, { cache: "no-store" });
        const j2 = await r2.json().catch(() => ({}));
        setHistory(Array.isArray(j2.snapshots) ? j2.snapshots : []);
      } catch {
        setHistory([]);
      }
      setHistoryLoading(false);
    }
  }

  async function toggleWatch(itemId: string, mp: EbayMarketplaceId = marketplaceId) {
    try {
      const r = await fetch("/api/ebay/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, marketplaceId: mp, action: "toggle" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.message || "Failed");
      setWatchlist(Array.isArray(j.items) ? j.items : []);
    } catch {
      // ignore
    }
  }

  async function refreshWatchlist() {
    try {
      const r = await fetch("/api/ebay/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxItems: 50, concurrency: 3 }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.items && Array.isArray(j.items)) setWatchlist(j.items);
      if (detail?.itemId && watchedSet.has(detail.itemId)) {
        // reload history for the open item
        const r2 = await fetch(`/api/ebay/watchlist/${encodeURIComponent(detail.itemId)}/history`, { cache: "no-store" });
        const j2 = await r2.json().catch(() => ({}));
        setHistory(Array.isArray(j2.snapshots) ? j2.snapshots : []);
      }
    } catch {
      // ignore
    }
  }

  const historyPoints = useMemo(() => {
    const pts: { ts: number; value: number }[] = [];
    for (const s of history) {
      const v = Number(s?.price?.value);
      if (!Number.isFinite(v)) continue;
      pts.push({ ts: s.ts, value: v });
    }
    return pts;
  }, [history]);

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">eBay Listings</h1>
          <p className="text-sm text-neutral-400">Search, view details, watch items, and track price history.</p>
        </div>
        <button
          onClick={refreshWatchlist}
          className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
          title="Refresh watched items"
        >
          <RefreshCw className="h-4 w-4 text-neutral-300" />
          Refresh watchlist
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Left: Search + Results */}
        <div className="space-y-6">
          {customSearch ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-sm text-neutral-300 font-medium">Custom search</div>
                <button
                  onClick={runPresetSearch}
                  className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
                  title="Back to preset search"
                >
                  Use preset
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder='Keyword (e.g. "TI-84 Plus CE")'
                    className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => runSearch()}
                  disabled={searchLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Marketplace</label>
                  <select
                    value={marketplaceId}
                    onChange={(e) => setMarketplaceId(e.target.value as EbayMarketplaceId)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  >
                    {MARKETPLACES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Buying options</label>
                  <div className="flex gap-3 items-center h-[38px]">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-200">
                      <input
                        type="checkbox"
                        checked={buyFixed}
                        onChange={(e) => setBuyFixed(e.target.checked)}
                        className="accent-blue-500"
                      />
                      Fixed price
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-200">
                      <input
                        type="checkbox"
                        checked={buyAuction}
                        onChange={(e) => setBuyAuction(e.target.checked)}
                        className="accent-blue-500"
                      />
                      Auction
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  >
                    <option value="">Any</option>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="parts">For parts / not working</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Price min</label>
                  <input
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Price max</label>
                  <input
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Ships from (country)</label>
                  <select
                    value={itemLocationCountry}
                    onChange={(e) => setItemLocationCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  >
                    <option value="">Any</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Sort</label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200"
                  >
                    <option value="bestMatch">Best match</option>
                    <option value="price">Price: low → high</option>
                    <option value="-price">Price: high → low</option>
                    <option value="endingSoonest">Ending soon</option>
                  </select>
                </div>
              </div>

              {searchError && <div className="mt-3 text-sm text-red-400">{searchError}</div>}
            </div>
          ) : null}

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Results</h2>
              <div className="text-xs text-neutral-500">{results.length} items</div>
            </div>

            {searchLoading ? (
              <div className="text-neutral-400 text-sm">Searching…</div>
            ) : results.length === 0 ? (
              <div className="text-neutral-400 text-sm">Run a search to see results.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((it) => (
                  <div key={it.itemId} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="h-20 w-20 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex-shrink-0">
                        {it.thumbnailUrl ? (
                          <img src={it.thumbnailUrl} alt={it.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-neutral-600">No image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{it.title}</div>
                        <div className="mt-1 text-xs text-neutral-400">
                          <span className="text-neutral-300">{fmtMoney(it.price)}</span>
                          {it.shippingCost ? <span className="text-neutral-500"> • + {fmtMoney(it.shippingCost)} ship</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {it.condition || "—"}
                          {it.sellerUsername ? <span> • Seller {it.sellerUsername}</span> : null}
                          {it.endTime ? <span> • Ends {new Date(it.endTime).toLocaleString()}</span> : null}
                        </div>
                        {it.buyingOptions?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">{it.buyingOptions.map((b) => chip(b))}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openDetails(it.itemId, marketplaceId)}
                        className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 transition-colors"
                      >
                        Open details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWatch(it.itemId, marketplaceId)}
                          className={`p-2 rounded-lg border transition-colors ${
                            watchedSet.has(it.itemId)
                              ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                              : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                          }`}
                          title={watchedSet.has(it.itemId) ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        {it.itemWebUrl ? (
                          <a
                            href={it.itemWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-colors"
                            title="Open on eBay"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Watchlist + Preset search */}
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Watchlist</h2>
              <div className="text-xs text-neutral-500">{watchLoading ? "…" : `${watchlist.length} items`}</div>
            </div>
            {watchLoading ? (
              <div className="text-sm text-neutral-400">Loading…</div>
            ) : watchlist.length === 0 ? (
              <div className="text-sm text-neutral-400">No watched items yet.</div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {watchlist.map((w) => (
                  <div
                    key={w.itemId}
                    className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-lg p-3"
                  >
                    <div className="h-10 w-10 rounded-md overflow-hidden bg-neutral-900 border border-neutral-800 flex-shrink-0">
                      {w.imageUrl ? (
                        <img src={w.imageUrl} alt={w.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-neutral-600">—</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{w.title}</div>
                      <div className="text-[11px] text-neutral-500">
                        <span className="text-neutral-300">{fmtMoney(w.lastPrice)}</span>
                        {w.lastShippingCost ? <span> • + {fmtMoney(w.lastShippingCost)} ship</span> : null}
                        {w.availabilityStatus ? <span> • {w.availabilityStatus}</span> : null}
                      </div>
                    </div>
                    <button
                      onClick={() => openDetails(w.itemId, w.marketplaceId)}
                      className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 transition-colors"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => toggleWatch(w.itemId, w.marketplaceId)}
                      className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Saved search</h2>
              <button
                onClick={() => setCustomSearch(true)}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 hover:bg-neutral-800 transition-colors text-sm"
                title="Open custom search"
              >
                Custom search
              </button>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
              <div className="text-sm text-white font-medium truncate">{PRESET_KEYWORD}</div>
              <div className="text-xs text-neutral-500 mt-1">Marketplace: {marketplaceId}</div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => runPresetSearch()}
                  disabled={searchLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
                <button
                  onClick={() => runPresetSearch()}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
                  title="Reset to preset"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details modal */}
      {detailOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-4xl w-full max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white truncate">{detail?.title || "Item details"}</div>
                <div className="text-xs text-neutral-500 truncate">{detail?.itemId || ""}</div>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="text-neutral-400 hover:text-white"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="text-sm text-neutral-400">Loading…</div>
            ) : !detail ? (
              <div className="text-sm text-neutral-400">Failed to load item.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
                {/* Gallery */}
                <div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden aspect-video flex items-center justify-center">
                    {detailImg ? (
                      <img src={detailImg} alt={detail.title} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-xs text-neutral-600">No image</div>
                    )}
                  </div>
                  {detail.imageUrls?.length > 1 ? (
                    <div className="mt-3 flex gap-2 overflow-auto">
                      {detail.imageUrls.slice(0, 12).map((u) => (
                        <button
                          key={u}
                          onClick={() => setDetailImg(u)}
                          className={`h-14 w-14 rounded-lg overflow-hidden border ${
                            u === detailImg ? "border-blue-500/60" : "border-neutral-800"
                          } bg-neutral-950 flex-shrink-0`}
                        >
                          <img src={u} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                    <div className="text-sm font-semibold text-white mb-2">Description</div>
                    <pre className="whitespace-pre-wrap text-sm text-neutral-300">
                      {detail.descriptionText || "No description returned by API."}
                    </pre>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                    <div className="text-xs text-neutral-500">Price</div>
                    <div className="text-2xl font-bold text-white">{fmtMoney(detail.price)}</div>
                    {detail.shippingCost ? (
                      <div className="text-xs text-neutral-400 mt-1">+ {fmtMoney(detail.shippingCost)} shipping</div>
                    ) : null}
                    {detail.availabilityStatus ? (
                      <div className="text-xs text-neutral-500 mt-2">Availability: {detail.availabilityStatus}</div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(detail.buyingOptions || []).map((b) => chip(b))}
                      {detail.condition ? chip(detail.condition) : null}
                    </div>
                    {detail.endTime ? (
                      <div className="text-xs text-neutral-500 mt-2">Ends: {new Date(detail.endTime).toLocaleString()}</div>
                    ) : null}
                    {detail.sellerUsername ? (
                      <div className="text-xs text-neutral-500 mt-1">Seller: {detail.sellerUsername}</div>
                    ) : null}

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => toggleWatch(detail.itemId, detailMarketplace)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
                          watchedSet.has(detail.itemId)
                            ? "bg-blue-600/20 border-blue-500/30 text-blue-200"
                            : "bg-neutral-900 border-neutral-800 text-neutral-200 hover:bg-neutral-800"
                        }`}
                      >
                        <Star className="h-4 w-4" />
                        {watchedSet.has(detail.itemId) ? "Watching" : "Watch"}
                      </button>
                      {detail.itemWebUrl ? (
                        <a
                          href={detail.itemWebUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 hover:bg-neutral-800 transition-colors text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open on eBay
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white">Price history</div>
                      {historyLoading ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : null}
                    </div>
                    {watchedSet.has(detail.itemId) ? (
                      <>
                        <Sparkline points={historyPoints} />
                        <div className="mt-2 text-[11px] text-neutral-500">
                          {history.length} snapshots
                          {history.length ? (
                            <span>
                              {" "}
                              • latest {fmtMoney(history[history.length - 1]?.price)}
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-neutral-500">Add to watchlist to track price over time.</div>
                    )}
                  </div>

                  {detail.itemWebUrl ? (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                      <div className="text-sm font-semibold text-white mb-3">Buy on eBay</div>
                      <a
                        href={detail.itemWebUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View listing on eBay
                      </a>
                      <div className="text-[11px] text-neutral-500 mt-2 text-center">
                        Place bids, make offers, or buy directly on eBay
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


