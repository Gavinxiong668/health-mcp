import type { Logger } from '../../../logger.js';
import type {
  ResourceKind,
  SyncArgs,
  SyncResult,
  TokenSet,
  WearableProvider,
} from '../../types.js';
import {
  ZeppClient,
  type ZeppTokenResponse,
  buildZeppAuthUrl,
  exchangeZeppCode,
  refreshZeppTokens,
} from './client.js';

const SCOPES = [
  'profile',
  'sleep',
  'activity',
  'heart_rate',
  'workout',
  'readiness',
];

export type ZeppOptions = {
  clientId: string | null;
  clientSecret: string | null;
  logger: Logger;
};

export const createZeppProvider = (opts: ZeppOptions): WearableProvider | null => {
  if (!opts.clientId || !opts.clientSecret) return null;
  const clientId = opts.clientId;
  const clientSecret = opts.clientSecret;
  return {
    id: 'zepp',
    displayName: 'Zepp Health (华米)',
    authStrategy: 'oauth2',
    scopes: SCOPES,
    hasMinuteResolution: true,
    buildAuthUrl: (state, redirectUri) =>
      buildZeppAuthUrl({ clientId, redirectUri, state, scopes: SCOPES }),
    exchangeCode: async (code, redirectUri) =>
      tokenSetFromResponse(await exchangeZeppCode({ code, clientId, clientSecret, redirectUri })),
    refreshTokens: async (refreshToken) =>
      tokenSetFromResponse(await refreshZeppTokens({ refreshToken, clientId, clientSecret })),
    sync: async (args: SyncArgs): Promise<SyncResult[]> => {
      const resources: ResourceKind[] = args.resources ?? [
        'profile',
        'sleep',
        'activity',
        'readiness',
        'daily',
      ];
      const accessToken = { current: args.auth.access_token ?? '' };
      const refresh = async () => {
        if (!args.auth.refresh_token) throw new Error('zepp: missing refresh_token');
        const r = await refreshZeppTokens({
          refreshToken: args.auth.refresh_token,
          clientId,
          clientSecret,
        });
        const ts = tokenSetFromResponse(r);
        accessToken.current = ts.access_token;
        if (args.onAuthRefreshed) await args.onAuthRefreshed(ts);
      };
      if (args.auth.expires_at) {
        const remaining = new Date(args.auth.expires_at).getTime() - Date.now();
        if (remaining < 5 * 60_000) await refresh();
      }
      const client = new ZeppClient({
        logger: opts.logger,
        getAccessToken: () => accessToken.current,
      });
      const { runZeppResource } = await import('./sync.js');
      const results: SyncResult[] = [];
      for (const res of resources) {
        try {
          results.push(
            await runZeppResource({
              db: args.db,
              client,
              resource: res,
              cursor: args.cursors[res] ?? null,
              since: args.since,
              refresh,
            }),
          );
        } catch (err) {
          opts.logger.error('zepp sync failed', {
            resource: res,
            error: (err as Error).message,
          });
        }
      }
      return results;
    },
  };
};

const tokenSetFromResponse = (r: ZeppTokenResponse): TokenSet => ({
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  scope: r.scope,
});
