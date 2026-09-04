import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { MealPlanEntryDto } from '@health-mcp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// ── Helpers ──

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABEL: Record<MealType | 'snack', string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

const STATUS_BADGE: Record<string, 'default' | 'ok' | 'muted'> = {
  planned: 'default',
  consumed: 'ok',
  skipped: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  planned: '计划中',
  consumed: '已食用',
  skipped: '已跳过',
};

/** Get Monday of the week containing `d`. */
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const toIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ── Dialog for adding / editing a meal plan entry ──

type PlanDialogProps = {
  date: string;
  mealType: MealType;
  entry?: MealPlanEntryDto;
  recipes: Array<{ id: string; name: string }>;
  onClose: () => void;
};

const PlanDialog = ({ date, mealType, entry, recipes, onClose }: PlanDialogProps) => {
  const qc = useQueryClient();
  const [name, setName] = useState(entry?.name ?? '');
  const [useRecipe, setUseRecipe] = useState(!!entry?.recipe_id);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    entry?.recipe_id ? [entry.recipe_id] : [],
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');

  const createOne = useMutation({
    mutationFn: (body: unknown) => api.mealPlan.upsert(body),
  });

  // When editing an existing entry we only update that single row
  const updateOne = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.mealPlan.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan'] });
      onClose();
    },
  });

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const finalName = useRecipe
    ? selectedIds
        .map((id) => recipes.find((r) => r.id === id)?.name ?? '')
        .filter(Boolean)
        .join(' + ')
    : name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalName.trim()) return;

    if (entry) {
      // Editing existing single entry
      updateOne.mutate({
        id: entry.id,
        body: {
          recipe_id: useRecipe && selectedIds[0] ? selectedIds[0] : null,
          name: finalName.trim(),
          notes: notes.trim() || null,
        },
      });
      return;
    }

    if (useRecipe && selectedIds.length > 0) {
      // Create one entry per selected recipe
      for (const rid of selectedIds) {
        const rname = recipes.find((r) => r.id === rid)?.name ?? '';
        await createOne.mutateAsync({
          date,
          meal_type: mealType,
          recipe_id: rid,
          name: rname,
          servings: 1,
          notes: notes.trim() || null,
        });
      }
    } else if (!useRecipe && name.trim()) {
      await createOne.mutateAsync({
        date,
        meal_type: mealType,
        recipe_id: null,
        name: name.trim(),
        servings: 1,
        notes: notes.trim() || null,
      });
    }

    qc.invalidateQueries({ queryKey: ['meal-plan'] });
    onClose();
  };

  const isBusy = createOne.isPending || updateOne.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {entry ? '编辑计划' : '新增计划'} — {fmtDate(date, 'MM/dd')} {MEAL_LABEL[mealType]}
          </CardTitle>
          <Button variant="ghost" shape="square" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useRecipe}
                  onChange={(e) => setUseRecipe(e.target.checked)}
                  className="rounded"
                />
                从食谱库选择{!entry ? '（可多选）' : ''}
              </label>
            </div>
            {useRecipe ? (
              entry ? (
                // Editing: single select
                <select
                  value={selectedIds[0] ?? ''}
                  onChange={(e) => setSelectedIds(e.target.value ? [e.target.value] : [])}
                  className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm"
                >
                  <option value="">选择食谱...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                // Creating: multi-select checkboxes
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-kumo-line p-2">
                  {recipes.length === 0 ? (
                    <p className="text-xs text-kumo-subtle">暂无食谱</p>
                  ) : (
                    recipes.map((r) => (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-kumo-fill/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleRecipe(r.id)}
                          className="rounded"
                        />
                        {r.name}
                      </label>
                    ))
                  )}
                </div>
              )
            ) : (
              <Input
                placeholder="餐食名称，如：鸡蛋白炒蛋+白米粥"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            )}
            <Input
              placeholder="备注（可选）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isBusy || !finalName.trim()}>
                {isBusy ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Single entry row inside a cell ──

type EntryRowProps = {
  entry: MealPlanEntryDto;
  onEdit: () => void;
};

const EntryRow = ({ entry, onEdit }: EntryRowProps) => {
  const qc = useQueryClient();

  const markConsumed = useMutation({
    mutationFn: (id: string) => api.mealPlan.update(id, { status: 'consumed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  });

  const markSkipped = useMutation({
    mutationFn: (id: string) => api.mealPlan.update(id, { status: 'skipped' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.mealPlan.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  });

  const busy = markConsumed.isPending || markSkipped.isPending || remove.isPending;

  return (
    <div
      className={cn(
        'flex items-start gap-1 rounded border p-1.5 text-sm',
        entry.status === 'consumed' && 'border-kumo-success/30 bg-kumo-success/5',
        entry.status === 'skipped' && 'border-kumo-line/40 bg-kumo-fill/50 opacity-60',
        entry.status === 'planned' && 'border-kumo-line bg-kumo-canvas',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="line-clamp-1 flex-1 text-xs font-medium leading-tight">
            {entry.name}
          </span>
          <Badge variant={STATUS_BADGE[entry.status]} className="shrink-0 text-[9px] leading-none">
            {STATUS_LABEL[entry.status]}
          </Badge>
        </div>
        {entry.notes ? (
          <span className="line-clamp-1 text-[10px] text-kumo-subtle">{entry.notes}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {entry.status === 'planned' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-5 w-5"
              title="标记已吃"
              disabled={busy}
              onClick={() => markConsumed.mutate(entry.id)}
            >
              <Check className="h-2.5 w-2.5 text-kumo-success" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-5 w-5"
              title="跳过"
              disabled={busy}
              onClick={() => markSkipped.mutate(entry.id)}
            >
              <SkipForward className="h-2.5 w-2.5 text-kumo-subtle" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="h-5 w-5"
            title="恢复计划"
            disabled={busy}
            onClick={() =>
              api.mealPlan.update(entry.id, { status: 'planned' }).then(() =>
                qc.invalidateQueries({ queryKey: ['meal-plan'] }),
              )
            }
          >
            <ChevronLeft className="h-2.5 w-2.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className="h-5 w-5"
          title="编辑"
          onClick={onEdit}
        >
          <CalendarDays className="h-2.5 w-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className="h-5 w-5"
          title="删除"
          disabled={busy}
          onClick={() => remove.mutate(entry.id)}
        >
          <Trash2 className="h-2.5 w-2.5 text-kumo-danger" />
        </Button>
      </div>
    </div>
  );
};

// ── Cell component ──

type CellProps = {
  entries: MealPlanEntryDto[];
  date: string;
  mealType: MealType;
  recipes: Array<{ id: string; name: string }>;
  onAdd: () => void;
  onEditEntry: (entry: MealPlanEntryDto) => void;
};

const PlanCell = ({ entries, onAdd, onEditEntry }: CellProps) => {
  if (entries.length === 0) {
    return (
      <button
        onClick={onAdd}
        className="flex h-full min-h-[80px] w-full items-center justify-center rounded-md border border-dashed border-kumo-line/60 text-kumo-subtle transition-colors hover:border-kumo-brand/40 hover:bg-kumo-tint/50"
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-[80px] flex-col gap-1">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} onEdit={() => onEditEntry(entry)} />
      ))}
      <button
        onClick={onAdd}
        className="flex items-center justify-center gap-1 rounded border border-dashed border-kumo-line/40 py-0.5 text-[10px] text-kumo-subtle transition-colors hover:border-kumo-brand/40 hover:text-kumo-brand"
      >
        <Plus className="h-3 w-3" />
        添加
      </button>
    </div>
  );
};

// ── Main page ──

const Plan = () => {
  const [monday, setMonday] = useState(() => getMonday(new Date()));
  const sunday = useMemo(() => addDays(monday, 6), [monday]);

  const startIso = toIso(monday);
  const endIso = toIso(sunday);

  const entries = useQuery({
    queryKey: ['meal-plan', startIso, endIso],
    queryFn: () => api.mealPlan.list({ start: startIso, end: endIso }),
  });

  const recipes = useQuery({
    queryKey: ['recipes', 'list'],
    queryFn: () => api.recipes.list({ limit: 100 }),
  });

  const recipeOptions = useMemo(
    () => (recipes.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [recipes.data],
  );

  const entryMap = useMemo(() => {
    const map = new Map<string, MealPlanEntryDto[]>();
    for (const e of entries.data ?? []) {
      const key = `${e.date}_${e.meal_type}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [entries.data]);

  const [dialog, setDialog] = useState<{
    date: string;
    mealType: MealType;
    entry?: MealPlanEntryDto;
  } | null>(null);

  const goWeek = useCallback((offset: number) => {
    setMonday((prev) => addDays(prev, offset * 7));
  }, []);

  const goToday = useCallback(() => {
    setMonday(getMonday(new Date()));
  }, []);

  const isCurrentWeek = toIso(getMonday(new Date())) === startIso;

  const weekLabel = `${fmtDate(startIso, 'MM/dd')} - ${fmtDate(endIso, 'MM/dd')}`;

  return (
    <>
      <PageHeader
        title="计划"
        description="安排一周的餐食，追踪执行情况。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!isCurrentWeek ? (
              <Button variant="outline" size="sm" onClick={goToday}>
                本周
              </Button>
            ) : null}
            <span className="min-w-[120px] text-center text-sm font-medium tabular-nums">
              {weekLabel}
            </span>
            <Button variant="outline" size="sm" onClick={() => goWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {entries.isLoading ? (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-kumo-line">
                    <th className="sticky left-0 z-10 w-16 bg-kumo-canvas px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-kumo-subtle">
                      餐次
                    </th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = addDays(monday, i);
                      const iso = toIso(d);
                      const isToday = iso === toIso(new Date());
                      return (
                        <th
                          key={iso}
                          className={cn(
                            'px-2 py-2 text-center text-xs font-medium',
                            isToday ? 'text-kumo-brand' : 'text-kumo-subtle',
                          )}
                        >
                          <div>{DAY_NAMES[i]}</div>
                          <div className="tabular-nums">{fmtDate(iso, 'M/d')}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((mt) => (
                    <tr key={mt} className="border-b border-kumo-line/50 last:border-0">
                      <td className="sticky left-0 z-10 bg-kumo-canvas px-3 py-3 text-xs font-medium text-kumo-subtle">
                        {MEAL_LABEL[mt]}
                      </td>
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = addDays(monday, i);
                        const iso = toIso(d);
                        const key = `${iso}_${mt}`;
                        const cellEntries = entryMap.get(key) ?? [];
                        return (
                          <td key={iso} className="px-1.5 py-1.5 align-top">
                            <PlanCell
                              entries={cellEntries}
                              date={iso}
                              mealType={mt}
                              recipes={recipeOptions}
                              onAdd={() =>
                                setDialog({ date: iso, mealType: mt })
                              }
                              onEditEntry={(entry) =>
                                setDialog({ date: iso, mealType: mt, entry })
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {entries.data ? (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-kumo-subtle">
          <span>
            计划:{' '}
            <span className="font-medium text-kumo-default">
              {(entries.data ?? []).filter((e) => e.status === 'planned').length}
            </span>
          </span>
          <span>
            已执行:{' '}
            <span className="font-medium text-kumo-success">
              {(entries.data ?? []).filter((e) => e.status === 'consumed').length}
            </span>
          </span>
          <span>
            已跳过:{' '}
            <span className="font-medium text-kumo-subtle">
              {(entries.data ?? []).filter((e) => e.status === 'skipped').length}
            </span>
          </span>
        </div>
      ) : null}

      {/* Dialog */}
      {dialog ? (
        <PlanDialog
          date={dialog.date}
          mealType={dialog.mealType}
          entry={dialog.entry}
          recipes={recipeOptions}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
};

export const Route = createFileRoute('/plan')({ component: Plan });
