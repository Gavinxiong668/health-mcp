import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { fmtNum, fmtTime } from '@/lib/format';
import type { MealComponentDto, MealDto } from '@health-mcp/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

type Props = {
  meal: MealDto;
  onDeleteMeal?: (id: string) => void;
  onRemoveComponent?: (mealId: string, componentId: string) => void;
  busy?: boolean;
  showConfidence?: boolean;
};

const refKindLabel: Record<MealComponentDto['ref_kind'], string> = {
  food: '食物',
  recipe_serving: '食谱',
  batch: '批次',
  custom: '自定义',
};

const componentLabel = (c: MealComponentDto): string => c.display_name ?? refKindLabel[c.ref_kind];

const titleFor = (meal: MealDto): string => {
  if (meal.name) return meal.name;
  if (meal.components.length === 1) return componentLabel(meal.components[0]!);
  return meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1);
};

const portion = (c: MealComponentDto): string | null => {
  if (c.grams != null) return `${fmtNum(c.grams, 0)} 克`;
  if (c.servings != null) {
    return c.servings === 1 ? '1 份' : `${fmtNum(c.servings, 1)} 份`;
  }
  return null;
};

const Macro = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) => (
  <span className="inline-flex items-baseline gap-1 text-xs tabular-nums">
    <span className={cn('font-semibold', className)}>{label}</span>
    <span className="font-medium text-kumo-default">{fmtNum(value, 1)}</span>
    <span className="text-[11px] text-kumo-subtle">g</span>
  </span>
);

const confidenceTone = (c: number): string => {
  if (c >= 0.85) return 'text-kumo-success';
  if (c >= 0.6) return 'text-kumo-warning';
  return 'text-kumo-danger';
};

type Nutrient = { label: string; value: number; unit: string };

const nutrientsOf = (c: MealComponentDto): Nutrient[] => {
  const all: { label: string; value: number | null; unit: string }[] = [
    { label: '蛋白质', value: c.protein_g, unit: 'g' },
    { label: '碳水', value: c.carb_g, unit: 'g' },
    { label: '脂肪', value: c.fat_g, unit: 'g' },
    { label: '纤维', value: c.fiber_g, unit: 'g' },
    { label: '糖', value: c.sugar_g, unit: 'g' },
    { label: '饱和脂肪', value: c.sat_fat_g, unit: 'g' },
    { label: '钠', value: c.sodium_mg, unit: 'mg' },
  ];
  return all.filter((n): n is Nutrient => n.value != null);
};

const Kcal = ({ value, className }: { value: number; className?: string }) => (
  <span className={cn('shrink-0 whitespace-nowrap tabular-nums text-kumo-strong', className)}>
    {fmtNum(value, 0)}
    <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
      kcal
    </span>
  </span>
);

const ComponentDetail = ({
  component,
  onRemove,
  busy,
  showConfidence,
}: {
  component: MealComponentDto;
  onRemove?: (id: string) => void;
  busy?: boolean;
  showConfidence?: boolean;
}) => {
  const name = componentLabel(component);
  const port = portion(component);
  return (
    <li className="rounded-lg border border-kumo-line bg-kumo-base p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate font-medium text-kumo-default">{name}</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
              {refKindLabel[component.ref_kind]}
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-kumo-subtle">
            {port ? <span>{port}</span> : null}
            {showConfidence ? (
              <span className={confidenceTone(component.confidence)}>
                {fmtNum(component.confidence * 100, 0)}% 置信度
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Kcal value={component.kcal} className="text-base font-semibold" />
          {onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              aria-label={`移除 ${name}`}
              disabled={busy}
              onClick={() => onRemove(component.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-4">
        {nutrientsOf(component).map((n) => (
          <div key={n.label}>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-kumo-subtle">
              {n.label}
            </dt>
            <dd className="text-sm tabular-nums text-kumo-default">
              {fmtNum(n.value, 1)}
              <span className="ml-0.5 text-[10px] text-kumo-subtle">{n.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      {component.notes ? (
        <p className="mt-2 text-xs italic text-kumo-subtle">{component.notes}</p>
      ) : null}
    </li>
  );
};

export const MealCard = ({
  meal,
  onDeleteMeal,
  onRemoveComponent,
  busy,
  showConfidence,
}: Props) => {
  const title = titleFor(meal);
  const single = meal.components.length === 1;
  const hasComponents = meal.components.length > 0;
  const [open, setOpen] = useState(false);

  const summary = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-medium text-kumo-default">{title}</h3>
        <Kcal value={meal.totals.kcal} className="text-base font-semibold" />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Macro label="P" value={meal.totals.protein_g} className="text-kumo-success" />
        <Macro label="C" value={meal.totals.carb_g} className="text-kumo-warning" />
        <Macro label="F" value={meal.totals.fat_g} className="text-kumo-info" />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-kumo-subtle">
        <span className="font-mono tabular-nums">{fmtTime(meal.ts)}</span>
        <span aria-hidden="true">·</span>
        <Badge variant="muted" className="font-normal capitalize">
          {meal.meal_type}
        </Badge>
        {single && meal.components[0]!.grams != null ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{portion(meal.components[0]!)}</span>
          </>
        ) : meal.components.length > 1 ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{meal.components.length} 项</span>
          </>
        ) : null}
        {showConfidence && meal.totals.avg_confidence !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span
              className={cn('tabular-nums', confidenceTone(meal.totals.avg_confidence))}
              title="平均组件置信度 (0–1)"
            >
              {fmtNum(meal.totals.avg_confidence * 100, 0)}% 置信度
            </span>
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <li className="group rounded-md px-2 py-2.5 transition-colors hover:bg-kumo-tint">
      <div className="flex items-start gap-3">
        {hasComponents ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={(p) => (
                <button
                  type="button"
                  {...(p as Record<string, unknown>)}
                  aria-label={`查看 ${title} 的组件`}
                  className="min-w-0 flex-1 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-line"
                >
                  {summary}
                </button>
              )}
            />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-kumo-subtle">
                  <span className="font-mono tabular-nums">{fmtTime(meal.ts)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{meal.meal_type}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {meal.components.length}{' '}
                    {meal.components.length === 1 ? '个组件' : '个组件'}
                  </span>
                </p>
              </DialogHeader>

              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-kumo-tint px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Macro label="P" value={meal.totals.protein_g} className="text-kumo-success" />
                  <Macro label="C" value={meal.totals.carb_g} className="text-kumo-warning" />
                  <Macro label="F" value={meal.totals.fat_g} className="text-kumo-info" />
                </div>
                <Kcal value={meal.totals.kcal} className="text-base font-semibold" />
              </div>

              <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {meal.components.map((c) => (
                  <ComponentDetail
                    key={c.id}
                    component={c}
                    onRemove={
                      onRemoveComponent ? (id) => onRemoveComponent(meal.id, id) : undefined
                    }
                    busy={busy}
                    showConfidence={showConfidence}
                  />
                ))}
              </ul>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                  完成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="min-w-0 flex-1">{summary}</div>
        )}
        {onDeleteMeal ? (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={`删除 ${title}`}
            className="-mr-1 shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
            disabled={busy}
            onClick={() => onDeleteMeal(meal.id)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
};
