import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionLabel } from '@/components/ui/section-label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtNum } from '@/lib/format';
import { InputGroup } from '@cloudflare/kumo';
import type { GoalBound, GoalsDto } from '@health-mcp/shared/dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Droplets, Flame, Salad, Scale } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';

type MacroKey =
  | 'kcal'
  | 'protein_g'
  | 'carb_g'
  | 'fat_g'
  | 'fiber_g'
  | 'sugar_g'
  | 'sat_fat_g'
  | 'sodium_mg'
  | 'hydration_ml';

type Shape = 'range' | 'floor' | 'cap';

type MacroField = {
  key: MacroKey;
  label: string;
  unit: string;
  shape: Shape;
  hint?: string;
};

type MacroSection = {
  title: string;
  icon: LucideIcon;
  fields: MacroField[];
};

const SECTIONS: MacroSection[] = [
  {
    title: '能量',
    icon: Flame,
    fields: [{ key: 'kcal', label: '热量', unit: 'kcal', shape: 'range' }],
  },
  {
    title: '宏量营养素',
    icon: Salad,
    fields: [
      { key: 'protein_g', label: '蛋白质', unit: 'g', shape: 'floor' },
      { key: 'carb_g', label: '碳水', unit: 'g', shape: 'range' },
      { key: 'fat_g', label: '脂肪', unit: 'g', shape: 'range' },
      {
        key: 'sat_fat_g',
        label: '饱和脂肪',
        unit: 'g',
        shape: 'cap',
        hint: 'AHA 建议 2000 kcal 饮食不超过 13 克。',
      },
      { key: 'fiber_g', label: '纤维', unit: 'g', shape: 'floor' },
      { key: 'sugar_g', label: '糖', unit: 'g', shape: 'cap' },
      {
        key: 'sodium_mg',
        label: '钠',
        unit: 'mg',
        shape: 'cap',
        hint: 'FDA 每日上限为 2300 毫克。',
      },
    ],
  },
  {
    title: '水分补充',
    icon: Droplets,
    fields: [{ key: 'hydration_ml', label: '水', unit: 'ml', shape: 'floor' }],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

type CellKey = `${MacroKey}_min` | `${MacroKey}_max` | 'weight_kg_target';
type FormState = Record<CellKey, string>;
type GoalsInput = Partial<Omit<GoalsDto, 'updated_at'>>;

const numToStr = (n: number | null): string => (n == null ? '' : String(n));

const initialState = (): FormState => {
  const next = {} as FormState;
  for (const f of ALL_FIELDS) {
    next[`${f.key}_min`] = '';
    next[`${f.key}_max`] = '';
  }
  next.weight_kg_target = '';
  return next;
};

const fromGoals = (g: GoalsDto): FormState => {
  const next = initialState();
  for (const f of ALL_FIELDS) {
    next[`${f.key}_min`] = numToStr(g[f.key].min);
    next[`${f.key}_max`] = numToStr(g[f.key].max);
  }
  next.weight_kg_target = numToStr(g.weight_kg_target);
  return next;
};

const parseCell = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const isFormDirty = (form: FormState, server: GoalsDto | undefined): boolean => {
  if (!server) return false;
  for (const f of ALL_FIELDS) {
    if (form[`${f.key}_min`].trim() !== numToStr(server[f.key].min)) return true;
    if (form[`${f.key}_max`].trim() !== numToStr(server[f.key].max)) return true;
  }
  return form.weight_kg_target.trim() !== numToStr(server.weight_kg_target);
};

const formatBound = (b: GoalBound, unit: string): string | null => {
  if (b.min != null && b.max != null) {
    if (b.min === b.max) return `${fmtNum(b.min)} ${unit}`;
    return `${fmtNum(b.min)}–${fmtNum(b.max)} ${unit}`;
  }
  if (b.min != null) return `min ${fmtNum(b.min)} ${unit}`;
  if (b.max != null) return `max ${fmtNum(b.max)} ${unit}`;
  return null;
};

const Goals = () => {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api.goals.get() });
  const [form, setForm] = useState<FormState>(initialState);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (goals.data) setForm(fromGoals(goals.data));
  }, [goals.data]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const save = useMutation({
    mutationFn: api.goals.set,
    onSuccess: () => {
      qc.invalidateQueries();
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 2200);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: GoalsInput = { weight_kg_target: parseCell(form.weight_kg_target) };
    for (const f of ALL_FIELDS) {
      body[f.key] = {
        min: parseCell(form[`${f.key}_min`]),
        max: parseCell(form[`${f.key}_max`]),
      };
    }
    save.mutate(body);
  };

  if (goals.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const setCell = (key: CellKey, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const dirty = isFormDirty(form, goals.data);
  const errorMessage = save.isError ? (save.error as Error).message : null;

  return (
    <>
      <PageHeader
        title="目标"
        description="每日目标 — 为每种宏量营养素设置下限、上限或两者。留空则清除。"
      />

      <Card className="t-panel-reveal">
        <form id="goals-form" onSubmit={submit}>
          <CardContent className="px-0 pb-0 pt-0 [&>section+section]:border-t [&>section+section]:border-kumo-line">
            {SECTIONS.map((section) => (
              <Section
                key={section.title}
                section={section}
                form={form}
                server={goals.data}
                onChange={setCell}
              />
            ))}

            <section>
              <SectionLabel icon={Scale} className="px-5 pb-3 pt-5">
                身体
              </SectionLabel>
              <FieldRow
                label="体重目标"
                unit="kg"
                previewBound={
                  goals.data?.weight_kg_target != null
                    ? `${fmtNum(goals.data.weight_kg_target, 1)} kg`
                    : null
                }
              >
                <SingleInput
                  id="weight_kg_target"
                  ariaLabel="体重目标（千克）"
                  step="0.1"
                  endAddon="kg"
                  value={form.weight_kg_target}
                  onChange={(v) => setCell('weight_kg_target', v)}
                />
              </FieldRow>
            </section>
          </CardContent>

          <SaveBar dirty={dirty} pending={save.isPending} saved={savedFlash} error={errorMessage} />
        </form>
      </Card>
    </>
  );
};

const Section = ({
  section,
  form,
  server,
  onChange,
}: {
  section: MacroSection;
  form: FormState;
  server: GoalsDto | undefined;
  onChange: (key: CellKey, value: string) => void;
}) => (
  <section>
    <SectionLabel icon={section.icon} className="px-5 pb-3 pt-5">
      {section.title}
    </SectionLabel>
    <div className="divide-y divide-kumo-line/60">
      {section.fields.map((field) => (
        <FieldRow
          key={field.key}
          label={field.label}
          unit={`${field.unit} / 天`}
          hint={field.hint}
          previewBound={server ? formatBound(server[field.key], field.unit) : null}
        >
          <BoundedInputs
            field={field}
            minValue={form[`${field.key}_min`]}
            maxValue={form[`${field.key}_max`]}
            onChange={onChange}
          />
        </FieldRow>
      ))}
    </div>
  </section>
);

const FieldRow = ({
  label,
  unit,
  hint,
  previewBound,
  children,
}: {
  label: string;
  unit: string;
  hint?: string;
  previewBound?: string | null;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-1 items-start gap-3 px-5 py-4 sm:grid-cols-[1fr_260px] sm:items-center">
    <div className="min-w-0">
      <div className="text-sm font-medium text-kumo-strong">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2 text-xs">
        <span className="font-mono tabular-nums text-kumo-subtle" translate="no">
          {unit}
        </span>
        {previewBound ? (
          <>
            <span aria-hidden="true" className="text-kumo-subtle">
              ·
            </span>
            <span
              className="tabular-nums text-kumo-default"
              aria-label={`Current goal ${previewBound}`}
            >
              {previewBound}
            </span>
          </>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] text-kumo-subtle">{hint}</p> : null}
    </div>
    <div className="grid grid-cols-2 gap-2">{children}</div>
  </div>
);

const BoundedInputs = ({
  field,
  minValue,
  maxValue,
  onChange,
}: {
  field: MacroField;
  minValue: string;
  maxValue: string;
  onChange: (key: CellKey, value: string) => void;
}) => {
  const showMin = field.shape !== 'cap';
  const showMax = field.shape !== 'floor';
  return (
    <>
      {showMin ? (
        <BoundInput
          id={`${field.key}_min`}
          ariaLabel={`${field.label} 最小值（${field.unit}）`}
          addon="min"
          value={minValue}
          onChange={(v) => onChange(`${field.key}_min`, v)}
        />
      ) : (
        <EmptySlot label={`${field.label} 无最小值`} />
      )}
      {showMax ? (
        <BoundInput
          id={`${field.key}_max`}
          ariaLabel={`${field.label} 最大值（${field.unit}）`}
          addon="max"
          value={maxValue}
          onChange={(v) => onChange(`${field.key}_max`, v)}
        />
      ) : (
        <EmptySlot label={`${field.label} 无最大值`} />
      )}
    </>
  );
};

const BoundInput = ({
  id,
  ariaLabel,
  addon,
  value,
  onChange,
}: {
  id: string;
  ariaLabel: string;
  addon: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <InputGroup>
    <InputGroup.Addon>{addon}</InputGroup.Addon>
    <InputGroup.Input
      id={id}
      aria-label={ariaLabel}
      type="number"
      inputMode="decimal"
      min={0}
      placeholder="—"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </InputGroup>
);

const EmptySlot = ({ label }: { label: string }) => (
  <div
    className="grid h-9 place-items-center rounded-md border border-dashed border-kumo-line/70 text-kumo-subtle/50"
    aria-label={label}
    role="note"
  >
    <span aria-hidden="true" className="text-sm leading-none">
      —
    </span>
  </div>
);

const SingleInput = ({
  id,
  ariaLabel,
  step,
  endAddon,
  value,
  onChange,
}: {
  id: string;
  ariaLabel: string;
  step?: string;
  endAddon: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="col-span-2">
    <InputGroup>
      <InputGroup.Input
        id={id}
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <InputGroup.Addon align="end">{endAddon}</InputGroup.Addon>
    </InputGroup>
  </div>
);

const SaveBar = ({
  dirty,
  pending,
  saved,
  error,
}: {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  error: string | null;
}) => (
  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-kumo-line bg-kumo-base/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-kumo-base/80">
    <output className="min-w-0 truncate text-xs text-kumo-subtle" aria-live="polite">
      {error ? (
        <span className="text-kumo-danger">{error}</span>
      ) : pending ? (
        '保存中…'
      ) : saved ? (
        <span className="text-kumo-success">目标已更新。</span>
      ) : dirty ? (
        '有未保存的更改。'
      ) : (
        ' '
      )}
    </output>
    <Button
      type="submit"
      form="goals-form"
      disabled={pending || (!dirty && !saved)}
      className={cn('transition-transform motion-reduce:transition-none', saved && 'scale-[1.02]')}
    >
      <span className="inline-flex items-center gap-2">
        {saved ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>已保存</span>
          </>
        ) : pending ? (
          <span>保存中…</span>
        ) : (
          <span>保存目标</span>
        )}
      </span>
    </Button>
  </div>
);

export const Route = createFileRoute('/goals')({ component: Goals });
