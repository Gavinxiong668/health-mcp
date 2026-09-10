import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtNum } from '@/lib/format';
import { COMMON_UNITS, DIALYSIS_KEY_MARKERS, STATUS_LABEL, STATUS_VARIANT, formatCategoryName, type BiomarkerStatus } from '@/lib/labs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Beaker, Calendar, ChevronRight, FlaskConical, Plus, Save, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

const LabsIndex = () => {
  const [outOnly, setOutOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'category' | 'date'>('category');
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch categories
  const categories = useQuery({
    queryKey: ['biomarker-categories'],
    queryFn: () => api.biomarkers.categories(),
  });

  // Fetch latest biomarkers
  const latest = useQuery({
    queryKey: ['biomarkers', 'latest', outOnly, selectedCategory],
    queryFn: () =>
      api.biomarkers.latest({
        out_of_range_only: outOnly,
        category: selectedCategory ?? undefined,
      }),
  });

  // Fetch lab panels
  const panels = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => api.labs.panels({ limit: 50 }),
  });

  // Fetch all lab results for date view
  const allResults = useQuery({
    queryKey: ['lab-results', 'all'],
    queryFn: () => api.labs.results({ limit: 500 }),
  });

  // Group results by date
  const resultsByDate = useMemo(() => {
    if (!allResults.data) return new Map<string, typeof allResults.data>();
    const map = new Map<string, typeof allResults.data>();
    for (const r of allResults.data) {
      const date = r.taken_at.split('T')[0];
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(r);
    }
    return map;
  }, [allResults.data]);

  // Group latest by category
  const latestByCategory = useMemo(() => {
    if (!latest.data) return new Map<string, typeof latest.data>();
    const map = new Map<string, typeof latest.data>();
    for (const row of latest.data) {
      // Get category from biomarker (we'll need to fetch this separately or include in response)
      // For now, use a simple grouping
      const cat = 'Other'; // Default, will be overridden by category filter
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    return map;
  }, [latest.data]);

  const sortedPanels = (panels.data ?? [])
    .slice()
    .sort((x, y) => y.drawn_at.localeCompare(x.drawn_at));

  const sortedDates = useMemo(
    () => Array.from(resultsByDate.keys()).sort((a, b) => b.localeCompare(a)),
    [resultsByDate],
  );

  return (
    <>
      <PageHeader
        title="化验"
        description="生物标志物化验数据。点击任意标志查看完整历史。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={outOnly ? 'default' : 'outline'}
              onClick={() => setOutOnly((v) => !v)}
            >
              仅显示异常
            </Button>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger
                render={(p) => (
                  <Button {...(p as any)} size="sm" variant="default">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    上传结果
                  </Button>
                )}
              />
              <UploadLabResultDialog onClose={() => setUploadOpen(false)} />
            </Dialog>
          </div>
        }
      />

      {/* View mode toggle */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          size="sm"
          variant={viewMode === 'category' ? 'default' : 'outline'}
          onClick={() => setViewMode('category')}
        >
          按分类
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'date' ? 'default' : 'outline'}
          onClick={() => setViewMode('date')}
        >
          按日期
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-kumo-brand" />
              {viewMode === 'category' ? '按分类查看' : '按日期查看'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latest.isLoading || allResults.isLoading ? (
              <Spinner />
            ) : viewMode === 'category' ? (
              <CategoryView
                categories={categories.data ?? []}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                data={latest.data ?? []}
              />
            ) : (
              <DateView dates={sortedDates} resultsByDate={resultsByDate} />
            )}
          </CardContent>
        </Card>

        {/* Side panel - Lab panels */}
        <Card>
          <CardHeader>
            <CardTitle>化验面板</CardTitle>
          </CardHeader>
          <CardContent>
            {panels.isLoading ? (
              <Spinner />
            ) : sortedPanels.length === 0 ? (
              <Empty title="暂无化验面板" description="通过上传结果创建化验面板" />
            ) : (
              <ul className="space-y-1">
                {sortedPanels.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/labs/panel/$panelId"
                      params={{ panelId: p.id }}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-kumo-tint"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-kumo-default">
                          {p.name ?? p.lab_name ?? '面板'}
                        </div>
                        <div className="text-xs text-kumo-subtle">{fmtDate(p.drawn_at)}</div>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// Category view component
const CategoryView = ({
  categories,
  selectedCategory,
  onSelectCategory,
  data,
}: {
  categories: Array<{ name: string; count: number }>;
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  data: Array<{
    biomarker: { id: string; name: string; display_name: string | null };
    result: { value_numeric: number | null; value_text: string | null; unit_ucum: string; taken_at: string };
    status: BiomarkerStatus;
  }>;
}) => {
  const categoriesWithResults = categories.filter((c) => c.count > 0);

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={selectedCategory === null ? 'default' : 'outline'}
          onClick={() => onSelectCategory(null)}
        >
          全部
        </Button>
        {categoriesWithResults.map((cat) => (
          <Button
            key={cat.name}
            size="sm"
            variant={selectedCategory === cat.name ? 'default' : 'outline'}
            onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
          >
            {formatCategoryName(cat.name)}
            <span className="ml-1 text-xs opacity-70">({cat.count})</span>
          </Button>
        ))}
      </div>

      {/* Results list */}
      {data.length === 0 ? (
        <Empty
          icon={Beaker}
          title="暂无化验结果"
          description="点击右上角'上传结果'添加化验数据"
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.map((row) => (
            <li key={row.biomarker.id}>
              <Link
                to="/labs/$biomarkerId"
                params={{ biomarkerId: row.biomarker.id }}
                className="group flex items-center justify-between gap-3 rounded-md border border-kumo-line bg-kumo-base p-3 text-left text-sm transition-colors hover:border-kumo-strong hover:bg-kumo-tint"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-kumo-default">
                      {row.biomarker.display_name ?? row.biomarker.name}
                    </span>
                    <Badge variant={STATUS_VARIANT[row.status]} className="shrink-0 capitalize">
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  <div className="text-xs tabular-nums text-kumo-subtle">
                    <span className="font-medium text-kumo-default">
                      {row.result.value_numeric != null
                        ? `${fmtNum(row.result.value_numeric, 2)} ${row.result.unit_ucum}`
                        : (row.result.value_text ?? '—')}
                    </span>
                    <span className="ml-2">{fmtDate(row.result.taken_at)}</span>
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Date view component
const DateView = ({
  dates,
  resultsByDate,
}: {
  dates: string[];
  resultsByDate: Map<string, Array<{
    biomarker_id: string;
    value_numeric: number | null;
    value_text: string | null;
    unit_ucum: string;
    taken_at: string;
    status: BiomarkerStatus;
    biomarker?: { id: string; name: string; display_name: string | null };
  }>>;
}) => {
  if (dates.length === 0) {
    return (
      <Empty
        icon={Calendar}
        title="暂无化验结果"
        description="点击右上角'上传结果'添加化验数据"
      />
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const results = resultsByDate.get(date) ?? [];
        return (
          <div key={date}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-kumo-subtle">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(date)}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((r, idx) => (
                <li key={`${r.biomarker_id}-${idx}`}>
                  <Link
                    to="/labs/$biomarkerId"
                    params={{ biomarkerId: r.biomarker_id }}
                    className="group flex items-center justify-between gap-3 rounded-md border border-kumo-line bg-kumo-base p-3 text-left text-sm transition-colors hover:border-kumo-strong hover:bg-kumo-tint"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[r.status]} className="shrink-0 capitalize">
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <div className="text-xs tabular-nums text-kumo-subtle">
                        <span
                          className={cn(
                            'font-medium',
                            r.status === 'out_of_ref' && 'text-kumo-danger',
                            r.status === 'optimal' && 'text-kumo-success',
                          )}
                        >
                          {r.value_numeric != null
                            ? `${fmtNum(r.value_numeric, 2)} ${r.unit_ucum}`
                            : (r.value_text ?? '—')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

// Upload dialog
const UploadLabResultDialog = ({ onClose }: { onClose: () => void }) => {
  const [mode, setMode] = useState<'dialysis' | 'single' | 'panel'>('dialysis');
  const [biomarker, setBiomarker] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [panelName, setPanelName] = useState('');
  const [labName, setLabName] = useState('');
  const [results, setResults] = useState<Array<{ biomarker: string; value: string; unit: string }>>([
    { biomarker: '', value: '', unit: '' },
  ]);
  // Dialysis quick-entry: one row per key marker
  const [dialysisRows, setDialysisRows] = useState(
    () => DIALYSIS_KEY_MARKERS.map((m) => ({
      name: m.name,
      label: m.label,
      value: '',
      unit: m.defaultUnit,
      units: m.units,
    })),
  );

  const queryClient = useQueryClient();

  const singleMutation = useMutation({
    mutationFn: (body: unknown) => api.labs.logResult(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      onClose();
    },
    onError: (error: Error) => {
      console.error('Failed to upload lab result:', error);
      alert('上传失败: ' + error.message);
    },
  });

  const panelMutation = useMutation({
    mutationFn: (body: unknown) => api.labs.createPanel(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-panels'] });
      queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
      onClose();
    },
    onError: (error: Error) => {
      console.error('Failed to upload lab panel:', error);
      alert('上传失败: ' + error.message);
    },
  });

  const handleSingleSubmit = (draft = false) => {
    if (!biomarker) return;
    if (!draft && !value) return;
    singleMutation.mutate({
      biomarker,
      value_numeric: value ? parseFloat(value) : undefined,
      unit_ucum: unit || undefined,
      taken_at: new Date(date).toISOString(),
      notes: notes || undefined,
      draft,
    });
  };

  const handleDialysisSubmit = (draft = false) => {
    const filledRows = dialysisRows.filter((r) => r.value !== '');
    if (!draft && filledRows.length === 0) return;

    panelMutation.mutate({
      panel_name: '透析常规指标',
      drawn_at: new Date(date).toISOString(),
      notes: notes || undefined,
      results: dialysisRows.map((r) => ({
        biomarker: r.name,
        value_numeric: r.value ? parseFloat(r.value) : undefined,
        unit_ucum: r.unit,
        draft: (!r.value && draft) ? true : undefined,
      })),
    });
  };

  const handlePanelSubmit = (draft = false) => {
    if (!panelName) return;
    const filledResults = results.filter((r) => r.biomarker && r.value);
    if (!draft && filledResults.length === 0) return;

    panelMutation.mutate({
      panel_name: panelName,
      lab_name: labName || undefined,
      drawn_at: new Date(date).toISOString(),
      notes: notes || undefined,
      results: results
        .filter((r) => r.biomarker)
        .map((r) => ({
          biomarker: r.biomarker,
          value_numeric: r.value ? parseFloat(r.value) : undefined,
          unit_ucum: r.unit || undefined,
          draft: (!r.value && draft) ? true : undefined,
        })),
    });
  };

  const addResultRow = () => {
    setResults([...results, { biomarker: '', value: '', unit: '' }]);
  };

  const updateResultRow = (idx: number, field: string, val: string) => {
    const newResults = [...results];
    newResults[idx] = { ...newResults[idx], [field]: val };
    setResults(newResults);
  };

  const removeResultRow = (idx: number) => {
    setResults(results.filter((_, i) => i !== idx));
  };

  const updateDialysisRow = (idx: number, field: string, val: string) => {
    const newRows = [...dialysisRows];
    newRows[idx] = { ...newRows[idx], [field]: val };
    setDialysisRows(newRows);
  };

  const isPending = singleMutation.isPending || panelMutation.isPending;
  const hasError = singleMutation.isError || panelMutation.isError;
  const errorMsg = (singleMutation.error ?? panelMutation.error) as Error | null;

  return (
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>上传化验结果</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'dialysis' ? 'default' : 'outline'}
            onClick={() => setMode('dialysis')}
          >
            透析常规指标
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'single' ? 'default' : 'outline'}
            onClick={() => setMode('single')}
          >
            单项结果
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'panel' ? 'default' : 'outline'}
            onClick={() => setMode('panel')}
          >
            化验面板
          </Button>
        </div>

        {/* Date (shared across all modes) */}
        <div className="space-y-2">
          <Label>日期</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {mode === 'dialysis' ? (
          <>
            <p className="text-xs text-kumo-subtle">
              透析患者常规监测指标。带 <span className="text-kumo-danger">*</span> 为建议必填项，留空可暂存为草稿。
            </p>
            <div className="space-y-3">
              {dialysisRows.map((row, idx) => (
                <div key={row.name} className="space-y-1">
                  <Label className="text-sm font-medium">
                    {row.label}
                    <span className="ml-1 text-xs text-kumo-subtle">(建议填写)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      type="number"
                      step="0.01"
                      value={row.value}
                      onChange={(e) => updateDialysisRow(idx, 'value', e.target.value)}
                      placeholder="留空可暂存"
                    />
                    <Select
                      className="w-24"
                      size="sm"
                      value={row.unit}
                      onChange={(e) => updateDialysisRow(idx, 'unit', e.target.value)}
                    >
                      {row.units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="透析前/后、空腹等" />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handleDialysisSubmit(true)}
                disabled={isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                暂存
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleDialysisSubmit(false)}
                disabled={dialysisRows.every((r) => !r.value) || isPending}
              >
                {isPending ? '提交中...' : '正式提交'}
              </Button>
            </div>
          </>
        ) : mode === 'single' ? (
          <>
            <div className="space-y-2">
              <Label>生物标志物名称 <span className="text-kumo-danger">*</span></Label>
              <Input
                value={biomarker}
                onChange={(e) => setBiomarker(e.target.value)}
                placeholder="如: 血红蛋白, 肌酐, 血糖"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>数值 <span className="text-xs text-kumo-subtle">(暂存可留空)</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="12.5"
                />
              </div>
              <div className="space-y-2">
                <Label>单位 <span className="text-xs text-kumo-subtle">(可选)</span></Label>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="">选择单位</option>
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="空腹、实验室名称等" />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handleSingleSubmit(true)}
                disabled={!biomarker || isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                暂存
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSingleSubmit(false)}
                disabled={!biomarker || !value || isPending}
              >
                {isPending ? '提交中...' : '正式提交'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>面板名称 <span className="text-kumo-danger">*</span></Label>
              <Input
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                placeholder="如: 肾功能检查、血常规"
              />
            </div>
            <div className="space-y-2">
              <Label>实验室名称（可选）</Label>
              <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="XX医院" />
            </div>

            {/* Results table */}
            <div className="space-y-2">
              <Label>化验结果 <span className="text-xs text-kumo-subtle">(数值留空可暂存)</span></Label>
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={r.biomarker}
                      onChange={(e) => updateResultRow(idx, 'biomarker', e.target.value)}
                      placeholder="标志物"
                    />
                    <Input
                      className="w-20"
                      type="number"
                      step="0.01"
                      value={r.value}
                      onChange={(e) => updateResultRow(idx, 'value', e.target.value)}
                      placeholder="数值"
                    />
                    <Select
                      className="w-24"
                      size="sm"
                      value={r.unit}
                      onChange={(e) => updateResultRow(idx, 'unit', e.target.value)}
                    >
                      <option value="">单位</option>
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                    {results.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeResultRow(idx)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addResultRow}>
                <Plus className="mr-1 h-3 w-3" />
                添加一行
              </Button>
            </div>

            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="空腹等" />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handlePanelSubmit(true)}
                disabled={!panelName || isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                暂存
              </Button>
              <Button
                className="flex-1"
                onClick={() => handlePanelSubmit(false)}
                disabled={!panelName || results.filter((r) => r.biomarker && r.value).length === 0 || isPending}
              >
                {isPending ? '提交中...' : '提交面板'}
              </Button>
            </div>
          </>
        )}

        {hasError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            错误: {errorMsg?.message ?? '上传失败'}
          </div>
        )}
      </div>
    </DialogContent>
  );
};

export const Route = createFileRoute('/labs/')({ component: LabsIndex });
