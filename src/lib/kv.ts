import { createClient } from "@vercel/kv";
import { Pool } from "pg";

export type KvClientLike = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

let pgPool: Pool | null = null;

function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

async function ensureTable() {
  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function getKvClient(): KvClientLike {
  // 1. Prioritize Vercel KV if available
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createClient({ url, token });
  }

  // 2. Fallback to Postgres (Neon) if available
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    return {
      async get<T>(key: string) {
        await ensureTable();
        const { rows } = await getPgPool().query("SELECT value FROM kv_store WHERE key = $1", [key]);
        return rows.length ? (rows[0].value as T) : null;
      },
      async set(key: string, value: unknown) {
        await ensureTable();
        await getPgPool().query(
          "INSERT INTO kv_store (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
          [key, JSON.stringify(value)]
        );
        return "OK";
      },
      async del(key: string) {
        await ensureTable();
        const { rowCount } = await getPgPool().query("DELETE FROM kv_store WHERE key = $1", [key]);
        return rowCount;
      },
    };
  }

  // 3. Last resort: Local Memory (non-persistent)
  console.warn("⚠️ No persistent KV storage found. Data will be lost on restart.");
  const mem = new Map<string, unknown>();
  return {
    async get<T>(key: string) { return (mem.get(key) as T) || null; },
    async set(key: string, value: unknown) { mem.set(key, value); return "OK"; },
    async del(key: string) { mem.delete(key); return 1; },
  };
}
