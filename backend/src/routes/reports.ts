// FR-07.3 Employee Efficiency & OEE + dasbor ringkasan (FR-FND-01, FR-FIN-01, FR-SPV-01)
// Endpoint: /reports/efficiency, /reports/oee, /reports/leaderboard, /reports/my-efficiency, /me/efficiency,
//           /dashboard/founder, /dashboard/supervisor, /dashboard/finance
// (/reports/cutting-yield, /reports/downtime, /reports/defect-* dibuat modul produksi/QC.)
import express, { Request, Response } from 'express';
import { query, queryOne } from '../lib/db.ts';
import { ah, notFound, oneOf } from '../lib/http.ts';
import { allow } from '../lib/auth.ts';
import { assertStaffFeature, costingSummary, LABOR_CREDITS_SQL, rangeParam, todayWib, varianceThreshold } from './finance.ts';

export const reportsRouter = express.Router();

const str = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const round = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
// Jalankan query berurutan (hemat koneksi DB bersama)
async function seq<T extends readonly (() => Promise<any>)[]>(fns: T): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: any[] = [];
  for (const fn of fns) out.push(await fn());
  return out as any;
}
const WIB_DAY_START = (col: string) => `(${col}::timestamp AT TIME ZONE 'Asia/Jakarta')`;
const WIB_DAY_END = (col: string) => `((${col} + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')`;

// Lini: id atau kode (SEW-1)
async function resolveLine(raw: unknown): Promise<any | null> {
  const v = str(raw);
  if (!v) return null;
  const r = await queryOne(`SELECT id, code, name FROM erp.production_lines WHERE id::text = $1 OR upper(code) = upper($1)`, [v]);
  if (!r) throw notFound('Lini produksi tidak ditemukan.', 'LINE_NOT_FOUND');
  return r;
}

// Mesin: id atau kode aset (MC-SRB-F007-03)
async function resolveMachine(raw: unknown): Promise<any | null> {
  const v = str(raw);
  if (!v) return null;
  const r = await queryOne(`SELECT id, asset_code FROM erp.machines WHERE id::text = $1 OR upper(asset_code) = upper($1)`, [v]);
  if (!r) throw notFound('Mesin tidak ditemukan.', 'MACHINE_NOT_FOUND');
  return r;
}

// =====================================================================
// Efisiensi operator — Efficiency = Σ(output Pass × SMV) / waktu kerja aktual × 100%
// Waktu kerja aktual = (planned − istirahat) dari work_shifts − downtime mesin yang dipakai operator hari itu
// (downtime mesin dianggap bukan kesalahan operator). Scan anomali yang belum direviu / ditolak dikecualikan.
// Output Pass = qty Pass QC bundel asal (termasuk rework yang lolos QC ulang). Operasi rework tidak dihitung ulang.
// =====================================================================
interface EffFilter { operatorId?: number | null; lineId?: number | null }

async function efficiencyDays(from: string, to: string, f: EffFilter = {}) {
  return query(
    `WITH t AS (
       SELECT t.id, t.operator_id, t.machine_id, t.qty, t.bundle_id, b.is_rework, o.smv_minutes,
              erp.fn_wib_date(t.completed_at) AS work_date,
              (t.is_anomaly AND t.anomaly_accepted IS NOT TRUE) AS excluded,
              (t.is_anomaly AND t.anomaly_reviewed_at IS NULL) AS pending_review,
              -- pcs dihitung sekali per bundel per operator-hari (operator bisa mengerjakan beberapa operasi di bundel yang sama)
              row_number() OVER (PARTITION BY t.operator_id, erp.fn_wib_date(t.completed_at), t.bundle_id,
                                 (t.is_anomaly AND t.anomaly_accepted IS NOT TRUE) ORDER BY t.id) = 1 AS first_in_bundle
       FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id JOIN erp.bundles b ON b.id = t.bundle_id
       WHERE t.completed_at IS NOT NULL AND erp.fn_wib_date(t.completed_at) BETWEEN $1::date AND $2::date
         AND ($3::bigint IS NULL OR t.operator_id = $3)
     ), pass AS (
       SELECT coalesce(b.root_bundle_id, b.id) AS root_id, sum(q.qty_pass) AS qty_pass
       FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id
       WHERE coalesce(b.root_bundle_id, b.id) IN (SELECT bundle_id FROM t)
       GROUP BY 1
     ), insp AS (
       SELECT DISTINCT bundle_id FROM erp.qc_inspections WHERE bundle_id IN (SELECT bundle_id FROM t)
     ), o AS (
       SELECT t.operator_id, t.work_date,
              sum(CASE WHEN NOT t.excluded AND NOT t.is_rework THEN coalesce(p.qty_pass, 0) * t.smv_minutes ELSE 0 END) AS earned_min,
              sum(CASE WHEN NOT t.excluded AND NOT t.is_rework AND t.first_in_bundle THEN coalesce(p.qty_pass, 0) ELSE 0 END) AS pass_pcs,
              coalesce(sum(t.qty) FILTER (WHERE NOT t.excluded AND t.first_in_bundle), 0) AS output_pcs,
              coalesce(sum(t.qty) FILTER (WHERE NOT t.excluded AND NOT t.is_rework AND i.bundle_id IS NULL AND t.first_in_bundle), 0) AS pending_qc_pcs,
              count(*) FILTER (WHERE t.excluded) AS excluded_scans,
              count(*) FILTER (WHERE t.pending_review) AS pending_review_scans
       FROM t LEFT JOIN pass p ON p.root_id = t.bundle_id LEFT JOIN insp i ON i.bundle_id = t.bundle_id
       GROUP BY 1, 2
     ), sh AS (
       SELECT s.operator_id, s.work_date, s.line_id, greatest(s.planned_minutes - s.break_minutes, 0) AS shift_min
       FROM erp.work_shifts s
       WHERE s.work_date BETWEEN $1::date AND $2::date AND ($3::bigint IS NULL OR s.operator_id = $3)
     ), md AS (
       SELECT DISTINCT operator_id, work_date, machine_id FROM t WHERE machine_id IS NOT NULL
     ), dt AS (
       SELECT md.operator_id, md.work_date,
              sum(greatest(0, extract(epoch FROM least(coalesce(d.resolved_at, now()), ${WIB_DAY_END('md.work_date')})
                                              - greatest(d.reported_at, ${WIB_DAY_START('md.work_date')})) / 60)) AS dt_min
       FROM md JOIN erp.downtime_tickets d ON d.machine_id = md.machine_id
        AND d.reported_at < ${WIB_DAY_END('md.work_date')} AND coalesce(d.resolved_at, now()) > ${WIB_DAY_START('md.work_date')}
       GROUP BY 1, 2
     ), day AS (
       SELECT coalesce(o.operator_id, sh.operator_id) AS operator_id, coalesce(o.work_date, sh.work_date) AS work_date,
              sh.line_id AS shift_line_id, sh.shift_min,
              least(coalesce(dt.dt_min, 0), coalesce(sh.shift_min, 0)) AS downtime_min,
              coalesce(o.earned_min, 0) AS earned_min, coalesce(o.pass_pcs, 0) AS pass_pcs, coalesce(o.output_pcs, 0) AS output_pcs,
              coalesce(o.pending_qc_pcs, 0) AS pending_qc_pcs, coalesce(o.excluded_scans, 0) AS excluded_scans,
              coalesce(o.pending_review_scans, 0) AS pending_review_scans
       FROM o FULL JOIN sh ON sh.operator_id = o.operator_id AND sh.work_date = o.work_date
       LEFT JOIN dt ON dt.operator_id = coalesce(o.operator_id, sh.operator_id) AND dt.work_date = coalesce(o.work_date, sh.work_date)
     )
     SELECT day.operator_id, day.work_date::text, day.shift_min, round(day.downtime_min::numeric, 2) AS downtime_min,
            round(day.earned_min::numeric, 2) AS earned_min, day.pass_pcs, day.output_pcs, day.pending_qc_pcs,
            day.excluded_scans, day.pending_review_scans,
            u.full_name AS operator_name, u.operator_code, u.staff_function,
            pl.id AS line_id, pl.code AS line_code, pl.name AS line_name
     FROM day JOIN erp.users u ON u.id = day.operator_id
     LEFT JOIN erp.production_lines pl ON pl.id = coalesce(day.shift_line_id, u.line_id)
     WHERE ($4::int IS NULL OR pl.id = $4)
     ORDER BY u.full_name, day.work_date`,
    [from, to, f.operatorId ?? null, f.lineId ?? null]);
}

/** Agregasi baris harian → per operator / per lini. Hari tanpa shift tidak masuk rasio (N/A bila tidak ada shift sama sekali). */
function aggregate(days: any[], key: 'operator' | 'line') {
  const map = new Map<string, any>();
  for (const d of days) {
    const k = key === 'operator' ? String(d.operator_id) : String(d.line_id ?? 'none');
    if (!map.has(k)) {
      map.set(k, key === 'operator'
        ? { operator_id: d.operator_id, operator_code: d.operator_code, operator_name: d.operator_name, line_code: d.line_code, line_name: d.line_name, _ops: null }
        : { line_id: d.line_id, line_code: d.line_code ?? null, line_name: d.line_name ?? 'Tanpa lini', _ops: new Set() });
      Object.assign(map.get(k), { days_with_shift: 0, days_without_shift: 0, shift_min: 0, downtime_min: 0, work_min: 0,
        earned_min: 0, earned_min_without_shift: 0, pass_pcs: 0, output_pcs: 0, pending_qc_pcs: 0, excluded_scans: 0, pending_review_scans: 0 });
    }
    const a = map.get(k);
    if (a._ops) a._ops.add(d.operator_id);
    a.pass_pcs += d.pass_pcs; a.output_pcs += d.output_pcs; a.pending_qc_pcs += d.pending_qc_pcs;
    a.excluded_scans += d.excluded_scans; a.pending_review_scans += d.pending_review_scans;
    if (d.shift_min !== null && d.shift_min !== undefined) {
      a.days_with_shift += 1; a.shift_min += d.shift_min; a.downtime_min += d.downtime_min;
      a.work_min += Math.max(d.shift_min - d.downtime_min, 0); a.earned_min += d.earned_min;
    } else {
      a.days_without_shift += 1; a.earned_min_without_shift += d.earned_min;
    }
  }
  return [...map.values()].map(({ _ops, ...a }) => {
    const eff = a.work_min > 0 ? round((a.earned_min / a.work_min) * 100, 1) : null;
    const out: any = {
      ...a,
      ...(key === 'line' ? { operators: _ops.size } : {}),
      downtime_min: round(a.downtime_min, 1), earned_min: round(a.earned_min, 2), earned_min_without_shift: round(a.earned_min_without_shift, 2),
      efficiency_pct: eff,
      efficiency_display: eff === null ? 'N/A' : `${eff}%`,
    };
    if (eff === null) out.note = 'Data shift tidak ada.';
    else if (a.days_without_shift > 0) out.note = `${a.days_without_shift} hari tanpa data shift tidak dihitung.`;
    return out;
  });
}

function excludedNote(rows: any[]) {
  const n = rows.reduce((s, r) => s + r.excluded_scans, 0);
  return { excluded_scans: n, excluded_note: n > 0 ? `${n} scan dikecualikan.` : null };
}

// GET /reports/efficiency?group_by=operator|line&from=&to=&line=&operator=
reportsRouter.get('/reports/efficiency', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const groupBy = oneOf(String(req.query.group_by ?? 'operator').toLowerCase(), ['operator', 'line'] as const, 'group_by');
  const { from, to } = rangeParam(req.query);
  const line = await resolveLine(req.query.line ?? req.query.line_id);
  let operatorId: number | null = null;
  const opRaw = str(req.query.operator ?? req.query.operator_id);
  if (opRaw) {
    const u = await queryOne(`SELECT id FROM erp.users WHERE id::text = $1 OR operator_code = upper($1)`, [opRaw]);
    if (!u) throw notFound('Operator tidak ditemukan.', 'OPERATOR_NOT_FOUND');
    operatorId = u.id;
  }
  const days = await efficiencyDays(from, to, { operatorId, lineId: line?.id });
  const data = aggregate(days, groupBy).sort((a, b) => (b.efficiency_pct ?? -1) - (a.efficiency_pct ?? -1));
  const totalWork = data.reduce((s, r) => s + r.work_min, 0);
  const totalEarned = data.reduce((s, r) => s + (r.earned_min ?? 0), 0);
  res.json({
    group_by: groupBy, from, to, line: line?.code ?? null,
    formula: 'Σ(output Pass QC × SMV) ÷ waktu kerja aktual (shift − istirahat − downtime mesin) × 100%',
    data,
    summary: { efficiency_pct: totalWork > 0 ? round((totalEarned / totalWork) * 100, 1) : null, work_min: totalWork, earned_min: round(totalEarned, 2), ...excludedNote(data) },
  });
}));

// GET /reports/leaderboard?line=&from=&to=&limit=
reportsRouter.get('/reports/leaderboard', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const { from, to } = rangeParam(req.query);
  const line = await resolveLine(req.query.line ?? req.query.line_id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
  const rows = aggregate(await efficiencyDays(from, to, { lineId: line?.id }), 'operator');
  const ranked = rows.filter((r) => r.efficiency_pct !== null).sort((a, b) => b.efficiency_pct - a.efficiency_pct || b.pass_pcs - a.pass_pcs)
    .map((r, i) => ({ rank: i + 1, ...r }));
  const na = rows.filter((r) => r.efficiency_pct === null).map((r) => ({ rank: null, ...r }));
  res.json({ from, to, line: line?.code ?? null, data: [...ranked.slice(0, limit), ...na], ranked_count: ranked.length, not_available_count: na.length, ...excludedNote(rows) });
}));

// GET /reports/my-efficiency (Staff, skor sendiri — opsional) · alias /me/efficiency
async function myEfficiency(req: Request, res: Response) {
  await assertStaffFeature('ANALYTICS');
  const { from, to } = rangeParam(req.query);
  const days = await efficiencyDays(from, to, { operatorId: req.user!.id });
  const [me] = aggregate(days, 'operator');
  const daily = days.map((d: any) => {
    const work = d.shift_min !== null && d.shift_min !== undefined ? Math.max(d.shift_min - d.downtime_min, 0) : null;
    const eff = work ? round((d.earned_min / work) * 100, 1) : null;
    return { work_date: d.work_date, pass_pcs: d.pass_pcs, output_pcs: d.output_pcs, pending_qc_pcs: d.pending_qc_pcs, work_min: work,
      efficiency_pct: eff, efficiency_display: eff === null ? 'N/A' : `${eff}%`, excluded_scans: d.excluded_scans };
  });
  res.json({
    from, to,
    operator: { id: req.user!.id, name: req.user!.name, operator_code: req.user!.operatorCode },
    efficiency_pct: me?.efficiency_pct ?? null, efficiency_display: me?.efficiency_display ?? 'N/A',
    pass_pcs: me?.pass_pcs ?? 0, output_pcs: me?.output_pcs ?? 0, pending_qc_pcs: me?.pending_qc_pcs ?? 0,
    excluded_scans: me?.excluded_scans ?? 0, note: me?.note ?? (me ? null : 'Belum ada data pada periode ini.'),
    daily,
  });
}
reportsRouter.get('/reports/my-efficiency', allow({ staff: '*' }), ah(myEfficiency));
reportsRouter.get('/me/efficiency', allow({ staff: '*' }), ah(myEfficiency));

// =====================================================================
// OEE mesin = Availability × Performance × Quality
//  Availability = (waktu rencana − downtime) / waktu rencana; waktu rencana = hari produksi × machine_planned_minutes_per_day
//    (hari produksi = ada shift di lini mesin atau ada scan selesai di mesin itu)
//  Performance  = Σ(output × SMV) / waktu operasi aktual (dibatasi maks. 100% untuk OEE)
//  Quality      = Pass / total diinspeksi (first-pass, bundel yang dikerjakan di mesin tsb.)
// =====================================================================
async function oeeRows(from: string, to: string, machineId: number | null, lineId: number | null = null) {
  return query(
    `WITH m AS (
       SELECT m.id, m.asset_code, m.brand_model, m.machine_type, m.line_id, m.status
       FROM erp.machines m WHERE ($3::bigint IS NULL OR m.id = $3) AND ($4::int IS NULL OR m.line_id = $4)
         AND ($3::bigint IS NOT NULL OR m.status <> 'INACTIVE')
     ), plan AS (SELECT erp.fn_setting_num('machine_planned_minutes_per_day', 480) AS min_per_day),
     t AS (
       SELECT t.machine_id, t.bundle_id, t.qty, o.smv_minutes, erp.fn_wib_date(t.completed_at) AS work_date,
              (t.is_anomaly AND t.anomaly_accepted IS NOT TRUE) AS excluded
       FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
       WHERE t.machine_id IN (SELECT id FROM m) AND t.completed_at IS NOT NULL
         AND erp.fn_wib_date(t.completed_at) BETWEEN $1::date AND $2::date
     ), pd AS (
       SELECT DISTINCT m.id AS machine_id, x.d::date AS day
       FROM m CROSS JOIN generate_series($1::date, $2::date, interval '1 day') x(d)
       WHERE EXISTS (SELECT 1 FROM erp.work_shifts s WHERE s.line_id = m.line_id AND s.work_date = x.d::date)
          OR EXISTS (SELECT 1 FROM t WHERE t.machine_id = m.id AND t.work_date = x.d::date)
     ), dt AS (
       SELECT pd.machine_id, pd.day,
              least((SELECT min_per_day FROM plan), sum(greatest(0, extract(epoch FROM
                    least(coalesce(d.resolved_at, now()), ${WIB_DAY_END('pd.day')}) - greatest(d.reported_at, ${WIB_DAY_START('pd.day')})) / 60))) AS dt_min
       FROM pd JOIN erp.downtime_tickets d ON d.machine_id = pd.machine_id
        AND d.reported_at < ${WIB_DAY_END('pd.day')} AND coalesce(d.resolved_at, now()) > ${WIB_DAY_START('pd.day')}
       GROUP BY 1, 2
     ), qb AS (
       SELECT DISTINCT t.machine_id, t.bundle_id FROM t WHERE NOT t.excluded
     ), q AS (
       SELECT qb.machine_id, sum(qi.qty_pass) AS pass_pcs, sum(qi.qty_pass + qi.qty_rework + qi.qty_reject) AS inspected_pcs
       FROM qb JOIN erp.qc_inspections qi ON qi.bundle_id = qb.bundle_id GROUP BY 1
     )
     SELECT m.id AS machine_id, m.asset_code, m.brand_model, m.machine_type, m.status, pl.code AS line_code, pl.name AS line_name,
            (SELECT count(*) FROM pd WHERE pd.machine_id = m.id) AS production_days,
            (SELECT count(*) FROM pd WHERE pd.machine_id = m.id) * (SELECT min_per_day FROM plan) AS planned_min,
            coalesce((SELECT round(sum(dt_min)::numeric, 2) FROM dt WHERE dt.machine_id = m.id), 0) AS downtime_min,
            coalesce((SELECT round(sum(t.qty * t.smv_minutes), 2) FROM t WHERE t.machine_id = m.id AND NOT t.excluded), 0) AS earned_min,
            coalesce((SELECT sum(t.qty) FROM t WHERE t.machine_id = m.id AND NOT t.excluded), 0) AS output_pcs,
            (SELECT count(*) FROM t WHERE t.machine_id = m.id AND t.excluded) AS excluded_scans,
            q.pass_pcs, q.inspected_pcs,
            (SELECT count(*) FROM erp.downtime_tickets d WHERE d.machine_id = m.id
               AND d.reported_at < ${WIB_DAY_END('$2::date')} AND coalesce(d.resolved_at, now()) > ${WIB_DAY_START('$1::date')}) AS downtime_tickets
     FROM m LEFT JOIN erp.production_lines pl ON pl.id = m.line_id LEFT JOIN q ON q.machine_id = m.id
     ORDER BY m.asset_code`,
    [from, to, machineId, lineId]);
}

function shapeOee(r: any) {
  const planned = Number(r.planned_min);
  const operating = Math.max(planned - Number(r.downtime_min), 0);
  const A = planned > 0 ? operating / planned : null;
  const Praw = operating > 0 ? Number(r.earned_min) / operating : null;
  const P = Praw === null ? null : Math.min(Praw, 1);
  const Q = Number(r.inspected_pcs) > 0 ? Number(r.pass_pcs) / Number(r.inspected_pcs) : null;
  const oee = A !== null && P !== null && Q !== null ? A * P * Q : null;
  const pct = (v: number | null) => (v === null ? null : round(v * 100, 1));
  return {
    machine_id: r.machine_id, asset_code: r.asset_code, brand_model: r.brand_model, machine_type: r.machine_type, status: r.status,
    line_code: r.line_code, line_name: r.line_name,
    availability_pct: pct(A), performance_pct: pct(P), quality_pct: pct(Q), oee_pct: pct(oee),
    oee_display: oee === null ? 'N/A' : `${pct(oee)}%`,
    performance_raw_pct: pct(Praw),
    planned_min: planned, downtime_min: Number(r.downtime_min), operating_min: round(operating, 2), earned_min: Number(r.earned_min),
    production_days: Number(r.production_days), output_pcs: Number(r.output_pcs),
    pass_pcs: r.pass_pcs === null ? 0 : Number(r.pass_pcs), inspected_pcs: r.inspected_pcs === null ? 0 : Number(r.inspected_pcs),
    downtime_tickets: Number(r.downtime_tickets), excluded_scans: Number(r.excluded_scans),
    note: planned === 0 ? 'Tidak ada hari produksi pada periode ini.' : Q === null ? 'Belum ada output yang di-QC.' : null,
  };
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? round(v.reduce((s, x) => s + x, 0) / v.length, 1) : null;
};

// GET /reports/oee?machine=&line=&from=&to=
reportsRouter.get('/reports/oee', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const { from, to } = rangeParam(req.query);
  const machine = await resolveMachine(req.query.machine ?? req.query.machine_id);
  const line = await resolveLine(req.query.line ?? req.query.line_id);
  const data = (await oeeRows(from, to, machine?.id ?? null, line?.id ?? null)).map(shapeOee);
  let downtime: any[] | undefined;
  if (machine) {
    downtime = await query(
      `SELECT d.ticket_no, d.issue_type, d.status, d.reported_at, d.resolved_at,
              round((extract(epoch FROM coalesce(d.resolved_at, now()) - d.reported_at) / 60)::numeric, 1) AS duration_min, u.full_name AS assigned_to_name
       FROM erp.downtime_tickets d LEFT JOIN erp.users u ON u.id = d.assigned_to
       WHERE d.machine_id = $1 AND d.reported_at < ${WIB_DAY_END('$3::date')} AND coalesce(d.resolved_at, now()) > ${WIB_DAY_START('$2::date')}
       ORDER BY d.reported_at DESC`, [machine.id, from, to]);
  }
  res.json({
    from, to, machine: machine?.asset_code ?? null, line: line?.code ?? null,
    formula: 'OEE = Availability × Performance × Quality',
    data,
    summary: {
      machines: data.length,
      avg_availability_pct: avg(data.map((d) => d.availability_pct)), avg_performance_pct: avg(data.map((d) => d.performance_pct)),
      avg_quality_pct: avg(data.map((d) => d.quality_pct)), avg_oee_pct: avg(data.map((d) => d.oee_pct)),
    },
    ...(downtime ? { downtime } : {}),
  });
}));

// =====================================================================
// Dasbor
// =====================================================================
const prevMonthRange = (from: string) => {
  const d = new Date(from + 'T00:00:00Z');
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};
const varianceChip = (v: number | null, thr: number) => (v === null ? null : Math.abs(v) <= 3 ? 'GREEN' : Math.abs(v) <= thr ? 'YELLOW' : 'RED');

/** Progres SPK aktif (tanpa data biaya). */
async function activeWoProgress(limit = 50) {
  return query(
    `SELECT w.id, w.wo_no, s.code AS sku_code, s.name AS sku_name, br.code AS brand_code, w.target_qty, w.due_date::text, w.destination,
            coalesce(cut.pcs, 0) AS cut_pcs, coalesce(bd.sewn, 0) AS sewn_pcs, coalesce(qc.pass, 0) AS qc_pass_pcs,
            coalesce(qc.rework, 0) AS qc_rework_pcs, coalesce(qc.reject, 0) AS qc_reject_pcs, coalesce(pk.packed, 0) AS packed_pcs,
            (w.due_date < (now() AT TIME ZONE 'Asia/Jakarta')::date) AS overdue
     FROM erp.work_orders w JOIN erp.skus s ON s.id = w.sku_id JOIN erp.brands br ON br.id = s.brand_id
     LEFT JOIN LATERAL (SELECT sum(cut_pcs) AS pcs FROM erp.cutting_records WHERE work_order_id = w.id) cut ON true
     LEFT JOIN LATERAL (SELECT sum(qty) AS sewn FROM erp.bundles WHERE work_order_id = w.id AND NOT is_rework AND status IN ('SEWN','INSPECTED')) bd ON true
     LEFT JOIN LATERAL (SELECT sum(q.qty_pass) AS pass, sum(q.qty_rework) AS rework, sum(q.qty_reject) AS reject
                        FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id WHERE b.work_order_id = w.id) qc ON true
     LEFT JOIN LATERAL (SELECT sum(i.qty) AS packed FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
                        WHERE u.work_order_id = w.id AND u.status = 'CONFIRMED') pk ON true
     WHERE w.status = 'ACTIVE' ORDER BY w.due_date, w.wo_no LIMIT $1`, [limit]);
}
const withPct = (r: any) => {
  const p = (v: number) => (r.target_qty > 0 ? round((v / r.target_qty) * 100, 1) : null);
  return { ...r, progress_pct: { cutting: p(r.cut_pcs), sewing: p(r.sewn_pcs), qc: p(r.qc_pass_pcs), packing: p(r.packed_pcs) } };
};

async function qcStats(from: string, to: string) {
  const r = await queryOne(
    `SELECT coalesce(sum(qty_pass + qty_rework + qty_reject), 0) AS inspected, coalesce(sum(qty_pass), 0) AS pass,
            coalesce(sum(qty_rework), 0) AS rework, coalesce(sum(qty_reject), 0) AS reject
     FROM erp.qc_inspections WHERE erp.fn_wib_date(inspected_at) BETWEEN $1::date AND $2::date`, [from, to]);
  const inspected = Number(r.inspected);
  return { ...r, defect_rate_pct: inspected > 0 ? round(((Number(r.rework) + Number(r.reject)) / inspected) * 100, 2) : null };
}

// GET /dashboard/founder?from=&to= — ringkasan pabrik (boleh berisi data biaya)
reportsRouter.get('/dashboard/founder', allow('FOUNDER'), ah(async (req, res) => {
  const { from, to } = rangeParam(req.query);
  const thr = await varianceThreshold();
  const prev = prevMonthRange(from);
  const [activeWo, packed, qc, oee, cost, brands, brandsPrev, recent] = await seq([
    () => queryOne(`SELECT count(*) AS n, coalesce(sum(target_qty), 0) AS target FROM erp.work_orders WHERE status = 'ACTIVE'`),
    () => queryOne(`SELECT coalesce(sum(i.qty), 0) AS pcs, count(DISTINCT u.id) AS packs FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
              WHERE u.status = 'CONFIRMED' AND erp.fn_wib_date(u.confirmed_at) BETWEEN $1::date AND $2::date`, [from, to]),
    () => qcStats(from, to),
    () => oeeRows(from, to, null),
    () => queryOne(`SELECT count(*) AS calculated, count(*) FILTER (WHERE c.status = 'PROVISIONAL') AS provisional,
                     count(*) FILTER (WHERE abs(c.variance_pct) > $3) AS over_threshold,
                     round((sum(c.fg_qty * c.act_total) - sum(c.fg_qty * c.est_total)) / nullif(sum(c.fg_qty * c.est_total), 0) * 100, 2) AS variance_pct,
                     (SELECT count(*) FROM erp.work_orders w2 WHERE w2.status = 'CLOSED' AND erp.fn_wib_date(w2.closed_at) BETWEEN $1::date AND $2::date) AS closed
              FROM erp.work_order_costings c JOIN erp.work_orders w ON w.id = c.work_order_id
              WHERE w.status = 'CLOSED' AND erp.fn_wib_date(w.closed_at) BETWEEN $1::date AND $2::date`, [from, to, thr]),
    () => costingSummary('brand', from, to),
    () => costingSummary('brand', prev.from, prev.to),
    () => query(`SELECT w.wo_no AS work_order, s.code AS sku_code, br.code AS brand_code, w.closed_at, coalesce(c.status::text, 'NOT_CALCULATED') AS costing_status,
                  c.fg_qty, c.est_total, c.act_total, c.variance_pct
           FROM erp.work_orders w JOIN erp.skus s ON s.id = w.sku_id JOIN erp.brands br ON br.id = s.brand_id
           LEFT JOIN erp.work_order_costings c ON c.work_order_id = w.id
           WHERE w.status = 'CLOSED' AND erp.fn_wib_date(w.closed_at) BETWEEN $1::date AND $2::date
           ORDER BY w.closed_at DESC LIMIT 10`, [from, to]),
  ]);
  const oeeData = oee.map(shapeOee);
  const weightedMargin = (rows: any[]) => {
    const priced = rows.filter((r) => r.margin_pct !== null);
    const rev = priced.reduce((s, r) => s + Number(r.revenue_idr), 0);
    const cst = priced.reduce((s, r) => s + Number(r.priced_cost_idr), 0);
    return rev > 0 ? round(((rev - cst) / rev) * 100, 1) : null;
  };
  const margin = weightedMargin(brands);
  const marginPrev = weightedMargin(brandsPrev);
  const v = cost?.variance_pct ?? null;
  res.json({
    from, to,
    kpi: {
      active_work_orders: Number(activeWo.n), active_target_pcs: Number(activeWo.target),
      output_packed_pcs: Number(packed.pcs),
      defect_rate_pct: qc.defect_rate_pct, inspected_pcs: Number(qc.inspected),
      oee_pct: avg(oeeData.map((d) => d.oee_pct)), oee_target_pct: { current: 65, next: 75 },
      cost_variance_pct: v, cost_variance_chip: varianceChip(v, thr), cost_variance_warning: v !== null && Math.abs(v) > thr,
      work_orders_over_threshold: Number(cost?.over_threshold ?? 0),
      margin_avg_pct: margin, margin_prev_month_pct: marginPrev, margin_delta_pct: margin !== null && marginPrev !== null ? round(margin - marginPrev, 1) : null,
      provisional_label: Number(cost?.provisional ?? 0) > 0 ? 'Sementara' : null,
    },
    margin_by_brand: brands,
    recent_closed_work_orders: recent.map((r: any) => ({ ...r, variance_chip: varianceChip(r.variance_pct, thr), label: r.costing_status === 'PROVISIONAL' ? 'Sementara' : null })),
    empty_state: Number(cost?.closed ?? 0) === 0 ? 'Belum ada SPK selesai di periode ini.' : null,
    variance_threshold_pct: thr,
  });
}));

// GET /dashboard/supervisor?from=&to= — efisiensi lini, progres SPK, downtime terbuka, stok kritis (TANPA data biaya/tarif)
reportsRouter.get('/dashboard/supervisor', allow('SUPERVISOR', 'ADMIN', 'FOUNDER'), ah(async (req, res) => {
  const today = todayWib();
  const { from, to } = req.query.from || req.query.to ? rangeParam(req.query) : { from: today, to: today };
  const [wo, effDays, downtime, stock, todayQc, scansToday, machines] = await seq([
    () => activeWoProgress(),
    () => efficiencyDays(from, to),
    () => query(`SELECT d.id, d.ticket_no, m.asset_code, pl.code AS line_code, d.issue_type, d.status, d.reported_at, d.acknowledged_at, d.escalated_at,
                  u.full_name AS assigned_to_name, round((extract(epoch FROM now() - d.reported_at) / 60)::numeric, 1) AS elapsed_min
           FROM erp.downtime_tickets d JOIN erp.machines m ON m.id = d.machine_id
           LEFT JOIN erp.production_lines pl ON pl.id = d.line_id LEFT JOIN erp.users u ON u.id = d.assigned_to
           WHERE d.status <> 'RESOLVED' ORDER BY d.reported_at`),
    () => query(`SELECT m.code, m.name, m.category, m.uom, m.min_stock,
                  coalesce(sum(l.qty_on_hand) FILTER (WHERE l.qc_status = 'PASS'), 0) AS on_hand,
                  coalesce(sum(l.qty_reserved) FILTER (WHERE l.qc_status = 'PASS'), 0) AS reserved,
                  coalesce(sum(l.qty_on_hand - l.qty_reserved) FILTER (WHERE l.qc_status = 'PASS'), 0) AS free_qty
           FROM erp.materials m LEFT JOIN erp.material_lots l ON l.material_id = m.id
           WHERE m.status = 'ACTIVE' AND m.min_stock > 0
           GROUP BY m.id HAVING coalesce(sum(l.qty_on_hand - l.qty_reserved) FILTER (WHERE l.qc_status = 'PASS'), 0) <= m.min_stock
           ORDER BY m.category, m.code`),
    () => qcStats(today, today),
    () => queryOne(`SELECT count(*) AS n, coalesce(sum(qty), 0) AS pcs FROM erp.wip_tasks WHERE completed_at IS NOT NULL AND erp.fn_wib_date(completed_at) = $1::date`, [today]),
    () => query(`SELECT m.asset_code, m.machine_type, pl.code AS line_code, m.status FROM erp.machines m LEFT JOIN erp.production_lines pl ON pl.id = m.line_id
           WHERE m.status IN ('DOWN','MAINTENANCE') ORDER BY m.asset_code`),
  ]);
  const lines = aggregate(effDays, 'line').sort((a, b) => String(a.line_code).localeCompare(String(b.line_code)));
  res.json({
    date: today, from, to,
    kpi: {
      active_work_orders: wo.length,
      output_today_pass_pcs: Number(todayQc.pass), inspected_today_pcs: Number(todayQc.inspected), defect_rate_today_pct: todayQc.defect_rate_pct,
      scans_completed_today: Number(scansToday.n), pcs_completed_today: Number(scansToday.pcs),
      problem_machines: machines.length, open_downtime_tickets: downtime.length, critical_stock_items: stock.length,
    },
    line_efficiency: lines.map((l) => ({ line_code: l.line_code, line_name: l.line_name, operators: l.operators, efficiency_pct: l.efficiency_pct,
      efficiency_display: l.efficiency_display, pass_pcs: l.pass_pcs, output_pcs: l.output_pcs, excluded_scans: l.excluded_scans, note: l.note ?? null })),
    work_orders: wo.map(withPct),
    downtime_tickets: downtime,
    problem_machines: machines,
    critical_stock: stock,
  });
}));

// GET /dashboard/finance — draf payroll, SPK closed menunggu costing, overhead belum diinput
reportsRouter.get('/dashboard/finance', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const today = todayWib();
  const month = today.slice(0, 8) + '01';
  const thr = await varianceThreshold();
  const [drafts, waiting, ohCurrent, ohMissing, variance, scrap, notifs] = await seq([
    () => query(`SELECT p.id, p.period_start::text, p.period_end::text, p.frequency, p.generated_at,
                  coalesce(l.operators, 0) AS operators, coalesce(l.qty_pass, 0) AS qty_pass, coalesce(l.gross, 0) AS gross_idr,
                  coalesce(a.adj, 0) AS adjustment_idr, coalesce(l.gross, 0) + coalesce(a.adj, 0) AS total_idr, coalesce(l.no_rate, 0) AS lines_without_rate,
                  (SELECT count(*) FROM ${LABOR_CREDITS_SQL} lc WHERE lc.credit_date BETWEEN p.period_start AND p.period_end AND NOT lc.is_payable) AS anomaly_scans
           FROM erp.payroll_periods p
           LEFT JOIN LATERAL (SELECT count(DISTINCT operator_id) AS operators, sum(qty_pass) AS qty_pass, sum(amount) AS gross,
                                     count(*) FILTER (WHERE rate_idr IS NULL) AS no_rate FROM erp.payroll_lines WHERE period_id = p.id) l ON true
           LEFT JOIN LATERAL (SELECT sum(amount) AS adj FROM erp.payroll_adjustments WHERE period_id = p.id) a ON true
           WHERE p.status = 'DRAFT' ORDER BY p.period_start DESC LIMIT 10`),
    () => query(`SELECT w.id, w.wo_no AS work_order, s.code AS sku_code, w.closed_at, coalesce(c.status::text, 'NOT_CALCULATED') AS costing_status,
                  c.variance_pct, count(*) OVER () AS _total
           FROM erp.work_orders w JOIN erp.skus s ON s.id = w.sku_id LEFT JOIN erp.work_order_costings c ON c.work_order_id = w.id
           WHERE w.status = 'CLOSED' AND (c.work_order_id IS NULL OR c.status = 'PROVISIONAL')
           ORDER BY w.closed_at LIMIT 20`),
    () => queryOne(`SELECT p.id, to_char(p.period_month, 'YYYY-MM') AS month, p.status,
                     coalesce(sum(e.amount) FILTER (WHERE e.amount > 0), 0) AS gross_idr, coalesce(sum(e.amount) FILTER (WHERE e.amount < 0), 0) AS scrap_credit_idr,
                     coalesce(sum(e.amount), 0) AS net_idr, count(e.id) FILTER (WHERE e.ref_table IS NULL) AS manual_entries
              FROM erp.overhead_periods p LEFT JOIN erp.overhead_entries e ON e.period_id = p.id
              WHERE p.period_month = $1::date GROUP BY p.id`, [month]),
    // Bulan yang punya SPK closed tetapi overhead belum diinput manual / belum dikunci
    () => query(`SELECT to_char(x.m, 'YYYY-MM') AS month, x.closed_work_orders, p.id AS period_id, coalesce(p.status::text, 'NOT_CREATED') AS status,
                  coalesce((SELECT count(*) FROM erp.overhead_entries e WHERE e.period_id = p.id AND e.ref_table IS NULL), 0) AS manual_entries
           FROM (SELECT date_trunc('month', erp.fn_wib_date(closed_at))::date AS m, count(*) AS closed_work_orders
                 FROM erp.work_orders WHERE status = 'CLOSED' GROUP BY 1) x
           LEFT JOIN erp.overhead_periods p ON p.period_month = x.m
           WHERE p.id IS NULL OR p.status = 'OPEN'
           ORDER BY x.m`),
    () => queryOne(`SELECT count(*) AS n FROM erp.work_order_costings c JOIN erp.work_orders w ON w.id = c.work_order_id
              WHERE abs(c.variance_pct) > $1 AND w.status = 'CLOSED'`, [thr]),
    () => queryOne(`SELECT coalesce(sum(qty_kg), 0) AS qty_kg, coalesce(sum(total_amount), 0) AS amount_idr FROM erp.scrap_disposals
              WHERE method = 'SOLD' AND date_trunc('month', erp.fn_wib_date(disposed_at)) = $1::date`, [month]),
    () => query(`SELECT id, type, title, body, entity, entity_id, created_at, read_at FROM erp.notifications
           WHERE type IN ('COST_VARIANCE','WO_CLOSED','PAYROLL_READY') AND (target_role = $1 OR user_id = $2)
           ORDER BY created_at DESC LIMIT 10`, [req.user!.role, req.user!.id]),
  ]);
  const latest = drafts[0] ?? null;
  res.json({
    date: today,
    kpi: {
      payroll_drafts: drafts.length,
      work_orders_waiting_costing: Number(waiting[0]?._total ?? 0),
      work_orders_over_threshold: Number(variance.n),
      overhead_current_month_status: ohCurrent?.status ?? 'NOT_CREATED',
      overhead_months_pending: ohMissing.length,
      scrap_sales_month_idr: Number(scrap.amount_idr), scrap_sold_month_kg: Number(scrap.qty_kg),
    },
    payroll_summary: latest
      ? { period_id: latest.id, period_start: latest.period_start, period_end: latest.period_end, operators: latest.operators, qty_pass: latest.qty_pass,
          anomaly_scans: latest.anomaly_scans, total_idr: latest.total_idr, lines_without_rate: latest.lines_without_rate }
      : null,
    payroll_drafts: drafts,
    work_orders_waiting_costing: waiting.map(({ _total, ...r }: any) => r),
    overhead_current_month: ohCurrent ?? { month: month.slice(0, 7), status: 'NOT_CREATED', gross_idr: 0, scrap_credit_idr: 0, net_idr: 0, manual_entries: 0 },
    overhead_pending: ohMissing.map((m: any) => ({ ...m, note: Number(m.manual_entries) === 0 ? 'Overhead belum diinput.' : 'Overhead belum dikunci.' })),
    notifications: notifs,
    variance_threshold_pct: thr,
  });
}));

