import { getKvClient } from "@/lib/kv";

export type EbayUserTokenRecord = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  scope: string;
  tokenType: string;
  obtainedAt: number;
  lastRefreshedAt: number;
};

function getApiBaseUrl() {
  const override = process.env.EBAY_API_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const env = (process.env.EBAY_ENV || "production").toLowerCase();
  return env === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function getAuthBaseUrl() {
  const env = (process.env.EBAY_ENV || "production").toLowerCase();
  return env === "sandbox" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
}

function getClientId() {
  return process.env.EBAY_CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.EBAY_CLIENT_SECRET || "";
}

function getRuName() {
  return process.env.EBAY_OAUTH_RU_NAME || process.env.EBAY_RU_NAME || "";
}

export function getUserOauthScopes(): string {
  // Note: buy.offer.auction and buy.order scopes require eBay approval
  // Set EBAY_USER_OAUTH_SCOPES env var to include them once approved
  return (
    process.env.EBAY_USER_OAUTH_SCOPES?.trim() ||
    "https://api.ebay.com/oauth/api_scope"
  );
}

function tokenKey(uid: string) {
  return `ebay:user:${uid}:oauth`;
}

export async function loadUserTokenRecord(uid: string): Promise<EbayUserTokenRecord | null> {
  const kv = getKvClient();
  const v = await kv.get<unknown>(tokenKey(uid));
  if (!v || typeof v !== "object") return null;
  const rec = v as Partial<EbayUserTokenRecord>;
  if (!rec.accessToken || !rec.refreshToken) return null;
  if (!rec.accessTokenExpiresAt || !rec.refreshTokenExpiresAt) return null;
  return rec as EbayUserTokenRecord;
}

export async function saveUserTokenRecord(uid: string, rec: EbayUserTokenRecord): Promise<void> {
  const kv = getKvClient();
  await kv.set(tokenKey(uid), rec);
}

export async function deleteUserTokenRecord(uid: string): Promise<void> {
  const kv = getKvClient();
  if (typeof kv.del === "function") await kv.del(tokenKey(uid));
}

export function buildEbayAuthorizeUrl(state: string): string {
  const clientId = getClientId();
  const ruName = getRuName();
  if (!clientId || !ruName) {
    throw new Error("missing_ebay_oauth_config");
  }

  const scopes = getUserOauthScopes();
  const auth = new URL("/oauth2/authorize", getAuthBaseUrl());
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", ruName);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", scopes);
  auth.searchParams.set("state", state);
  return auth.toString();
}

type OAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
  scope?: string;
};

async function oauthTokenRequest(body: URLSearchParams): Promise<OAuthTokenResponse> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) throw new Error("missing_ebay_client_credentials");

  const auth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const r = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
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

  return j as OAuthTokenResponse;
}

export async function exchangeAuthCodeForUserToken(code: string): Promise<EbayUserTokenRecord> {
  const ruName = getRuName();
  if (!ruName) throw new Error("missing_ebay_oauth_runame");

  const now = Date.now();
  const j = await oauthTokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    })
  );

  const accessToken = String(j.access_token || "");
  const tokenType = String(j.token_type || "");
  const expiresIn = Number(j.expires_in || 0);
  const refreshToken = String(j.refresh_token || "");
  const refreshExpiresIn = Number(j.refresh_token_expires_in || 0);
  const scope = String(j.scope || getUserOauthScopes());

  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("ebay_oauth_invalid_token_response");
  }

  return {
    accessToken,
    accessTokenExpiresAt: now + expiresIn * 1000,
    refreshToken,
    refreshTokenExpiresAt: now + Math.max(0, refreshExpiresIn) * 1000,
    scope,
    tokenType,
    obtainedAt: now,
    lastRefreshedAt: now,
  };
}

export async function getValidUserAccessToken(uid: string): Promise<string> {
  const rec = await loadUserTokenRecord(uid);
  if (!rec) throw new Error("ebay_not_connected");

  const now = Date.now();
  if (rec.accessTokenExpiresAt > now + 60_000) return rec.accessToken;

  // Refresh
  const j = await oauthTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: rec.refreshToken,
      scope: rec.scope || getUserOauthScopes(),
    })
  );

  const accessToken = String(j.access_token || "");
  const tokenType = String(j.token_type || rec.tokenType || "");
  const expiresIn = Number(j.expires_in || 0);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("ebay_oauth_refresh_invalid_response");
  }

  const next: EbayUserTokenRecord = {
    ...rec,
    accessToken,
    tokenType,
    accessTokenExpiresAt: now + expiresIn * 1000,
    lastRefreshedAt: now,
  };
  await saveUserTokenRecord(uid, next);
  return accessToken;
}






