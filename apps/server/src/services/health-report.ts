import type { Ctx } from './types.js';

/**
 * Aggregates all clinical + nutrition data for a date range into a single
 * report payload consumed by the Dashboard report page (print → PDF).
 */
export const generateHealthReport = (
  ctx: Ctx,
  args: { start: string; end: string },
) => {
  const { start, end } = args;

  // --- Nutrition (range summary, bucketed by day) ---
  const intakeRows = ctx.db
    .prepare(
      `SELECT date,
              COALESCE(SUM(kcal),0) AS kcal,
              COALESCE(SUM(protein_g),0) AS protein_g,
              COALESCE(SUM(carb_g),0) AS carb_g,
              COALESCE(SUM(fat_g),0) AS fat_g,
              COALESCE(SUM(sodium_mg),0) AS sodium_mg,
              COALESCE(SUM(potassium_mg),0) AS potassium_mg,
              COALESCE(SUM(fiber_g),0) AS fiber_g
         FROM intake_v
        WHERE date >= ? AND date <= ?
        GROUP BY date ORDER BY date`,
    )
    .all(start, end) as Array<{
    date: string;
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    sodium_mg: number;
    potassium_mg: number;
    fiber_g: number;
  }>;

  const dayCount = intakeRows.length || 1;
  const nutritionAvg = {
    kcal: Math.round(intakeRows.reduce((s, r) => s + r.kcal, 0) / dayCount),
    protein_g: Math.round(intakeRows.reduce((s, r) => s + r.protein_g, 0) / dayCount * 10) / 10,
    carb_g: Math.round(intakeRows.reduce((s, r) => s + r.carb_g, 0) / dayCount * 10) / 10,
    fat_g: Math.round(intakeRows.reduce((s, r) => s + r.fat_g, 0) / dayCount * 10) / 10,
    sodium_mg: Math.round(intakeRows.reduce((s, r) => s + r.sodium_mg, 0) / dayCount),
    potassium_mg: Math.round(intakeRows.reduce((s, r) => s + r.potassium_mg, 0) / dayCount),
    fiber_g: Math.round(intakeRows.reduce((s, r) => s + r.fiber_g, 0) / dayCount * 10) / 10,
  };

  // --- Hydration intake ---
  const hydrationRows = ctx.db
    .prepare(
      `SELECT date, COALESCE(SUM(ml),0) AS ml
         FROM hydration_entries
        WHERE date >= ? AND date <= ?
        GROUP BY date ORDER BY date`,
    )
    .all(start, end) as Array<{ date: string; ml: number }>;
  const hydrationAvg = Math.round(hydrationRows.reduce((s, r) => s + r.ml, 0) / dayCount);

  // --- Fluid output ---
  const fluidOutput = ctx.db
    .prepare(
      `SELECT id, ts, date, kind, ml, notes FROM fluid_output_entries
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{ id: string; ts: string; date: string; kind: string; ml: number; notes: string | null }>;
  const fluidOutputByKind: Record<string, number> = {};
  for (const r of fluidOutput) {
    fluidOutputByKind[r.kind] = (fluidOutputByKind[r.kind] ?? 0) + r.ml;
  }
  const totalOutput = fluidOutput.reduce((s, r) => s + r.ml, 0);
  const totalIntake = hydrationRows.reduce((s, r) => s + r.ml, 0);

  // --- Blood pressure ---
  const bpEntries = ctx.db
    .prepare(
      `SELECT id, ts, date, systolic, diastolic, pulse, position, notes
         FROM blood_pressure_entries
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{
    id: string; ts: string; date: string; systolic: number; diastolic: number;
    pulse: number | null; position: string | null; notes: string | null;
  }>;
  const bpStats = bpEntries.length > 0
    ? {
        avg_systolic: Math.round(bpEntries.reduce((s, r) => s + r.systolic, 0) / bpEntries.length),
        avg_diastolic: Math.round(bpEntries.reduce((s, r) => s + r.diastolic, 0) / bpEntries.length),
        avg_pulse: Math.round(
          bpEntries.filter((r) => r.pulse != null).reduce((s, r) => s + (r.pulse ?? 0), 0) /
            Math.max(1, bpEntries.filter((r) => r.pulse != null).length),
        ),
        count: bpEntries.length,
      }
    : null;

  // --- Dialysis ---
  const dialysisEntries = ctx.db
    .prepare(
      `SELECT id, ts, date, modality, duration_min, access_type,
              pre_weight_kg, post_weight_kg, dry_weight_kg, ultrafiltration_ml,
              complications, symptoms, notes
         FROM dialysis_sessions
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{
    id: string; ts: string; date: string; modality: string; duration_min: number | null;
    access_type: string | null; pre_weight_kg: number | null; post_weight_kg: number | null;
    dry_weight_kg: number | null; ultrafiltration_ml: number | null;
    complications: string | null; symptoms: string | null; notes: string | null;
  }>;
  const dialysisStats = dialysisEntries.length > 0
    ? {
        count: dialysisEntries.length,
        avg_duration_min: Math.round(
          dialysisEntries.filter((e) => e.duration_min != null).reduce((s, e) => s + (e.duration_min ?? 0), 0) /
            Math.max(1, dialysisEntries.filter((e) => e.duration_min != null).length),
        ),
        total_uf_ml: dialysisEntries.reduce((s, e) => s + (e.ultrafiltration_ml ?? 0), 0),
      }
    : null;

  // --- Pain ---
  const painEntries = ctx.db
    .prepare(
      `SELECT id, ts, date, score, location, type, notes
         FROM pain_entries
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{
    id: string; ts: string; date: string; score: number;
    location: string | null; type: string | null; notes: string | null;
  }>;
  const painStats = painEntries.length > 0
    ? {
        avg_score: Math.round(painEntries.reduce((s, r) => s + r.score, 0) / painEntries.length * 10) / 10,
        max_score: Math.max(...painEntries.map((r) => r.score)),
        min_score: Math.min(...painEntries.map((r) => r.score)),
        count: painEntries.length,
      }
    : null;

  // --- Medications (active list, not date-filtered) ---
  const medications = ctx.db
    .prepare(
      `SELECT id, name, category, dose_amount, dose_unit, frequency, indication, active
         FROM medications WHERE active = 1 ORDER BY name`,
    )
    .all() as Array<{
    id: string; name: string; category: string | null; dose_amount: number | null;
    dose_unit: string | null; frequency: string | null; indication: string | null; active: number;
  }>;

  // --- Diary ---
  const diaryEntries = ctx.db
    .prepare(
      `SELECT id, ts, date, mood, energy, sleep_quality, appetite, symptoms, notes
         FROM diary_entries
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{
    id: string; ts: string; date: string; mood: number | null; energy: number | null;
    sleep_quality: number | null; appetite: number | null; symptoms: string | null; notes: string | null;
  }>;
  const diaryStats = diaryEntries.length > 0
    ? {
        avg_mood: Math.round(
          diaryEntries.filter((e) => e.mood != null).reduce((s, e) => s + (e.mood ?? 0), 0) /
            Math.max(1, diaryEntries.filter((e) => e.mood != null).length) * 10,
        ) / 10,
        avg_energy: Math.round(
          diaryEntries.filter((e) => e.energy != null).reduce((s, e) => s + (e.energy ?? 0), 0) /
            Math.max(1, diaryEntries.filter((e) => e.energy != null).length) * 10,
        ) / 10,
        avg_sleep: Math.round(
          diaryEntries.filter((e) => e.sleep_quality != null).reduce((s, e) => s + (e.sleep_quality ?? 0), 0) /
            Math.max(1, diaryEntries.filter((e) => e.sleep_quality != null).length) * 10,
        ) / 10,
        count: diaryEntries.length,
      }
    : null;

  // --- Weight ---
  const weightEntries = ctx.db
    .prepare(
      `SELECT id, ts, date, kg, body_fat_pct, notes
         FROM weight_entries
        WHERE date >= ? AND date <= ?
        ORDER BY ts DESC`,
    )
    .all(start, end) as Array<{
    id: string; ts: string; date: string; kg: number; body_fat_pct: number | null; notes: string | null;
  }>;

  // --- Latest lab results (most recent panel within range, or latest overall) ---
  const labResults = ctx.db
    .prepare(
      `SELECT lr.id, lr.biomarker_id, lr.taken_at, lr.value_numeric, lr.value_text,
              lr.unit_ucum, lr.ref_low, lr.ref_high, lr.interpretation,
              b.name AS biomarker_name, b.default_ref_low, b.default_ref_high
         FROM lab_results lr
         JOIN biomarkers b ON b.id = lr.biomarker_id
        WHERE lr.taken_at >= ? AND lr.taken_at <= ?
        ORDER BY lr.taken_at DESC LIMIT 50`,
    )
    .all(`${start}T00:00:00Z`, `${end}T23:59:59Z`) as Array<{
    id: string; biomarker_id: string; taken_at: string; value_numeric: number | null;
    value_text: string | null; unit_ucum: string; ref_low: number | null; ref_high: number | null;
    interpretation: string | null; biomarker_name: string;
    default_ref_low: number | null; default_ref_high: number | null;
  }>;

  return {
    start,
    end,
    generated_at: new Date().toISOString(),
    nutrition: { daily: intakeRows, avg: nutritionAvg },
    hydration: { daily: hydrationRows, avg_ml: hydrationAvg },
    fluid_balance: {
      total_intake_ml: totalIntake,
      total_output_ml: totalOutput,
      balance_ml: totalIntake - totalOutput,
      output_by_kind: fluidOutputByKind,
      entries: fluidOutput,
    },
    blood_pressure: { entries: bpEntries, stats: bpStats },
    dialysis: { entries: dialysisEntries, stats: dialysisStats },
    pain: { entries: painEntries, stats: painStats },
    medications,
    diary: { entries: diaryEntries, stats: diaryStats },
    weight: weightEntries,
    lab_results: labResults,
  };
};
