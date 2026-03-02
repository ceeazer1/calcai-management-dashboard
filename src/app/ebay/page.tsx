"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Check,
  X,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Trash2,
  ShoppingCart,
  Inbox,
  Send,
  PackageCheck,
} from "lucide-react";

interface EbayPick {
  itemId: string;
  title: string;
  price: number;
  shipping: number;
  totalCost: number;
  condition: string;
  seller: string;
  feedbackPct: string;
  url: string;
  isOfferOnly: boolean;
  thumbnailUrl?: string;
  approvedAt?: number;
  offerAmount?: number;
  offeredAt?: number;
  pricePaid?: number;
  boughtAt?: number;
}

type Tab = "review" | "approved" | "offered" | "bought";

const TABS: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "review", label: "Review Queue", icon: <Inbox className="h-4 w-4" />, color: "blue" },
  { key: "approved", label: "Approved", icon: <Check className="h-4 w-4" />, color: "green" },
  { key: "offered", label: "Offers Placed", icon: <Send className="h-4 w-4" />, color: "purple" },
  { key: "bought", label: "Bought", icon: <PackageCheck className="h-4 w-4" />, color: "amber" },
];

export default function ClawdbotEbayPicks() {
  const [tab, setTab] = useState<Tab>("review");
  const [picks, setPicks] = useState<EbayPick[]>([]);
  const [approved, setApproved] = useState<EbayPick[]>([]);
  const [offered, setOffered] = useState<EbayPick[]>([]);
  const [bought, setBought] = useState<EbayPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [picksRes, approvedRes, offeredRes, boughtRes] = await Promise.all([
        fetch("/api/clawdbot/picks", { cache: "no-store" }),
        fetch("/api/clawdbot/approved", { cache: "no-store" }),
        fetch("/api/clawdbot/offered", { cache: "no-store" }),
        fetch("/api/clawdbot/bought", { cache: "no-store" }),
      ]);
      const [pj, aj, oj, bj] = await Promise.all([
        picksRes.json(), approvedRes.json(), offeredRes.json(), boughtRes.json(),
      ]);
      if (pj.ok) setPicks(pj.items);
      if (aj.ok) setApproved(aj.items);
      if (oj.ok) setOffered(oj.items);
      if (bj.ok) setBought(bj.items);
    } catch (e) { console.error("Failed to load", e); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // --- Actions ---

  async function handleApprove(itemId: string) {
    setActionId(itemId);
    try {
      const r = await fetch("/api/clawdbot/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, decision: "approve", reason: "" }),
      });
      const j = await r.json();
      if (j.ok) {
        const item = picks.find((p) => p.itemId === itemId);
        if (item) setApproved((prev) => [...prev, { ...item, approvedAt: Date.now() }]);
        setPicks((prev) => prev.filter((p) => p.itemId !== itemId));
      }
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  async function handleDismiss(itemId: string) {
    setActionId(itemId);
    try {
      const r = await fetch("/api/clawdbot/dismissed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (j.ok) setPicks((prev) => prev.filter((p) => p.itemId !== itemId));
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  async function handleRemoveApproved(itemId: string) {
    setActionId(itemId);
    try {
      const r = await fetch("/api/clawdbot/approved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (j.ok) setApproved((prev) => prev.filter((a) => a.itemId !== itemId));
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  async function handleMarkBought(itemId: string) {
    setActionId(itemId);
    try {
      const item = offered.find((o) => o.itemId === itemId);
      const r = await fetch("/api/clawdbot/bought", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, pricePaid: item?.offerAmount || item?.totalCost }),
      });
      const j = await r.json();
      if (j.ok) {
        if (item) setBought((prev) => [...prev, { ...item, boughtAt: Date.now() }]);
        setOffered((prev) => prev.filter((o) => o.itemId !== itemId));
      }
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  async function handleRemoveOffered(itemId: string) {
    setActionId(itemId);
    try {
      const r = await fetch("/api/clawdbot/offered", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (j.ok) setOffered((prev) => prev.filter((o) => o.itemId !== itemId));
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  async function handleRemoveBought(itemId: string) {
    setActionId(itemId);
    try {
      const r = await fetch("/api/clawdbot/bought", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (j.ok) setBought((prev) => prev.filter((b) => b.itemId !== itemId));
    } catch (e) { console.error(e); }
    setActionId(null);
  }

  // --- Tab counts ---
  const counts: Record<Tab, number> = {
    review: picks.length,
    approved: approved.length,
    offered: offered.length,
    bought: bought.length,
  };

  const tabColors: Record<string, { bg: string; border: string; text: string; activeBg: string; activeBorder: string }> = {
    blue: { bg: "bg-blue-500/5", border: "border-blue-500/10", text: "text-blue-400", activeBg: "bg-blue-500/15", activeBorder: "border-blue-500/40" },
    green: { bg: "bg-green-500/5", border: "border-green-500/10", text: "text-green-400", activeBg: "bg-green-500/15", activeBorder: "border-green-500/40" },
    purple: { bg: "bg-purple-500/5", border: "border-purple-500/10", text: "text-purple-400", activeBg: "bg-purple-500/15", activeBorder: "border-purple-500/40" },
    amber: { bg: "bg-amber-500/5", border: "border-amber-500/10", text: "text-amber-400", activeBg: "bg-amber-500/15", activeBorder: "border-amber-500/40" },
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            🦞 Clawdbot&apos;s Picks
          </h1>
          <p className="text-neutral-400">
            AI-curated eBay deals. Approve, track offers, and manage purchases.
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-all text-sm text-neutral-200"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const c = tabColors[t.color];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap ${active
                  ? `${c.activeBg} ${c.activeBorder} ${c.text}`
                  : `${c.bg} ${c.border} text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50`
                }`}
            >
              {t.icon}
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? c.text : "text-neutral-500"} ${active ? c.activeBg : "bg-neutral-800"}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading && picks.length === 0 && approved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <p className="text-neutral-500">Loading...</p>
        </div>
      ) : (
        <>
          {/* ── Review Queue ── */}
          {tab === "review" && (
            <section>
              {picks.length === 0 ? (
                <EmptyState icon={<Check className="h-7 w-7 text-neutral-500" />} title="All caught up!" subtitle="No new deals right now. Ask Clawdbot to sync." />
              ) : (
                <div className="grid gap-5">
                  {picks.map((pick) => (
                    <div
                      key={pick.itemId}
                      className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all group"
                    >
                      <div className="p-5 flex flex-col md:flex-row gap-6">
                        <Thumbnail src={pick.thumbnailUrl} alt={pick.title} />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="text-base font-bold text-white leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
                                {pick.title}
                              </h3>
                              <PriceBadge amount={pick.totalCost} color="blue" />
                            </div>
                            <ItemMeta pick={pick} />
                          </div>
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleApprove(pick.itemId)}
                                disabled={actionId === pick.itemId}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/20 text-sm"
                              >
                                {actionId === pick.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleDismiss(pick.itemId)}
                                disabled={actionId === pick.itemId}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-800 hover:bg-red-900/50 hover:text-red-300 text-white font-bold rounded-xl transition-all text-sm"
                              >
                                {actionId === pick.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                Dismiss
                              </button>
                            </div>
                            <EbayLink url={pick.url} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Approved ── */}
          {tab === "approved" && (
            <section>
              {approved.length === 0 ? (
                <EmptyState icon={<ShoppingCart className="h-7 w-7 text-neutral-500" />} title="No approved items" subtitle="Approve picks from the Review Queue to queue offers." />
              ) : (
                <div className="grid gap-3">
                  {approved.map((item) => (
                    <CompactRow key={item.itemId} item={item} borderColor="border-green-900/40 hover:border-green-700/40">
                      <span className="text-green-400 font-bold text-sm">${item.totalCost.toFixed(2)}</span>
                      {item.approvedAt && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Clock className="h-3 w-3" />
                          {new Date(item.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <EbayLink url={item.url} compact />
                      <button onClick={() => handleRemoveApproved(item.itemId)} disabled={actionId === item.itemId} className="p-2 text-neutral-600 hover:text-red-400 transition-colors" title="Remove">
                        {actionId === item.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </CompactRow>
                  ))}
                  <div className="mt-2 p-4 bg-green-950/30 border border-green-900/30 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-green-300 font-semibold text-sm">Ready to place offers</p>
                      <p className="text-neutral-500 text-xs mt-0.5">
                        Tell Clawdbot: <span className="text-white font-mono">&quot;place offers on approved items&quot;</span>
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="h-5 w-5 text-green-400" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Offers Placed ── */}
          {tab === "offered" && (
            <section>
              {offered.length === 0 ? (
                <EmptyState icon={<Send className="h-7 w-7 text-neutral-500" />} title="No pending offers" subtitle="Offers will show here once Clawdbot places them." />
              ) : (
                <div className="grid gap-3">
                  {offered.map((item) => (
                    <CompactRow key={item.itemId} item={item} borderColor="border-purple-900/40 hover:border-purple-700/40">
                      {item.offerAmount && <span className="text-purple-400 font-bold text-sm">Offered ${item.offerAmount.toFixed(2)}</span>}
                      {item.offeredAt && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Clock className="h-3 w-3" />
                          {new Date(item.offeredAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <EbayLink url={item.url} compact />
                      <button onClick={() => handleMarkBought(item.itemId)} disabled={actionId === item.itemId} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all" title="Mark as bought">
                        {actionId === item.itemId ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3" />}
                        Bought
                      </button>
                      <button onClick={() => handleRemoveOffered(item.itemId)} disabled={actionId === item.itemId} className="p-2 text-neutral-600 hover:text-red-400 transition-colors" title="Remove">
                        {actionId === item.itemId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </CompactRow>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Bought ── */}
          {tab === "bought" && (
            <section>
              {bought.length === 0 ? (
                <EmptyState icon={<PackageCheck className="h-7 w-7 text-neutral-500" />} title="No purchases yet" subtitle="Items you mark as bought will appear here." />
              ) : (
                <div className="grid gap-3">
                  {bought.map((item) => (
                    <CompactRow key={item.itemId} item={item} borderColor="border-amber-900/40 hover:border-amber-700/40">
                      {item.pricePaid && <span className="text-amber-400 font-bold text-sm">Paid ${item.pricePaid.toFixed(2)}</span>}
                      {item.boughtAt && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Clock className="h-3 w-3" />
                          {new Date(item.boughtAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <EbayLink url={item.url} compact />
                      <button onClick={() => handleRemoveBought(item.itemId)} disabled={actionId === item.itemId} className="p-2 text-neutral-600 hover:text-red-400 transition-colors" title="Remove">
                        {actionId === item.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </CompactRow>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared Components ──

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
      <div className="h-14 w-14 bg-neutral-800 rounded-full flex items-center justify-center mb-4">{icon}</div>
      <p className="text-white font-medium">{title}</p>
      <p className="text-neutral-500 text-sm">{subtitle}</p>
    </div>
  );
}

function Thumbnail({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="h-28 w-28 md:h-36 md:w-36 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800">
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-neutral-700 text-xs">No Image</div>
      )}
    </div>
  );
}

function PriceBadge({ amount, color }: { amount: number; color: string }) {
  const cls = color === "blue" ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
    : color === "green" ? "bg-green-500/10 border-green-500/20 text-green-400"
      : "bg-neutral-800 border-neutral-700 text-neutral-300";
  return (
    <div className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 ${cls} border rounded-full`}>
      <span className="text-sm font-bold">${amount.toFixed(2)}</span>
    </div>
  );
}

function ItemMeta({ pick }: { pick: EbayPick }) {
  return (
    <>
      <div className="flex flex-wrap gap-3 text-sm text-neutral-400 mt-2">
        <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-green-500" />${pick.price.toFixed(2)}</div>
        <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-neutral-500" />+${pick.shipping.toFixed(2)} ship</div>
        <div className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] uppercase tracking-wider font-bold">{pick.condition}</div>
        {pick.isOfferOnly && (
          <span className="flex items-center gap-1 text-orange-400 text-xs font-medium">
            <AlertTriangle className="h-3 w-3" /> Offer Only
          </span>
        )}
      </div>
      <div className="text-sm text-neutral-500 mt-2">
        Seller: <span className="text-neutral-300">{pick.seller}</span> ({pick.feedbackPct}%)
      </div>
    </>
  );
}

function EbayLink({ url, compact }: { url: string; compact?: boolean }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`text-neutral-400 hover:text-white flex items-center gap-1 text-sm font-medium border-b border-transparent hover:border-neutral-500 transition-all ${compact ? "" : ""}`}
    >
      {compact ? <ExternalLink className="h-3.5 w-3.5" /> : <>View on eBay <ExternalLink className="h-3.5 w-3.5" /></>}
    </a>
  );
}

function CompactRow({ item, children, borderColor }: { item: EbayPick; children: React.ReactNode; borderColor: string }) {
  return (
    <div className={`bg-neutral-900/70 border ${borderColor} rounded-2xl p-4 flex items-center gap-4 transition-all`}>
      {item.thumbnailUrl && (
        <div className="h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800 bg-black">
          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{item.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
          {children}
        </div>
      </div>
    </div>
  );
}
