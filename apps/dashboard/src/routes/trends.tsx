import { MetricChart } from '@/components/metric-chart';
import { PageHeader } from '@/components/page-header';
import { RangeToggle } from '@/components/range-toggle';
import { type SeriesPoint, reverseSeries } from '@/components/ui/chart';
import { SectionLabel } from '@/components/ui/section-label';
import { api } from '@/lib/api';
import { daysAgoIso, todayIso } from '@/lib/format';
import { MACRO_META, type MacroKey } from '@/lib/macros';
import type { WeightEntryDto } from '@health-mcp/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

// Nutrient charts share the Today ring identity (color + label + unit) so a macro
// reads the same everywhere; digits differ since trace nutrients want a decimal.
const NUTRIENTS: { key: MacroKey; digits: number }[] = [
  { key: 'kcal', digits: 0 },
  { key: 'protein_g', digits: 0 },
  { key: 'carb_g', digits: 0 },
  { key: 'fat_g', digits: 0 },
  { key: 'fiber_g', digits: 1 },
  { key: 'sugar_g', digits: 1 },
  { key: 'sat_fat_g', digits: 1 },
  { key: 'sodium_mg', digits: 0 },
];

// Weight can carry both a manual entry and a Whoop-synced one for the same day, so
// collapse to the latest reading per day for a clean line. Rows arrive newest-first,
// so the first seen per date is the latest; reverse to ascending for the chart.
const weightByDay = (rows: WeightEntryDto[] | undefined): SeriesPoint[] => {
  const seen = new Set<string>();
  const points: SeriesPoint[] = [];
  for (const w of rows ?? []) {
    if (seen.has(w.date)) continue;
    seen.add(w.date);
    points.push({ date: w.date, value: w.kg });
  }
  return points.reverse();
};

const Trends = () => {
  const [days, setDays] = useState(30);
  const start = daysAgoIso(days);
  const end = todayIso();

  const range = useQuery({
    queryKey: ['summary', 'range', start, end, 'day'],
    queryFn: () => api.summary.range({ start, end, bucket: 'day' }),
    placeholderData: keepPreviousData,
  });
  const weight = useQuery({
    queryKey: ['weight', 'range', start, end],
    queryFn: () =>
      api.weight.list({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`, limit: 365 }),
    placeholderData: keepPreviousData,
  });
  const readiness = useQuery({
    queryKey: ['readiness', start, end],
    queryFn: () => api.wearables.readiness({ start, end }),
    placeholderData: keepPreviousData,
  });
  const sleep = useQuery({
    queryKey: ['sleep', start, end],
    queryFn: () => api.wearables.sleep({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z` }),
    placeholderData: keepPreviousData,
  });

  const daysData = range.data?.days ?? [];
  const weights = weightByDay(weight.data);
  const recoveries = reverseSeries(
    readiness.data,
    (r) => r.date,
    (r) => r.score,
  );
  const sleeps = reverseSeries(
    sleep.data,
    (s) => s.start.slice(0, 10),
    (s) => s.score,
  );

  return (
    <>
      <PageHeader
        title="趋势"
        description={
          <span>
            最近 <span className="font-medium text-kumo-default">{days}</span> 天 ·{' '}
            <span className="font-mono text-xs">{start}</span> →{' '}
            <span className="font-mono text-xs">{end}</span>
          </span>
        }
        actions={<RangeToggle days={days} onChange={setDays} />}
      />

      <SectionLabel>营养</SectionLabel>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {NUTRIENTS.map(({ key, digits }) => {
          const meta = MACRO_META[key];
          return (
            <MetricChart
              key={key}
              id={key}
              title={meta.label}
              data={daysData.map((d) => ({ date: d.date, value: d[key] ?? null }))}
              color={meta.color}
              unit={meta.unit || undefined}
              digits={digits}
            />
          );
        })}
      </div>

      <SectionLabel className="mt-8">身体 &amp; 恢复</SectionLabel>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <MetricChart
          id="weight"
          title="体重"
          data={weights}
          color="var(--color-kumo-brand)"
          unit="kg"
        />
        <MetricChart
          id="recovery"
          title="恢复"
          data={recoveries}
          color="var(--color-kumo-success)"
          digits={0}
        />
        <MetricChart
          id="sleep"
          title="睡眠评分"
          data={sleeps}
          color="var(--color-kumo-brand)"
          digits={0}
        />
      </div>
    </>
  );
};

export const Route = createFileRoute('/trends')({ component: Trends });
