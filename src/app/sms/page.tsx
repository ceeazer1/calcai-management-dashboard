"use client";

import { useState, useEffect } from "react";

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
      setSubscribers(j.rows || []);
      setTotal(j.total || 0);
    } catch {
      showAlert("Failed to load subscribers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSubscribers(); }, []);

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
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-white mb-6">SMS Management</h1>

      {alert && (
        <div className={`mb-4 p-3 rounded-lg ${alert.type === "error" ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>
          {alert.msg}
        </div>
      )}

      {/* Subscribers Section */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Subscribers</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadSubscribers()}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); }}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="subscribed">Subscribed</option>
            <option value="opted_out">Opted out</option>
          </select>
          <button onClick={loadSubscribers} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
            {loading ? "Loading…" : "Reload"}
          </button>
          <button onClick={exportCSV} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-white">
            Export CSV
          </button>
          <span className="text-neutral-400 self-center ml-auto">{total} total</span>
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
                <tr><td colSpan={4} className="py-4 text-center text-neutral-500">No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Section */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Broadcast to All Subscribers</h2>
        <div className="max-w-xl">
          <div className="mb-4">
            <label className="block text-neutral-400 mb-1">Message Preset</label>
            <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white">
              <option value="">Custom message</option>
              <option value="restock">Restock Alert</option>
              <option value="preorder">Preorder Available</option>
              <option value="shipping">Shipping Update</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-neutral-400 mb-1">Message</label>
            <textarea
              rows={4}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Type your message…"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
            <small className="text-neutral-500">Include STOP/HELP for compliance.</small>
          </div>
          <button
            onClick={handleBroadcast}
            disabled={broadcasting}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-3 rounded-lg text-white font-semibold"
          >
            {broadcasting ? "Broadcasting…" : "Broadcast to All"}
          </button>
        </div>
      </div>

      {/* Test Send Section */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-4">Send Test Message</h2>
        <div className="max-w-xl">
          <div className="mb-4">
            <label className="block text-neutral-400 mb-1">Country</label>
            <select value={testCountry} onChange={(e) => setTestCountry(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} +{c.dial}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
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
          <div className="mb-4">
            <label className="block text-neutral-400 mb-1">Message</label>
            <textarea
              rows={3}
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder="Type a test message…"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white"
          >
            {sendingTest ? "Sending…" : "Send Test"}
          </button>
        </div>
      </div>
    </div>
  );
}

