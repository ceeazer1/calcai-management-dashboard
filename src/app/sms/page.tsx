"use client";

import { useState, useEffect } from "react";
import { Eye, X } from "lucide-react";

interface Subscriber {
  phone: string;
  status: string;
  source?: string;
  consent_ts?: string;
}

const COUNTRIES = [
  { code: "US", name: "United States", dial: "1", placeholder: "(555) 123-4567" },
  { code: "CA", name: "Canada", dial: "1", placeholder: "(555) 123-4567" },
  { code: "GB", name: "United Kingdom", dial: "44", placeholder: "7123 456 789" },
  { code: "AU", name: "Australia", dial: "61", placeholder: "4123 456 78" },
  { code: "IN", name: "India", dial: "91", placeholder: "98765 43210" },
  { code: "DE", name: "Germany", dial: "49", placeholder: "151 234 5678" },
  { code: "FR", name: "France", dial: "33", placeholder: "6 12 34 567" },
];

const PRESETS: Record<string, string> = {
  restock: "CalcAI: New units available at bit.ly/43xzlkK. Reply STOP to unsubscribe.",
  preorder: "CalcAI: Preorders open at bit.ly/43xzlkK. Reply STOP to unsubscribe.",
  shipping: "CalcAI: Your order has shipped. Track your package. Reply STOP to unsubscribe.",
};

export default function SmsPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [subscribersLoaded, setSubscribersLoaded] = useState(false);
  const [subscribedCount, setSubscribedCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [tab, setTab] = useState<"broadcast" | "direct">("broadcast");

  // Broadcast state
  const [broadcastBody, setBroadcastBody] = useState("");
  const [preset, setPreset] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  // Test send state
  const [testCountry, setTestCountry] = useState("US");
  const [testNational, setTestNational] = useState("");
  const [testBody, setTestBody] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const [alert, setAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showAlert = (msg: string, type: "success" | "error") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadSubscribers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/sms/subscribers?${params.toString()}`);
      const j = await r.json();
      if (!r.ok || j.ok === false) {
        const errMsg = j.error || j.body || `HTTP ${r.status}`;
        showAlert(`Failed to load: ${errMsg}`, "error");
        setSubscribers([]);
        setTotal(0);
        return;
      }
      setSubscribers(j.rows || []);
      setTotal(j.total || 0);
      setSubscribersLoaded(true);
    } catch (e) {
      console.error("loadSubscribers error:", e);
      showAlert("Failed to load subscribers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showSubscribers && !subscribersLoaded) loadSubscribers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSubscribers]);

  useEffect(() => {
    async function loadCount() {
      setCountLoading(true);
      try {
        const r = await fetch("/api/sms/subscriber-count?status=subscribed", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) throw new Error(j?.error || "count_failed");
        const n = Number(j?.total);
        setSubscribedCount(Number.isFinite(n) ? n : 0);
      } catch {
        setSubscribedCount(null);
      } finally {
        setCountLoading(false);
      }
    }
    loadCount();
  }, []);

  const handleBroadcast = async () => {
    if (!broadcastBody.trim()) {
      showAlert("Enter a message", "error");
      return;
    }
    const confirm = window.prompt("⚠️ This will send to ALL subscribed numbers.\n\nType SEND to confirm:");
    if (confirm !== "SEND") {
      showAlert("Cancelled", "error");
      return;
    }
    setBroadcasting(true);
    try {
      const r = await fetch("/api/sms/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: broadcastBody }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Broadcast failed");
      showAlert(`Broadcast sent to ${j.sent || 0} subscribers`, "success");
      setBroadcastBody("");
      setPreset("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Broadcast failed";
      showAlert(msg, "error");
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSendTest = async () => {
    const country = COUNTRIES.find((c) => c.code === testCountry) || COUNTRIES[0];
    const digits = testNational.replace(/\D/g, "");
    const to = digits ? `+${country.dial}${digits}` : "";
    if (!to || !testBody.trim()) {
      showAlert("Enter number and message", "error");
      return;
    }
    setSendingTest(true);
    try {
      const r = await fetch("/api/sms/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body: testBody }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Send failed");
      showAlert("Test message sent!", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      showAlert(msg, "error");
    } finally {
      setSendingTest(false);
    }
  };

  const handlePresetChange = (val: string) => {
    setPreset(val);
    if (val && PRESETS[val]) {
      setBroadcastBody(PRESETS[val]);
    }
  };

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("format", "csv");
    window.open(`/api/sms/subscribers?${params.toString()}`, "_blank");
  };

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">SMS Management</h1>

        {alert && (
          <div className={`mb-4 p-3 rounded-lg ${alert.type === "error" ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>
            {alert.msg}
          </div>
        )}

        {/* Main (tabs) */}
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-white">Messaging</h2>
              <div className="text-xs text-neutral-500 mt-1">
                {countLoading ? "Counting…" : subscribedCount !== null ? `${subscribedCount} subscribed` : "Count unavailable"}
                {tab === "broadcast" ? " • confirm required" : ""}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Docker-like tab bar */}
              <div className="inline-flex bg-neutral-950 border border-neutral-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setTab("broadcast")}
                  className={[
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    tab === "broadcast" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white",
                  ].join(" ")}
                >
                  Broadcast to all
                </button>
                <button
                  type="button"
                  onClick={() => setTab("direct")}
                  className={[
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    tab === "direct" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white",
                  ].join(" ")}
                >
                  Send to number
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSubscribers(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200"
                title="View subscriber list"
              >
                <Eye className="h-4 w-4" />
                View subscribers
              </button>
            </div>
          </div>

          {tab === "broadcast" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-neutral-400 mb-1">Message Preset</label>
                  <select
                    value={preset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Custom message</option>
                    <option value="restock">Restock Alert</option>
                    <option value="preorder">Preorder Available</option>
                    <option value="shipping">Shipping Update</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Message</label>
                <textarea
                  rows={6}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Type your message…"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                />
                <small className="text-neutral-500">Include STOP/HELP for compliance.</small>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleBroadcast}
                  disabled={broadcasting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-3 rounded-lg text-white font-semibold"
                >
                  {broadcasting ? "Broadcasting…" : "Broadcast to All"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Country</label>
                  <select
                    value={testCountry}
                    onChange={(e) => setTestCountry(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} +{c.dial}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Phone Number</label>
                  <div className="flex">
                    <span className="bg-neutral-800 border border-neutral-700 border-r-0 rounded-l-lg px-3 py-2 text-neutral-400">
                      +{COUNTRIES.find((c) => c.code === testCountry)?.dial || "1"}
                    </span>
                    <input
                      type="text"
                      value={testNational}
                      onChange={(e) => setTestNational(e.target.value)}
                      placeholder={COUNTRIES.find((c) => c.code === testCountry)?.placeholder}
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-r-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Message</label>
                <textarea
                  rows={5}
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  placeholder="Type a message…"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white"
                >
                  {sendingTest ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscribers modal */}
      {showSubscribers && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSubscribers(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-5xl w-full max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">Subscribers</h3>
                <div className="text-xs text-neutral-500">Phone numbers are hidden by default on the SMS page.</div>
              </div>
              <button
                onClick={() => setShowSubscribers(false)}
                className="text-neutral-400 hover:text-white"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Search phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadSubscribers()}
                className="flex-1 min-w-[220px] bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                }}
                className="w-full md:w-44 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">All</option>
                <option value="subscribed">Subscribed</option>
                <option value="opted_out">Opted out</option>
              </select>
              <button
                onClick={loadSubscribers}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
              >
                {loading ? "Loading…" : subscribersLoaded ? "Reload" : "Load subscribers"}
              </button>
              <button
                onClick={exportCSV}
                className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-white"
              >
                Export CSV
              </button>
              <span className="text-neutral-400 self-center md:ml-auto">{total} total</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-neutral-700">
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Source</th>
                    <th className="py-2 px-3">Consent</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s, i) => (
                    <tr key={i} className="border-b border-neutral-800 text-white">
                      <td className="py-2 px-3">{s.phone}</td>
                      <td className="py-2 px-3">{s.status}</td>
                      <td className="py-2 px-3 text-neutral-400">{s.source || "-"}</td>
                      <td className="py-2 px-3 text-neutral-400">{s.consent_ts || "-"}</td>
                    </tr>
                  ))}
                  {subscribers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral-500">
                        {loading
                          ? "Loading…"
                          : subscribersLoaded
                            ? "No subscribers found"
                            : "Click “Load subscribers” to fetch the list"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

