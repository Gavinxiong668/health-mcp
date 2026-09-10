export const STATUS_VARIANT = {
  optimal: 'ok',
  in_ref: 'muted',
  out_of_ref: 'bad',
  unknown: 'outline',
} as const;

export const STATUS_LABEL = {
  optimal: '最佳',
  in_ref: '正常',
  out_of_ref: '异常',
  unknown: '未知',
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  Autoimmunity: '自身免疫',
  CBC: '血常规',
  CMP: '综合代谢',
  Cardiac: '心脏',
  Glycemic: '血糖',
  'Hormones - adrenal': '肾上腺激素',
  'Hormones - sex': '性激素',
  Inflammation: '炎症',
  Iron: '铁代谢',
  Kidney: '肾脏',
  Lipid: '血脂',
  Liver: '肝脏',
  Metals: '金属',
  Minerals: '矿物质',
  Other: '其他',
  Thyroid: '甲状腺',
  Vitamins: '维生素',
};

export const formatCategoryName = (name: string): string => {
  const cn = CATEGORY_LABEL[name];
  if (cn) return `${cn} (${name})`;
  return name;
};

export type BiomarkerStatus = keyof typeof STATUS_VARIANT;

// Dialysis routine monitoring markers — these are the key biomarkers that
// dialysis patients should track regularly. The form uses this list to provide
// a quick-entry template with pre-filled units.
export const DIALYSIS_KEY_MARKERS = [
  { name: 'Potassium', label: '血钾 (Potassium)', defaultUnit: 'mmol/L', units: ['mmol/L', 'mEq/L'] },
  { name: 'Phosphorus', label: '血磷 (Phosphorus)', defaultUnit: 'mg/dL', units: ['mg/dL', 'mmol/L'] },
  { name: 'Calcium', label: '血钙 (Calcium)', defaultUnit: 'mg/dL', units: ['mg/dL', 'mmol/L'] },
  { name: 'Hemoglobin', label: '血红蛋白 (Hemoglobin)', defaultUnit: 'g/dL', units: ['g/dL', 'g/L'] },
  { name: 'PTH', label: 'PTH (甲状旁腺激素)', defaultUnit: 'pg/mL', units: ['pg/mL'] },
] as const;

// Common unit options shown in the unit dropdown for free-form entry.
export const COMMON_UNITS = [
  'mg/dL', 'g/dL', 'g/L', 'mmol/L', 'mEq/L',
  'pg/mL', 'ng/mL', 'ug/dL', 'ng/dL',
  'mIU/L', 'uIU/mL', 'IU/L',
  'umol/L', 'nmol/L', 'pmol/L',
  '%', 'U/L', 'fL', 'pg',
] as const;
