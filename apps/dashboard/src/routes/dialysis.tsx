import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/dialysis')({
  component: DialysisPage,
});

const MODALITY_LABEL: Record<string, string> = {
  hemodialysis: '血液透析',
  peritoneal: '腹膜透析',
  hdf: '血液滤过',
  hf: '血液滤过',
  online_hdf: '在线 HDF',
};

const ACCESS_LABEL: Record<string, string> = {
  avf: '动静脉瘘',
  avg: '移植物',
  cvc: '中心静脉导管',
  pd_catheter: '腹透管',
  other: '其他',
};

function DialysisPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rangeDays, setRangeDays] = useState<'all' | 7 | 30>('all');
  const [form, setForm] = useState({
    modality: 'hemodialysis',
    duration_min: '',
    pre_weight_kg: '',
    post_weight_kg: '',
    dry_weight_kg: '',
    ultrafiltration_ml: '',
    access_type: '',
    notes: '',
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['dialysis'],
    queryFn: () => api.dialysis.list({ limit: 500 }),
  });

  // Filter entries by range
  const entries = allEntries.filter((e) => {
    if (rangeDays === 'all') return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return new Date(e.ts) >= cutoff;
  });

  const log = useMutation({
    mutationFn: () =>
      api.dialysis.log({
        modality: form.modality,
        duration_min: form.duration_min ? Number(form.duration_min) : undefined,
        pre_weight_kg: form.pre_weight_kg ? Number(form.pre_weight_kg) : undefined,
        post_weight_kg: form.post_weight_kg ? Number(form.post_weight_kg) : undefined,
        dry_weight_kg: form.dry_weight_kg ? Number(form.dry_weight_kg) : undefined,
        ultrafiltration_ml: form.ultrafiltration_ml ? Number(form.ultrafiltration_ml) : undefined,
        access_type: form.access_type || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dialysis'] });
      setShowForm(false);
      setForm({ modality: 'hemodialysis', duration_min: '', pre_weight_kg: '', post_weight_kg: '', dry_weight_kg: '', ultrafiltration_ml: '', access_type: '', notes: '' });
    },
  });

  // Chart data — reverse chronological for left-to-right time axis
  const chartData = [...entries].reverse().map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd'),
    透前体重: e.pre_weight_kg,
    透后体重: e.post_weight_kg,
    干体重: e.dry_weight_kg,
    超滤量: e.ultrafiltration_ml,
  }));

  // Modality distribution
  const modalityCounts: Record<string, number> = {};
  for (const e of entries) {
    modalityCounts[e.modality] = (modalityCounts[e.modality] ?? 0) + 1;
  }

  const hasWeights = chartData.some((d) => d.透前体重 != null);

  return (
    <div>
      <PageHeader
        title="透析"
        description="记录透析治疗、血管通路和超滤数据"
        actions={
          <div className="flex items-center gap-2">
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
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? '取消' : '记录透析'}
            </Button>
          </div>
        }
      />

      {showForm && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-kumo-strong">新透析记录</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">透析方式</label>
              <select
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm"
              >
                <option value="hemodialysis">血液透析</option>
                <option value="peritoneal">腹膜透析</option>
                <option value="hdf">HDF</option>
                <option value="online_hdf">在线 HDF</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">时长 (分钟)</label>
              <input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="240" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">血管通路</label>
              <select value={form.access_type} onChange={(e) => setForm({ ...form, access_type: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm">
                <option value="">未选择</option>
                <option value="avf">动静脉瘘</option>
                <option value="avg">移植物</option>
                <option value="cvc">中心静脉导管</option>
                <option value="pd_catheter">腹透管</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">透前体重 (kg)</label>
              <input type="number" step="0.1" value={form.pre_weight_kg} onChange={(e) => setForm({ ...form, pre_weight_kg: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">透后体重 (kg)</label>
              <input type="number" step="0.1" value={form.post_weight_kg} onChange={(e) => setForm({ ...form, post_weight_kg: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">超滤量 (mL)</label>
              <input type="number" value={form.ultrafiltration_ml} onChange={(e) => setForm({ ...form, ultrafiltration_ml: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => log.mutate()} disabled={log.isPending}>
              {log.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      )}

      {/* Charts */}
      {entries.length > 0 && (
        <>
          {/* Modality stats */}
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(modalityCounts).map(([mod, count]) => (
              <span key={mod} className="rounded bg-kumo-brand/10 px-2.5 py-1 text-xs font-medium text-kumo-brand">
                {MODALITY_LABEL[mod] ?? mod}: {count} 次
              </span>
            ))}
          </div>

          {/* Weight / UF trend chart */}
          {hasWeights && chartData.length > 1 && (
            <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
              <h3 className="mb-3 text-sm font-semibold text-kumo-strong">体重与超滤趋势</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-kumo-line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" label={{ value: 'kg', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="var(--color-kumo-subtle)" label={{ value: 'mL', angle: 90, position: 'insideRight', fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="透前体重" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="透后体重" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="干体重" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Bar yAxisId="right" dataKey="超滤量" fill="#8b5cf6" opacity={0.5} radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <div className="rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">透析记录</h3>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无透析记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded bg-kumo-brand/10 px-2 py-0.5 text-xs font-medium text-kumo-brand">
                      {MODALITY_LABEL[e.modality] ?? e.modality}
                    </span>
                    {e.duration_min && (
                      <span className="text-xs text-kumo-subtle">{e.duration_min} 分钟</span>
                    )}
                    {e.access_type && (
                      <span className="text-xs text-kumo-subtle">{ACCESS_LABEL[e.access_type] ?? e.access_type}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-kumo-subtle">{format(parseISO(e.ts), 'yyyy-MM-dd HH:mm')}</span>
                    <Button variant="ghost" size="sm" onClick={() => { api.dialysis.delete(e.id).then(() => qc.invalidateQueries({ queryKey: ['dialysis'] })); }}>删除</Button>
                  </div>
                </div>
                {(e.pre_weight_kg || e.ultrafiltration_ml) && (
                  <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-kumo-subtle">
                    {e.pre_weight_kg && <span>透前: {e.pre_weight_kg} kg</span>}
                    {e.post_weight_kg && <span>透后: {e.post_weight_kg} kg</span>}
                    {e.dry_weight_kg && <span>干体重: {e.dry_weight_kg} kg</span>}
                    {e.ultrafiltration_ml && <span>超滤: {e.ultrafiltration_ml} mL</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
