import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/medications')({
  component: MedicationsPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  prescription: '处方药', otc: '非处方药', supplement: '保健品',
  vitamin: '维生素', mineral: '矿物质', herbal: '草药', other: '其他',
};

function MedicationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'prescription', dose_amount: '', dose_unit: '', frequency: '', indication: '', notes: '',
  });

  const { data: meds = [] } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.medications.list(),
  });

  const { data: logEntries = [] } = useQuery({
    queryKey: ['medication-log'],
    queryFn: () => api.medications.log({ limit: 50 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.medications.create({
        name: form.name,
        category: form.category,
        dose_amount: form.dose_amount ? Number(form.dose_amount) : undefined,
        dose_unit: form.dose_unit || undefined,
        frequency: form.frequency || undefined,
        indication: form.indication || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      setShowForm(false);
      setForm({ name: '', category: 'prescription', dose_amount: '', dose_unit: '', frequency: '', indication: '', notes: '' });
    },
  });

  return (
    <div>
      <PageHeader
        title="用药"
        description="管理药物和补剂，追踪服药记录"
        actions={<Button onClick={() => setShowForm(!showForm)}>{showForm ? '取消' : '添加药物'}</Button>}
      />

      {showForm && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-kumo-strong">新增药物</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">名称</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="药物名称" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">类别</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">剂量</label>
              <div className="flex gap-2">
                <input type="number" value={form.dose_amount} onChange={(e) => setForm({ ...form, dose_amount: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="500" />
                <input type="text" value={form.dose_unit} onChange={(e) => setForm({ ...form, dose_unit: e.target.value })} className="w-20 rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="mg" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">频次</label>
              <input type="text" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="每日两次" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-kumo-subtle">用途</label>
              <input type="text" value={form.indication} onChange={(e) => setForm({ ...form, indication: e.target.value })} className="w-full rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 text-sm" placeholder="降磷" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                {create.isPending ? '添加中...' : '添加'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">当前用药</h3>
        </div>
        {meds.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无药物记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {meds.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-kumo-strong">{m.name}</span>
                    {m.category && (
                      <span className="rounded bg-kumo-fill px-1.5 py-0.5 text-xs text-kumo-subtle">
                        {CATEGORY_LABEL[m.category] ?? m.category}
                      </span>
                    )}
                    {!m.active && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">已停用</span>}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-kumo-subtle">
                    {m.dose_amount && <span>{m.dose_amount} {m.dose_unit ?? ''}</span>}
                    {m.frequency && <span>{m.frequency}</span>}
                    {m.indication && <span>{m.indication}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { api.medications.logDose(m.id, {}).then(() => qc.invalidateQueries({ queryKey: ['medication-log'] })); }}>服药</Button>
                  <Button variant="ghost" size="sm" onClick={() => { api.medications.delete(m.id).then(() => qc.invalidateQueries({ queryKey: ['medications'] })); }}>删除</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-kumo-line bg-kumo-surface">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-kumo-strong">服药日志</h3>
        </div>
        {logEntries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-kumo-subtle">暂无服药记录</p>
        ) : (
          <div className="divide-y divide-kumo-line">
            {logEntries.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-kumo-default">{format(parseISO(l.ts), 'MM/dd HH:mm')}</span>
                <span className={`text-xs ${l.skipped ? 'text-red-500' : 'text-green-600'}`}>
                  {l.skipped ? '已跳过' : '已服用'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
