import { cn } from '@/lib/cn';

export const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

export const RangeToggle = ({
  days,
  onChange,
}: {
  days: number;
  onChange: (n: number) => void;
}) => (
  <div
    className="inline-flex rounded-md border border-kumo-line bg-kumo-elevated p-0.5"
    role="tablist"
    aria-label="日期范围"
  >
    {RANGES.map((r) => {
      const active = days === r.days;
      return (
        <button
          key={r.label}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(r.days)}
          className={cn(
            'inline-flex h-[26px] items-center justify-center rounded px-3 text-xs font-medium transition-colors',
            active
              ? 'bg-kumo-base text-kumo-default shadow-sm ring-1 ring-kumo-line'
              : 'text-kumo-subtle hover:text-kumo-default',
          )}
        >
          {r.label}
        </button>
      );
    })}
  </div>
);
