import { createClient } from "@vercel/kv";

export type KvClientLike = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

let memStore: Map<string, unknown> | null = null;

function getMemStore() {
  if (!memStore) memStore = new Map<string, unknown>();
  return memStore;
}

export function getKvClient(): KvClientLike {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createClient({ url, token });
  }

  // Local/dev fallback (non-persistent)
  const mem = getMemStore();
  return {
    async get<T>(key: string) {
      return (mem.has(key) ? (mem.get(key) as T) : null);
    },
    async set(key: string, value: unknown) {
      mem.set(key, value);
      return "OK";
    },
    async del(key: string) {
      mem.delete(key);
      return 1;
    },
  };
}









