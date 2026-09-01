import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtNum } from '@/lib/format';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/labs';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, Beaker, ChevronRight, FlaskConical } from 'lucide-react';

const PanelDetail = () => {
  const { panelId } = Route.useParams();
  const detail = useQuery({
    queryKey: ['lab-panel', panelId],
    queryFn: () => api.labs.panel(panelId),
  });

  if (detail.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Empty
        icon={Beaker}
        title="面板未找到"
        description={(detail.error as Error)?.message ?? '未找到该 id 的记录。'}
      />
    );
  }

  const { panel, rows } = detail.data;
  const counts = { optimal: 0, in_ref: 0, out_of_ref: 0, unknown: 0 };
  for (const r of rows) counts[r.status] += 1;

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
          <FlaskConical className="h-5 w-5 text-kumo-brand" aria-hidden="true" />
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-kumo-strong sm:text-[26px]">
            {panel.name ?? panel.lab_name ?? '化验面板'}
          </h1>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-kumo-subtle">
          <span>{fmtDate(panel.drawn_at)}</span>
          {panel.lab_name && panel.name ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{panel.lab_name}</span>
            </>
          ) : null}
          {panel.fasting != null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{panel.fasting ? '空腹' : '非空腹'}</span>
            </>
          ) : null}
          {panel.ordered_by ? (
            <>
              <span aria-hidden="true">·</span>
              <span>开具者：{panel.ordered_by}</span>
            </>
          ) : null}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="最佳" count={counts.optimal} tone="text-kumo-success" />
        <SummaryTile label="正常" count={counts.in_ref} tone="text-kumo-default" />
        <SummaryTile label="异常" count={counts.out_of_ref} tone="text-kumo-danger" />
        <SummaryTile label="未知" count={counts.unknown} tone="text-kumo-subtle" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>结果 ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty title="该面板暂无记录结果" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <li key={row.result.id}>
                  <Link
                    to="/labs/$biomarkerId"
                    params={{ biomarkerId: row.biomarker.id }}
                    className="group flex items-center justify-between gap-3 rounded-md border border-kumo-line bg-kumo-base p-3 text-left text-sm transition-colors hover:border-kumo-strong hover:bg-kumo-tint"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-kumo-default">
                          {row.biomarker.display_name ?? row.biomarker.name}
                        </span>
                        <Badge variant={STATUS_VARIANT[row.status]} className="shrink-0 capitalize">
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </div>
                      <div className="text-xs tabular-nums text-kumo-subtle">
                        <span
                          className={cn(
                            'font-medium',
                            row.status === 'out_of_ref' && 'text-kumo-danger',
                            row.status === 'optimal' && 'text-kumo-success',
                            (row.status === 'in_ref' || row.status === 'unknown') &&
                              'text-kumo-default',
                          )}
                        >
                          {row.result.value_numeric != null
                            ? `${fmtNum(row.result.value_numeric, 2)} ${row.result.unit_ucum}`
                            : (row.result.value_text ?? '—')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {panel.notes ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>备注</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-kumo-default">{panel.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
};

const SummaryTile = ({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) => (
  <div className="rounded-lg border border-kumo-line bg-kumo-base px-4 py-3">
    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
      {label}
    </div>
    <div className={cn('mt-1 text-xl font-semibold tabular-nums tracking-tight', tone)}>
      {count}
    </div>
  </div>
);

export const Route = createFileRoute('/labs/panel/$panelId')({ component: PanelDetail });
