"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Users } from "lucide-react";

type Point = { ts: number; value: number };
type MetricKey = "totalUsers" | "smsSubscribers";
type RangeId = "24h" | "7d" | "30d" | "90d";

const RANGES: { id: RangeId; label: string; ms: number }[] = [
  { id: "24h", label: "24H", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7D", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30D", ms: 30 * 24 * 60 * 60 * 1000 },
  { id: "90d", label: "90D", ms: 90 * 24 * 60 * 60 * 1000 },
];

const COLORS = {
  blue: {
    badge: "bg-blue-500/20 text-blue-400",
    buttonSelected: "bg-blue-600/20 border-blue-500/30 text-blue-200",
    stroke: "rgba(59,130,246,0.9)",
    fill: "rgba(59,130,246,0.12)",
  },
  orange: {
    badge: "bg-orange-500/20 text-orange-400",
    buttonSelected: "bg-orange-600/20 border-orange-500/30 text-orange-200",
    stroke: "rgba(249,115,22,0.9)",
    fill: "rgba(249,115,22,0.12)",
  },
} as const;

interface MetricSeries {
  current: number | null;
  series: Point[];
}

interface MetricsResponse {
  ok: boolean;
  now: number;
  metrics: {
    totalUsers: MetricSeries;
    smsSubscribers: MetricSeries;
  };
  errors?: Record<string, string>;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());
  const [metrics, setMetrics] = useState<MetricsResponse["metrics"]>({
    totalUsers: { current: null, series: [] },
    smsSubscribers: { current: null, series: [] },
  });
  const [ranges, setRanges] = useState<Record<MetricKey, RangeId>>({
    totalUsers: "30d",
    smsSubscribers: "30d",
  });

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const r = await fetch("/api/dashboard/metrics", { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as Partial<MetricsResponse>;
        if (!r.ok || !j.ok || !j.metrics) throw new Error("metrics_fetch_failed");
        setNow(Number(j.now || Date.now()));
        setMetrics(j.metrics as MetricsResponse["metrics"]);
      } catch {
        setNow(Date.now());
        setMetrics({
          totalUsers: { current: null, series: [] },
          smsSubscribers: { current: null, series: [] },
        });
      }
      setLoading(false);
    }
    fetchMetrics();
  }, []);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.current}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          now={now}
          series={metrics.totalUsers.series}
          loading={loading}
          range={ranges.totalUsers}
          onRangeChange={(r) => setRanges((prev) => ({ ...prev, totalUsers: r }))}
        />
        <MetricCard
          title="SMS Subscribers"
          value={metrics.smsSubscribers.current}
          icon={<MessageSquare className="h-5 w-5" />}
          color="orange"
          now={now}
          series={metrics.smsSubscribers.series}
          loading={loading}
          range={ranges.smsSubscribers}
          onRangeChange={(r) => setRanges((prev) => ({ ...prev, smsSubscribers: r }))}
        />
      </div>
    </div>
  );
}

function fmtNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat().format(n);
}

function MetricCard({
  title,
  value,
  icon,
  color,
  now,
  series,
  loading,
  range,
  onRangeChange,
}: {
  title: string;
  value: number | null;
  icon: React.ReactNode;
  color: keyof typeof COLORS;
  now: number;
  series: Point[];
  loading: boolean;
  range: RangeId;
  onRangeChange: (r: RangeId) => void;
}) {
  const rangeMs = RANGES.find((r) => r.id === range)?.ms || RANGES[2].ms;
  const cutoff = now - rangeMs;
  const filtered = useMemo(() => {
    const pts = (Array.isArray(series) ? series : []).filter((p) => Number(p.ts) >= cutoff);
    pts.sort((a, b) => a.ts - b.ts);
    if (pts.length >= 2) return pts;
    if (typeof value === "number" && Number.isFinite(value)) {
      return [
        { ts: cutoff, value },
        { ts: now, value },
      ];
    }
    return pts;
  }, [series, cutoff, value, now]);

  const theme = COLORS[color];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${theme.badge}`}>{icon}</div>
            <div className="text-sm text-neutral-400">{title}</div>
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {loading ? "..." : fmtNumber(value)}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {RANGES.map((r) => {
            const selected = r.id === range;
            return (
              <button
                key={r.id}
                onClick={() => onRangeChange(r.id)}
                className={[
                  "px-2 py-1 text-[11px] rounded-md border transition-colors",
                  selected
                    ? theme.buttonSelected
                    : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800",
                ].join(" ")}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {filtered.length >= 2 ? (
          <Sparkline points={filtered} stroke={theme.stroke} fill={theme.fill} />
        ) : (
          <div className="text-xs text-neutral-500">No history yet</div>
        )}
        <div className="mt-2 text-[11px] text-neutral-500">
          {range.toUpperCase()} • {filtered.length ? `${filtered.length} points` : "0 points"}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, stroke, fill }: { points: Point[]; stroke: string; fill: string }) {
  const w = 300;
  const h = 80;
  const pad = 8;
  if (!points || points.length < 2) return null;

  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const scaleX = (ts: number) => pad + ((ts - minX) / spanX) * (w - pad * 2);
  const scaleY = (v: number) => pad + (1 - (v - minY) / spanY) * (h - pad * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.ts).toFixed(2)} ${scaleY(p.value).toFixed(2)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 block">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
      <path
        d={`${d} L ${scaleX(points[points.length - 1].ts)} ${h - pad} L ${scaleX(points[0].ts)} ${h - pad} Z`}
        fill={fill}
        stroke="none"
      />
    </svg>
  );
}
