"use client";

import { useEffect, useState } from "react";
import { Users, Cpu, Activity, MessageSquare } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalDevices: number;
  totalSmsSubscribers: number;
  loading: boolean;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalDevices: 0, totalSmsSubscribers: 0, loading: true });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, devicesRes, smsRes] = await Promise.all([
          fetch("/api/users-admin/list"),
          fetch("/api/users-admin/devices"),
          fetch("/api/sms/subscriber-count?status=subscribed"),
        ]);
        const usersJson = await usersRes.json().catch(() => ({ users: [] }));
        const devicesJson = await devicesRes.json().catch(() => ({ devices: [] }));
        const smsJson = await smsRes.json().catch(() => ({ total: 0 }));
        setStats({
          totalUsers: usersJson.users?.length || 0,
          totalDevices: devicesJson.devices?.length || 0,
          totalSmsSubscribers: Number(smsJson?.total || 0) || 0,
          loading: false,
        });
      } catch {
        setStats({ totalUsers: 0, totalDevices: 0, totalSmsSubscribers: 0, loading: false });
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" value={stats.loading ? "..." : stats.totalUsers} icon={<Users className="h-6 w-6" />} color="blue" />
        <StatCard title="Paired Devices" value={stats.loading ? "..." : stats.totalDevices} icon={<Cpu className="h-6 w-6" />} color="green" />
        <StatCard title="Active Today" value="-" icon={<Activity className="h-6 w-6" />} color="purple" />
        <StatCard title="SMS Subscribers" value={stats.loading ? "..." : stats.totalSmsSubscribers} icon={<MessageSquare className="h-6 w-6" />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <p className="text-neutral-400 text-sm">Activity feed coming soon...</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a href="/users" className="block p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors">View All Users →</a>
            <a href="/firmware" className="block p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors">Manage Firmware →</a>
            <a href="/settings" className="block p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors">Settings →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
    orange: "bg-orange-500/20 text-orange-400",
  };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-400">{title}</div>
    </div>
  );
}
