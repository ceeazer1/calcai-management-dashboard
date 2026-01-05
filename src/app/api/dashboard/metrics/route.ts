import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";

type Point = { ts: number; value: number };

const EDGE_BASE = process.env.EDGE_WORKER_URL || "https://ai.calcai.cc";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Ensure WEBSITE_URL has https:// prefix
const rawWebsiteUrl = (process.env.WEBSITE_URL || "https://www.calcai.cc").replace(/\/+$/, "");
const WEBSITE_BASE = rawWebsiteUrl.startsWith("http") ? rawWebsiteUrl : `https://${rawWebsiteUrl}`;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN || "";

const MAX_POINTS = 2000;
const KEEP_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MIN_APPEND_INTERVAL_MS = 15 * 60 * 1000; // 15 min

function seriesKey(metric: string) {
  return `dashboard:metric:${metric}:series`;
}

function normalizeSeries(v: unknown): Point[] {
  if (!Array.isArray(v)) return [];
  const out: Point[] = [];
  for (const row of v) {
    const ts = Number((row as any)?.ts);
    const value = Number((row as any)?.value);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) continue;
    out.push({ ts, value });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

function prune(points: Point[], now: number): Point[] {
  const cutoff = now - KEEP_MS;
  const filtered = points.filter((p) => p.ts >= cutoff);
  return filtered.slice(Math.max(0, filtered.length - MAX_POINTS));
}

async function loadAndMaybeAppend(metric: string, current: number | null, now: number): Promise<Point[]> {
  const kv = getKvClient();
  const existing = normalizeSeries(await kv.get<unknown>(seriesKey(metric)));
  const pruned = prune(existing, now);

  if (current === null || !Number.isFinite(current)) return pruned;
  const last = pruned.length ? pruned[pruned.length - 1] : null;
  const shouldAppend =
    !last || now - last.ts >= MIN_APPEND_INTERVAL_MS || Number(last.value) !== Number(current);
  if (!shouldAppend) return pruned;

  const next = prune([...pruned, { ts: now, value: current }], now);
  await kv.set(seriesKey(metric), next);
  return next;
}

async function fetchTotalUsers(): Promise<number> {
  if (!ADMIN_TOKEN) throw new Error("missing_ADMIN_TOKEN");
  const r = await fetch(`${EDGE_BASE}/ai/admin/users`, {
    headers: { "X-Admin-Token": ADMIN_TOKEN },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    const msg = j?.error || j?.message || `HTTP ${r.status}`;
    throw new Error(`users_fetch_failed:${msg}`);
  }
  if (Array.isArray(j?.users)) return j.users.length;
  const n = Number(j?.totalUsers ?? j?.total ?? 0);
  if (!Number.isFinite(n)) throw new Error("users_invalid_response");
  return n;
}

async function fetchSmsSubscribedCount(): Promise<number> {
  if (!ADMIN_API_TOKEN) throw new Error("missing_ADMIN_API_TOKEN");
  const params = new URLSearchParams();
  params.set("status", "subscribed");
  params.set("limit", "1");
  params.set("offset", "0");

  const r = await fetch(`${WEBSITE_BASE}/api/admin/sms/subscribers?${params.toString()}`, {
    headers: { "x-admin-token": ADMIN_API_TOKEN },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    const msg = j?.error || j?.message || `HTTP ${r.status}`;
    throw new Error(`sms_fetch_failed:${msg}`);
  }
  const total = Number(j?.total ?? 0);
  if (!Number.isFinite(total)) throw new Error("sms_invalid_response");
  return total;
}

export async function GET() {
  const now = Date.now();

  let totalUsers: number | null = null;
  let smsSubscribers: number | null = null;
  const errors: Record<string, string> = {};

  try {
    totalUsers = await fetchTotalUsers();
  } catch (e: unknown) {
    errors.totalUsers = e instanceof Error ? e.message : String(e);
  }

  try {
    smsSubscribers = await fetchSmsSubscribedCount();
  } catch (e: unknown) {
    errors.smsSubscribers = e instanceof Error ? e.message : String(e);
  }

  const [usersSeries, smsSeries] = await Promise.all([
    loadAndMaybeAppend("totalUsers", totalUsers, now),
    loadAndMaybeAppend("smsSubscribers", smsSubscribers, now),
  ]);

  return NextResponse.json({
    ok: true,
    now,
    metrics: {
      totalUsers: { current: totalUsers, series: usersSeries },
      smsSubscribers: { current: smsSubscribers, series: smsSeries },
    },
    errors: Object.keys(errors).length ? errors : undefined,
  });
}









