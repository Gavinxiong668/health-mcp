import { join } from 'node:path';
import { Hono } from 'hono';
import { bearerAuth } from './auth.js';
import type { Config } from './config.js';
import { mountDashboard, resolvePublicDir } from './dashboard.js';
import type { Logger } from './logger.js';
import { mountRestRoutes } from './rest/index.js';
import type { WearableServiceCtx } from './services/wearables.js';
import { VERSION } from './version.js';

export const createHonoApp = (opts: {
  config: Config;
  logger: Logger;
  ctx: WearableServiceCtx;
  sdkVersion?: string;
}): Hono => {
  const app = new Hono();
  const { config } = opts;

  app.get('/health', (c) =>
    c.json({
      ok: true,
      db: 'up',
      tz: config.tz,
      version: VERSION,
      auth_required: Boolean(config.token),
      host: config.host,
      port: config.port,
      db_path: config.dbPath,
      auth_path: join(config.dataDir, 'auth.json'),
      dashboard: config.dashboard,
      log_level: config.logLevel,
      auto_migrate: config.autoMigrate,
      whoop_sync_cron: config.whoopSyncCron,
      wearable_redirect_base: config.wearableRedirectBase,
      providers: {
        usda: Boolean(config.usdaApiKey),
        whoop: Boolean(config.whoopClientId && config.whoopClientSecret),
        oura: Boolean(config.ouraClientId && config.ouraClientSecret),
        zepp: true, // Zepp uses push endpoints, always available
      },
    }),
  );
  app.get('/version', (c) =>
    c.json({
      version: VERSION,
      sdk_version: opts.sdkVersion ?? null,
    }),
  );

  if (opts.config.token) {
    app.use('/api/*', bearerAuth(opts.config.token));
  }

  mountRestRoutes(app, opts.ctx);

  if (opts.config.dashboard) {
    const publicDir = resolvePublicDir(opts.config.publicDir);
    if (publicDir) {
      mountDashboard(app, { publicDir, logger: opts.logger });
    } else {
      opts.logger.warn('dashboard enabled but no public/ build found; serving API only');
    }
  }

  return app;
};
