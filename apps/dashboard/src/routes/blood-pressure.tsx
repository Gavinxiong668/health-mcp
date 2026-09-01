import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Legend } from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/blood-pressure')({
  component: BloodPressurePage,
});

function BloodPressurePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ systolic: '', diastolic: '', pulse: '', notes: '' });
  const [rangeDays, setRangeDays] = useState<'all' | 7 | 30>('all');

  const { data: allEntries = [] } = useQuery({
    queryKey: ['blood-pressure'],
    queryFn: () => api.bloodPressure.list({ limit: 500 }),
  });

  const entries = allEntries.filter((e) => {
    if (rangeDays === 'all') return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return new Date(e.ts) >= cutoff;
  });

  const log = useMutation({
    mutationFn: () =>
      api.bloodPressure.log({
        systolic: Number(form.systolic),
        diastolic: Number(form.diastolic),
        pulse: form.pulse ? Number(form.pulse) : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blood-pressure'] });
      setForm({ systolic: '', diastolic: '', pulse: '', notes: '' });
    },
  });

  const chartData = [...entries]
    .reverse()
    .map((e) => ({
      date: format(parseISO(e.ts), 'MM/dd HH:mm'),
      收缩压: e.systolic,
      舒张压: e.diastolic,
      脉搏: e.pulse,
    }));

  // Stats
  const avgSystolic = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.systolic, 0) / entries.length) : null;
  const avgDiastolic = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.diastolic, 0) / entries.length) : null;
  const pulseEntries = entries.filter((e) => e.pulse != null);
  const avgPulse = pulseEntries.length > 0 ? Math.round(pulseEntries.reduce((s, e) => s + (e.pulse ?? 0), 0) / pulseEntries.length) : null;

  return (
    <div>
      <PageHeader title="血压" description="记录并追踪血压读数" />

      <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-kumo-strong">记录血压</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">收缩压 (mmHg)</label>
            <input
              type="number"
              value={form.systolic}
              onChange={(e) => setForm({ ...form, systolic: e.target.value })}
              className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm"
              placeholder="120"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">舒张压 (mmHg)</label>
            <input
              type="number"
              value={form.diastolic}
              onChange={(e) => setForm({ ...form, diastolic: e.target.value })}
              className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm"
              placeholder="80"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">脉搏 (bpm)</label>
            <input
              type="number"
              value={form.pulse}
              onChange={(e) => setForm({ ...form, pulse: e.target.value })}
              className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm"
              placeholder="72"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => log.mutate()}
              disabled={!form.systolic || !form.diastolic || log.isPending}
            >
              {log.isPending ? '记录中...' : '记录'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats + range selector */}
      {entries.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {avgSystolic != null && (
              <span className="text-kumo-subtle">
                平均 <b className="text-red-500">{avgSystolic}</b>/<b className="text-blue-500">{avgDiastolic}</b> mmHg
              </span>
            )}
            {avgPulse != null && <span className="text-kumo-subtle">平均脉搏 <b className="text-green-600">{avgPulse}</b> bpm</span>}
            <span className="text-kumo-subtle">共 {entries.length} 条记录</span>
          </div>
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

      {chartData.length > 1 && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-kumo-strong">趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-kumo-line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId={0} y={120} stroke="#ef4444" strokeOpacity={0.3} strokeDasharray="4 4" label={{ value: '120', fontSize: 10, fill: '#ef4444' }} />
              <ReferenceLine yAxisId={0} y={80} stroke="#3b82f6" strokeOpacity={0.3} strokeDasharray="4 4" label={{ value: '80', fontSize: 10, fill: '#3b82f6' }} />
              <Line type="monotone" dataKey="收缩压" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="舒张压" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="脉搏" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">历史记录</h3>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无血压记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-medium text-kumo-strong">
                    {e.systolic}/{e.diastolic}
                  </span>
                  {e.pulse && (
                    <span className="text-xs text-kumo-subtle">{e.pulse} bpm</span>
                  )}
                  {e.position && (
                    <span className="rounded bg-kumo-fill px-1.5 py-0.5 text-xs text-kumo-subtle">
                      {e.position === 'sitting' ? '坐位' : e.position === 'standing' ? '站立' : '卧位'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-kumo-subtle">
                    {format(parseISO(e.ts), 'MM/dd HH:mm')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      api.bloodPressure.delete(e.id).then(() =>
                        qc.invalidateQueries({ queryKey: ['blood-pressure'] }),
                      );
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
