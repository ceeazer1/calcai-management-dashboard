"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, ShoppingCart, DollarSign, RefreshCw } from "lucide-react";

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
      // Fetch metrics (users + subscribers)
      const metricsRes = await fetch("/api/dashboard/metrics", { cache: "no-store" });
      const metricsData = await metricsRes.json().catch(() => ({}));

      // Fetch orders
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
      // Keep existing stats on error
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="SMS Subscribers"
          value={stats.smsSubscribers}
          icon={<MessageSquare className="h-5 w-5" />}
          color="orange"
          loading={loading}
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Revenue"
          value={stats.totalRevenue}
          icon={<DollarSign className="h-5 w-5" />}
          color="purple"
          loading={loading}
          isCurrency
        />
      </div>
    </div>
  );
}

const COLORS = {
  blue: "bg-blue-500/20 text-blue-400",
  orange: "bg-orange-500/20 text-orange-400",
  green: "bg-green-500/20 text-green-400",
  purple: "bg-purple-500/20 text-purple-400",
} as const;

function StatCard({
  title,
  value,
  icon,
  color,
  loading,
  isCurrency = false,
}: {
  title: string;
  value: number | null;
  icon: React.ReactNode;
  color: keyof typeof COLORS;
  loading: boolean;
  isCurrency?: boolean;
}) {
  const formatValue = (v: number | null): string => {
    if (v === null || !Number.isFinite(v)) return "—";
    if (isCurrency) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(v / 100);
    }
    return new Intl.NumberFormat().format(v);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${COLORS[color]}`}>{icon}</div>
        <div className="text-sm text-neutral-400">{title}</div>
      </div>
      <div className="mt-4 text-3xl font-bold text-white">
        {loading ? "..." : formatValue(value)}
      </div>
    </div>
  );
}
