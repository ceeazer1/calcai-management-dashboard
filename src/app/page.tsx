"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AgentPlayground } from "./components/AgentPlayground";

interface DashboardStats {
  totalUsers: number | null;
  smsSubscribers: number | null;
  totalOrders: number | null;
  totalRevenue: number | null;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: null,
    smsSubscribers: null,
    totalOrders: null,
    totalRevenue: null,
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const metricsRes = await fetch("/api/dashboard/metrics", { cache: "no-store" });
      const metricsData = await metricsRes.json().catch(() => ({}));

      const ordersRes = await fetch("/api/orders/list", { cache: "no-store" });
      const ordersData = await ordersRes.json().catch(() => ({}));

      const orders = Array.isArray(ordersData?.orders) ? ordersData.orders : [];
      const completedOrders = orders.filter((o: any) => o.status === "complete");
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);

      setStats({
        totalUsers: metricsData?.metrics?.totalUsers?.current ?? null,
        smsSubscribers: metricsData?.metrics?.smsSubscribers?.current ?? null,
        totalOrders: completedOrders.length,
        totalRevenue: totalRevenue,
      });
    } catch {
      // Ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatValue = (v: number | null): string => {
    if (v === null || !Number.isFinite(v)) return "—";
    return new Intl.NumberFormat().format(v);
  };

  const formatCurrency = (v: number | null): string => {
    if (v === null || !Number.isFinite(v)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(v / 100);
  };

  return (
    <div className="flex flex-col h-screen max-h-[100dvh] bg-black text-white font-sans p-4 sm:p-6 overflow-hidden relative selection:bg-cyan-900/50">
      {/* Background layer */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,10,20,1)_0%,rgba(0,0,0,1)_100%)]"></div>

      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 z-10 shrink-0 border-b border-neutral-900/50 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <h1 className="text-xl font-bold tracking-[0.3em] text-neutral-300 max-w-min uppercase leading-none border-b-2 border-cyan-500/50 pb-1">
            SYS.CORE
          </h1>
          <div className="hidden sm:block h-8 w-px bg-neutral-800"></div>

          <div className="flex gap-6 sm:gap-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono">Total Users</span>
              <span className="text-neutral-300 font-bold font-mono tracking-tight text-sm">{loading ? "..." : formatValue(stats.totalUsers)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono">SMS Subs</span>
              <span className="text-neutral-300 font-bold font-mono tracking-tight text-sm">{loading ? "..." : formatValue(stats.smsSubscribers)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono">Orders</span>
              <span className="text-neutral-300 font-bold font-mono tracking-tight text-sm">{loading ? "..." : formatValue(stats.totalOrders)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono">Revenue</span>
              <span className="text-neutral-300 font-bold font-mono tracking-tight text-sm">{loading ? "..." : formatCurrency(stats.totalRevenue)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900/40 border border-neutral-800/80 rounded uppercase font-mono text-[10px] tracking-wider text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          SYNC
        </button>
      </div>

      <div className="flex-1 w-full relative z-10 min-h-0 bg-black/50 rounded-2xl border border-neutral-900 overflow-hidden shadow-2xl">
        <AgentPlayground />
      </div>
    </div>
  );
}
