import type { Logger } from '../../../logger.js';

// Zepp Health (华米) API endpoints
// Note: These endpoints are placeholders - update once API access is approved
const BASE_URL = 'https://api.zepp.com';
const AUTH_URL = 'https://api.zepp.com/oauth/authorize';
const TOKEN_URL = 'https://api.zepp.com/oauth/token';

type Bucket = {
  capacity: number;
  tokens: number;
  refillPerMs: number;
  last: number;
};

export class ZeppClient {
  private bucket: Bucket = {
    capacity: 1000 / 24, // Conservative rate limit
    tokens: 1000 / 24,
    refillPerMs: 1000 / 24 / 3_600_000,
    last: Date.now(),
  };
  private logger: Logger;
  private getAccessToken: () => string;

  constructor(opts: { logger: Logger; getAccessToken: () => string }) {
    this.logger = opts.logger;
    this.getAccessToken = opts.getAccessToken;
  }

  private async takeToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.bucket.last;
    this.bucket.tokens = Math.min(
      this.bucket.capacity,
      this.bucket.tokens + elapsed * this.bucket.refillPerMs,
    );
    this.bucket.last = now;
    if (this.bucket.tokens >= 1) {
      this.bucket.tokens -= 1;
      return;
    }
    const need = 1 - this.bucket.tokens;
    const waitMs = Math.ceil(need / this.bucket.refillPerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    this.bucket.tokens = 0;
    this.bucket.last = Date.now();
  }

  async fetchJson<T>(path: string): Promise<T> {
    await this.takeToken();
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ZeppApiError(res.status, text);
    }
    return (await res.json()) as T;
  }
}

export class ZeppApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Zepp API ${status}`);
    this.status = status;
    this.body = body;
  }
}

export type ZeppTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

const postTokenEndpoint = async (
  body: URLSearchParams,
  label: string,
): Promise<ZeppTokenResponse> => {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Zepp ${label} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as ZeppTokenResponse;
};

export const exchangeZeppCode = (args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<ZeppTokenResponse> =>
  postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
    }),
    'token exchange',
  );

export const refreshZeppTokens = (args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<ZeppTokenResponse> =>
  postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
    }),
    'refresh',
  );

export const buildZeppAuthUrl = (args: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string => {
  const u = new URL(AUTH_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('scope', args.scopes.join(' '));
  u.searchParams.set('state', args.state);
  return u.toString();
};
