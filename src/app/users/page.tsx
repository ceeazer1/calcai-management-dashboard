"use client";

import { useEffect, useState } from "react";
import { Search, RefreshCw, X, Lock } from "lucide-react";

interface User {
  email: string;
  createdAt?: number;
}

interface Device {
  mac: string;
  owner: string;
  pairedAt?: number;
}

interface LogItem {
  ts?: number;
  type?: string;
  question?: string;
  prompt?: string;
  response?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ type: string; mac: string; title: string } | null>(null);
  const [modalContent, setModalContent] = useState<string | React.ReactNode>("");

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, devicesRes] = await Promise.all([
        fetch("/api/users-admin/list"),
        fetch("/api/users-admin/devices"),
      ]);
      const usersJson = await usersRes.json().catch(() => ({ users: [] }));
      const devicesJson = await devicesRes.json().catch(() => ({ devices: [] }));
      setUsers(Array.isArray(usersJson.users) ? usersJson.users : []);
      setDevices(Array.isArray(devicesJson.devices) ? devicesJson.devices : []);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = users.filter(u => !search || (u.email || "").toLowerCase().includes(search.toLowerCase()));

  function macPretty(id: string) {
    const s = String(id || "").toLowerCase();
    if (/^[0-9a-f]{12}$/.test(s)) return s.match(/.{1,2}/g)?.join(":") || s;
    return s;
  }

  async function viewLogs(mac: string) {
    setModal({ type: "logs", mac, title: `Logs - ${macPretty(mac)}` });
    setModalContent(<p className="text-neutral-400">Loading...</p>);
    try {
      const r = await fetch(`/api/users-admin/logs/${encodeURIComponent(mac)}?limit=100`);
      const j = await r.json().catch(() => ({ items: [] }));
      const items: LogItem[] = Array.isArray(j.items) ? j.items : [];
      if (items.length === 0) { setModalContent(<p className="text-neutral-400">No logs found</p>); return; }
      setModalContent(
        <div className="space-y-3 max-h-[60vh] overflow-auto">
          {items.map((log, i) => (
            <div key={i} className="border-b border-neutral-800 pb-3">
              <div className="text-xs text-neutral-500">{new Date(log.ts || Date.now()).toLocaleString()}</div>
              {(log.question || log.prompt) && <div className="text-sm text-neutral-300"><strong>Q:</strong> {log.question || log.prompt}</div>}
              {log.response && <div className="text-sm text-neutral-300"><strong>A:</strong> {log.response}</div>}
            </div>
          ))}
        </div>
      );
    } catch { setModalContent(<p className="text-red-400">Failed to load logs</p>); }
  }

  async function viewNotes(mac: string) {
    setModal({ type: "notes", mac, title: `Notes - ${macPretty(mac)}` });
    setModalContent(<p className="text-neutral-400">Loading...</p>);
    try {
      const r = await fetch(`/api/users-admin/notes/${encodeURIComponent(mac)}`);
      const j = await r.json().catch(() => ({}));
      setModalContent(j.text ? <pre className="whitespace-pre-wrap text-neutral-300">{j.text}</pre> : <p className="text-neutral-400">No notes</p>);
    } catch { setModalContent(<p className="text-red-400">Failed to load notes</p>); }
  }

  async function viewModel(mac: string) {
    setModal({ type: "model", mac, title: `Model - ${macPretty(mac)}` });
    setModalContent(<p className="text-neutral-400">Loading...</p>);
    try {
      const r = await fetch(`/api/users-admin/model/${encodeURIComponent(mac)}`);
      const j = await r.json().catch(() => ({}));
      setModalContent(<div className="text-neutral-300"><p><strong>Model:</strong> {j.model || "Default"}</p><p><strong>Max Tokens:</strong> {j.maxTokens || 320}</p></div>);
    } catch { setModalContent(<p className="text-red-400">Failed to load model</p>); }
  }

  async function resetPassword(email: string) {
    if (!confirm(`Are you sure you want to trigger a password reset for ${email}?`)) return;
    try {
      const r = await fetch("/api/users-admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (j.ok) alert("Password reset email trigger sent successfully");
      else alert("Failed to trigger password reset: " + (j.error || "unknown"));
    } catch { alert("Network error triggering password reset"); }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={loadData} className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors">
            <RefreshCw className={`h-4 w-4 text-neutral-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2">
          <span className="text-2xl font-bold text-blue-400">{users.length}</span>
          <span className="text-sm text-neutral-400 ml-2">Users</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2">
          <span className="text-2xl font-bold text-green-400">{devices.length}</span>
          <span className="text-sm text-neutral-400 ml-2">Devices</span>
        </div>
      </div>

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-neutral-400">No users found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((user, i) => {
            const userDevices = devices.filter(d => d.owner === user.email);
            return (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <h3 className="text-white font-medium truncate mb-1">{user.email}</h3>
                <p className="text-xs text-neutral-500 mb-3">Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}</p>
                <div className="text-xs text-neutral-400 mb-2">{userDevices.length} device{userDevices.length !== 1 ? "s" : ""}</div>
                {userDevices.map((d, j) => (
                  <div key={j} className="bg-neutral-800 rounded-lg p-3 mb-2">
                    <div className="font-mono text-sm text-blue-400 mb-2">{macPretty(d.mac)}</div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => viewLogs(d.mac)} className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-200 transition-colors">Logs</button>
                      <button onClick={() => viewNotes(d.mac)} className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-200 transition-colors">Notes</button>
                      <button onClick={() => viewModel(d.mac)} className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-200 transition-colors">Model</button>
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-neutral-800">
                  <button onClick={() => resetPassword(user.email)} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-900/20 hover:bg-red-900/40 px-3 py-2 rounded w-full justify-center">
                    <Lock className="h-3 w-3" />
                    Reset Password
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">{modal.title}</h3>
              <button onClick={() => setModal(null)} className="text-neutral-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {modalContent}
          </div>
        </div>
      )}
    </div>
  );
}

