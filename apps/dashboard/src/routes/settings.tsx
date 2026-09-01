import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Key,
  Plug,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

type Probe = NonNullable<ReturnType<typeof useHealthProbe>['data']>;

const useHealthProbe = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 60_000,
  });

const TokenSection = () => {
  const initial = getToken() ?? '';
  const [value, setValue] = useState(initial);
  const [reveal, setReveal] = useState(false);
  const dirty = value !== initial;
  const hasSaved = initial.length > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      clearToken();
    } else {
      setToken(value.trim());
    }
    window.location.reload();
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" /> 访问令牌
          </CardTitle>
          <Badge variant={hasSaved ? 'ok' : 'outline'} className="capitalize">
            {hasSaved ? '已保存' : '未设置'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="token">令牌</Label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Input
                  id="token"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={hasSaved ? '••••••••' : '粘贴你的 HEALTH_MCP_TOKEN'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full pr-9"
                />
                <button
                  type="button"
                  aria-label={reveal ? '隐藏令牌' : '显示令牌'}
                  onClick={() => setReveal((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-kumo-subtle transition-colors hover:text-kumo-default"
                >
                  {reveal ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <Button type="submit" disabled={!dirty}>
                保存并重新加载
              </Button>
              {hasSaved ? (
                <Button
                  type="button"
                  variant="outline"
                  aria-label="清除令牌"
                  onClick={() => {
                    clearToken();
                    window.location.reload();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">清除</span>
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-kumo-subtle">
            仅存储在你浏览器的 localStorage 中。每次{' '}
            <code className="rounded bg-kumo-fill px-1.5 py-0.5">/api/*</code> 调用时作为{' '}
            <code className="rounded bg-kumo-fill px-1.5 py-0.5">Authorization: Bearer</code> 发送。
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

const ProbeRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <li className="flex items-center justify-between gap-3 border-t border-kumo-line py-2 first:border-t-0">
    <span className="text-xs uppercase tracking-wide text-kumo-subtle">{label}</span>
    <span className="truncate text-right text-sm tabular-nums">{value}</span>
  </li>
);

const StatusDot = ({ ok }: { ok: boolean }) => (
  <span className="relative mr-1 inline-flex h-1.5 w-1.5">
    <span
      className={cn(
        'absolute inline-flex h-full w-full rounded-full opacity-70',
        ok ? 'bg-kumo-success animate-ping' : 'bg-kumo-danger',
      )}
    />
    <span
      className={cn(
        'relative inline-flex h-1.5 w-1.5 rounded-full',
        ok ? 'bg-kumo-success' : 'bg-kumo-danger',
      )}
    />
  </span>
);

const ServerSection = ({ probe }: { probe: ReturnType<typeof useHealthProbe> }) => {
  const ok = !probe.isError && !!probe.data && probe.data.ok;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> 连接状态
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={ok ? 'ok' : 'bad'} className="capitalize">
              <StatusDot ok={ok} />
              {probe.isLoading ? '检查中' : ok ? '已连接' : '离线'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={probe.isFetching}
              onClick={() => probe.refetch()}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', probe.isFetching && 'animate-spin')} />
              <span className="sr-only sm:not-sr-only">刷新</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {probe.isLoading ? (
          <Spinner />
        ) : probe.isError ? (
          <p className="text-sm text-kumo-subtle">
            无法连接。health-mcp 是否运行在{' '}
            <code className="rounded bg-kumo-fill px-1 py-0.5">localhost:7777</code>?
          </p>
        ) : probe.data ? (
          <ul className="space-y-0">
            <ProbeRow
              label="版本"
              value={<span className="font-mono">{probe.data.version}</span>}
            />
            <ProbeRow
              label="数据库"
              value={
                <span
                  className={cn(
                    'capitalize',
                    probe.data.db === 'up' ? 'text-kumo-success' : 'text-kumo-danger',
                  )}
                >
                  {probe.data.db}
                </span>
              }
            />
            <ProbeRow label="时区" value={probe.data.tz} />
            <ProbeRow
              label="需要认证"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {probe.data.auth_required ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-kumo-success" />
                  ) : null}
                  {probe.data.auth_required ? '是' : '否'}
                </span>
              }
            />
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
};

const PathRow = ({
  icon: Icon,
  label,
  path,
}: {
  icon: typeof Database;
  label: string;
  path: string;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-kumo-subtle">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-kumo-line bg-kumo-fill px-2.5 py-1.5 text-xs">
          {path}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`复制 ${label} 路径`}
          onClick={copy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-kumo-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">{copied ? '已复制' : '复制'}</span>
        </Button>
      </div>
    </div>
  );
};

const StorageSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <HardDrive className="h-4 w-4" /> 存储
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        全部本地存储 — 通过 <code className="rounded bg-kumo-fill px-1 py-0.5">--db</code>{' '}
        或 <code className="rounded bg-kumo-fill px-1 py-0.5">HEALTH_MCP_DB</code> 更改路径。
      </p>
    </CardHeader>
    <CardContent className="space-y-4">
      <PathRow icon={Database} label="数据库" path={probe.db_path} />
      <PathRow icon={Key} label="认证文件" path={probe.auth_path} />
    </CardContent>
  </Card>
);

const RuntimeSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Server className="h-4 w-4" /> 运行时
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        通过 CLI 参数、<code className="rounded bg-kumo-fill px-1 py-0.5">HEALTH_MCP_*</code>{' '}
        环境变量或 JSON 配置文件设置。
      </p>
    </CardHeader>
    <CardContent>
      <ul className="space-y-0">
        <ProbeRow
          label="绑定地址"
          value={
            <span className="font-mono">
              {probe.host}:{probe.port}
            </span>
          }
        />
        <ProbeRow
          label="仪表盘"
          value={
            <Badge variant={probe.dashboard ? 'ok' : 'muted'} className="capitalize">
              {probe.dashboard ? '开启' : '关闭'}
            </Badge>
          }
        />
        <ProbeRow
          label="日志级别"
          value={<span className="font-mono uppercase">{probe.log_level}</span>}
        />
        <ProbeRow
          label="自动迁移"
          value={
            <Badge variant={probe.auto_migrate ? 'ok' : 'muted'} className="capitalize">
              {probe.auto_migrate ? '已启用' : '已禁用'}
            </Badge>
          }
        />
        <ProbeRow
          label="Whoop 定时任务"
          value={<span className="font-mono text-xs">{probe.whoop_sync_cron}</span>}
        />
        <ProbeRow
          label="可穿戴重定向"
          value={
            probe.wearable_redirect_base ? (
              <span className="truncate font-mono text-xs">{probe.wearable_redirect_base}</span>
            ) : (
              <span className="text-kumo-subtle">—</span>
            )
          }
        />
      </ul>
    </CardContent>
  </Card>
);

const PROVIDER_ENV: Record<keyof Probe['providers'], string[]> = {
  usda: ['HEALTH_MCP_USDA_API_KEY'],
  whoop: ['HEALTH_MCP_WHOOP_CLIENT_ID', 'HEALTH_MCP_WHOOP_CLIENT_SECRET'],
  oura: ['HEALTH_MCP_OURA_CLIENT_ID', 'HEALTH_MCP_OURA_CLIENT_SECRET'],
};

const PROVIDER_LABEL: Record<keyof Probe['providers'], string> = {
  usda: 'USDA FoodData Central',
  whoop: 'Whoop',
  oura: 'Oura',
};

const ProvidersSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Plug className="h-4 w-4" /> 提供商
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        仅检测凭据是否存在 — 密钥永远不会离开服务器。
      </p>
    </CardHeader>
    <CardContent>
      <ul className="space-y-0">
        {(Object.keys(PROVIDER_LABEL) as Array<keyof Probe['providers']>).map((key) => {
          const configured = probe.providers[key];
          return (
            <li
              key={key}
              className="flex items-start justify-between gap-3 border-t border-kumo-line py-3 first:border-t-0"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium text-kumo-default">{PROVIDER_LABEL[key]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDER_ENV[key].map((envName) => (
                    <code
                      key={envName}
                      className="rounded bg-kumo-fill px-1.5 py-0.5 text-[10px] text-kumo-subtle"
                    >
                      {envName}
                    </code>
                  ))}
                </div>
              </div>
              <Badge variant={configured ? 'ok' : 'outline'} className="shrink-0 capitalize">
                {configured ? '已配置' : '未设置'}
              </Badge>
            </li>
          );
        })}
      </ul>
    </CardContent>
  </Card>
);

const Settings = () => {
  const probe = useHealthProbe();
  return (
    <>
      <PageHeader title="设置" description="本地配置。" />
      <div className="grid gap-4 lg:grid-cols-2">
        <TokenSection />
        <ServerSection probe={probe} />
        {probe.data ? <StorageSection probe={probe.data} /> : null}
        {probe.data ? <RuntimeSection probe={probe.data} /> : null}
        {probe.data ? <ProvidersSection probe={probe.data} /> : null}
      </div>
    </>
  );
};

export const Route = createFileRoute('/settings')({ component: Settings });
