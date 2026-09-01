import { AnimatedNumber } from '@/components/animated-number';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtNum } from '@/lib/format';
import { MACRO_META, type MacroKey, goalRatio, macroBarColor, primaryTarget } from '@/lib/macros';
import type { DailySummaryDto, GoalBound, GoalStatus } from '@health-mcp/shared/dto';
import { Flame } from 'lucide-react';

type Row = {
  key: MacroKey;
  label: string;
  unit: string;
  value: number;
  bound: GoalBound;
  status: GoalStatus;
  color: string;
};

const rowFor = (key: MacroKey, summary: DailySummaryDto): Row => ({
  key,
  label: MACRO_META[key].label,
  unit: MACRO_META[key].unit,
  value: summary.totals[key] ?? 0,
  bound: summary.goals[key],
  status: summary.delta[key].status,
  color: MACRO_META[key].color,
});

const digitsFor = (key: MacroKey): number =>
  key === 'kcal' || MACRO_META[key].unit === 'mg' ? 0 : 1;

const Bar = ({ ratio, color }: { ratio: number; color: string }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-kumo-fill">
    <div
      className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
      style={{ width: `${ratio * 100}%`, background: color }}
    />
  </div>
);

const MacroCell = ({ row }: { row: Row }) => {
  const target = primaryTarget(row.bound);
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-kumo-subtle">
        {row.label}
      </div>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-lg font-semibold tabular-nums text-kumo-strong">
          <AnimatedNumber value={fmtNum(row.value, digitsFor(row.key))} />
        </span>
        {target != null ? (
          <span className="text-xs font-normal tabular-nums text-kumo-subtle">
            / {fmtNum(target, 0)}
          </span>
        ) : null}
        {row.unit ? (
          <span className="text-[11px] font-normal text-kumo-subtle">{row.unit}</span>
        ) : null}
      </div>
      {target != null ? (
        <Bar ratio={goalRatio(row.value, row.bound)} color={macroBarColor(row.status, row.color)} />
      ) : null}
    </div>
  );
};

export const DailyTotals = ({ summary }: { summary: DailySummaryDto }) => {
  const { totals, goals } = summary;
  const kcal = rowFor('kcal', summary);
  const kcalTarget = primaryTarget(kcal.bound);
  const macros = goals.tracked_macros.map((key) => rowFor(key, summary));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-kumo-brand" aria-hidden="true" />
          每日总计
        </CardTitle>
        <Badge variant="muted">
          {fmtNum(totals.meal_count, 0)} 餐
          {totals.component_count > totals.meal_count ? (
            <span className="text-kumo-subtle"> · {fmtNum(totals.component_count, 0)} 项</span>
          ) : null}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-kumo-strong">
              <AnimatedNumber value={fmtNum(kcal.value, 0)} />
            </span>
            {kcalTarget != null ? (
              <span className="text-base font-medium tabular-nums text-kumo-subtle">
                / {fmtNum(kcalTarget, 0)}
              </span>
            ) : null}
            <span className="text-sm font-medium uppercase tracking-wide text-kumo-subtle">
              kcal
            </span>
          </div>
          {kcalTarget != null ? (
            <Bar
              ratio={goalRatio(kcal.value, kcal.bound)}
              color={macroBarColor(kcal.status, kcal.color)}
            />
          ) : null}
        </div>

        {macros.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {macros.map((row) => (
              <MacroCell key={row.key} row={row} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
