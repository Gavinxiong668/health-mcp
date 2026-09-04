import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtNum } from '@/lib/format';
import type { BatchDto } from '@health-mcp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Archive,
  CalendarDays,
  Check,
  CookingPot,
  Plus,
  Search,
  SkipForward,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

// ── Food search + select for intake recording ──

type FoodHit = {
  id: string;
  name: string;
  category: string | null;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

const FoodSearchSelect = ({
  selected,
  onSelect,
}: {
  selected: FoodHit | null;
  onSelect: (food: FoodHit | null) => void;
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedQuery = useCallback((val: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val), 250);
  }, []);

  const search = useQuery({
    queryKey: ['food-search', query],
    queryFn: () => api.foods.search({ query, limit: 10, source: 'manual' }),
    enabled: query.length >= 1,
    refetchInterval: false,
  });

  const categories = useQuery({
    queryKey: ['foods', 'categories'],
    queryFn: () => api.foods.categories(),
  });

  const [browseCategory, setBrowseCategory] = useState<string | null>(null);
  const browseFoods = useQuery({
    queryKey: ['foods', 'category', browseCategory],
    queryFn: () => api.foods.byCategory(browseCategory!),
    enabled: !!browseCategory,
  });

  const results: FoodHit[] = search.data?.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    kcal_per_100g: f.kcal_per_100g,
    protein_g: f.protein_g,
    carb_g: f.carb_g,
    fat_g: f.fat_g,
  })) ?? [];

  const browseResults: FoodHit[] = browseFoods.data?.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    kcal_per_100g: f.kcal_per_100g,
    protein_g: f.protein_g,
    carb_g: f.carb_g,
    fat_g: f.fat_g,
  })) ?? [];

  const displayResults = query.length >= 1 ? results : browseResults;

  const handleSelect = (food: FoodHit) => {
    onSelect(food);
    setOpen(false);
    setQuery('');
    setBrowseCategory(null);
  };

  return (
    <div className="relative">
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-kumo-subtle"
        >
          <Search className="h-4 w-4" />
        </span>
        <Input
          placeholder="搜索食物…"
          autoComplete="off"
          value={selected ? selected.name : query}
          readOnly={!!selected}
          onChange={(e) => {
            if (!selected) {
              debouncedQuery(e.target.value);
            }
          }}
          onFocus={() => {
            if (selected) {
              onSelect(null);
              setQuery('');
            }
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200);
          }}
          className="pl-9"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-kumo-line bg-kumo-surface shadow-lg">
          {query.length < 1 && (
            <div className="flex flex-wrap gap-1 border-b border-kumo-line p-2">
              {categories.data?.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setBrowseCategory(c.category)}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs transition-colors',
                    browseCategory === c.category
                      ? 'bg-kumo-accent text-white'
                      : 'bg-kumo-surface-hover text-kumo-subtle hover:text-kumo-text',
                  )}
                >
                  {c.category}
                </button>
              ))}
            </div>
          )}

          {query.length >= 1 && search.isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : browseCategory && browseFoods.isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : displayResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-kumo-subtle">
              {query.length >= 1 ? '无匹配结果' : '选择分类浏览'}
            </div>
          ) : (
            <ul>
              {displayResults.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(f)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-kumo-surface-hover"
                  >
                    {f.category ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {f.category}
                      </Badge>
                    ) : null}
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-kumo-subtle">
                      {fmtNum(f.kcal_per_100g, 0)} kcal
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// ── Record Intake Dialog (consistent with PlanDialog style) ──

type IntakeDialogProps = {
  onClose: () => void;
};

const IntakeDialog = ({ onClose }: IntakeDialogProps) => {
  const qc = useQueryClient();
  const [selectedFood, setSelectedFood] = useState<FoodHit | null>(null);
  const [grams, setGrams] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.batches.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      onClose();
    },
  });

  const gramsNum = Number(grams);
  const isValid = selectedFood && gramsNum > 0;

  const estKcal = selectedFood ? (selectedFood.kcal_per_100g * gramsNum) / 100 : 0;
  const estProtein = selectedFood ? (selectedFood.protein_g * gramsNum) / 100 : 0;
  const estCarb = selectedFood ? (selectedFood.carb_g * gramsNum) / 100 : 0;
  const estFat = selectedFood ? (selectedFood.fat_g * gramsNum) / 100 : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !selectedFood) return;
    create.mutate({
      food_id: selectedFood.id,
      total_grams: gramsNum,
      consumed_grams: gramsNum,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">记录饮食</CardTitle>
          <Button variant="ghost" shape="square" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-kumo-subtle">选择食物</label>
              <FoodSearchSelect selected={selectedFood} onSelect={setSelectedFood} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-kumo-subtle">摄入克数</label>
              <Input
                type="number"
                min="1"
                placeholder="例如 150"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </div>

            {/* Macro estimate */}
            {selectedFood && gramsNum > 0 && (
              <div className="rounded-md border border-kumo-line bg-kumo-surface-hover p-3">
                <div className="mb-1 text-xs text-kumo-subtle">
                  预估：{grams}克 {selectedFood.name}
                </div>
                <div className="flex gap-4 text-sm tabular-nums">
                  <span>
                    <span className="font-medium">{fmtNum(estKcal, 0)}</span> kcal
                  </span>
                  <span>
                    P <span className="font-medium">{fmtNum(estProtein, 1)}</span>g
                  </span>
                  <span>
                    C <span className="font-medium">{fmtNum(estCarb, 1)}</span>g
                  </span>
                  <span>
                    F <span className="font-medium">{fmtNum(estFat, 1)}</span>g
                  </span>
                </div>
              </div>
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
              <Button type="submit" disabled={!isValid || create.isPending}>
                {create.isPending ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Batch entry row (consistent with plan EntryRow style) ──

type BatchRowProps = {
  batch: BatchDto;
  onEdit: () => void;
};

const BatchRow = ({ batch, onEdit }: BatchRowProps) => {
  const qc = useQueryClient();
  const isConsumed = batch.remaining_grams <= 0;
  const isArchived = batch.archived === 1;

  const archive = useMutation({
    mutationFn: (id: string) => api.batches.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.batches.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });

  const busy = archive.isPending || remove.isPending;

  const status = isArchived ? 'skipped' : isConsumed ? 'consumed' : 'planned';

  return (
    <div
      className={cn(
        'flex items-start gap-1 rounded border p-1.5 text-sm',
        status === 'consumed' && 'border-kumo-success/30 bg-kumo-success/5',
        status === 'skipped' && 'border-kumo-line/40 bg-kumo-fill/50 opacity-60',
        status === 'planned' && 'border-kumo-line bg-kumo-canvas',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="line-clamp-1 flex-1 text-xs font-medium leading-tight">
            {batch.name ?? '批次'}
          </span>
          <Badge
            variant={status === 'consumed' ? 'ok' : status === 'skipped' ? 'muted' : 'default'}
            className="shrink-0 text-[9px] leading-none"
          >
            {status === 'consumed' ? '已记录' : status === 'skipped' ? '已归档' : '进行中'}
          </Badge>
        </div>
        <div className="flex gap-2 text-[10px] tabular-nums text-kumo-subtle">
          <span>{fmtDate(batch.cooked_at, 'MM/dd HH:mm')}</span>
          <span>
            {fmtNum(batch.total_grams, 0)}g · {fmtNum(batch.kcal_total, 0)}kcal
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {!isArchived && !isConsumed ? (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="h-5 w-5"
            title="标记已吃"
            disabled={busy}
            onClick={() => archive.mutate(batch.id)}
          >
            <Check className="h-2.5 w-2.5 text-kumo-success" />
          </Button>
        ) : null}
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
          onClick={() => remove.mutate(batch.id)}
        >
          <Trash2 className="h-2.5 w-2.5 text-kumo-danger" />
        </Button>
      </div>
    </div>
  );
};

// ── Main Batches page ──

const Batches = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const [dialog, setDialog] = useState(false);

  const list = useQuery({
    queryKey: ['batches', tab],
    queryFn: () => api.batches.list({ active_only: tab === 'active' }),
  });

  return (
    <>
      <PageHeader
        title="批次"
        description="记录日常饮食，追踪摄入情况。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<UtensilsCrossed className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setDialog(true)}
            >
              记录饮食
            </Button>
            <Tabs
              size="sm"
              value={tab}
              onValueChange={(v) => setTab(v as 'active' | 'all')}
              tabs={[
                { value: 'active', label: '进行中' },
                { value: 'all', label: '全部' },
              ]}
            />
          </div>
        }
      />

      {list.isLoading ? (
        <Spinner />
      ) : !list.data?.length ? (
        <Empty
          icon={CookingPot}
          title="暂无批次"
          description="点击「记录饮食」开始记录你的饮食。"
        />
      ) : (
        <Card>
          <CardContent className="space-y-1.5 p-4">
            {list.data.map((b) => (
              <BatchRow key={b.id} batch={b} onEdit={() => {}} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {list.data ? (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-kumo-subtle">
          <span>
            进行中:{' '}
            <span className="font-medium text-kumo-default">
              {list.data.filter((b) => b.remaining_grams > 0 && !b.archived).length}
            </span>
          </span>
          <span>
            已记录:{' '}
            <span className="font-medium text-kumo-success">
              {list.data.filter((b) => b.remaining_grams <= 0).length}
            </span>
          </span>
          <span>
            已归档:{' '}
            <span className="font-medium text-kumo-subtle">
              {list.data.filter((b) => b.archived).length}
            </span>
          </span>
        </div>
      ) : null}

      {/* Dialog */}
      {dialog ? <IntakeDialog onClose={() => setDialog(false)} /> : null}
    </>
  );
};

export const Route = createFileRoute('/batches')({ component: Batches });
