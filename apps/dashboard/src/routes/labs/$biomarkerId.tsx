import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtNum } from '@/lib/format';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/labs';
import { Popover } from '@cloudflare/kumo';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, Beaker, Info } from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AboutSection = ({ label, body }: { label: string; body: string }) => (
  <div>
    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
      {label}
    </div>
    <p className="mt-1.5 leading-relaxed text-kumo-default">{body}</p>
  </div>
);

const StatTile = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-kumo-line bg-kumo-base px-4 py-3">
    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
      {label}
    </div>
    <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-kumo-strong">
      {value}
    </div>
    {hint ? <div className="mt-0.5 text-[11px] text-kumo-subtle">{hint}</div> : null}
  </div>
);

const BiomarkerDetail = () => {
  const { biomarkerId } = Route.useParams();
  const biomarker = useQuery({
    queryKey: ['biomarker', biomarkerId],
    queryFn: () => api.biomarkers.get(biomarkerId),
  });
  const trend = useQuery({
    queryKey: ['biomarker-trend', biomarkerId],
    queryFn: () => api.biomarkers.trend(biomarkerId),
  });
  const results = useQuery({
    queryKey: ['biomarker-results', biomarkerId],
    queryFn: () => api.labs.results({ biomarker: biomarkerId, limit: 100 }),
  });

  const chartData = useMemo(() => {
    return (trend.data ?? [])
      .filter((p): p is typeof p & { value: number } => p.value !== null)
      .map((p) => ({ date: p.ts.slice(0, 10), value: p.value }));
  }, [trend.data]);

  if (biomarker.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (biomarker.isError || !biomarker.data) {
    return (
      <Empty
        icon={Beaker}
        title="生物标志物未找到"
        description={(biomarker.error as Error)?.message ?? '未找到该 id 的记录。'}
      />
    );
  }
  const b = biomarker.data;
  const sortedResults = (results.data ?? [])
    .slice()
    .sort((x, y) => y.taken_at.localeCompare(x.taken_at));
  const latest = sortedResults[0];
  const latestValue = latest?.value_numeric ?? null;
  const status = latest?.status ?? 'unknown';

  const rangeLabel = (low: number | null, high: number | null): string => {
    if (low != null && high != null)
      return `${fmtNum(low, 2)} – ${fmtNum(high, 2)} ${b.default_unit_ucum}`;
    if (low != null) return `≥ ${fmtNum(low, 2)} ${b.default_unit_ucum}`;
    if (high != null) return `≤ ${fmtNum(high, 2)} ${b.default_unit_ucum}`;
    return '—';
  };
  const refLabel = rangeLabel(b.default_ref_low, b.default_ref_high);
  const optLabel = rangeLabel(b.optimal_low, b.optimal_high);
  const hasRef = b.default_ref_low != null || b.default_ref_high != null;
  const hasOpt = b.optimal_low != null || b.optimal_high != null;
  const aliasList = (b.aliases ? (JSON.parse(b.aliases) as string[]) : []).filter(Boolean);

  const oldest = sortedResults[sortedResults.length - 1];
  const entriesHint =
    oldest && latest ? `${fmtDate(oldest.taken_at)} → ${fmtDate(latest.taken_at)}` : '—';

  return (
    <>
      <Link
        to="/labs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-kumo-subtle transition-colors hover:text-kumo-default"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        返回化验
      </Link>
      <header className="mb-6 space-y-2 sm:mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-kumo-strong sm:text-[26px]">
            {b.display_name ?? b.name}
          </h1>
          {latestValue != null ? (
            <Badge variant={STATUS_VARIANT[status]} className="capitalize">
              {STATUS_LABEL[status]}
            </Badge>
          ) : null}
          {b.loinc_code ? (
            <Popover>
              <Popover.Trigger
                render={(p) => (
                  <button
                    {...p}
                    type="button"
                    aria-label={`什么是 LOINC ${b.loinc_code}？`}
                    className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-kumo-line bg-kumo-fill px-2 font-mono text-[10px] uppercase tracking-wide text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
                  >
                    <Info className="h-3 w-3" aria-hidden="true" />
                    LOINC {b.loinc_code}
                  </button>
                )}
              />
              <Popover.Content side="bottom" className="max-w-xs p-4 normal-case tracking-normal">
                <Popover.Title className="text-sm font-semibold text-kumo-strong">
                  LOINC {b.loinc_code}
                </Popover.Title>
                <Popover.Description className="mt-1.5 text-xs leading-relaxed text-kumo-subtle">
                  <span className="font-medium text-kumo-default">
                    逻辑观察标识符名称和代码
                  </span>{' '}
                  — 国际标准，为每个化验测量提供稳定标识符，
                  确保结果在不同实验室和电子病历系统间一致。
                </Popover.Description>
                <a
                  href={`https://loinc.org/${b.loinc_code}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-kumo-brand hover:underline"
                >
                  在 loinc.org 上查看 →
                </a>
              </Popover.Content>
            </Popover>
          ) : null}
        </div>
        {aliasList.length > 0 ? (
          <p className="text-sm text-kumo-subtle">
            别名：<span className="text-kumo-default">{aliasList.join(', ')}</span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="最新"
              value={
                latestValue != null
                  ? `${fmtNum(latestValue, 2)} ${latest?.unit_ucum ?? b.default_unit_ucum}`
                  : '—'
              }
              hint={latest ? fmtDate(latest.taken_at) : '无记录'}
            />
            <StatTile
              label="参考范围"
              value={refLabel}
              hint={hasRef ? '人群范围' : '未设置'}
            />
            <StatTile
              label="最佳范围"
              value={optLabel}
              hint={hasOpt ? '你的目标区间' : '未设置'}
            />
            <StatTile label="记录数" value={String(sortedResults.length)} hint={entriesHint} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {trend.isLoading ? (
                <Spinner />
              ) : chartData.length === 0 ? (
                <Empty title="无数值数据" description="至少需要一条数值结果。" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="biomarker-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-kumo-brand)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--color-kumo-brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-kumo-line)"
                      strokeDasharray="2 4"
                      vertical={false}
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="date"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      stroke="var(--text-color-kumo-subtle)"
                      tickMargin={6}
                    />
                    <YAxis
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      stroke="var(--text-color-kumo-subtle)"
                      width={40}
                    />
                    {b.default_ref_low != null ? (
                      <ReferenceArea
                        y2={b.default_ref_low}
                        fill="var(--color-kumo-danger)"
                        fillOpacity={0.08}
                        ifOverflow="hidden"
                      />
                    ) : null}
                    {b.default_ref_high != null ? (
                      <ReferenceArea
                        y1={b.default_ref_high}
                        fill="var(--color-kumo-danger)"
                        fillOpacity={0.08}
                        ifOverflow="hidden"
                      />
                    ) : null}
                    {b.optimal_low != null || b.optimal_high != null ? (
                      <ReferenceArea
                        y1={b.optimal_low ?? undefined}
                        y2={b.optimal_high ?? undefined}
                        fill="var(--color-kumo-success)"
                        fillOpacity={0.1}
                        ifOverflow="hidden"
                      />
                    ) : null}
                    {b.default_ref_low != null ? (
                      <ReferenceLine
                        y={b.default_ref_low}
                        stroke="var(--color-kumo-danger)"
                        strokeOpacity={0.4}
                        strokeDasharray="4 4"
                        label={{
                          value: `参考下限 ${fmtNum(b.default_ref_low, 2)}`,
                          fontSize: 10,
                          fill: 'var(--text-color-kumo-subtle)',
                          position: 'insideTopLeft',
                        }}
                      />
                    ) : null}
                    {b.default_ref_high != null ? (
                      <ReferenceLine
                        y={b.default_ref_high}
                        stroke="var(--color-kumo-danger)"
                        strokeOpacity={0.4}
                        strokeDasharray="4 4"
                        label={{
                          value: `参考上限 ${fmtNum(b.default_ref_high, 2)}`,
                          fontSize: 10,
                          fill: 'var(--text-color-kumo-subtle)',
                          position: 'insideBottomLeft',
                        }}
                      />
                    ) : null}
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-kumo-base)',
                        border: '1px solid var(--color-kumo-line)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'var(--text-color-kumo-default)', fontWeight: 500 }}
                      formatter={(v: number) => [`${fmtNum(v, 2)} ${b.default_unit_ucum}`, b.name]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-kumo-brand)"
                      strokeWidth={2}
                      fill="url(#biomarker-area)"
                      dot={{ r: 3, fill: 'var(--color-kumo-brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>历史</CardTitle>
            </CardHeader>
            <CardContent>
              {results.isLoading ? (
                <Spinner />
              ) : sortedResults.length === 0 ? (
                <Empty title="暂无结果" />
              ) : (
                <ul className="divide-y divide-kumo-line">
                  {sortedResults.map((r) => {
                    const rowStatus = r.status;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="font-mono text-xs tabular-nums text-kumo-subtle">
                          {fmtDate(r.taken_at)}
                        </span>
                        <span
                          className={cn(
                            'flex-1 text-right font-medium tabular-nums',
                            rowStatus === 'out_of_ref' && 'text-kumo-danger',
                            rowStatus === 'optimal' && 'text-kumo-success',
                          )}
                        >
                          {r.value_numeric != null
                            ? `${fmtNum(r.value_numeric, 2)} ${r.unit_ucum}`
                            : (r.value_text ?? '—')}
                        </span>
                        <Badge variant={STATUS_VARIANT[rowStatus]} className="capitalize">
                          {STATUS_LABEL[rowStatus]}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-kumo-subtle">
            {b.why_it_matters ? (
              <AboutSection label="重要性" body={b.why_it_matters} />
            ) : null}
            {b.influences ? <AboutSection label="影响因素" body={b.influences} /> : null}
            {b.how_to_improve ? (
              <AboutSection label="改善方法" body={b.how_to_improve} />
            ) : null}
            {!b.why_it_matters && !b.influences && !b.how_to_improve ? (
              <p>该生物标志物暂无描述。</p>
            ) : null}
            {b.notes ? <AboutSection label="备注" body={b.notes} /> : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-kumo-line pt-3 text-xs">
              <dt className="text-kumo-subtle">单位</dt>
              <dd className="font-mono text-kumo-default">{b.default_unit_ucum}</dd>
              <dt className="text-kumo-subtle">值类型</dt>
              <dd className="capitalize text-kumo-default">{b.value_type.replace('_', ' ')}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export const Route = createFileRoute('/labs/$biomarkerId')({ component: BiomarkerDetail });
