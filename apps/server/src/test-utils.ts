import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from './config.js';
import { type Db, openDb } from './db/client.js';
import { runMigrations } from './db/migrations.js';
import { type Logger, createLogger } from './logger.js';
import { AuthStore } from './wearables/auth-store.js';
import { initRegistry } from './wearables/registry.js';

export type TestCtx = {
  db: Db;
  logger: Logger;
  config: Config;
  authStore: AuthStore;
};

export const makeTestCtx = (overrides: Partial<Config> = {}): TestCtx => {
  const dir = mkdtempSync(join(tmpdir(), 'health-mcp-test-'));
  const dbPath = join(dir, 'data.db');
  const logger = createLogger('error', true);
  const db = openDb({ path: dbPath, allowInsecure: true, logger });
  const config: Config = {
    stdio: false,
    port: 0,
    host: '127.0.0.1',
    dataDir: dir,
    dbPath,
    token: null,
    dashboard: false,
    publicDir: null,
    openBrowser: false,
    tz: 'UTC',
    usdaApiKey: null,
    whoopClientId: null,
    whoopClientSecret: null,
    ouraClientId: null,
    ouraClientSecret: null,
    zeppClientId: null,
    zeppClientSecret: null,
    wearableRedirectBase: 'http://127.0.0.1:7777/auth/wearable/callback',
    whoopSyncCron: '*/30 * * * *',
    logLevel: 'error',
    allowInsecureDb: true,
    allowInsecureAuth: true,
    autoMigrate: true,
    subcommand: 'serve',
    subcommandArgs: [],
    retz: false,
    exportIncludeRaw: false,
    ...overrides,
  };
  runMigrations(db, logger);
  const authStore = new AuthStore({ authDir: dir, allowInsecure: true });
  const ctx = { db, logger, config, authStore };
  initRegistry(ctx);
  return ctx;
};

export const closeCtx = (ctx: { db: Db }) => {
  try {
    ctx.db.close();
  } catch {
    // ignore
  }
};
