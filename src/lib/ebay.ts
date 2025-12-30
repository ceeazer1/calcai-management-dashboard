export type EbayMarketplaceId =
  | "EBAY_US"
  | "EBAY_GB"
  | "EBAY_DE"
  | "EBAY_AU"
  | "EBAY_CA"
  | (string & {});

export type EbayBuyingOption = "FIXED_PRICE" | "AUCTION" | "BEST_OFFER" | (string & {});

export interface Money {
  value: number;
  currency: string;
}

export interface NormalizedItemSummary {
  itemId: string;
  title: string;
  price: Money | null;
  shippingCost: Money | null;
  condition: string | null;
  endTime: string | null;
  sellerUsername: string | null;
  thumbnailUrl: string | null;
  itemWebUrl: string | null;
  buyingOptions: EbayBuyingOption[];
}

export interface NormalizedItemDetail {
  itemId: string;
  title: string;
  descriptionText: string | null;
  descriptionHtml: string | null;
  imageUrls: string[];
  price: Money | null;
  shippingCost: Money | null;
  condition: string | null;
  endTime: string | null;
  sellerUsername: string | null;
  itemWebUrl: string | null;
  buyingOptions: EbayBuyingOption[];
  availabilityStatus: string | null;
  raw: unknown;
}

export interface SearchParams {
  keyword: string;
  marketplaceId?: EbayMarketplaceId;
  buyingOptions?: EbayBuyingOption[];
  conditionIds?: number[];
  minPrice?: number | null;
  maxPrice?: number | null;
  itemLocationCountry?: string | null;
  sort?: "bestMatch" | "price" | "-price" | "endingSoonest" | (string & {});
  limit?: number;
  offset?: number;
}

type OAuthTokenCache = {
  token: string;
  expiresAt: number;
  baseUrl: string;
  clientId: string;
  scope: string;
};

let tokenCache: OAuthTokenCache | null = null;

function getEbayBaseUrl() {
  const override = process.env.EBAY_API_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const env = (process.env.EBAY_ENV || "production").toLowerCase();
  return env === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function getScope() {
  return (
    process.env.EBAY_OAUTH_SCOPE?.trim() ||
    // Minimal scope for Browse API app access token
    "https://api.ebay.com/oauth/api_scope"
  );
}

function marketplaceCurrency(marketplaceId: EbayMarketplaceId): string | null {
  const id = String(marketplaceId || "").toUpperCase();
  if (id === "EBAY_US") return "USD";
  if (id === "EBAY_GB") return "GBP";
  if (id === "EBAY_DE") return "EUR";
  if (id === "EBAY_AU") return "AUD";
  if (id === "EBAY_CA") return "CAD";
  return null;
}

function normalizeMoney(input: any): Money | null {
  if (!input || typeof input !== "object") return null;
  const rawValue = (input.value ?? input.amount ?? input.convertedFromValue) as unknown;
  const rawCurrency = (input.currency ?? input.currencyCode) as unknown;
  const value = Number(rawValue);
  const currency = typeof rawCurrency === "string" ? rawCurrency : null;
  if (!Number.isFinite(value) || !currency) return null;
  return { value, currency };
}

export function htmlToText(html: string): string {
  if (!html) return "";
  let t = String(html);
  t = t.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  t = t.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  t = t.replace(/<\/?[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return t;
}

async function getAppAccessToken(): Promise<string> {
  const baseUrl = getEbayBaseUrl();
  const scope = getScope();
  const clientId = process.env.EBAY_CLIENT_ID || "";
  const clientSecret = process.env.EBAY_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("missing_ebay_client_credentials");
  }

  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.baseUrl === baseUrl &&
    tokenCache.clientId === clientId &&
    tokenCache.scope === scope &&
    tokenCache.expiresAt > now + 60_000
  ) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials", scope });
  const r = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const txt = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(txt);
  } catch {
    // ignore
  }
  if (!r.ok) {
    throw new Error(`ebay_oauth_failed:${r.status}:${txt.slice(0, 400)}`);
  }
  const accessToken = String(j?.access_token || "");
  const expiresIn = Number(j?.expires_in || 0);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("ebay_oauth_invalid_response");
  }
  tokenCache = {
    token: accessToken,
    expiresAt: now + expiresIn * 1000,
    baseUrl,
    clientId,
    scope,
  };
  return accessToken;
}

async function ebayFetchJson(
  url: string,
  opts: { method?: string; marketplaceId?: EbayMarketplaceId; headers?: Record<string, string> } = {}
) {
  const token = await getAppAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(opts.marketplaceId ? { "X-EBAY-C-MARKETPLACE-ID": String(opts.marketplaceId) } : {}),
    ...(opts.headers || {}),
  };
  const r = await fetch(url, {
    method: opts.method || "GET",
    headers,
    cache: "no-store",
  });
  const txt = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(txt);
  } catch {
    // ignore
  }
  if (!r.ok) {
    const msg =
      j?.errors?.[0]?.message ||
      j?.error_description ||
      j?.message ||
      txt?.slice(0, 400) ||
      "ebay_request_failed";
    const err = new Error(`ebay_api_failed:${r.status}:${msg}`);
    (err as any).status = r.status;
    (err as any).body = j || txt;
    throw err;
  }
  return j;
}

function buildFilterString(p: SearchParams): string | null {
  const parts: string[] = [];

  const buying = Array.isArray(p.buyingOptions) ? p.buyingOptions.filter(Boolean) : [];
  if (buying.length) {
    const uniq = Array.from(new Set(buying.map((x) => String(x).toUpperCase())));
    parts.push(`buyingOptions:{${uniq.join("|")}}`);
  }

  const cond = Array.isArray(p.conditionIds) ? p.conditionIds.filter((n) => Number.isInteger(n)) : [];
  if (cond.length) {
    const uniq = Array.from(new Set(cond)).slice(0, 8);
    parts.push(`conditionIds:{${uniq.join("|")}}`);
  }

  const min = p.minPrice ?? null;
  const max = p.maxPrice ?? null;
  if (min !== null || max !== null) {
    const minStr = min !== null && Number.isFinite(min) ? String(min) : "";
    const maxStr = max !== null && Number.isFinite(max) ? String(max) : "";
    parts.push(`price:[${minStr}..${maxStr}]`);
    const cur = marketplaceCurrency(p.marketplaceId || "EBAY_US");
    if (cur) parts.push(`priceCurrency:${cur}`);
  }

  const loc = p.itemLocationCountry ? String(p.itemLocationCountry).toUpperCase() : "";
  if (loc && /^[A-Z]{2}$/.test(loc)) {
    parts.push(`itemLocationCountry:${loc}`);
  }

  return parts.length ? parts.join(",") : null;
}

export async function searchEbayItemSummaries(params: SearchParams) {
  const baseUrl = getEbayBaseUrl();
  const marketplaceId = params.marketplaceId || "EBAY_US";
  const limit = Math.max(1, Math.min(50, Number(params.limit || 20)));
  const offset = Math.max(0, Number(params.offset || 0));
  const keyword = String(params.keyword || "").trim();
  if (!keyword) throw new Error("missing_keyword");

  const url = new URL(`${baseUrl}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", keyword);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  if (params.sort) url.searchParams.set("sort", String(params.sort));

  const filter = buildFilterString({ ...params, marketplaceId });
  if (filter) url.searchParams.set("filter", filter);

  const data = await ebayFetchJson(url.toString(), { marketplaceId });
  const itemsRaw = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];

  const items: NormalizedItemSummary[] = itemsRaw
    .map((s: any) => normalizeItemSummary(s))
    .filter((x: NormalizedItemSummary | null) => !!x) as NormalizedItemSummary[];

  return {
    total: Number(data?.total ?? items.length) || items.length,
    nextOffset: typeof data?.next === "string" ? parseNextOffset(data.next) : null,
    items,
    raw: data as unknown,
  };
}

function parseNextOffset(nextUrl: string): number | null {
  try {
    const u = new URL(nextUrl);
    const o = u.searchParams.get("offset");
    if (!o) return null;
    const n = Number(o);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function getEbayItem(itemId: string, marketplaceId: EbayMarketplaceId = "EBAY_US") {
  const baseUrl = getEbayBaseUrl();
  const id = String(itemId || "").trim();
  if (!id) throw new Error("missing_item_id");
  const url = `${baseUrl}/buy/browse/v1/item/${encodeURIComponent(id)}`;
  const data = await ebayFetchJson(url, { marketplaceId });
  return normalizeItemDetail(data);
}

function normalizeItemSummary(s: any): NormalizedItemSummary | null {
  if (!s || typeof s !== "object") return null;
  const itemId = String(s.itemId || "").trim();
  const title = String(s.title || "").trim();
  if (!itemId || !title) return null;

  const price = normalizeMoney(s.price);
  const shippingCost =
    normalizeMoney(s.shippingCost) ||
    normalizeMoney(s.shippingOptions?.[0]?.shippingCost) ||
    normalizeMoney(s.shippingOptions?.[0]?.shippingCostSummary);

  const buyingOptions: EbayBuyingOption[] = Array.isArray(s.buyingOptions)
    ? (s.buyingOptions.map((x: any) => String(x)) as EbayBuyingOption[])
    : [];

  const thumbnailUrl =
    (typeof s.image?.imageUrl === "string" && s.image.imageUrl) ||
    (typeof s.thumbnailImages?.[0]?.imageUrl === "string" && s.thumbnailImages[0].imageUrl) ||
    null;

  const endTime =
    (typeof s.itemEndDate === "string" && s.itemEndDate) ||
    (typeof s.endDate === "string" && s.endDate) ||
    null;

  return {
    itemId,
    title,
    price,
    shippingCost,
    condition: typeof s.condition === "string" ? s.condition : null,
    endTime,
    sellerUsername: typeof s.seller?.username === "string" ? s.seller.username : null,
    thumbnailUrl,
    itemWebUrl: typeof s.itemWebUrl === "string" ? s.itemWebUrl : null,
    buyingOptions,
  };
}

function normalizeItemDetail(data: any): NormalizedItemDetail {
  const itemId = String(data?.itemId || "").trim();
  const title = String(data?.title || "").trim();

  const imageUrls: string[] = [];
  if (typeof data?.image?.imageUrl === "string") imageUrls.push(data.image.imageUrl);
  if (Array.isArray(data?.additionalImages)) {
    for (const img of data.additionalImages) {
      if (typeof img?.imageUrl === "string") imageUrls.push(img.imageUrl);
    }
  }
  const uniqImages = Array.from(new Set(imageUrls.filter(Boolean)));

  const descriptionHtml = typeof data?.description === "string" ? data.description : null;
  const descriptionText = descriptionHtml ? htmlToText(descriptionHtml) : null;

  const price = normalizeMoney(data?.price);
  const shippingCost =
    normalizeMoney(data?.shippingCost) ||
    normalizeMoney(data?.shippingOptions?.[0]?.shippingCost) ||
    normalizeMoney(data?.shippingOptions?.[0]?.shippingCostSummary);

  const buyingOptions: EbayBuyingOption[] = Array.isArray(data?.buyingOptions)
    ? (data.buyingOptions.map((x: any) => String(x)) as EbayBuyingOption[])
    : [];

  const endTime =
    (typeof data?.itemEndDate === "string" && data.itemEndDate) ||
    (typeof data?.endDate === "string" && data.endDate) ||
    null;

  return {
    itemId,
    title,
    descriptionText,
    descriptionHtml,
    imageUrls: uniqImages,
    price,
    shippingCost,
    condition: typeof data?.condition === "string" ? data.condition : null,
    endTime,
    sellerUsername: typeof data?.seller?.username === "string" ? data.seller.username : null,
    itemWebUrl: typeof data?.itemWebUrl === "string" ? data.itemWebUrl : null,
    buyingOptions,
    availabilityStatus:
      typeof data?.availability?.availabilityStatus === "string" ? data.availability.availabilityStatus : null,
    raw: data as unknown,
  };
}




