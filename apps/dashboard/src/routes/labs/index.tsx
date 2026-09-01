import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/labs';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Beaker, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const LabsIndex = () => {
  const [outOnly, setOutOnly] = useState(false);
  const latest = useQuery({
    queryKey: ['biomarkers', 'latest', outOnly],
    queryFn: () => api.biomarkers.latest({ out_of_range_only: outOnly }),
  });
  const panels = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => api.labs.panels({ limit: 25 }),
  });
  const sortedPanels = (panels.data ?? [])
    .slice()
    .sort((x, y) => y.drawn_at.localeCompare(x.drawn_at));
  return (
    <>
      <PageHeader
        title="化验"
        description="最新生物标志物数值。点击任意标志查看完整历史。"
        actions={
          <Button
            size="sm"
            variant={outOnly ? 'default' : 'outline'}
            onClick={() => setOutOnly((v) => !v)}
          >
            仅显示异常
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>最新生物标志物</CardTitle>
          </CardHeader>
          <CardContent>
            {latest.isLoading ? (
              <Spinner />
            ) : !latest.data?.length ? (
              <Empty
                icon={Beaker}
                title={outOnly ? '无异常项' : '暂无化验结果'}
                description="通过 MCP 或 REST 记录化验面板数据。"
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {latest.data.map((row) => (
                  <li key={row.biomarker.id}>
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
                          <Badge
                            variant={STATUS_VARIANT[row.status]}
                            className="shrink-0 capitalize"
                          >
                            {STATUS_LABEL[row.status]}
                          </Badge>
                        </div>
                        <div className="text-xs tabular-nums text-kumo-subtle">
                          <span className="font-medium text-kumo-default">
                            {row.result.value_numeric != null
                              ? `${fmtNum(row.result.value_numeric, 2)} ${row.result.unit_ucum}`
                              : (row.result.value_text ?? '—')}
                          </span>
                          <span className="ml-2">{fmtDate(row.result.taken_at)}</span>
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
        <Card>
          <CardHeader>
            <CardTitle>化验面板</CardTitle>
          </CardHeader>
          <CardContent>
            {panels.isLoading ? (
              <Spinner />
            ) : sortedPanels.length === 0 ? (
              <Empty title="暂无化验面板" />
            ) : (
              <ul className="space-y-1">
                {sortedPanels.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/labs/panel/$panelId"
                      params={{ panelId: p.id }}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-kumo-tint"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-kumo-default">
                          {p.name ?? p.lab_name ?? '面板'}
                        </div>
                        <div className="text-xs text-kumo-subtle">{fmtDate(p.drawn_at)}</div>
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
      </div>
    </>
  );
};

export const Route = createFileRoute('/labs/')({ component: LabsIndex });
