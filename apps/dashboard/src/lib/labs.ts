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

export type BiomarkerStatus = keyof typeof STATUS_VARIANT;
