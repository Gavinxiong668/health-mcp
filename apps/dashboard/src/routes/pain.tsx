import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/pain')({
  component: PainPage,
});

const PAIN_TYPE_LABEL: Record<string, string> = {
  sharp: '刺痛', dull: '钝痛', aching: '酸痛', burning: '灼痛',
  throbbing: '搏动痛', stabbing: '刀割痛', tingling: '麻刺痛', other: '其他',
};

const scoreColor = (score: number) => {
  if (score <= 3) return '#22c55e';
  if (score <= 6) return '#f59e0b';
  return '#ef4444';
};

function PainPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ score: '5', location: '', type: '', notes: '' });
  const [rangeDays, setRangeDays] = useState<'all' | 7 | 30>('all');

  const { data: allEntries = [] } = useQuery({
    queryKey: ['pain'],
    queryFn: () => api.pain.list({ limit: 500 }),
  });

  const entries = allEntries.filter((e) => {
    if (rangeDays === 'all') return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return new Date(e.ts) >= cutoff;
  });

  const log = useMutation({
    mutationFn: () =>
      api.pain.log({
        score: Number(form.score),
        location: form.location || undefined,
        type: form.type || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pain'] });
      setForm({ score: '5', location: '', type: '', notes: '' });
    },
  });

  const chartData = [...entries].reverse().map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd HH:mm'),
    评分: e.score,
  }));

  // 3-point rolling average
  const rollingAvg = chartData.map((d, i) => {
    if (i === 0 || i === chartData.length - 1) return { ...d, 趋势: null };
    const prev = chartData[i - 1]!.评分;
    const next = chartData[i + 1]!.评分;
    const avg = Math.round(((prev + d.评分 + next) / 3) * 10) / 10;
    return { ...d, 趋势: avg };
  });

  // Pain type distribution
  const typeCounts: Record<string, number> = {};
  for (const e of entries) {
    if (e.type) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }

  const avgScore = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length * 10) / 10
    : null;

  return (
    <div>
      <PageHeader title="疼痛" description="NRS 疼痛评分 (0-10)，追踪疼痛变化趋势" />

      <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-kumo-strong">记录疼痛</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">评分 (0-10)</label>
            <input type="number" min="0" max="10" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">部位</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="腰部" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-kumo-subtle">类型</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm">
              <option value="">未选择</option>
              {Object.entries(PAIN_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => log.mutate()} disabled={!form.score || log.isPending}>
              {log.isPending ? '记录中...' : '记录'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats + range selector */}
      {entries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {avgScore != null && (
              <span className="text-kumo-subtle">
                平均评分 <b style={{ color: scoreColor(avgScore) }}>{avgScore}</b>
              </span>
            )}
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

      {/* Pain type distribution */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <span key={type} className="rounded bg-kumo-fill px-2 py-0.5 text-xs text-kumo-default">
              {PAIN_TYPE_LABEL[type] ?? type}: {count} 次
            </span>
          ))}
        </div>
      )}

      {rollingAvg.length > 1 && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-kumo-strong">趋势</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={rollingAvg}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-kumo-line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="评分" radius={[4, 4, 0, 0]}>
                {rollingAvg.map((d, i) => (
                  <Cell key={i} fill={scoreColor(d.评分)} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="趋势" stroke="#6366f1" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">疼痛记录</h3>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无疼痛记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: scoreColor(e.score) }}>
                    {e.score}
                  </span>
                  <div>
                    {e.location && <span className="text-sm text-kumo-default">{e.location}</span>}
                    {e.type && <span className="ml-2 text-xs text-kumo-subtle">{PAIN_TYPE_LABEL[e.type] ?? e.type}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-kumo-subtle">{format(parseISO(e.ts), 'MM/dd HH:mm')}</span>
                  <Button variant="ghost" size="sm" onClick={() => { api.pain.delete(e.id).then(() => qc.invalidateQueries({ queryKey: ['pain'] })); }}>删除</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
