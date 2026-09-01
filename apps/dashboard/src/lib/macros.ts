import type { TrackableMacro } from '@health-mcp/shared';
import type { GoalBound, GoalStatus } from '@health-mcp/shared/dto';
import { fmtNum } from './format';

export type MacroKey = 'kcal' | TrackableMacro;

export type MacroMeta = {
  label: string;
  unit: string;
  color: string;
};

// Display identity for each macro ring — label, unit suffix, and a stable color.
// kcal is always the hero ring; the rest are the trackable Today rings.
export const MACRO_META: Record<MacroKey, MacroMeta> = {
  kcal: { label: '热量', unit: '', color: 'var(--color-kumo-brand)' },
  protein_g: { label: '蛋白质', unit: 'g', color: 'var(--macro-protein)' },
  carb_g: { label: '碳水', unit: 'g', color: 'var(--macro-carb)' },
  fat_g: { label: '脂肪', unit: 'g', color: 'var(--macro-fat)' },
  fiber_g: { label: '纤维', unit: 'g', color: 'var(--macro-fiber)' },
  sugar_g: { label: '糖', unit: 'g', color: 'var(--macro-sugar)' },
  sat_fat_g: { label: '饱和脂肪', unit: 'g', color: 'var(--macro-sat-fat)' },
  sodium_mg: { label: '钠', unit: 'mg', color: 'var(--macro-sodium)' },
};

// Goal status → accent color. `in_range` and `over` carry meaning; `under`/`no_goal`
// fall back to the macro's own identity color (null here, resolved by macroBarColor).
export const MACRO_STATUS_COLOR: Record<GoalStatus, string | null> = {
  no_goal: null,
  under: null,
  in_range: 'var(--color-kumo-success)',
  over: 'var(--color-kumo-danger)',
};

export const MACRO_STATUS_LABEL: Record<GoalStatus, string> = {
  no_goal: '',
  under: '偏低',
  in_range: '达标',
  over: '超标',
};

export const primaryTarget = (bound: GoalBound): number | null => bound.max ?? bound.min;

export const goalRatio = (current: number, bound: GoalBound): number => {
  const target = primaryTarget(bound);
  if (!target || target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
};

export const macroBarColor = (status: GoalStatus, identity: string): string =>
  MACRO_STATUS_COLOR[status] ?? identity;

export const formatBound = (bound: GoalBound): string | null => {
  if (bound.min !== null && bound.max !== null && bound.min !== bound.max) {
    return `${fmtNum(bound.min, 0)}–${fmtNum(bound.max, 0)}`;
  }
  if (bound.max !== null) return `≤ ${fmtNum(bound.max, 0)}`;
  if (bound.min !== null) return `≥ ${fmtNum(bound.min, 0)}`;
  return null;
};
