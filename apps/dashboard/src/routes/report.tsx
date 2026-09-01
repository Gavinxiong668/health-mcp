import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO, subDays } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { FileDown } from 'lucide-react';

export const Route = createFileRoute('/report')({
  component: ReportPage,
});

type ReportData = Awaited<ReturnType<typeof api.report>>;

const MODALITY_LABEL: Record<string, string> = {
  hemodialysis: '血液透析', peritoneal: '腹膜透析', hdf: 'HDF', online_hdf: '在线 HDF',
};
const PAIN_TYPE_LABEL: Record<string, string> = {
  sharp: '刺痛', dull: '钝痛', aching: '酸痛', burning: '灼痛',
  throbbing: '搏动痛', stabbing: '刀割痛', tingling: '麻刺痛', other: '其他',
};
const KIND_LABEL: Record<string, string> = {
  urine: '尿液', sweat: '汗液', vomit: '呕吐', drain: '引流', stool: '粪便', other: '其他',
};
const MOOD_LABEL: Record<number, string> = { 1: '很差', 2: '偏差', 3: '一般', 4: '好', 5: '很好' };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="report-section mb-6 rounded-lg border border-kumo-line bg-kumo-surface print:mb-4 print:border-0 print:bg-transparent print:p-0">
    <h2 className="border-b border-kumo-line px-4 py-2.5 text-sm font-semibold text-kumo-strong print:py-1 print:border-gray-300">{title}</h2>
    <div className="p-4 print:px-0 print:py-1">{children}</div>
  </div>
);

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-1 text-sm">
    <span className="text-kumo-subtle">{label}</span>
    <span className="font-medium tabular-nums text-kumo-strong">{value}</span>
  </div>
);

const EmptyNote = ({ text }: { text: string }) => (
  <p className="py-4 text-center text-sm text-kumo-subtle print:text-gray-500">{text}</p>
);

function ReportPage() {
  const [days, setDays] = useState(7);
  const end = format(new Date(), 'yyyy-MM-dd');
  const start = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['report', start, end],
    queryFn: () => api.report({ start, end }),
  });

  const r = data as ReportData | undefined;

  const handlePrint = () => window.print();

  const bpEntries = ((r?.blood_pressure as { entries?: Array<{ ts: string; systolic: number; diastolic: number; pulse: number | null }> })?.entries ?? []).slice().reverse();
  const painEntries = ((r?.pain as { entries?: Array<{ ts: string; score: number; location: string | null; type: string | null }> })?.entries ?? []).slice().reverse();
  const diaryEntries = ((r?.diary as { entries?: Array<{ ts: string; mood: number | null; energy: number | null }> })?.entries ?? []).slice().reverse();
  const weightEntries = (r?.weight as Array<{ ts: string; date: string; kg: number }> | undefined) ?? [];
  const dialysisEntries = ((r?.dialysis as { entries?: Array<Record<string, unknown>> })?.entries ?? []) as Array<{ ts: string; date: string; modality: string; duration_min: number | null; ultrafiltration_ml: number | null; pre_weight_kg: number | null; post_weight_kg: number | null }>;
  const medications = (r?.medications as Array<{ name: string; category: string | null; dose_amount: number | null; dose_unit: string | null; frequency: string | null; indication: string | null }> | undefined) ?? [];
  const labResults = (r?.lab_results as Array<{ id: string; taken_at: string; biomarker_name: string; value_numeric: number | null; value_text: string | null; unit_ucum: string; default_ref_low: number | null; default_ref_high: number | null }> | undefined) ?? [];

  const bpStats = (r?.blood_pressure as { stats?: { avg_systolic: number; avg_diastolic: number; avg_pulse: number; count: number } | null })?.stats;
  const painStats = (r?.pain as { stats?: { avg_score: number; max_score: number; min_score: number; count: number } | null })?.stats;
  const dialysisStats_ = (r?.dialysis as { stats?: { count: number; avg_duration_min: number; total_uf_ml: number } | null })?.stats;
  const diaryStats_ = (r?.diary as { stats?: { avg_mood: number; avg_energy: number; avg_sleep: number; count: number } | null })?.stats;
  const nutrition = r?.nutrition as { avg?: Record<string, number> } | undefined;
  const fluidBalance = r?.fluid_balance as { total_intake_ml: number; total_output_ml: number; balance_ml: number; output_by_kind: Record<string, number> } | undefined;
  const hydration = r?.hydration as { avg_ml: number } | undefined;

  const bpChartData = bpEntries.map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd'),
    收缩压: e.systolic,
    舒张压: e.diastolic,
  }));

  const painChartData = painEntries.map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd HH:mm'),
    评分: e.score,
  }));

  const diaryChartData = diaryEntries.map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd'),
    心情: e.mood,
    精力: e.energy,
  }));

  const weightChartData = [...weightEntries].reverse().map((e) => ({
    date: format(parseISO(e.ts), 'MM/dd'),
    体重: e.kg,
  }));

  return (
    <div>
      <PageHeader
        title="健康报告"
        description="生成健康报告，可用于复诊时分享给医生"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <div className="flex gap-1 rounded-md border border-kumo-line p-0.5">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${days === d ? 'bg-kumo-brand text-white' : 'text-kumo-subtle hover:text-kumo-default'}`}
                >
                  {d}天
                </button>
              ))}
            </div>
            <Button onClick={handlePrint}>
              <FileDown className="mr-1.5 h-4 w-4" />
              生成 PDF
            </Button>
          </div>
        }
      />

      {/* Report header — visible in print */}
      <div className="mb-6 hidden print:block">
        <h1 className="text-xl font-bold text-kumo-strong">健康数据报告</h1>
        <p className="text-sm text-kumo-subtle">
          报告周期：{start} 至 {end} · 生成时间：{format(new Date(), 'yyyy-MM-dd HH:mm')}
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <div className="text-sm text-kumo-subtle">加载中...</div>
        </div>
      ) : !r ? (
        <EmptyNote text="无法加载报告数据" />
      ) : (
        <div className="report-content">
          {/* Nutrition */}
          <Section title="营养概览">
            {nutrition?.avg ? (
              <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-4 print:grid-cols-4">
                <StatRow label="日均热量" value={`${nutrition.avg.kcal} kcal`} />
                <StatRow label="日均蛋白质" value={`${nutrition.avg.protein_g} g`} />
                <StatRow label="日均碳水" value={`${nutrition.avg.carb_g} g`} />
                <StatRow label="日均脂肪" value={`${nutrition.avg.fat_g} g`} />
                <StatRow label="日均钠" value={`${nutrition.avg.sodium_mg} mg`} />
                <StatRow label="日均钾" value={`${nutrition.avg.potassium_mg} mg`} />
                <StatRow label="日均膳食纤维" value={`${nutrition.avg.fiber_g} g`} />
                <StatRow label="日均饮水" value={`${hydration?.avg_ml ?? 0} ml`} />
              </div>
            ) : <EmptyNote text="该时段暂无饮食记录" />}
          </Section>

          {/* Fluid balance */}
          <Section title="液体出入量">
            {fluidBalance ? (
              <>
                <div className="grid grid-cols-3 gap-4 print:grid-cols-3">
                  <StatRow label="总摄入" value={`${fluidBalance.total_intake_ml} ml`} />
                  <StatRow label="总排出" value={`${fluidBalance.total_output_ml} ml`} />
                  <StatRow label="平衡" value={`${fluidBalance.balance_ml > 0 ? '+' : ''}${fluidBalance.balance_ml} ml`} />
                </div>
                {Object.keys(fluidBalance.output_by_kind).length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-kumo-subtle">排出分类：</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(fluidBalance.output_by_kind).map(([kind, ml]) => (
                        <span key={kind} className="rounded bg-kumo-fill px-2 py-0.5 text-xs text-kumo-default">
                          {KIND_LABEL[kind] ?? kind}: {ml} ml
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <EmptyNote text="该时段暂无液体记录" />}
          </Section>

          {/* Blood pressure */}
          <Section title="血压趋势">
            {bpStats ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-x-8 sm:grid-cols-4 print:grid-cols-4">
                  <StatRow label="平均收缩压" value={`${bpStats.avg_systolic} mmHg`} />
                  <StatRow label="平均舒张压" value={`${bpStats.avg_diastolic} mmHg`} />
                  <StatRow label="平均脉搏" value={`${bpStats.avg_pulse} bpm`} />
                  <StatRow label="记录次数" value={`${bpStats.count}`} />
                </div>
                {bpChartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={200} className="print:h-[160px]">
                    <LineChart data={bpChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="收缩压" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="舒张压" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </>
            ) : <EmptyNote text="该时段暂无血压记录" />}
          </Section>

          {/* Dialysis */}
          <Section title="透析记录">
            {dialysisStats_ ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-4 print:grid-cols-3">
                  <StatRow label="透析次数" value={`${dialysisStats_.count}`} />
                  <StatRow label="平均时长" value={`${dialysisStats_.avg_duration_min} 分钟`} />
                  <StatRow label="总超滤量" value={`${dialysisStats_.total_uf_ml} ml`} />
                </div>
                {dialysisEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs print:text-[10px]">
                      <thead>
                        <tr className="border-b border-kumo-line text-kumo-subtle print:border-gray-300">
                          <th className="py-1.5 pr-3">日期</th>
                          <th className="py-1.5 pr-3">方式</th>
                          <th className="py-1.5 pr-3">时长</th>
                          <th className="py-1.5 pr-3">透前体重</th>
                          <th className="py-1.5 pr-3">超滤量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dialysisEntries.map((e) => (
                          <tr key={e.ts} className="border-b border-kumo-line/50 print:border-gray-200">
                            <td className="py-1.5 pr-3">{e.date}</td>
                            <td className="py-1.5 pr-3">{MODALITY_LABEL[e.modality] ?? e.modality}</td>
                            <td className="py-1.5 pr-3">{e.duration_min ? `${e.duration_min}min` : '-'}</td>
                            <td className="py-1.5 pr-3">{e.pre_weight_kg ? `${e.pre_weight_kg}kg` : '-'}</td>
                            <td className="py-1.5 pr-3">{e.ultrafiltration_ml ? `${e.ultrafiltration_ml}ml` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : <EmptyNote text="该时段暂无透析记录" />}
          </Section>

          {/* Pain */}
          <Section title="疼痛评分">
            {painStats ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-x-8 sm:grid-cols-4 print:grid-cols-4">
                  <StatRow label="平均评分" value={`${painStats.avg_score}`} />
                  <StatRow label="最高评分" value={`${painStats.max_score}`} />
                  <StatRow label="最低评分" value={`${painStats.min_score}`} />
                  <StatRow label="记录次数" value={`${painStats.count}`} />
                </div>
                {painChartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={160} className="print:h-[120px]">
                    <BarChart data={painChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="评分" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </>
            ) : <EmptyNote text="该时段暂无疼痛记录" />}
          </Section>

          {/* Medications */}
          <Section title="当前用药">
            {medications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs print:text-[10px]">
                  <thead>
                    <tr className="border-b border-kumo-line text-kumo-subtle print:border-gray-300">
                      <th className="py-1.5 pr-3">药物</th>
                      <th className="py-1.5 pr-3">类别</th>
                      <th className="py-1.5 pr-3">剂量</th>
                      <th className="py-1.5 pr-3">频次</th>
                      <th className="py-1.5 pr-3">用途</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((m) => (
                      <tr key={m.name} className="border-b border-kumo-line/50 print:border-gray-200">
                        <td className="py-1.5 pr-3 font-medium">{m.name}</td>
                        <td className="py-1.5 pr-3">{m.category ?? '-'}</td>
                        <td className="py-1.5 pr-3">{m.dose_amount ? `${m.dose_amount} ${m.dose_unit ?? ''}` : '-'}</td>
                        <td className="py-1.5 pr-3">{m.frequency ?? '-'}</td>
                        <td className="py-1.5 pr-3">{m.indication ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyNote text="暂无活跃药物记录" />}
          </Section>

          {/* Diary */}
          <Section title="情绪/症状日记">
            {diaryStats_ ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-x-8 sm:grid-cols-4 print:grid-cols-4">
                  <StatRow label="平均心情" value={`${diaryStats_.avg_mood} / 5`} />
                  <StatRow label="平均精力" value={`${diaryStats_.avg_energy} / 5`} />
                  <StatRow label="平均睡眠" value={`${diaryStats_.avg_sleep} / 5`} />
                  <StatRow label="记录次数" value={`${diaryStats_.count}`} />
                </div>
                {diaryChartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={160} className="print:h-[120px]">
                    <LineChart data={diaryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="心情" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="精力" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </>
            ) : <EmptyNote text="该时段暂无日记记录" />}
          </Section>

          {/* Weight */}
          <Section title="体重趋势">
            {weightChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160} className="print:h-[120px]">
                <LineChart data={weightChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="体重" stroke="var(--color-kumo-brand, #499d80)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyNote text="该时段暂无体重记录" />}
          </Section>

          {/* Lab results */}
          <Section title="化验结果">
            {labResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs print:text-[10px]">
                  <thead>
                    <tr className="border-b border-kumo-line text-kumo-subtle print:border-gray-300">
                      <th className="py-1.5 pr-3">日期</th>
                      <th className="py-1.5 pr-3">指标</th>
                      <th className="py-1.5 pr-3 text-right">结果</th>
                      <th className="py-1.5 pr-3">单位</th>
                      <th className="py-1.5 pr-3">参考范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labResults.map((lr) => {
                      const val = lr.value_numeric ?? null;
                      const isLow = val != null && lr.default_ref_low != null && val < lr.default_ref_low;
                      const isHigh = val != null && lr.default_ref_high != null && val > lr.default_ref_high;
                      return (
                        <tr key={lr.id} className="border-b border-kumo-line/50 print:border-gray-200">
                          <td className="py-1.5 pr-3">{format(parseISO(lr.taken_at), 'yyyy-MM-dd')}</td>
                          <td className="py-1.5 pr-3">{lr.biomarker_name}</td>
                          <td className={`py-1.5 pr-3 text-right tabular-nums ${isLow || isHigh ? 'font-semibold text-red-600' : ''}`}>
                            {lr.value_numeric != null ? lr.value_numeric : (lr.value_text ?? '-')}
                          </td>
                          <td className="py-1.5 pr-3">{lr.unit_ucum}</td>
                          <td className="py-1.5 pr-3 text-kumo-subtle">
                            {lr.default_ref_low != null && lr.default_ref_high != null
                              ? `${lr.default_ref_low} – ${lr.default_ref_high}`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyNote text="该时段暂无化验结果" />}
          </Section>

          {/* Footer for print */}
          <div className="hidden print:block print:mt-6 print:border-t print:border-gray-300 print:pt-3">
            <p className="text-[10px] text-gray-500">
              本报告由 health-mcp 自动生成，数据来源于患者日常记录。仅供参考，不作为诊断依据。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
