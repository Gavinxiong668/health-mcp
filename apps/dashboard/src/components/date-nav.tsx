import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/format';
import { DatePicker, Popover } from '@cloudflare/kumo';
import { format, parseISO } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const isoToDate = (iso: string): Date => parseISO(iso);
const dateToIso = (date: Date): string => format(date, 'yyyy-MM-dd');

const shiftIso = (iso: string, days: number): string => {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
};

const friendlyLabel = (iso: string): string => {
  const today = todayIso();
  if (iso === today) return '今天';
  if (iso === shiftIso(today, -1)) return '昨天';
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return format(parseISO(iso), sameYear ? 'EEE, MMM d' : 'MMM d, yyyy');
};

export const DateNav = ({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const atToday = date >= today;
  const selected = isoToDate(date);
  const label = friendlyLabel(date);

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-kumo-base p-0.5 ring-1 ring-inset ring-kumo-line">
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        aria-label="前一天"
        onClick={() => onChange(shiftIso(date, -1))}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          render={(triggerProps) => (
            <button
              {...(triggerProps as Record<string, unknown>)}
              type="button"
              aria-label={`更改日期，已选择 ${label}`}
              className="inline-flex h-8 min-w-[7.5rem] cursor-pointer items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium tabular-nums text-kumo-strong transition-colors hover:bg-kumo-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-kumo-subtle" aria-hidden="true" />
              <span>{label}</span>
            </button>
          )}
        />
        <Popover.Content className="w-auto p-2">
          <Popover.Title className="sr-only">选择日期</Popover.Title>
          <DatePicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={{ after: isoToDate(today) }}
            onChange={(picked) => {
              if (picked) onChange(dateToIso(picked));
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        shape="square"
        aria-label="后一天"
        disabled={atToday}
        className={cn(
          'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          atToday && 'pointer-events-none scale-90 opacity-0',
        )}
        onClick={() => onChange(shiftIso(date, 1))}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
};
