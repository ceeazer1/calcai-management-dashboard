import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const KV_KEY = 'website:settings';

function getKvClient() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createClient({ url, token });
  }
  return null;
}

interface MaintenanceSettings {
  enabled: boolean;
  until: string;
  discordUrl: string;
}

interface WebsiteSettings {
  price: number;
  compareAt: number | null;
  inStock: boolean;
  stockCount: number | null;
  preorderEnabled: boolean;
  preorderPrice: number | null;
  preorderShipDate: string;
  maintenance: MaintenanceSettings;
  lastUpdated: number;
}

const defaultSettings: WebsiteSettings = {
  price: 174.99,
  compareAt: 199.99,
  inStock: true,
  stockCount: 12,
  preorderEnabled: false,
  preorderPrice: 200.0,
  preorderShipDate: '',
  maintenance: {
    enabled: false,
    until: '',
    discordUrl: '',
  },
  lastUpdated: 0,
};

async function loadSettings(): Promise<WebsiteSettings> {
  const kv = getKvClient();
  if (kv) {
    try {
      const v = await kv.get<WebsiteSettings>(KV_KEY);
      if (v && typeof v === 'object') {
        return { ...defaultSettings, ...v };
      }
    } catch (e) {
      console.warn('[website-public/settings] loadFromKV failed:', e);
    }
  }
  return defaultSettings;
}

// Public read-only endpoint - no auth required
export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json(settings, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

