import { AnimatedNumber } from '@/components/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum } from '@/lib/format';
import { MACRO_META } from '@/lib/macros';
import { Checkbox } from '@cloudflare/kumo';
import { MAX_TRACKED_MACROS, TRACKABLE_MACROS, type TrackableMacro } from '@health-mcp/shared';
import type { GoalBound } from '@health-mcp/shared/dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { type ReactElement, useEffect, useState } from 'react';

type TriggerProps = Record<string, unknown>;

const formatTarget = (b: GoalBound, unit: string): string | null => {
  if (b.min != null && b.max != null) {
    return b.min === b.max
      ? `${fmtNum(b.min)} ${unit}`
      : `${fmtNum(b.min)}–${fmtNum(b.max)} ${unit}`;
  }
  if (b.min != null) return `≥ ${fmtNum(b.min)} ${unit}`;
  if (b.max != null) return `≤ ${fmtNum(b.max)} ${unit}`;
  return null;
};

const sameSelection = (a: TrackableMacro[], b: TrackableMacro[]): boolean =>
  a.length === b.length && a.every((k, i) => k === b[i]);

const ColorDot = ({ color }: { color: string }) => (
  <span
    className="h-2.5 w-2.5 shrink-0 rounded-full"
    style={{ background: color }}
    aria-hidden="true"
  />
);

export const EditRingsDialog = ({
  renderTrigger,
}: {
  renderTrigger: (props: TriggerProps) => ReactElement;
}) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api.goals.get(), enabled: open });
  const [selected, setSelected] = useState<TrackableMacro[]>([]);

  useEffect(() => {
    if (open && goals.data) setSelected(goals.data.tracked_macros);
  }, [open, goals.data]);

  const save = useMutation({
    mutationFn: (tracked: TrackableMacro[]) => api.goals.set({ tracked_macros: tracked }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
    },
  });

  const atMax = selected.length >= MAX_TRACKED_MACROS;
  const dirty = goals.data ? !sameSelection(selected, goals.data.tracked_macros) : false;

  const toggle = (key: TrackableMacro, checked: boolean) => {
    setSelected((prev) => {
      if (!checked) return prev.filter((k) => k !== key);
      if (prev.includes(key) || prev.length >= MAX_TRACKED_MACROS) return prev;
      return [...prev, key];
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(p) => renderTrigger(p as TriggerProps)} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-kumo-brand" aria-hidden="true" />
            编辑环形图
          </DialogTitle>
          <DialogDescription>
            选择最多 {MAX_TRACKED_MACROS} 个宏量营养素在今日跟踪。热量始终显示。
          </DialogDescription>
        </DialogHeader>

        {goals.isLoading || !goals.data ? (
          <div className="grid place-items-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 rounded-md px-2 py-2.5">
              <Checkbox
                checked
                disabled
                label={
                  <span className="flex items-center gap-2">
                    <ColorDot color={MACRO_META.kcal.color} />
                    <span className="text-kumo-strong">热量</span>
                  </span>
                }
              />
              <Badge variant="muted" className="ml-auto">
                始终
              </Badge>
            </div>

            {TRACKABLE_MACROS.map((key) => {
              const checked = selected.includes(key);
              const disabled = !checked && atMax;
              const meta = MACRO_META[key];
              const target = goals.data ? formatTarget(goals.data[key], meta.unit) : null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-md px-2 py-2.5 transition-colors hover:bg-kumo-elevated"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(key, c)}
                    label={
                      <span className="flex items-center gap-2">
                        <ColorDot color={meta.color} />
                        <span className="text-kumo-strong">{meta.label}</span>
                        {target ? (
                          <span className="text-xs text-kumo-subtle" translate="no">
                            · {target}
                          </span>
                        ) : (
                          <span className="text-xs text-kumo-subtle/60">· 无目标</span>
                        )}
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <p className="text-kumo-subtle" aria-live="polite">
            <AnimatedNumber
              value={String(selected.length)}
              className="font-medium text-kumo-default"
            />
            {` / ${MAX_TRACKED_MACROS} 个宏量营养素`}
          </p>
          {atMax ? (
            <span className="text-kumo-subtle/80">已达上限 — 取消一个以替换。</span>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(selected)}
          >
            {save.isPending ? '保存中…' : '保存环形图'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
