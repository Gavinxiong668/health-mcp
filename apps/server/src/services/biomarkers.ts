import type { BiomarkerStatus } from '@health-mcp/shared';
import { convertUnit, unitsEqual } from '../biomarkers/units.js';
import { cuid } from '../util/id.js';
import { type Ctx, ServiceError } from './types.js';

export type Biomarker = {
  id: string;
  loinc_code: string | null;
  name: string;
  display_name: string | null;
  aliases: string | null;
  default_unit_ucum: string;
  value_type: 'numeric' | 'text' | 'numeric_or_text';
  default_ref_low: number | null;
  default_ref_high: number | null;
  optimal_low: number | null;
  optimal_high: number | null;
  notes: string | null;
  why_it_matters: string | null;
  influences: string | null;
  how_to_improve: string | null;
  created_at: string;
  updated_at: string;
};

export type LabResult = {
  id: string;
  biomarker_id: string;
  panel_id: string | null;
  taken_at: string;
  value_numeric: number | null;
  value_text: string | null;
  unit_ucum: string;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  interpretation: string | null;
  notes: string | null;
  draft: number;
  created_at: string;
};

export type LabPanel = {
  id: string;
  name: string | null;
  lab_name: string | null;
  ordered_by: string | null;
  drawn_at: string;
  fasting: number | null;
  source: string | null;
  source_ref: string | null;
  notes: string | null;
  created_at: string;
};

export const resolveBiomarker = (ctx: Ctx, key: string): Biomarker => {
  const findOne = (sql: string, param: string): Biomarker | undefined =>
    ctx.db.prepare(sql).get(param) as Biomarker | undefined;
  const byId = findOne('SELECT * FROM biomarkers WHERE id = ?', key);
  if (byId) return byId;
  const byName = findOne('SELECT * FROM biomarkers WHERE name = ? COLLATE NOCASE', key);
  if (byName) return byName;
  const byLoinc = findOne('SELECT * FROM biomarkers WHERE loinc_code = ?', key);
  if (byLoinc) return byLoinc;
  const fuzzy = ctx.db
    .prepare('SELECT * FROM biomarkers WHERE aliases LIKE ?')
    .all(`%"${key}"%`) as Biomarker[];
  if (fuzzy[0]) return fuzzy[0];
  throw new ServiceError('biomarker_not_found', `biomarker '${key}' not found`, 404);
};

export const searchBiomarker = (
  ctx: Ctx,
  args: { query: string; category?: string; limit?: number },
): Biomarker[] => {
  const limit = args.limit ?? 25;
  const like = `%${args.query}%`;
  if (args.category) {
    return ctx.db
      .prepare(
        `SELECT b.* FROM biomarkers b
         JOIN biomarker_category_map m ON m.biomarker_id = b.id
         JOIN biomarker_categories c ON c.id = m.category_id
         WHERE (b.name LIKE ? COLLATE NOCASE OR b.aliases LIKE ? OR b.loinc_code = ?)
           AND c.name = ? COLLATE NOCASE
         GROUP BY b.id
         ORDER BY b.name
         LIMIT ?`,
      )
      .all(like, `%"${args.query}"%`, args.query, args.category, limit) as Biomarker[];
  }
  return ctx.db
    .prepare(
      `SELECT * FROM biomarkers
       WHERE name LIKE ? COLLATE NOCASE OR aliases LIKE ? OR loinc_code = ?
       ORDER BY name
       LIMIT ?`,
    )
    .all(like, `%"${args.query}"%`, args.query, limit) as Biomarker[];
};

export const getBiomarker = (ctx: Ctx, idOrName: string): Biomarker =>
  resolveBiomarker(ctx, idOrName);

export const createCustomBiomarker = (
  ctx: Ctx,
  args: {
    name: string;
    default_unit_ucum: string;
    value_type?: 'numeric' | 'text' | 'numeric_or_text';
    loinc_code?: string;
    display_name?: string;
    aliases?: string[];
    categories?: string[];
    default_ref_low?: number;
    default_ref_high?: number;
    optimal_low?: number;
    optimal_high?: number;
    notes?: string;
    why_it_matters?: string;
    influences?: string;
    how_to_improve?: string;
  },
): Biomarker => {
  const id = cuid();
  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare(
        `INSERT INTO biomarkers (
          id, loinc_code, name, display_name, aliases, default_unit_ucum, value_type,
          default_ref_low, default_ref_high, optimal_low, optimal_high, notes,
          why_it_matters, influences, how_to_improve
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        args.loinc_code ?? null,
        args.name,
        args.display_name ?? null,
        args.aliases ? JSON.stringify(args.aliases) : null,
        args.default_unit_ucum,
        args.value_type ?? 'numeric',
        args.default_ref_low ?? null,
        args.default_ref_high ?? null,
        args.optimal_low ?? null,
        args.optimal_high ?? null,
        args.notes ?? null,
        args.why_it_matters ?? null,
        args.influences ?? null,
        args.how_to_improve ?? null,
      );
    for (const catName of args.categories ?? []) {
      let cat = ctx.db
        .prepare('SELECT id FROM biomarker_categories WHERE name = ? COLLATE NOCASE')
        .get(catName) as { id: string } | undefined;
      if (!cat) {
        const catId = cuid();
        ctx.db
          .prepare('INSERT INTO biomarker_categories (id, name) VALUES (?, ?)')
          .run(catId, catName);
        cat = { id: catId };
      }
      ctx.db
        .prepare('INSERT INTO biomarker_category_map (biomarker_id, category_id) VALUES (?, ?)')
        .run(id, cat.id);
    }
  });
  tx();
  return ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(id) as Biomarker;
};

export const updateBiomarker = (ctx: Ctx, args: Partial<Biomarker> & { id: string }): Biomarker => {
  const existing = ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(args.id) as
    | Biomarker
    | undefined;
  if (!existing) throw new ServiceError('biomarker_not_found', args.id, 404);
  ctx.db
    .prepare(
      `UPDATE biomarkers SET
        loinc_code = COALESCE(?, loinc_code),
        display_name = COALESCE(?, display_name),
        aliases = COALESCE(?, aliases),
        default_unit_ucum = COALESCE(?, default_unit_ucum),
        value_type = COALESCE(?, value_type),
        default_ref_low = ?,
        default_ref_high = ?,
        optimal_low = ?,
        optimal_high = ?,
        notes = ?,
        why_it_matters = ?,
        influences = ?,
        how_to_improve = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      args.loinc_code ?? null,
      args.display_name ?? null,
      args.aliases ?? null,
      args.default_unit_ucum ?? null,
      args.value_type ?? null,
      args.default_ref_low === undefined ? existing.default_ref_low : args.default_ref_low,
      args.default_ref_high === undefined ? existing.default_ref_high : args.default_ref_high,
      args.optimal_low === undefined ? existing.optimal_low : args.optimal_low,
      args.optimal_high === undefined ? existing.optimal_high : args.optimal_high,
      args.notes === undefined ? existing.notes : args.notes,
      args.why_it_matters === undefined ? existing.why_it_matters : args.why_it_matters,
      args.influences === undefined ? existing.influences : args.influences,
      args.how_to_improve === undefined ? existing.how_to_improve : args.how_to_improve,
      args.id,
    );
  return ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(args.id) as Biomarker;
};

export const setOptimalRange = (
  ctx: Ctx,
  args: { biomarker: string; low?: number | null; high?: number | null },
): Biomarker => {
  const b = resolveBiomarker(ctx, args.biomarker);
  ctx.db
    .prepare(
      `UPDATE biomarkers SET
        optimal_low = ?,
        optimal_high = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      args.low === undefined ? b.optimal_low : args.low,
      args.high === undefined ? b.optimal_high : args.high,
      b.id,
    );
  return ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(b.id) as Biomarker;
};

type LabResultInput = {
  biomarker: string;
  value_numeric?: number;
  value_text?: string;
  unit_ucum?: string;
  ref_low?: number;
  ref_high?: number;
  ref_text?: string;
  interpretation?: string;
  notes?: string;
  draft?: boolean;
};

const insertLabResult = (
  ctx: Ctx,
  args: LabResultInput & { taken_at: string; panel_id: string | null },
): LabResult => {
  const b = resolveBiomarker(ctx, args.biomarker);
  let value = args.value_numeric ?? null;
  let unit = args.unit_ucum ?? b.default_unit_ucum;
  let notes = args.notes ?? null;
  const isDraft = args.draft === true;
  if (
    value !== null &&
    unit.toLowerCase() !== b.default_unit_ucum.toLowerCase() &&
    args.value_text === undefined
  ) {
    const conv = convertUnit(b.name, value, unit, b.default_unit_ucum);
    if (conv.ok) {
      const originalNote = `original: ${value} ${unit}`;
      notes = notes ? `${notes}; ${originalNote}` : originalNote;
      value = conv.value;
      unit = b.default_unit_ucum;
    } else {
      notes = notes ? `${notes}; unit_mismatch` : 'unit_mismatch';
    }
  }
  if (!isDraft && value === null && args.value_text === undefined) {
    throw new ServiceError('missing_value', 'either value_numeric or value_text required', 400);
  }
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO lab_results (
        id, biomarker_id, panel_id, taken_at, value_numeric, value_text, unit_ucum,
        ref_low, ref_high, ref_text, interpretation, notes, draft
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      b.id,
      args.panel_id,
      args.taken_at,
      value,
      args.value_text ?? null,
      unit,
      args.ref_low ?? null,
      args.ref_high ?? null,
      args.ref_text ?? null,
      args.interpretation ?? null,
      notes,
      isDraft ? 1 : 0,
    );
  return ctx.db.prepare('SELECT * FROM lab_results WHERE id = ?').get(id) as LabResult;
};

export const logLabPanel = (
  ctx: Ctx,
  args: {
    lab_name?: string;
    drawn_at: string;
    fasting?: boolean;
    ordered_by?: string;
    notes?: string;
    source?: 'manual' | 'pdf_import' | 'api';
    source_ref?: string;
    panel_name?: string;
    results: LabResultInput[];
  },
): { panel: LabPanel; results: LabResult[] } => {
  const id = cuid();
  const inserted: LabResult[] = [];
  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare(
        `INSERT INTO lab_panels (id, name, lab_name, ordered_by, drawn_at, fasting, source, source_ref, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        args.panel_name ?? null,
        args.lab_name ?? null,
        args.ordered_by ?? null,
        args.drawn_at,
        args.fasting === undefined ? null : args.fasting ? 1 : 0,
        args.source ?? 'manual',
        args.source_ref ?? null,
        args.notes ?? null,
      );
    for (const r of args.results) {
      inserted.push(insertLabResult(ctx, { ...r, taken_at: args.drawn_at, panel_id: id }));
    }
  });
  tx();
  const panel = ctx.db.prepare('SELECT * FROM lab_panels WHERE id = ?').get(id) as LabPanel;
  return { panel, results: inserted };
};

export const logLabResult = (ctx: Ctx, args: LabResultInput & { taken_at: string }): LabResult =>
  insertLabResult(ctx, { ...args, panel_id: null });

export const listLabResults = (
  ctx: Ctx,
  args: {
    biomarker?: string;
    category?: string;
    start?: string;
    end?: string;
    out_of_range_only?: boolean;
    limit?: number;
  } = {},
): Array<LabResult & { status: BiomarkerStatus; biomarker: Biomarker }> => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.biomarker) {
    const b = resolveBiomarker(ctx, args.biomarker);
    conds.push('lr.biomarker_id = ?');
    params.push(b.id);
  }
  if (args.start) {
    conds.push('lr.taken_at >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('lr.taken_at <= ?');
    params.push(args.end);
  }
  let join = '';
  if (args.category) {
    join = `JOIN biomarker_category_map bcm ON bcm.biomarker_id = lr.biomarker_id
            JOIN biomarker_categories bc ON bc.id = bcm.category_id`;
    conds.push('bc.name = ? COLLATE NOCASE');
    params.push(args.category);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 200);
  const rows = ctx.db
    .prepare(`SELECT lr.* FROM lab_results lr ${join} ${where} ORDER BY lr.taken_at DESC LIMIT ?`)
    .all(...params) as LabResult[];
  const withStatus = rows.map((r) => {
    const biomarker = ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(r.biomarker_id) as Biomarker;
    return { ...r, status: statusForResult(ctx, r, biomarker), biomarker };
  });
  if (args.out_of_range_only) return withStatus.filter((r) => r.status === 'out_of_ref');
  return withStatus;
};

export const statusForResult = (ctx: Ctx, r: LabResult, b?: Biomarker): BiomarkerStatus => {
  if (r.value_numeric === null) return 'unknown';
  const biomarker =
    b ??
    (ctx.db.prepare('SELECT * FROM biomarkers WHERE id = ?').get(r.biomarker_id) as
      | Biomarker
      | undefined);
  if (!biomarker) return 'unknown';

  // Classify in the biomarker's default unit. When the result is reported in a
  // different unit, convert through the hardcoded table; the lab's own ref range is
  // in the foreign unit, so it can't be reused — fall back to the default range. If no
  // safe conversion exists we refuse to classify rather than compare mismatched units.
  let value = r.value_numeric;
  let refLow = r.ref_low ?? biomarker.default_ref_low ?? Number.NEGATIVE_INFINITY;
  let refHigh = r.ref_high ?? biomarker.default_ref_high ?? Number.POSITIVE_INFINITY;
  if (!unitsEqual(r.unit_ucum, biomarker.default_unit_ucum)) {
    const conv = convertUnit(
      biomarker.name,
      r.value_numeric,
      r.unit_ucum,
      biomarker.default_unit_ucum,
    );
    if (!conv.ok) return 'unknown';
    value = conv.value;
    refLow = biomarker.default_ref_low ?? Number.NEGATIVE_INFINITY;
    refHigh = biomarker.default_ref_high ?? Number.POSITIVE_INFINITY;
  }

  const hasOptimal = biomarker.optimal_low !== null || biomarker.optimal_high !== null;
  if (hasOptimal) {
    const lo = biomarker.optimal_low ?? Number.NEGATIVE_INFINITY;
    const hi = biomarker.optimal_high ?? Number.POSITIVE_INFINITY;
    if (value >= lo && value <= hi) return 'optimal';
  }
  const hasRef = refLow !== Number.NEGATIVE_INFINITY || refHigh !== Number.POSITIVE_INFINITY;
  if (hasRef) {
    if (value >= refLow && value <= refHigh) return 'in_ref';
    return 'out_of_ref';
  }
  return hasOptimal ? 'out_of_ref' : 'unknown';
};

export const latestBiomarkers = (
  ctx: Ctx,
  args: { category?: string; out_of_range_only?: boolean } = {},
): Array<{
  biomarker: Biomarker;
  result: LabResult;
  status: BiomarkerStatus;
  delta_vs_prev: number | null;
}> => {
  const filterCategory = args.category
    ? 'WHERE bcm.category_id IN (SELECT id FROM biomarker_categories WHERE name = ? COLLATE NOCASE)'
    : '';
  const params: unknown[] = [];
  if (args.category) params.push(args.category);
  const sql = `
    WITH ranked AS (
      SELECT
        lr.*,
        ROW_NUMBER() OVER (PARTITION BY biomarker_id ORDER BY taken_at DESC) AS rn
      FROM lab_results lr
    )
    SELECT lr.* FROM ranked lr
    ${args.category ? `JOIN biomarker_category_map bcm ON bcm.biomarker_id = lr.biomarker_id ${filterCategory}` : ''}
    WHERE rn = 1
  `;
  const rows = (ctx.db.prepare(sql).all(...params) as Array<LabResult & { rn?: number }>).map(
    ({ rn: _rn, ...rest }) => rest as LabResult,
  );
  const out: Array<{
    biomarker: Biomarker;
    result: LabResult;
    status: BiomarkerStatus;
    delta_vs_prev: number | null;
  }> = [];
  for (const r of rows) {
    const b = ctx.db
      .prepare('SELECT * FROM biomarkers WHERE id = ?')
      .get(r.biomarker_id) as Biomarker;
    const prev = ctx.db
      .prepare(
        'SELECT value_numeric FROM lab_results WHERE biomarker_id = ? AND id != ? ORDER BY taken_at DESC LIMIT 1',
      )
      .get(r.biomarker_id, r.id) as { value_numeric: number | null } | undefined;
    const status = statusForResult(ctx, r, b);
    if (args.out_of_range_only && status !== 'out_of_ref') continue;
    const delta =
      r.value_numeric !== null && prev?.value_numeric !== undefined && prev.value_numeric !== null
        ? r.value_numeric - prev.value_numeric
        : null;
    out.push({ biomarker: b, result: r, status, delta_vs_prev: delta });
  }
  return out;
};

export const biomarkerTrend = (
  ctx: Ctx,
  args: { biomarker: string; start?: string; end?: string },
): Array<{ ts: string; value: number | null; unit: string; status: BiomarkerStatus }> => {
  const b = resolveBiomarker(ctx, args.biomarker);
  const conds: string[] = ['biomarker_id = ?'];
  const params: unknown[] = [b.id];
  if (args.start) {
    conds.push('taken_at >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('taken_at <= ?');
    params.push(args.end);
  }
  const rows = ctx.db
    .prepare(`SELECT * FROM lab_results WHERE ${conds.join(' AND ')} ORDER BY taken_at ASC`)
    .all(...params) as LabResult[];
  return rows.map((r) => ({
    ts: r.taken_at,
    value: r.value_numeric,
    unit: r.unit_ucum,
    status: statusForResult(ctx, r, b),
  }));
};

export const listLabPanels = (
  ctx: Ctx,
  args: { start?: string; end?: string; limit?: number } = {},
): LabPanel[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.start) {
    conds.push('drawn_at >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('drawn_at <= ?');
    params.push(args.end);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 50);
  return ctx.db
    .prepare(`SELECT * FROM lab_panels ${where} ORDER BY drawn_at DESC LIMIT ?`)
    .all(...params) as LabPanel[];
};

export const getLabPanel = (ctx: Ctx, id: string): { panel: LabPanel; results: LabResult[] } => {
  const panel = ctx.db.prepare('SELECT * FROM lab_panels WHERE id = ?').get(id) as
    | LabPanel
    | undefined;
  if (!panel) throw new ServiceError('panel_not_found', `panel ${id} not found`, 404);
  const results = ctx.db
    .prepare('SELECT * FROM lab_results WHERE panel_id = ? ORDER BY taken_at')
    .all(id) as LabResult[];
  return { panel, results };
};

export const getLabPanelDetail = (
  ctx: Ctx,
  id: string,
): {
  panel: LabPanel;
  rows: Array<{ biomarker: Biomarker; result: LabResult; status: BiomarkerStatus }>;
} => {
  const { panel, results } = getLabPanel(ctx, id);
  const rows = results.map((result) => {
    const biomarker = ctx.db
      .prepare('SELECT * FROM biomarkers WHERE id = ?')
      .get(result.biomarker_id) as Biomarker;
    return { biomarker, result, status: statusForResult(ctx, result, biomarker) };
  });
  return { panel, rows };
};

export const deleteLabResult = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM lab_results WHERE id = ?').run(id);
  if (r.changes === 0) throw new ServiceError('result_not_found', `result ${id} not found`, 404);
  return { id };
};

export const deleteLabPanel = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM lab_panels WHERE id = ?').run(id);
  if (r.changes === 0) throw new ServiceError('panel_not_found', `panel ${id} not found`, 404);
  return { id };
};

export const listBiomarkerCategories = (ctx: Ctx): Array<{ name: string; count: number }> => {
  return ctx.db
    .prepare(
      `SELECT c.name, COUNT(DISTINCT m.biomarker_id) as count
       FROM biomarker_categories c
       LEFT JOIN biomarker_category_map m ON m.category_id = c.id
       GROUP BY c.id, c.name
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as Array<{ name: string; count: number }>;
};
