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
}

export default function ClawdbotEbayPicks() {
  const [picks, setPicks] = useState<EbayPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState<string | null>(null);

  async function loadPicks() {
    setLoading(true);
    try {
      const r = await fetch("/api/clawdbot/picks", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setPicks(j.items);
    } catch (e) {
      console.error("Failed to load picks", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPicks();
  }, []);

  async function handleDecision(itemId: string, decision: 'approve' | 'disapprove', feedback?: string) {
    setDecidingId(itemId);
    try {
      const r = await fetch("/api/clawdbot/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, decision, reason: feedback || "" }),
      });
      const j = await r.json();
      if (j.ok) {
        setPicks((prev) => prev.filter((p) => p.itemId !== itemId));
        setShowReasonInput(null);
        setReason("");
      }
    } catch (e) {
      console.error("Decision failed", e);
    }
    setDecidingId(null);
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            🦞 Clawdbot's Picks
          </h1>
          <p className="text-neutral-400">
            AI-curated eBay deals. Approve to place offers or dismiss with feedback to train the AI.
          </p>
        </div>
        <button
          onClick={loadPicks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-all text-sm text-neutral-200"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Picks
        </button>
      </div>

      {loading && picks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <p className="text-neutral-500">Scanning eBay for new deals...</p>
        </div>
      ) : picks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-neutral-900/50 rounded-3xl border border-neutral-800 border-dashed">
          <div className="h-16 w-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-neutral-500" />
          </div>
          <p className="text-white font-medium">All caught up!</p>
          <p className="text-neutral-500 text-sm">No new deals matching your criteria right now.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {picks.map((pick) => (
            <div
              key={pick.itemId}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all group"
            >
              <div className="p-5 flex flex-col md:flex-row gap-6">
                {/* Image */}
                <div className="h-32 w-32 md:h-40 md:w-40 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800">
                  {pick.thumbnailUrl ? (
                    <img src={pick.thumbnailUrl} alt={pick.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700">No Image</div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-lg font-bold text-white leading-tight group-hover:text-blue-400 transition-colors">
                        {pick.title}
                      </h3>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                        <span className="text-xs font-bold text-blue-400">
                          ${pick.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-neutral-400 mt-2">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                        Price: ${pick.price.toFixed(2)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-neutral-500" />
                        Ship: ${pick.shipping.toFixed(2)}
                      </div>
                      <div className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] uppercase tracking-wider font-bold">
                        {pick.condition}
                      </div>
                    </div>

                    <div className="text-sm text-neutral-500 mt-3 flex items-center gap-2">
                      <span>Seller: <span className="text-neutral-300">{pick.seller}</span> ({pick.feedbackPct}%)</span>
                      {pick.isOfferOnly && (
                        <span className="flex items-center gap-1 text-orange-400 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" /> Offer Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDecision(pick.itemId, 'approve')}
                        disabled={decidingId === pick.itemId}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/20"
                      >
                        {decidingId === pick.itemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => setShowReasonInput(pick.itemId)}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all"
                      >
                        <X className="h-4 w-4" />
                        Disapprove
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

              {/* Reason Input Area */}
              {showReasonInput === pick.itemId && (
                <div className="bg-neutral-950 p-5 border-t border-neutral-800 animate-in slide-in-from-top duration-300">
                  <div className="flex items-center gap-2 text-neutral-400 text-sm mb-3">
                    <MessageSquare className="h-4 w-4" />
                    Why are you disapproving this pick?
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Too many scuffs on screen, seller has low feedback..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleDecision(pick.itemId, 'disapprove', reason)}
                    />
                    <button
                      onClick={() => handleDecision(pick.itemId, 'disapprove', reason)}
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
    </div>
  );
}
