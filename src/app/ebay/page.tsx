"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Check,
  X,
  MessageSquare,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Trash2,
  ShoppingCart,
  Inbox,
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
}

export default function ClawdbotEbayPicks() {
  const [picks, setPicks] = useState<EbayPick[]>([]);
  const [approved, setApproved] = useState<EbayPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [picksRes, approvedRes] = await Promise.all([
        fetch("/api/clawdbot/picks", { cache: "no-store" }),
        fetch("/api/clawdbot/approved", { cache: "no-store" }),
      ]);
      const picksJson = await picksRes.json();
      const approvedJson = await approvedRes.json();
      if (picksJson.ok) setPicks(picksJson.items);
      if (approvedJson.ok) setApproved(approvedJson.items);
    } catch (e) {
      console.error("Failed to load", e);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleDecision(itemId: string, decision: "approve" | "disapprove", feedback?: string) {
    setDecidingId(itemId);
    try {
      const r = await fetch("/api/clawdbot/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, decision, reason: feedback || "" }),
      });
      const j = await r.json();
      if (j.ok) {
        if (decision === "approve") {
          const approvedItem = picks.find((p) => p.itemId === itemId);
          if (approvedItem) setApproved((prev) => [...prev, { ...approvedItem, approvedAt: Date.now() }]);
        }
        setPicks((prev) => prev.filter((p) => p.itemId !== itemId));
        setShowReasonInput(null);
        setReason("");
      }
    } catch (e) {
      console.error("Decision failed", e);
    }
    setDecidingId(null);
  }

  async function handleRemoveApproved(itemId: string) {
    setRemovingId(itemId);
    try {
      const r = await fetch("/api/clawdbot/approved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (j.ok) setApproved((prev) => prev.filter((a) => a.itemId !== itemId));
    } catch (e) {
      console.error("Remove failed", e);
    }
    setRemovingId(null);
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            🦞 Clawdbot&apos;s Picks
          </h1>
          <p className="text-neutral-400">
            AI-curated eBay deals. Approve to queue for offers, or dismiss with feedback.
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

      {/* ── Picks Queue ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Inbox className="h-4 w-4 text-blue-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Review Queue</h2>
          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400">
            {picks.length}
          </span>
        </div>

        {loading && picks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
            <p className="text-neutral-500">Loading picks...</p>
          </div>
        ) : picks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
            <div className="h-14 w-14 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-neutral-500" />
            </div>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-neutral-500 text-sm">No new deals right now. Ask Clawdbot to sync.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {picks.map((pick) => (
              <div
                key={pick.itemId}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all group"
              >
                <div className="p-5 flex flex-col md:flex-row gap-6">
                  {/* Image */}
                  <div className="h-28 w-28 md:h-36 md:w-36 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800">
                    {pick.thumbnailUrl ? (
                      <img src={pick.thumbnailUrl} alt={pick.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-700 text-xs">No Image</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-base font-bold text-white leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
                          {pick.title}
                        </h3>
                        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                          <span className="text-sm font-bold text-blue-400">${pick.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-neutral-400 mt-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                          ${pick.price.toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-neutral-500" />
                          +${pick.shipping.toFixed(2)} ship
                        </div>
                        <div className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] uppercase tracking-wider font-bold">
                          {pick.condition}
                        </div>
                        {pick.isOfferOnly && (
                          <span className="flex items-center gap-1 text-orange-400 text-xs font-medium">
                            <AlertTriangle className="h-3 w-3" /> Offer Only
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-neutral-500 mt-2">
                        Seller: <span className="text-neutral-300">{pick.seller}</span> ({pick.feedbackPct}%)
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDecision(pick.itemId, "approve")}
                          disabled={decidingId === pick.itemId}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/20 text-sm"
                        >
                          {decidingId === pick.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve
                        </button>
                        <button
                          onClick={() => setShowReasonInput(pick.itemId)}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-sm"
                        >
                          <X className="h-4 w-4" />
                          Dismiss
                        </button>
                      </div>
                      <a
                        href={pick.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-white flex items-center gap-1 text-sm font-medium border-b border-transparent hover:border-neutral-500 transition-all"
                      >
                        View on eBay <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Reason Input */}
                {showReasonInput === pick.itemId && (
                  <div className="bg-neutral-950 p-5 border-t border-neutral-800 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2 text-neutral-400 text-sm mb-3">
                      <MessageSquare className="h-4 w-4" />
                      Why are you dismissing this? (trains the AI)
                    </div>
                    <div className="flex gap-3">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Too many scuffs, seller has low feedback..."
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => e.key === "Enter" && handleDecision(pick.itemId, "disapprove", reason)}
                      />
                      <button
                        onClick={() => handleDecision(pick.itemId, "disapprove", reason)}
                        disabled={decidingId === pick.itemId}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setShowReasonInput(null); setReason(""); }}
                        className="px-4 py-2 text-neutral-500 hover:text-white text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Approved Queue ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 bg-green-500/10 rounded-lg flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Approved — Pending Offers</h2>
          <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-bold text-green-400">
            {approved.length}
          </span>
          {approved.length > 0 && (
            <span className="ml-2 text-xs text-neutral-500">
              Tell Clawdbot &quot;place offers on approved items&quot; to fire these automatically
            </span>
          )}
        </div>

        {approved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/30 rounded-3xl border border-neutral-800 border-dashed">
            <div className="h-12 w-12 bg-neutral-800 rounded-full flex items-center justify-center mb-3">
              <ShoppingCart className="h-6 w-6 text-neutral-600" />
            </div>
            <p className="text-neutral-500 text-sm">No approved items yet. Approve picks above to queue offers.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {approved.map((item) => (
              <div
                key={item.itemId}
                className="bg-neutral-900/70 border border-green-900/40 rounded-2xl p-4 flex items-center gap-4 hover:border-green-700/40 transition-all"
              >
                {/* Thumbnail */}
                {item.thumbnailUrl && (
                  <div className="h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800 bg-black">
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                    <span className="text-green-400 font-bold">${item.totalCost.toFixed(2)} total</span>
                    <span>Seller: {item.seller}</span>
                    {item.approvedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-neutral-500 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleRemoveApproved(item.itemId)}
                    disabled={removingId === item.itemId}
                    className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                    title="Remove from queue"
                  >
                    {removingId === item.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            {/* Fire Offers CTA */}
            <div className="mt-2 p-4 bg-green-950/30 border border-green-900/30 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-green-300 font-semibold text-sm">Ready to place offers</p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  Tell Clawdbot on WhatsApp: <span className="text-white font-mono">&quot;place offers on approved items&quot;</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
