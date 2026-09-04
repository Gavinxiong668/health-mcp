import { MetricChart } from '@/components/metric-chart';
import { PageHeader } from '@/components/page-header';
import { RANGES, RangeToggle } from '@/components/range-toggle';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reverseSeries } from '@/components/ui/chart';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  daysAgoIso,
  fmtDate,
  fmtDuration,
  fmtNum,
  fmtRelative,
  fmtTime,
  todayIso,
} from '@/lib/format';
import { type Tone, scoreTone } from '@/lib/tone';
import type {
  WearableActivityDto,
  WearableDailyDto,
  WearableProviderInfoDto,
  WearableReadinessDto,
  WearableSleepDto,
  WearableStatusDto,
} from '@health-mcp/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  ArrowRight,
  Bike,
  Dumbbell,
  Footprints,
  Heart,
  Link2,
  type LucideIcon,
  Moon,
  Mountain,
  RefreshCw,
  Scale,
  Snowflake,
  Unplug,
  Watch,
  Waves,
  Zap,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useState } from 'react';

const TAB_ITEMS = [
  { value: 'overview', label: '概览' },
  { value: 'workouts', label: '运动' },
  { value: 'sleep', label: '睡眠' },
  { value: 'recovery', label: '恢复' },
  { value: 'connections', label: '连接' },
] as const;

type WearableTab = (typeof TAB_ITEMS)[number]['value'];
const isWearableTab = (v: unknown): v is WearableTab => TAB_ITEMS.some((t) => t.value === v);

// Long history lists get cheap off-screen virtualization via content-visibility, so a
// 90-day range never pays full layout cost for rows the user hasn't scrolled to.
const CV_ROW = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 84px',
} as unknown as CSSProperties;

const SPORT_ICON: Record<string, LucideIcon> = {
  run: Footprints,
  walk: Footprints,
  hike: Mountain,
  climb: Mountain,
  cycle: Bike,
  ergometer: Bike,
  swim: Waves,
  row: Waves,
  strength: Dumbbell,
  hiit: Zap,
  ski: Snowflake,
  board: Snowflake,
};
const sportIcon = (type: string): LucideIcon => SPORT_ICON[type] ?? Activity;

const titleize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const workoutLabel = (a: WearableActivityDto): string =>
  a.raw_type && a.raw_type !== 'unknown' ? titleize(a.raw_type) : titleize(a.type);

const recoveryTone = (score: number | null | undefined): Tone => scoreTone(score, 67, 34);
const sleepTone = (score: number | null | undefined): Tone => scoreTone(score, 70, 50);

const TONE_PILL: Record<Tone, string> = {
  default: 'bg-kumo-fill text-kumo-default',
  ok: 'bg-kumo-success-tint text-kumo-success',
  warn: 'bg-kumo-warning-tint text-kumo-warning',
  bad: 'bg-kumo-danger-tint text-kumo-danger',
};

const ScorePill = ({ score, tone }: { score: number | null; tone: Tone }) => (
  <span
    className={cn(
      'inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums',
      TONE_PILL[tone],
    )}
  >
    {score ?? '—'}
  </span>
);

const dayLabel = (iso: string): string => fmtDate(iso, 'EEE, MMM d');

const SLEEP_STAGES = [
  { key: 'deep_s', label: '深度', color: 'var(--color-kumo-brand)' },
  { key: 'rem_s', label: 'REM', color: 'var(--macro-sugar)' },
  { key: 'light_s', label: '浅度', color: 'var(--color-kumo-info)' },
  { key: 'awake_s', label: '清醒', color: 'var(--color-kumo-fill-hover)' },
] as const;

const StageBar = ({ sleep }: { sleep: WearableSleepDto }) => {
  const total = SLEEP_STAGES.reduce((sum, st) => sum + (sleep[st.key] ?? 0), 0);
  if (total <= 0) return null;
  return (
    <div className="mt-2.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-kumo-fill">
        {SLEEP_STAGES.map((st) => {
          const v = sleep[st.key] ?? 0;
          if (!v) return null;
          return (
            <div
              key={st.key}
              title={`${st.label} · ${fmtDuration(v)}`}
              style={{ width: `${(v / total) * 100}%`, background: st.color }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-kumo-subtle">
        {SLEEP_STAGES.map((st) => {
          const v = sleep[st.key];
          if (v == null) return null;
          return (
            <span key={st.key} className="inline-flex items-center gap-1 tabular-nums">
              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
              {st.label} {fmtDuration(v)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const MetricChip = ({ label, value }: { label: string; value: string }) => (
  <span className="tabular-nums">
    <span className="font-medium text-kumo-default">{value}</span>{' '}
    <span className="text-kumo-subtle">{label}</span>
  </span>
);

const WorkoutRow = ({ a }: { a: WearableActivityDto }) => {
  const Icon = sportIcon(a.type);
  return (
    <li className="flex items-start gap-3 py-3.5" style={CV_ROW}>
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-kumo-brand/10 text-kumo-brand">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-kumo-strong">{workoutLabel(a)}</span>
          {a.strain_or_load != null ? (
            <Badge variant="muted" className="shrink-0 tabular-nums">
              {fmtNum(a.strain_or_load, 1)} 负荷
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-kumo-subtle">
          {dayLabel(a.start)} · {fmtTime(a.start)}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <MetricChip label="" value={fmtDuration(a.duration_s)} />
          {a.kcal != null ? <MetricChip label="kcal" value={fmtNum(a.kcal, 0)} /> : null}
          {a.distance_m != null && a.distance_m > 0 ? (
            <MetricChip label="km" value={fmtNum(a.distance_m / 1000, 2)} />
          ) : null}
          {a.elevation_gain_m != null && a.elevation_gain_m > 0 ? (
            <MetricChip label="米爬升" value={fmtNum(a.elevation_gain_m, 0)} />
          ) : null}
          {a.hr_avg != null ? <MetricChip label="平均 bpm" value={fmtNum(a.hr_avg, 0)} /> : null}
        </div>
      </div>
    </li>
  );
};

const SleepRow = ({ s }: { s: WearableSleepDto }) => (
  <li className="py-3.5" style={CV_ROW}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium text-kumo-strong">{dayLabel(s.end)}</div>
        <div className="mt-0.5 text-xs tabular-nums text-kumo-subtle">
          {fmtTime(s.start)}–{fmtTime(s.end)} · {fmtDuration(s.duration_s)}
          {s.efficiency_pct != null ? ` · 效率 ${fmtNum(s.efficiency_pct, 0)}%` : ''}
          {s.respiratory_rate != null ? ` · ${fmtNum(s.respiratory_rate, 1)} rpm` : ''}
        </div>
      </div>
      <ScorePill score={s.score} tone={sleepTone(s.score)} />
    </div>
    <StageBar sleep={s} />
  </li>
);

const RecoveryRow = ({ r }: { r: WearableReadinessDto }) => (
  <li className="flex items-center justify-between gap-3 py-3.5" style={CV_ROW}>
    <div className="min-w-0">
      <div className="font-medium text-kumo-strong">{dayLabel(r.date)}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {r.hrv_rmssd != null ? <MetricChip label="ms HRV" value={fmtNum(r.hrv_rmssd, 0)} /> : null}
        {r.resting_hr != null ? (
          <MetricChip label="bpm 静息心率" value={fmtNum(r.resting_hr, 0)} />
        ) : null}
        {r.spo2 != null ? <MetricChip label="% SpO₂" value={fmtNum(r.spo2, 1)} /> : null}
        {r.skin_temp_delta_c != null ? (
          <MetricChip label="°C skin" value={fmtNum(r.skin_temp_delta_c, 1)} />
        ) : null}
      </div>
    </div>
    <ScorePill score={r.score} tone={recoveryTone(r.score)} />
  </li>
);

const HistoryCard = ({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <CardTitle>{title}</CardTitle>
      <span className="text-xs tabular-nums text-kumo-subtle">{count}</span>
    </CardHeader>
    <CardContent className="pt-0">
      {count === 0 ? (
        <p className="py-6 text-center text-sm text-kumo-subtle">{empty}</p>
      ) : (
        <ul className="divide-y divide-kumo-line">{children}</ul>
      )}
    </CardContent>
  </Card>
);

const ProviderCard = ({
  p,
  st,
  onConnect,
  onDisconnect,
  onSync,
  connecting,
  disconnecting,
  syncing,
}: {
  p: WearableProviderInfoDto;
  st: WearableStatusDto | undefined;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onSync: (id: string) => void;
  connecting: boolean;
  disconnecting: boolean;
  syncing: boolean;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <span>{p.display_name}</span>
        <Badge variant={p.status === 'linked' ? 'ok' : 'outline'} className="capitalize">
          {p.status}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="text-xs text-kumo-subtle">
        auth: {p.auth_strategy} · scopes: {p.scopes.length ? p.scopes.join(' ') : '—'}
      </div>
      {st?.resources?.length ? (
        <ul className="space-y-1 text-xs">
          {st.resources.map((res) => (
            <li key={res.resource} className="flex items-center justify-between">
              <span className="capitalize text-kumo-subtle">{res.resource}</span>
              <span className="tabular-nums text-kumo-subtle">
                {res.last_synced_at ? fmtRelative(res.last_synced_at) : '从未'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        {p.status === 'linked' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => onSync(p.id)} disabled={syncing}>
              <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} /> 同步
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect(p.id)}
              disabled={disconnecting}
            >
              <Unplug className="h-3.5 w-3.5" /> 断开连接
            </Button>
          </>
        ) : p.auth_strategy === 'oauth2' ? (
          <Button size="sm" onClick={() => onConnect(p.id)} disabled={connecting}>
            <Link2 className="h-3.5 w-3.5" /> 连接
          </Button>
        ) : (
          <span className="text-xs text-kumo-subtle">仪表盘尚不支持此功能。</span>
        )}
      </div>
    </CardContent>
  </Card>
);

const WorkoutSummary = ({ rows }: { rows: WearableActivityDto[] }) => {
  if (rows.length === 0) return null;
  const totalKcal = rows.reduce((s, a) => s + (a.kcal ?? 0), 0);
  const totalSeconds = rows.reduce((s, a) => s + (a.duration_s ?? 0), 0);
  const strains = rows.map((a) => a.strain_or_load).filter((v): v is number => v != null);
  const avgStrain = strains.length ? strains.reduce((a, b) => a + b, 0) / strains.length : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={Activity} label="运动次数" value={String(rows.length)} />
      <StatCard label="总时长" value={fmtDuration(totalSeconds)} />
      <StatCard label="总热量" value={fmtNum(totalKcal, 0)} />
      <StatCard
        icon={Zap}
        label="平均负荷"
        value={avgStrain != null ? fmtNum(avgStrain, 1) : '—'}
      />
    </div>
  );
};

const Wearables = () => {
  const qc = useQueryClient();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [days, setDays] = useState<number>(RANGES[1].days);
  const start = daysAgoIso(days);
  const end = todayIso();
  const startTs = `${start}T00:00:00Z`;
  const endTs = `${end}T23:59:59Z`;

  const providers = useQuery({
    queryKey: ['wearables', 'providers'],
    queryFn: () => api.wearables.providers(),
  });
  const status = useQuery({
    queryKey: ['wearables', 'status'],
    queryFn: () => api.wearables.status(),
  });
  const readiness = useQuery({
    queryKey: ['wearables', 'readiness', start, end],
    queryFn: () => api.wearables.readiness({ start, end }),
    placeholderData: keepPreviousData,
  });
  const sleep = useQuery({
    queryKey: ['wearables', 'sleep', start, end],
    queryFn: () => api.wearables.sleep({ start: startTs, end: endTs }),
    placeholderData: keepPreviousData,
  });
  const activity = useQuery({
    queryKey: ['wearables', 'activity', start, end],
    queryFn: () => api.wearables.activity({ start: startTs, end: endTs }),
    placeholderData: keepPreviousData,
  });
  const daily = useQuery({
    queryKey: ['wearables', 'daily', start, end],
    queryFn: () => api.wearables.daily({ start, end }),
    placeholderData: keepPreviousData,
  });
  const whoopBody = useQuery({
    queryKey: ['wearables', 'whoop-body'],
    queryFn: () => api.wearables.whoopBody(),
  });

  const connect = useMutation({
    mutationFn: (provider: string) => api.wearables.connect(provider),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener'),
  });
  const disconnect = useMutation({
    mutationFn: (provider: string) => api.wearables.disconnect(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wearables'] }),
  });
  const sync = useMutation({
    mutationFn: (provider?: string) =>
      api.wearables.sync(provider ? { providers: [provider] } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wearables'] }),
  });

  const setTab = (next: WearableTab) => navigate({ search: (prev) => ({ ...prev, tab: next }) });

  const providerList = providers.data ?? [];
  const hasProviders = providerList.length > 0;

  if (providers.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  // Only show the "no providers" empty state when there are truly no
  // providers configured AND no push-based data (e.g. Zepp) in the DB.
  // We check whether the data queries return anything below, so we no
  // longer gate on `anyLinked` which excluded push-only providers.
  const showEmptyState =
    !hasProviders &&
    (readiness.data ?? []).length === 0 &&
    (sleep.data ?? []).length === 0 &&
    (activity.data ?? []).length === 0 &&
    (daily.data ?? []).length === 0;

  if (showEmptyState) {
    return (
      <>
        <PageHeader
          title="可穿戴设备"
          description="连接提供商以同步睡眠、恢复、负荷和运动数据到本地数据库。"
        />
        <div className="mx-auto max-w-md space-y-4">
          <Empty
            icon={Watch}
            title="未连接可穿戴设备"
            description="在下方关联提供商或通过手表端小程序推送数据 — 数据会同步到本地数据库并显示在这里。"
          />
          {hasProviders ? (
            <div className="grid gap-3">
              {providerList.map((p) => (
                <ProviderCard
                  key={p.id}
                  p={p}
                  st={status.data?.find((s) => s.provider === p.id)}
                  onConnect={(id) => connect.mutate(id)}
                  onDisconnect={(id) => disconnect.mutate(id)}
                  onSync={(id) => sync.mutate(id)}
                  connecting={connect.isPending}
                  disconnecting={disconnect.isPending}
                  syncing={sync.isPending}
                />
              ))}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  const readinessRows = readiness.data ?? [];
  const sleepRows = sleep.data ?? [];
  const activityRows = activity.data ?? [];
  const dailyRows = daily.data ?? [];
  const body = whoopBody.data;

  const latestRecovery = readinessRows[0];
  const latestSleep = sleepRows[0];
  const latestStrain = dailyRows.find((d) => d.strain != null);
  // Latest daily row with any data (for steps / HR from push providers)
  const latestDaily = dailyRows[0];

  const recoverySeries = reverseSeries(
    readinessRows,
    (r) => r.date,
    (r) => r.score,
  );
  const hrvSeries = reverseSeries(
    readinessRows,
    (r) => r.date,
    (r) => r.hrv_rmssd,
  );
  const strainSeries = reverseSeries(
    dailyRows,
    (d) => d.date,
    (d) => d.strain,
  );
  const sleepScoreSeries = reverseSeries(
    sleepRows,
    (s) => s.end.slice(0, 10),
    (s) => s.score,
  );
  const sleepHoursSeries = reverseSeries(
    sleepRows,
    (s) => s.end.slice(0, 10),
    (s) => (s.duration_s != null ? s.duration_s / 3600 : null),
  );

  return (
    <>
      <PageHeader
        title="可穿戴设备"
        description={
          <span>
            最近 <span className="font-medium text-kumo-default">{days}</span> 天 ·{' '}
            <span className="font-mono text-xs">{start}</span> →{' '}
            <span className="font-mono text-xs">{end}</span>
          </span>
        }
        actions={
          <>
            <RangeToggle days={days} onChange={setDays} />
            <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate(undefined)}>
              <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} /> 同步
            </Button>
          </>
        }
      />

      <Tabs
        variant="underline"
        value={tab}
        onValueChange={(v) => setTab(v as WearableTab)}
        tabs={TAB_ITEMS.map((t) => ({ value: t.value, label: t.label }))}
        className="mb-6"
      />

      <div key={tab} className="t-panel-reveal">
        {tab === 'overview' ? (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Heart}
                tone={recoveryTone(latestRecovery?.score)}
                label="恢复"
                value={latestRecovery?.score != null ? String(latestRecovery.score) : '—'}
                hint={
                  latestRecovery?.hrv_rmssd != null
                    ? `HRV ${fmtNum(latestRecovery.hrv_rmssd, 0)} ms`
                    : latestDaily?.hr_avg != null
                      ? `静息 ${fmtNum(latestDaily.hr_avg, 0)} bpm`
                      : '暂无数据'
                }
              />
              <StatCard
                icon={Footprints}
                label="步数"
                value={latestDaily?.steps != null ? fmtNum(latestDaily.steps, 0) : '—'}
                hint={
                  latestDaily?.distance_m != null && latestDaily.distance_m > 0
                    ? `${fmtNum(latestDaily.distance_m / 1000, 1)} km`
                    : '今日累计'
                }
              />
              <StatCard
                icon={Moon}
                tone={sleepTone(latestSleep?.score)}
                label="睡眠评分"
                value={latestSleep?.score != null ? String(latestSleep.score) : '—'}
                hint={latestSleep ? `睡眠 ${fmtDuration(latestSleep.duration_s)}` : '暂无数据'}
              />
              <StatCard
                icon={Zap}
                label="日间负荷"
                value={latestStrain?.strain != null ? fmtNum(latestStrain.strain, 1) : '—'}
                hint={
                  latestDaily?.kcal_active != null
                    ? `${fmtNum(latestDaily.kcal_active, 0)} kcal`
                    : '0–21 量表'
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MetricChart
                id="ov-recovery"
                title="恢复"
                data={recoverySeries}
                color="var(--color-kumo-success)"
                digits={0}
              />
              <MetricChart
                id="ov-strain"
                title="日间负荷"
                data={strainSeries}
                color="var(--color-kumo-brand)"
              />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>近期运动</CardTitle>
                {activityRows.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('workouts')}
                    className="inline-flex items-center gap-1 rounded text-xs font-medium text-kumo-brand outline-none transition-colors hover:text-kumo-brand-hover focus-visible:ring-2 focus-visible:ring-kumo-focus"
                  >
                    查看全部 <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0">
                {activityRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-kumo-subtle">
                    此范围内无运动记录。
                  </p>
                ) : (
                  <ul className="divide-y divide-kumo-line">
                    {activityRows.slice(0, 4).map((a) => (
                      <WorkoutRow key={`${a.provider}-${a.provider_id}`} a={a} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === 'workouts' ? (
          <div className="grid gap-5">
            <WorkoutSummary rows={activityRows} />
            <HistoryCard
              title="运动历史"
              count={activityRows.length}
              empty="No workouts in this range."
            >
              {activityRows.map((a) => (
                <WorkoutRow key={`${a.provider}-${a.provider_id}`} a={a} />
              ))}
            </HistoryCard>
          </div>
        ) : null}

        {tab === 'sleep' ? (
          <div className="grid gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <MetricChart
                id="sleep-score"
                title="睡眠评分"
                data={sleepScoreSeries}
                color="var(--color-kumo-brand)"
                digits={0}
              />
              <MetricChart
                id="sleep-hours"
                title="睡眠时长"
                data={sleepHoursSeries}
                color="var(--color-kumo-info)"
                unit="h"
              />
            </div>
            <HistoryCard
              title="睡眠历史"
              count={sleepRows.length}
              empty="此范围内无睡眠记录。"
            >
              {sleepRows.map((s) => (
                <SleepRow key={`${s.provider}-${s.provider_id}`} s={s} />
              ))}
            </HistoryCard>
          </div>
        ) : null}

        {tab === 'recovery' ? (
          <div className="grid gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <MetricChart
                id="rec-score"
                title="恢复"
                data={recoverySeries}
                color="var(--color-kumo-success)"
                digits={0}
              />
              <MetricChart
                id="rec-hrv"
                title="HRV"
                data={hrvSeries}
                color="var(--color-kumo-brand)"
                unit="ms"
                digits={0}
              />
            </div>
            <HistoryCard
              title="恢复历史"
              count={readinessRows.length}
              empty="此范围内无恢复记录。"
            >
              {readinessRows.map((r) => (
                <RecoveryRow key={`${r.provider}-${r.date}`} r={r} />
              ))}
            </HistoryCard>
          </div>
        ) : null}

        {tab === 'connections' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providerList.map((p) => (
              <ProviderCard
                key={p.id}
                p={p}
                st={status.data?.find((s) => s.provider === p.id)}
                onConnect={(id) => connect.mutate(id)}
                onDisconnect={(id) => disconnect.mutate(id)}
                onSync={(id) => sync.mutate(id)}
                connecting={connect.isPending}
                disconnecting={disconnect.isPending}
                syncing={sync.isPending}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};

export const Route = createFileRoute('/wearables')({
  validateSearch: (search: Record<string, unknown>): { tab: WearableTab } => ({
    tab: isWearableTab(search.tab) ? search.tab : 'overview',
  }),
  component: Wearables,
});
