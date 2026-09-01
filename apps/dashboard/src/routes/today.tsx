import { EditRingsDialog } from '@/components/edit-rings-dialog';
import { MacroRings } from '@/components/macro-rings';
import { MealCard } from '@/components/meal-card';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum, fmtTime, todayIso } from '@/lib/format';
import { MACRO_META, type MacroKey } from '@/lib/macros';
import { scoreTone } from '@/lib/tone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  Droplets,
  Flame,
  Heart,
  Moon,
  Plus,
  Scale,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { type ReactElement, useState } from 'react';

const HYDRATION_STEPS = [250, 500, 750];

type TriggerProps = Record<string, unknown>;

type HydrationDialogProps = {
  renderTrigger: (props: TriggerProps) => ReactElement;
  date: string;
};

const HydrationDialog = ({ renderTrigger, date }: HydrationDialogProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const entries = useQuery({
    queryKey: ['hydration', date],
    queryFn: () => api.hydration.list({ date }),
    enabled: open,
  });
  const log = useMutation({
    mutationFn: (ml: number) => api.hydration.log({ ml }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.hydration.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });
  const submitCustom = () => {
    const ml = Number(custom);
    if (!Number.isFinite(ml) || ml <= 0) return;
    log.mutate(ml);
    setCustom('');
  };
  const today = entries.data ?? [];
  const total = today.reduce((sum, e) => sum + e.ml, 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(p) => renderTrigger(p as TriggerProps)} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-kumo-brand" />
            水分补充
          </DialogTitle>
          <p className="text-xs text-kumo-subtle">今日已记录 {fmtNum(total)} ml。</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {HYDRATION_STEPS.map((ml) => (
              <Button
                key={ml}
                variant="outline"
                size="sm"
                disabled={log.isPending}
                onClick={() => log.mutate(ml)}
              >
                +{ml} ml
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="自定义 ml"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitCustom();
                }
              }}
              className="flex-1"
            />
            <Button size="sm" disabled={!custom || log.isPending} onClick={submitCustom}>
              添加
            </Button>
          </div>
          <div>
            <SectionLabel className="mb-2">今日饮水记录</SectionLabel>
            {entries.isLoading ? (
              <Spinner />
            ) : today.length === 0 ? (
              <p className="text-xs text-kumo-subtle">还没有记录 — 点击上方按钮添加。</p>
            ) : (
              <ul className="max-h-48 divide-y divide-kumo-line overflow-y-auto">
                {today.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="font-mono text-xs tabular-nums text-kumo-subtle">
                      {fmtTime(e.ts)}
                    </span>
                    <span className="tabular-nums">{fmtNum(e.ml)} ml</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="删除记录"
                      className="h-7 w-7"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProgressBar = ({
  value,
  goal,
  color,
}: {
  value: number;
  goal: number | null;
  color: string;
}) => {
  const ratio = goal && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-kumo-fill">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${ratio * 100}%`, background: color }}
      />
    </div>
  );
};

const formatDateLong = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const Today = () => {
  const qc = useQueryClient();
  const date = todayIso();
  const summary = useQuery({
    queryKey: ['summary', 'daily', date, '7d_avg'],
    queryFn: () => api.summary.daily({ date, compare_to: '7d_avg' }),
  });
  const meals = useQuery({
    queryKey: ['meals', date],
    queryFn: () => api.meals.list({ date }),
  });
  const recovery = useQuery({
    queryKey: ['wearables', 'readiness', date],
    queryFn: () => api.wearables.readiness({ date }),
  });
  const sleep = useQuery({
    queryKey: ['wearables', 'sleep', date],
    queryFn: () => api.wearables.sleep({ date }),
  });
  const weight = useQuery({
    queryKey: ['weight', date],
    queryFn: () => api.weight.list({ date, limit: 1 }),
  });
  const whoopBody = useQuery({
    queryKey: ['wearables', 'whoop-body'],
    queryFn: () => api.wearables.whoopBody(),
  });

  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.meals.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });
  const removeComponent = useMutation({
    mutationFn: ({ mealId, componentId }: { mealId: string; componentId: string }) =>
      api.meals.removeComponent(mealId, componentId),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (summary.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return <Empty title="暂无数据" description={(summary.error as Error)?.message ?? '未知'} />;
  }

  const s = summary.data;
  const ringKeys: MacroKey[] = ['kcal', ...s.goals.tracked_macros];
  const macros = ringKeys.map((key) => ({
    label: MACRO_META[key].label,
    current: s.totals[key] ?? 0,
    bound: s.goals[key],
    status: s.delta[key].status,
    color: MACRO_META[key].color,
    unit: MACRO_META[key].unit,
  }));
  const r = recovery.data?.[0];
  const sl = sleep.data?.[0];
  const w = weight.data?.[0];
  const whoopWeightKg = whoopBody.data?.weight_kg ?? null;
  const displayWeightKg = w?.kg ?? whoopWeightKg;
  const recoveryTone = scoreTone(r?.score, 67, 34);
  const sleepTone = scoreTone(sl?.score, 70, 50);

  return (
    <>
      <PageHeader
        title="今日"
        description={
          <span className="flex items-center gap-2">
            <span>{formatDateLong(s.date)}</span>
            <span className="text-kumo-subtle">·</span>
            <span className="font-mono text-xs">{s.date}</span>
          </span>
        }
      />

      <div className="grid gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-kumo-brand" />
                宏量营养素 vs 目标
              </CardTitle>
              <p className="text-xs text-kumo-subtle">
                今日摄入实时数据 — 点击环形图查看详情。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="muted">
                {fmtNum(s.totals.meal_count, 0)} {s.totals.meal_count === 1 ? '餐' : '餐'}
                {s.totals.component_count > s.totals.meal_count ? (
                  <span className="text-kumo-subtle">
                    {' '}
                    · {fmtNum(s.totals.component_count, 0)} 项
                  </span>
                ) : null}
              </Badge>
              <EditRingsDialog
                renderTrigger={(p) => (
                  <button
                    {...p}
                    type="button"
                    aria-label="编辑环形图"
                    className="grid h-8 w-8 place-items-center rounded-md text-kumo-subtle transition-colors hover:bg-kumo-elevated hover:text-kumo-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <MacroRings macros={macros} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Moon}
            tone={sleepTone}
            label="睡眠评分"
            value={sl?.score != null ? String(sl.score) : '—'}
            hint={sl ? `睡眠 ${fmtNum((sl.duration_s ?? 0) / 3600, 1)} 小时` : '暂无数据'}
          />
          <StatCard
            icon={Heart}
            tone={recoveryTone}
            label="恢复"
            value={r?.score != null ? String(r.score) : '—'}
            hint={r?.hrv_rmssd ? `HRV ${fmtNum(r.hrv_rmssd, 0)} ms` : '暂无数据'}
          />
          <StatCard
            icon={Scale}
            label="体重"
            value={displayWeightKg != null ? `${fmtNum(displayWeightKg, 1)} kg` : '—'}
            hint={
              w?.body_fat_pct != null
                ? `体脂率 ${fmtNum(w.body_fat_pct, 1)}%`
                : w?.source === 'whoop' || (!w && whoopWeightKg != null)
                  ? '来自 Whoop'
                  : '无记录'
            }
          />
          <Card className="transition-colors hover:bg-kumo-elevated">
            <div className="flex items-stretch justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-kumo-subtle">
                  水分补充
                </div>
                <div className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-kumo-strong">
                  {fmtNum(s.totals.hydration_ml)} ml
                </div>
                {s.goals.hydration_ml.min != null || s.goals.hydration_ml.max != null ? (
                  <div className="mt-1.5 flex flex-col gap-1 text-xs text-kumo-subtle">
                    <span>
                      {s.goals.hydration_ml.min != null
                        ? `目标 ≥ ${fmtNum(s.goals.hydration_ml.min)} ml`
                        : `上限 ≤ ${fmtNum(s.goals.hydration_ml.max ?? 0)} ml`}
                    </span>
                    <ProgressBar
                      value={s.totals.hydration_ml}
                      goal={s.goals.hydration_ml.max ?? s.goals.hydration_ml.min ?? 0}
                      color="var(--color-kumo-brand)"
                    />
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-kumo-subtle">点击 + 记录饮水</div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-kumo-info-tint text-kumo-info">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                </div>
                <HydrationDialog
                  date={date}
                  renderTrigger={(p) => (
                    <button
                      {...p}
                      type="button"
                      aria-label="记录饮水"
                      className="grid h-8 w-8 place-items-center rounded-md bg-kumo-brand text-white shadow-sm shadow-kumo-brand/20 transition-[transform,box-shadow] hover:scale-105 hover:shadow-kumo-brand/40 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>餐食</CardTitle>
              <span className="text-xs text-kumo-subtle">
                平均置信度{' '}
                <span className="font-medium text-kumo-default">
                  {s.totals.avg_confidence === null ? '—' : fmtNum(s.totals.avg_confidence, 2)}
                </span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {meals.isLoading ? (
              <Spinner />
            ) : !meals.data?.length ? (
              <Empty
                icon={Activity}
                title="今日暂无餐食记录"
                description="通过 MCP 让智能体记录餐食，或使用食物/食谱页面手动添加。"
              />
            ) : (
              <ul className="-mx-2 divide-y divide-kumo-line">
                {meals.data.map((m) => (
                  <MealCard
                    key={m.id}
                    meal={m}
                    onDeleteMeal={(id) => deleteMeal.mutate(id)}
                    onRemoveComponent={(mealId, componentId) =>
                      removeComponent.mutate({ mealId, componentId })
                    }
                    busy={deleteMeal.isPending || removeComponent.isPending}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export const Route = createFileRoute('/today')({
  component: Today,
});
