import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type SeriesPoint, TrendArea } from '@/components/ui/chart';
import { fmtNum } from '@/lib/format';
import { useMemo } from 'react';

const summarize = (data: SeriesPoint[]): { latest: number | null; avg: number | null } => {
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return { latest: null, avg: null };
  return {
    latest: vals[vals.length - 1] ?? null,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
};

export const MetricChart = ({
  id,
  title,
  data,
  color,
  unit,
  height = 200,
  digits = 1,
}: {
  id: string;
  title: string;
  data: SeriesPoint[];
  color: string;
  unit?: string;
  height?: number;
  digits?: number;
}) => {
  const { latest, avg } = useMemo(() => summarize(data), [data]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="capitalize">{title}</CardTitle>
          <p className="text-xs text-kumo-subtle">
            平均{' '}
            <span className="font-medium tabular-nums text-kumo-default">
              {avg !== null ? `${fmtNum(avg, digits)}${unit ? ` ${unit}` : ''}` : '—'}
            </span>
          </p>
        </div>
        <div className="min-w-[4.5rem] shrink-0 text-right">
          <div
            className="text-xl font-semibold leading-none tracking-tight tabular-nums"
            style={{ color }}
          >
            {latest !== null ? fmtNum(latest, digits) : '—'}
          </div>
          {unit ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-kumo-subtle">
              {unit}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TrendArea id={id} data={data} color={color} unit={unit} title={title} height={height} />
      </CardContent>
    </Card>
  );
};
