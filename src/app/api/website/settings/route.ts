import { NextRequest, NextResponse } from 'next/server';
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
      console.warn('[website/settings] loadFromKV failed:', e);
    }
  }
  return defaultSettings;
}

async function saveSettings(settings: WebsiteSettings): Promise<void> {
  const kv = getKvClient();
  if (kv) {
    try {
      await kv.set(KV_KEY, settings);
    } catch (e) {
      console.warn('[website/settings] saveToKV failed:', e);
    }
  }
}

export async function GET() {
  const settings = await loadSettings();
  const kv = getKvClient();
  return NextResponse.json({ ...settings, storage: kv ? 'kv' : 'file' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await loadSettings();
    const next = { ...settings };

    // Price
    if (body.price !== undefined) {
      const p = Number(body.price);
      if (Number.isFinite(p) && p >= 0 && p <= 999999) next.price = Number(p.toFixed(2));
      else return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }

    // Compare at
    if (body.compareAt !== undefined) {
      // allow clearing compareAt
      if (body.compareAt === null || body.compareAt === '') {
        next.compareAt = null;
      } else {
        const c = Number(body.compareAt);
        if (Number.isFinite(c) && c >= 0 && c <= 999999) next.compareAt = Number(c.toFixed(2));
        else return NextResponse.json({ error: 'Invalid compareAt' }, { status: 400 });
      }
    }

    // In stock
    if (body.inStock !== undefined) {
      if (typeof body.inStock === 'boolean') next.inStock = body.inStock;
      else if (typeof body.inStock === 'string') next.inStock = body.inStock === 'true';
      else return NextResponse.json({ error: 'Invalid inStock' }, { status: 400 });
    }

    // Stock count
    if (body.stockCount !== undefined) {
      // allow clearing stockCount
      if (body.stockCount === null || body.stockCount === '') {
        next.stockCount = null;
      } else {
        const s = Number(body.stockCount);
        if (Number.isInteger(s) && s >= 0 && s <= 1000000) next.stockCount = s;
        else return NextResponse.json({ error: 'Invalid stockCount' }, { status: 400 });
      }
    }

    // Preorder enabled
    if (body.preorderEnabled !== undefined) {
      if (typeof body.preorderEnabled === 'boolean') next.preorderEnabled = body.preorderEnabled;
      else if (typeof body.preorderEnabled === 'string') next.preorderEnabled = body.preorderEnabled === 'true';
      else return NextResponse.json({ error: 'Invalid preorderEnabled' }, { status: 400 });
    }

    // Preorder price
    if (body.preorderPrice !== undefined) {
      // allow clearing preorderPrice
      if (body.preorderPrice === null || body.preorderPrice === '') {
        next.preorderPrice = null;
      } else {
        const pp = Number(body.preorderPrice);
        if (Number.isFinite(pp) && pp >= 0 && pp <= 999999) next.preorderPrice = Number(pp.toFixed(2));
        else return NextResponse.json({ error: 'Invalid preorderPrice' }, { status: 400 });
      }
    }

    // Preorder ship date
    if (body.preorderShipDate !== undefined) {
      if (typeof body.preorderShipDate === 'string' && body.preorderShipDate.length <= 40) {
        next.preorderShipDate = body.preorderShipDate.trim();
      } else return NextResponse.json({ error: 'Invalid preorderShipDate' }, { status: 400 });
    }

    // Maintenance
    if (body.maintenance) {
      const mb = body.maintenance;
      const nextMaint = { ...next.maintenance };
      if (mb.enabled !== undefined) {
        if (typeof mb.enabled === 'boolean') nextMaint.enabled = mb.enabled;
        else if (typeof mb.enabled === 'string') nextMaint.enabled = mb.enabled === 'true';
      }
      if (mb.until !== undefined && typeof mb.until === 'string' && mb.until.length <= 80) {
        nextMaint.until = mb.until.trim();
      }
      if (mb.discordUrl !== undefined && typeof mb.discordUrl === 'string' && mb.discordUrl.length <= 200) {
        nextMaint.discordUrl = mb.discordUrl.trim();
      }
      next.maintenance = nextMaint;
    }

    next.lastUpdated = Date.now();
    await saveSettings(next);
    
    const kv = getKvClient();
    return NextResponse.json({ ok: true, settings: next, storage: kv ? 'kv' : 'file' });
  } catch (e) {
    console.error('[website/settings] POST error:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

