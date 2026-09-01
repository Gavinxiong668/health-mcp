import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Config = {
  stdio: boolean;
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  token: string | null;
  dashboard: boolean;
  publicDir: string | null;
  openBrowser: boolean;
  tz: string;
  usdaApiKey: string | null;
  whoopClientId: string | null;
  whoopClientSecret: string | null;
  ouraClientId: string | null;
  ouraClientSecret: string | null;
  wearableRedirectBase: string | null;
  whoopSyncCron: string;
  logLevel: LogLevel;
  allowInsecureDb: boolean;
  allowInsecureAuth: boolean;
  autoMigrate: boolean;
  subcommand: 'serve' | 'migrate' | 'doctor' | 'export' | 'import-usda';
  subcommandArgs: string[];
  retz: boolean;
  exportIncludeRaw: boolean;
};

const DEFAULTS = {
  port: 7777,
  host: '0.0.0.0',
  dashboard: true,
  whoopSyncCron: '*/30 * * * *',
  logLevel: 'info' as LogLevel,
};

const ENV_PREFIX = 'HEALTH_MCP_';

const parseBool = (value: string | undefined): boolean | null => {
  if (value === undefined) return null;
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return null;
};

const parseInt10 = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

const knownSubcommands = new Set(['migrate', 'doctor', 'export', 'import-usda']);

export const parseConfig = (argv: string[] = process.argv.slice(2)): Config => {
  const positional = argv[0];
  const isSubcommand =
    positional && !positional.startsWith('-') && knownSubcommands.has(positional);
  const subcommand = (isSubcommand ? positional : 'serve') as Config['subcommand'];
  const subArgs = isSubcommand ? argv.slice(1) : argv;

  const parsed = parseArgs({
    args: subArgs,
    allowPositionals: true,
    strict: false,
    options: {
      stdio: { type: 'boolean' },
      port: { type: 'string' },
      host: { type: 'string' },
      'data-dir': { type: 'string' },
      token: { type: 'string' },
      'no-dashboard': { type: 'boolean' },
      'public-dir': { type: 'string' },
      open: { type: 'boolean' },
      'no-open': { type: 'boolean' },
      tz: { type: 'string' },
      'log-level': { type: 'string' },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
      retz: { type: 'boolean' },
      'no-auto-migrate': { type: 'boolean' },
      'allow-insecure-db': { type: 'boolean' },
      'allow-insecure-auth': { type: 'boolean' },
      'include-raw': { type: 'boolean' },
    },
  });

  let fileConfig: Record<string, unknown> = {};
  const configPath =
    (parsed.values.config as string | undefined) ?? process.env[`${ENV_PREFIX}CONFIG`];
  if (configPath) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`failed to read config file ${configPath}: ${(err as Error).message}`);
    }
  }

  const fileVal = <T>(key: string): T | null => {
    const v = fileConfig[key];
    return v === undefined ? null : (v as T);
  };

  const resolveString = (
    flagVal: string | undefined,
    envKey: string,
    fileKey: string,
  ): string | null => {
    if (flagVal !== undefined) return flagVal;
    const env = process.env[`${ENV_PREFIX}${envKey}`];
    if (env !== undefined && env !== '') return env;
    return fileVal<string>(fileKey);
  };

  const stdio =
    (parsed.values.stdio as boolean | undefined) ??
    parseBool(process.env[`${ENV_PREFIX}STDIO`]) ??
    fileVal<boolean>('stdio') ??
    false;

  const port =
    parseInt10(parsed.values.port as string | undefined) ??
    parseInt10(process.env[`${ENV_PREFIX}PORT`]) ??
    fileVal<number>('port') ??
    DEFAULTS.port;

  const host =
    resolveString(parsed.values.host as string | undefined, 'HOST', 'host') ?? DEFAULTS.host;

  const dataDir =
    resolveString(parsed.values['data-dir'] as string | undefined, 'DATA_DIR', 'data_dir') ??
    join(homedir(), '.health-mcp');

  const dbPath = join(dataDir, 'data.db');

  const token = resolveString(parsed.values.token as string | undefined, 'TOKEN', 'token');

  const noDashboardFlag = parsed.values['no-dashboard'] as boolean | undefined;
  const dashboardEnv = parseBool(process.env[`${ENV_PREFIX}DASHBOARD`]);
  const dashboard = noDashboardFlag
    ? false
    : dashboardEnv !== null
      ? dashboardEnv
      : (fileVal<boolean>('dashboard') ?? DEFAULTS.dashboard);

  const tz =
    resolveString(parsed.values.tz as string | undefined, 'TZ', 'tz') ??
    process.env.TZ ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'UTC';

  const logLevel =
    (resolveString(
      parsed.values['log-level'] as string | undefined,
      'LOG_LEVEL',
      'log_level',
    ) as LogLevel | null) ?? DEFAULTS.logLevel;

  const wearableRedirectBase =
    resolveString(undefined, 'WEARABLE_REDIRECT_BASE', 'wearable_redirect_base') ??
    `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/auth/wearable/callback`;

  const publicDir = resolveString(
    parsed.values['public-dir'] as string | undefined,
    'PUBLIC_DIR',
    'public_dir',
  );

  const openBrowser = resolveOpen({
    flagOpen: parsed.values.open as boolean | undefined,
    flagNoOpen: parsed.values['no-open'] as boolean | undefined,
    env: parseBool(process.env[`${ENV_PREFIX}OPEN`]),
    file: fileVal<boolean>('open'),
    stdio: Boolean(stdio),
    dashboard,
    subcommand,
    ttyOut: Boolean(process.stdout.isTTY),
  });

  return {
    stdio: Boolean(stdio),
    port,
    host,
    dataDir,
    dbPath,
    token,
    dashboard,
    publicDir,
    openBrowser,
    tz,
    usdaApiKey: resolveString(undefined, 'USDA_API_KEY', 'usda_api_key'),
    whoopClientId: resolveString(undefined, 'WHOOP_CLIENT_ID', 'whoop_client_id'),
    whoopClientSecret: resolveString(undefined, 'WHOOP_CLIENT_SECRET', 'whoop_client_secret'),
    ouraClientId: resolveString(undefined, 'OURA_CLIENT_ID', 'oura_client_id'),
    ouraClientSecret: resolveString(undefined, 'OURA_CLIENT_SECRET', 'oura_client_secret'),
    wearableRedirectBase,
    whoopSyncCron:
      resolveString(undefined, 'WHOOP_SYNC_CRON', 'whoop_sync_cron') ?? DEFAULTS.whoopSyncCron,
    logLevel: ['debug', 'info', 'warn', 'error'].includes(logLevel) ? logLevel : DEFAULTS.logLevel,
    allowInsecureDb: Boolean(parsed.values['allow-insecure-db']),
    allowInsecureAuth: Boolean(parsed.values['allow-insecure-auth']),
    autoMigrate: !parsed.values['no-auto-migrate'],
    subcommand,
    subcommandArgs: parsed.positionals as string[],
    retz: Boolean(parsed.values.retz),
    exportIncludeRaw: Boolean(parsed.values['include-raw']),
  };
};

const resolveOpen = (input: {
  flagOpen: boolean | undefined;
  flagNoOpen: boolean | undefined;
  env: boolean | null;
  file: boolean | null;
  stdio: boolean;
  dashboard: boolean;
  subcommand: Config['subcommand'];
  ttyOut: boolean;
}): boolean => {
  if (input.flagNoOpen) return false;
  if (input.flagOpen) return true;
  if (input.env !== null) return input.env;
  if (input.file !== null) return input.file;
  if (input.stdio || !input.dashboard || input.subcommand !== 'serve' || !input.ttyOut)
    return false;
  return true;
};

export const isLoopback = (host: string): boolean => {
  if (host === '127.0.0.1' || host === '::1' || host === 'localhost') return true;
  if (host.startsWith('127.')) return true;
  return false;
};

const looksLikeLowEntropy = (token: string): boolean => {
  if (token.length < 32) return true;
  const distinct = new Set(token).size;
  return distinct < 8;
};

export class ConfigError extends Error {}

export const enforceSecurityInvariants = (config: Config): void => {
  if (config.stdio) return;
  if (!isLoopback(config.host) && !config.token) {
    throw new ConfigError(
      `refusing to bind off-loopback host '${config.host}' without HEALTH_MCP_TOKEN set`,
    );
  }
  if (config.token && looksLikeLowEntropy(config.token)) {
    throw new ConfigError(
      'HEALTH_MCP_TOKEN must be at least 32 chars with sufficient entropy (≥8 distinct characters)',
    );
  }
};

export const helpText = (): string => `Usage: health-mcp [options]

Options:
  --stdio                  run as MCP stdio server (disables HTTP, dashboard, scheduler)
  --port <n>               HTTP port (default 7777)
  --host <addr>            bind host (default 127.0.0.1)
  --data-dir <path>        persistent state dir (default ~/.health-mcp)
  --token <secret>         require Bearer auth (HTTP mode only)
  --no-dashboard           disable the static dashboard
  --public-dir <path>      override location of dashboard build (defaults to packaged ./public)
  --open                   open dashboard in default browser on start
  --no-open                never open the browser
  --tz <iana>              timezone for date buckets
  --log-level <lvl>        debug|info|warn|error
  --config <path>          JSON config file
  --no-auto-migrate        do not auto-run migrations at startup
  --allow-insecure-db      open data.db even if permissions are loose
  --allow-insecure-auth    open auth.json even if permissions are loose
  --help, -h               show this help
  --version                print version and exit

Subcommands:
  health-mcp migrate            run pending migrations and exit
  health-mcp migrate --retz     recompute 'date' columns under the current TZ
  health-mcp import-usda <f>    ingest FDC bulk dump (phase 5)
  health-mcp export <path>      dump full DB to JSONL (raw_json redacted unless --include-raw)
  health-mcp doctor             self-check: DB ok, pragmas applied, token entropy, file modes
`;
