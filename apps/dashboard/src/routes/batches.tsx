import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Archive, CookingPot, Trash2 } from 'lucide-react';
import { useState } from 'react';

const TONE_COLOR = {
  ok: 'var(--color-kumo-success)',
  warn: 'var(--color-kumo-warning)',
  bad: 'var(--color-kumo-danger)',
} as const;

const Batches = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const list = useQuery({
    queryKey: ['batches', tab],
    queryFn: () => api.batches.list({ active_only: tab === 'active' }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.batches.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.batches.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
  return (
    <>
      <PageHeader
        title="批次"
        description="烹饪实例，随着摄入记录逐步消耗。"
        actions={
          <Tabs
            size="sm"
            value={tab}
            onValueChange={(v) => setTab(v as 'active' | 'all')}
            tabs={[
              { value: 'active', label: '进行中' },
              { value: 'all', label: '全部' },
            ]}
          />
        }
      />
      {list.isLoading ? (
        <Spinner />
      ) : !list.data?.length ? (
        <Empty
          icon={CookingPot}
          title="暂无批次"
          description="通过 MCP 烹饪食谱开始跟踪消耗。"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((b) => {
            const ratio = b.total_grams > 0 ? b.remaining_grams / b.total_grams : 0;
            const tone = ratio > 0.5 ? 'ok' : ratio > 0.15 ? 'warn' : 'bad';
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.name ?? '批次'}</div>
                      <div className="text-xs text-kumo-subtle">烹饪于 {fmtDate(b.cooked_at)}</div>
                    </div>
                    {b.archived ? (
                      <Badge variant="muted">已归档</Badge>
                    ) : (
                      <Badge variant={tone}>{Math.round(ratio * 100)}%</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-kumo-fill">
                      <div
                        className="h-full transition-[width] duration-300"
                        style={{
                          width: `${ratio * 100}%`,
                          background: TONE_COLOR[tone],
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs tabular-nums text-kumo-subtle">
                      <span>{fmtNum(b.remaining_grams, 0)} 克剩余</span>
                      <span>共 {fmtNum(b.total_grams, 0)} 克</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-kumo-subtle">
                    <span>
                      <span className="font-medium text-kumo-default">
                        {fmtNum(b.kcal_total, 0)}
                      </span>{' '}
                      kcal
                    </span>
                    <span>P {fmtNum(b.protein_g_total, 0)} g</span>
                    <span>C {fmtNum(b.carb_g_total, 0)} g</span>
                    <span>F {fmtNum(b.fat_g_total, 0)} g</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {!b.archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={archive.isPending}
                        onClick={() => archive.mutate(b.id)}
                      >
                        <Archive className="h-3.5 w-3.5" /> 归档
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="square"
                      aria-label="删除批次"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(b.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
};

export const Route = createFileRoute('/batches')({ component: Batches });
