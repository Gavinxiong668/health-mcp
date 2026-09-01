import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/diary')({
  component: DiaryPage,
});

const MOOD_LABEL: Record<number, string> = { 1: '很差', 2: '偏差', 3: '一般', 4: '好', 5: '很好' };

function DiaryPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ mood: '', energy: '', sleep_quality: '', appetite: '', notes: '' });
  const [rangeDays, setRangeDays] = useState<'all' | 7 | 30>('all');

  const { data: allEntries = [] } = useQuery({
    queryKey: ['diary'],
    queryFn: () => api.diary.list({ limit: 500 }),
  });

  const entries = allEntries.filter((e) => {
    if (rangeDays === 'all') return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return new Date(e.ts) >= cutoff;
  });

  const log = useMutation({
    mutationFn: () =>
      api.diary.log({
        mood: form.mood ? Number(form.mood) : undefined,
        energy: form.energy ? Number(form.energy) : undefined,
        sleep_quality: form.sleep_quality ? Number(form.sleep_quality) : undefined,
        appetite: form.appetite ? Number(form.appetite) : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary'] });
      setForm({ mood: '', energy: '', sleep_quality: '', appetite: '', notes: '' });
    },
  });

  const chartData = [...entries].reverse().map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd'),
    心情: e.mood,
    精力: e.energy,
    睡眠: e.sleep_quality,
    食欲: e.appetite,
  }));

  const SelectField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="mb-1 block text-xs text-kumo-subtle">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm">
        <option value="">-</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} - {MOOD_LABEL[n]}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <PageHeader title="日记" description="每日心情、精力、睡眠和食欲自评 (1-5)" />

      {/* Range selector */}
      {entries.length > 0 && (
        <div className="mb-4 flex justify-end">
          <div className="flex gap-1 rounded-md border border-kumo-line p-0.5">
            {([7, 30, 'all'] as const).map((d) => (
              <button
                key={String(d)}
                onClick={() => setRangeDays(d)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${rangeDays === d ? 'bg-kumo-brand text-white' : 'text-kumo-subtle hover:text-kumo-default'}`}
              >
                {d === 'all' ? '全部' : `${d}天`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-kumo-strong">今日记录</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SelectField label="心情" value={form.mood} onChange={(v) => setForm({ ...form, mood: v })} />
          <SelectField label="精力" value={form.energy} onChange={(v) => setForm({ ...form, energy: v })} />
          <SelectField label="睡眠质量" value={form.sleep_quality} onChange={(v) => setForm({ ...form, sleep_quality: v })} />
          <SelectField label="食欲" value={form.appetite} onChange={(v) => setForm({ ...form, appetite: v })} />
          <div className="flex items-end">
            <Button onClick={() => log.mutate()} disabled={log.isPending}>
              {log.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-kumo-strong">趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-kumo-line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <Tooltip />
              <Line type="monotone" dataKey="心情" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="精力" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="睡眠" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="食欲" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">日记记录</h3>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无日记记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-3">
                    {e.mood && <span className="text-xs">心情 <b>{MOOD_LABEL[e.mood]}</b></span>}
                    {e.energy && <span className="text-xs">精力 <b>{MOOD_LABEL[e.energy]}</b></span>}
                    {e.sleep_quality && <span className="text-xs">睡眠 <b>{MOOD_LABEL[e.sleep_quality]}</b></span>}
                    {e.appetite && <span className="text-xs">食欲 <b>{MOOD_LABEL[e.appetite]}</b></span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-kumo-subtle">{format(parseISO(e.ts), 'MM/dd HH:mm')}</span>
                    <Button variant="ghost" size="sm" onClick={() => { api.diary.delete(e.id).then(() => qc.invalidateQueries({ queryKey: ['diary'] })); }}>删除</Button>
                  </div>
                </div>
                {e.notes && <p className="mt-1 text-xs text-kumo-subtle">{e.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
