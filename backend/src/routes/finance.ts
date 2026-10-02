// FR-07.1 Piece-Rate Payroll Automation · FR-07.2 Actual vs Estimated Costing (HPP per Batch) + Overhead
// Endpoint: /payroll/*, /me/payroll, /overhead/*, /costing/*
//
// Catatan DB: fn_generate_payroll, fn_calculate_wo_costing (dan fn_lock_overhead_period yang memanggilnya)
// bergantung pada view erp.v_labor_credits dari 03_views.sql. Bila view itu belum ada di database,
// API memakai implementasi setara di bawah (LABOR_CREDITS_SQL) di dalam transaksi yang sama.
import express, { Request, Response } from 'express';
import { PoolClient } from 'pg';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, conflict, forbidden, idParam, notFound, num, oneOf, paging, required } from '../lib/http.ts';
import { allow } from '../lib/auth.ts';

export const financeRouter = express.Router();

// =====================================================================
// Helper umum (dipakai juga oleh reports.ts)
// =====================================================================
const str = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const round = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Tanggal hari ini zona WIB (YYYY-MM-DD). */
export const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Validasi parameter tanggal YYYY-MM-DD. */
export function dateParam(v: unknown, field: string): string | null {
  const s = str(v);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z')) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) {
    throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  }
  return s;
}

/** Rentang ?from=&to= — default awal bulan berjalan s/d hari ini (WIB). */
export function rangeParam(q: Record<string, any>, maxDays = 366) {
  const today = todayWib();
  const from = dateParam(q.from, 'from') ?? today.slice(0, 8) + '01';
  const to = dateParam(q.to, 'to') ?? today;
  if (from > to) throw badRequest('Tanggal from tidak boleh setelah to.', { field: 'from' });
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (days > maxDays) throw badRequest(`Rentang tanggal maksimal ${maxDays} hari.`, { field: 'to' });
  return { from, to };
}

/** Bulan: "2026-09" atau "2026-09-01" → "2026-09-01". */
function monthParam(v: unknown, field = 'month'): string | null {
  const s = str(v);
  if (s === null) return null;
  const m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw badRequest(`${field} harus berformat YYYY-MM.`, { field });
  return `${m[1]}-${m[2]}-01`;
}

/** Ambang variance HPP (system_settings.cost_variance_threshold_pct, default 5%). */
export async function varianceThreshold(): Promise<number> {
  const r = await queryOne(`SELECT erp.fn_setting_num('cost_variance_threshold_pct', 5) AS v`);
  return Number(r?.v ?? 5);
}

/** Fitur opsional Staff (slip/skor sendiri) aktif bila role_permissions STAFF.<module>.can_read = true. */
export async function assertStaffFeature(module: 'PAYROLL' | 'ANALYTICS') {
  const r = await queryOne(`SELECT can_read FROM erp.role_permissions WHERE role = 'STAFF' AND module = $1`, [module]);
  if (!r?.can_read) {
    throw forbidden(module === 'PAYROLL' ? 'Fitur slip upah belum diaktifkan oleh Admin.' : 'Fitur skor efisiensi belum diaktifkan oleh Admin.', 'FEATURE_DISABLED');
  }
}

/**
 * Kredit tenaga kerja (pengganti erp.v_labor_credits). Satu baris per (inspeksi QC × operasi selesai pada bundel asal):
 * - Kredit = qty Pass QC, diberikan ke semua operator yang menyelesaikan operasi di bundel asal (root).
 *   Unit rework dibayar sekali saat bundel rework lolos QC ulang (ke operator bundel asal); reject tidak dibayar.
 *   Operasi rework sendiri tidak dibayar lagi (tidak dibayar ganda).
 * - credit_date = tanggal QC (WIB); tarif = tarif efektif pada tanggal operasi selesai.
 * - Scan anomali hanya dibayar bila sudah diterima Supervisor (anomaly_accepted = true).
 */
export const LABOR_CREDITS_SQL = `(
  SELECT t.id AS task_id, t.operator_id, rb.work_order_id, t.operation_id, q.id AS inspection_id, qb.id AS qc_bundle_id,
         rb.id AS root_bundle_id, q.qty_pass AS credit_qty,
         erp.fn_rate_at(t.operation_id, erp.fn_wib_date(t.completed_at)) AS rate_idr,
         erp.fn_wib_date(q.inspected_at) AS credit_date, erp.fn_wib_date(t.completed_at) AS task_date,
         t.is_anomaly, t.anomaly_reviewed_at, t.anomaly_accepted, t.duration_min,
         (NOT t.is_anomaly OR t.anomaly_accepted IS TRUE) AS is_payable
  FROM erp.qc_inspections q
  JOIN erp.bundles qb ON qb.id = q.bundle_id
  JOIN erp.bundles rb ON rb.id = coalesce(qb.root_bundle_id, qb.id)
  JOIN erp.wip_tasks t ON t.bundle_id = rb.id AND t.completed_at IS NOT NULL
  WHERE q.qty_pass > 0
)`;

async function hasLaborView(c: PoolClient): Promise<boolean> {
  const r = (await c.query(`SELECT to_regclass('erp.v_labor_credits') IS NOT NULL AS ok`)).rows[0];
  return !!r?.ok;
}

// =====================================================================
// Resolver
// =====================================================================

// SPK: id numerik atau nomor SPK-2026-0101
async function resolveWo(raw: string): Promise<any> {
  const v = String(raw).trim();
  const row = /^SPK-/i.test(v)
    ? await queryOne(`SELECT id, wo_no, status FROM erp.work_orders WHERE upper(wo_no) = upper($1)`, [v])
    : await queryOne(`SELECT id, wo_no, status FROM erp.work_orders WHERE id = $1`, [idParam(v)]);
  if (!row) throw notFound('SPK tidak ditemukan.', 'WO_NOT_FOUND');
  return row;
}

// Periode payroll: id numerik / "PR-12"
async function loadPeriod(raw: string, c?: PoolClient) {
  const id = idParam(raw);
  const sql = `SELECT p.id, p.period_start::text, p.period_end::text, p.frequency, p.status, p.generated_at, p.approved_at,
                      p.generated_by, gu.full_name AS generated_by_name, p.approved_by, au.full_name AS approved_by_name
               FROM erp.payroll_periods p
               LEFT JOIN erp.users gu ON gu.id = p.generated_by LEFT JOIN erp.users au ON au.id = p.approved_by
               WHERE p.id = $1`;
  const row = c ? (await c.query(sql, [id])).rows[0] : await queryOne(sql, [id]);
  if (!row) throw notFound('Periode payroll tidak ditemukan.', 'PAYROLL_NOT_FOUND');
  return row;
}

// Operator: id, USR-012, atau kode operator OP-0231
async function resolveOperator(raw: unknown, c: PoolClient): Promise<any> {
  const v = str(raw);
  if (!v) throw badRequest('operator_id wajib diisi.', { field: 'operator_id' });
  const m = v.match(/^(?:USR-)?(\d+)$/i);
  const r = (await c.query(
    m ? `SELECT id, full_name, role, operator_code FROM erp.users WHERE id = $1`
      : `SELECT id, full_name, role, operator_code FROM erp.users WHERE operator_code = upper($1)`,
    [m ? Number(m[1]) : v])).rows[0];
  if (!r) throw notFound('Operator tidak ditemukan.', 'OPERATOR_NOT_FOUND');
  if (r.role !== 'STAFF') throw badRequest('Adjustment hanya untuk operator (Staff).', { field: 'operator_id' });
  return r;
}

// Periode overhead: id numerik atau bulan YYYY-MM
async function resolveOverheadPeriod(raw: string) {
  const v = String(raw).trim();
  const month = /^\d{4}-\d{2}(-\d{2})?$/.test(v) ? monthParam(v) : null;
  const row = month
    ? await queryOne(`SELECT id FROM erp.overhead_periods WHERE period_month = $1::date`, [month])
    : await queryOne(`SELECT id FROM erp.overhead_periods WHERE id = $1`, [idParam(v)]);
  if (!row) throw notFound('Periode overhead tidak ditemukan.', 'PERIOD_NOT_FOUND');
  return Number(row.id);
}

// =====================================================================
// FR-07.1 PAYROLL
// =====================================================================
const FREQ_ALIAS: Record<string, string> = {
  WEEKLY: 'WEEKLY', MINGGUAN: 'WEEKLY', BIWEEKLY: 'BIWEEKLY', DUA_MINGGUAN: 'BIWEEKLY', '2_MINGGUAN': 'BIWEEKLY', MONTHLY: 'MONTHLY', BULANAN: 'MONTHLY',
};
const FREQ_MAX_DAYS: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 16, MONTHLY: 31 };

/** Generate draf payroll: fn_generate_payroll bila view tersedia, selain itu implementasi setara. */
async function generatePayroll(c: PoolClient, periodId: number, userId: number) {
  if (await hasLaborView(c)) {
    return (await c.query(`SELECT erp.fn_generate_payroll($1, $2) AS r`, [periodId, userId])).rows[0].r;
  }
  await c.query(`SELECT erp.fn_assert_user($1, ARRAY['FINANCE']::erp.user_role[])`, [userId]);
  const per = (await c.query(`SELECT id, period_start::text, period_end::text, status FROM erp.payroll_periods WHERE id = $1 FOR UPDATE`, [periodId])).rows[0];
  if (!per) throw notFound('Periode payroll tidak ditemukan.', 'PAYROLL_NOT_FOUND');
  if (per.status !== 'DRAFT') throw new AppError(422, 'PAYROLL_LOCKED', 'Periode payroll sudah di-approve.');

  await c.query(`DELETE FROM erp.payroll_lines WHERE period_id = $1`, [periodId]);
  const ins = await c.query(
    `INSERT INTO erp.payroll_lines (period_id, operator_id, work_order_id, operation_id, qty_pass, rate_idr)
     SELECT $1, lc.operator_id, lc.work_order_id, lc.operation_id, sum(lc.credit_qty), lc.rate_idr
     FROM ${LABOR_CREDITS_SQL} lc
     WHERE lc.credit_date BETWEEN $2::date AND $3::date AND lc.is_payable
     GROUP BY lc.operator_id, lc.work_order_id, lc.operation_id, lc.rate_idr`,
    [periodId, per.period_start, per.period_end]);
  const stats = (await c.query(
    `SELECT (SELECT coalesce(sum(amount), 0) FROM erp.payroll_lines WHERE period_id = $1) AS total,
            (SELECT count(DISTINCT b.id) FROM erp.bundles b JOIN erp.wip_tasks t ON t.bundle_id = b.id
              WHERE b.status = 'SEWN' AND erp.fn_wib_date(t.completed_at) <= $3::date) AS uninspected,
            (SELECT count(*) FROM ${LABOR_CREDITS_SQL} lc WHERE lc.credit_date BETWEEN $2::date AND $3::date AND NOT lc.is_payable) AS anomaly`,
    [periodId, per.period_start, per.period_end])).rows[0];
  await c.query(`UPDATE erp.payroll_periods SET generated_by = $2, generated_at = now() WHERE id = $1`, [periodId, userId]);
  await c.query(
    `SELECT erp.fn_notify('PAYROLL_READY', format('Draf payroll %s s/d %s siap', to_char($2::date, 'DD-MM-YYYY'), to_char($3::date, 'DD-MM-YYYY')),
       format('Total Rp %s. %s bundel belum di-QC tidak masuk periode ini.', erp.fn_fmt($4::numeric), $5::int), NULL, 'FINANCE', 'payroll_periods', $1::text)`,
    [periodId, per.period_start, per.period_end, stats.total, stats.uninspected]);
  return { lines: ins.rowCount ?? 0, total_idr: Number(stats.total), uninspected_bundles: Number(stats.uninspected), anomaly_scans_excluded: Number(stats.anomaly) };
}

async function missingRateOps(periodId: number, c?: PoolClient) {
  const sql = `SELECT DISTINCT o.id AS operation_id, o.code, o.name FROM erp.payroll_lines l JOIN erp.operations o ON o.id = l.operation_id
               WHERE l.period_id = $1 AND l.rate_idr IS NULL ORDER BY o.code`;
  return c ? (await c.query(sql, [periodId])).rows : await query(sql, [periodId]);
}

function generateResponse(period: any, r: any, noRate: any[]) {
  const warnings: string[] = [];
  if (Number(r.uninspected_bundles) > 0) warnings.push(`${r.uninspected_bundles} bundel belum di-QC dan tidak masuk periode ini.`);
  if (Number(r.anomaly_scans_excluded) > 0) warnings.push(`${r.anomaly_scans_excluded} scan anomali dikecualikan.`);
  for (const o of noRate) warnings.push(`Operasi ${o.name} tanpa tarif.`);
  return {
    ...period,
    lines: Number(r.lines), total_idr: Number(r.total_idr),
    uninspected_bundles: Number(r.uninspected_bundles), anomaly_scans_excluded: Number(r.anomaly_scans_excluded),
    operations_without_rate: noRate, can_approve: noRate.length === 0 && period.status === 'DRAFT',
    warnings,
  };
}

// POST /payroll/runs — buat periode + generate draf (atau generate periode draf yang ada: { period_id })
financeRouter.post('/payroll/runs', allow('FINANCE'), ah(async (req, res) => {
  const b = req.body ?? {};
  const out = await withTx(req.user!.id, async (c) => {
    let periodId: number;
    if (b.period_id !== undefined && b.period_id !== null && b.period_id !== '') {
      periodId = idParam(String(b.period_id), 'period_id');
    } else {
      required(b, ['period_start', 'period_end', 'frequency']);
      const start = dateParam(b.period_start, 'period_start')!;
      const end = dateParam(b.period_end, 'period_end')!;
      const freq = FREQ_ALIAS[String(b.frequency).toUpperCase().replace(/[\s-]/g, '_')];
      if (!freq) throw badRequest('frequency harus WEEKLY, BIWEEKLY, atau MONTHLY.', { field: 'frequency' });
      if (end < start) throw badRequest('period_end tidak boleh sebelum period_start.', { field: 'period_end' });
      const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
      if (days > FREQ_MAX_DAYS[freq]) throw badRequest(`Periode ${freq} maksimal ${FREQ_MAX_DAYS[freq]} hari.`, { field: 'period_end' });
      const overlap = (await c.query(
        `SELECT id, period_start::text, period_end::text FROM erp.payroll_periods
         WHERE daterange(period_start, period_end, '[]') && daterange($1::date, $2::date, '[]') LIMIT 1`, [start, end])).rows[0];
      if (overlap) throw conflict('Periode bertumpuk dengan periode lain.', 'PERIOD_OVERLAP', { period_id: overlap.id, period_start: overlap.period_start, period_end: overlap.period_end });
      try {
        periodId = Number((await c.query(
          `INSERT INTO erp.payroll_periods (period_start, period_end, frequency) VALUES ($1, $2, $3) RETURNING id`, [start, end, freq])).rows[0].id);
      } catch (e: any) {
        if (e?.code === '23P01') throw conflict('Periode bertumpuk dengan periode lain.', 'PERIOD_OVERLAP');
        throw e;
      }
    }
    const r = await generatePayroll(c, periodId, req.user!.id);
    return { period: await loadPeriod(String(periodId), c), r, noRate: await missingRateOps(periodId, c) };
  });
  res.status(201).json(generateResponse(out.period, out.r, out.noRate));
}));

// POST /payroll/runs/:id/regenerate — generate ulang selama Draft (draf lama diganti)
financeRouter.post('/payroll/runs/:id/regenerate', allow('FINANCE'), ah(async (req, res) => {
  const p = await loadPeriod(req.params.id);
  if (p.status !== 'DRAFT') throw new AppError(422, 'PAYROLL_LOCKED', 'Periode payroll sudah di-approve.');
  const out = await withTx(req.user!.id, async (c) => {
    const r = await generatePayroll(c, p.id, req.user!.id);
    return { period: await loadPeriod(String(p.id), c), r, noRate: await missingRateOps(p.id, c) };
  });
  res.json(generateResponse(out.period, out.r, out.noRate));
}));

// GET /payroll/runs — daftar periode + ringkasan
financeRouter.get('/payroll/runs', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const status = str(req.query.status);
  if (status) oneOf(status.toUpperCase(), ['DRAFT', 'APPROVED'], 'status');
  const rows = await query(
    `SELECT p.id, p.period_start::text, p.period_end::text, p.frequency, p.status, p.generated_at, p.approved_at,
            au.full_name AS approved_by_name,
            coalesce(l.operators, 0) AS operator_count, coalesce(l.qty_pass, 0) AS qty_pass, coalesce(l.gross, 0) AS gross_idr,
            coalesce(a.adj, 0) AS adjustment_idr, coalesce(l.gross, 0) + coalesce(a.adj, 0) AS total_idr,
            coalesce(l.no_rate, 0) AS lines_without_rate,
            count(*) OVER () AS _total
     FROM erp.payroll_periods p
     LEFT JOIN erp.users au ON au.id = p.approved_by
     LEFT JOIN LATERAL (SELECT count(DISTINCT operator_id) AS operators, sum(qty_pass) AS qty_pass, sum(amount) AS gross,
                               count(*) FILTER (WHERE rate_idr IS NULL) AS no_rate
                        FROM erp.payroll_lines WHERE period_id = p.id) l ON true
     LEFT JOIN LATERAL (SELECT sum(amount) AS adj FROM erp.payroll_adjustments WHERE period_id = p.id) a ON true
     WHERE ($1::text IS NULL OR p.status::text = upper($1))
     ORDER BY p.period_start DESC LIMIT $2 OFFSET $3`, [status, limit, offset]);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0 });
}));

/** Detail slip per operator (rincian per SPK & operasi). operatorId = filter satu operator (slip Staff). */
async function payrollDetail(periodId: number, operatorId?: number, opts: { hideRate?: boolean } = {}) {
  const lines = await query(
    `SELECT l.operator_id, u.full_name AS operator_name, u.operator_code, pl.code AS line_code,
            w.wo_no AS work_order, s.code AS sku_code, s.name AS sku_name,
            o.code AS operation_code, o.name AS operation_name, l.qty_pass, l.rate_idr, l.amount
     FROM erp.payroll_lines l
     JOIN erp.users u ON u.id = l.operator_id
     LEFT JOIN erp.production_lines pl ON pl.id = u.line_id
     JOIN erp.work_orders w ON w.id = l.work_order_id JOIN erp.skus s ON s.id = w.sku_id
     JOIN erp.operations o ON o.id = l.operation_id
     WHERE l.period_id = $1 AND ($2::bigint IS NULL OR l.operator_id = $2)
     ORDER BY u.full_name, w.wo_no, o.code`, [periodId, operatorId ?? null]);
  const adjs = await query(
    `SELECT a.id, a.operator_id, u.full_name AS operator_name, u.operator_code, a.amount, a.reason,
            a.created_at, cu.full_name AS created_by_name
     FROM erp.payroll_adjustments a JOIN erp.users u ON u.id = a.operator_id JOIN erp.users cu ON cu.id = a.created_by
     WHERE a.period_id = $1 AND ($2::bigint IS NULL OR a.operator_id = $2) ORDER BY a.created_at`, [periodId, operatorId ?? null]);

  const ops = new Map<number, any>();
  const get = (r: any) => {
    if (!ops.has(r.operator_id)) {
      ops.set(r.operator_id, { operator_id: r.operator_id, operator_code: r.operator_code, operator_name: r.operator_name,
        line_code: r.line_code ?? null, qty_pass: 0, gross_idr: 0, adjustment_idr: 0, net_idr: 0, has_missing_rate: false, details: [], adjustments: [] });
    }
    return ops.get(r.operator_id);
  };
  for (const r of lines) {
    const o = get(r);
    o.qty_pass += r.qty_pass; o.gross_idr += r.amount;
    if (r.rate_idr === null) o.has_missing_rate = true;
    o.details.push({
      work_order: r.work_order, sku_code: r.sku_code, sku_name: r.sku_name, operation_code: r.operation_code,
      operation_name: r.operation_name, qty_pass: r.qty_pass,
      ...(opts.hideRate ? {} : { rate_idr: r.rate_idr }), amount: r.amount, rate_missing: r.rate_idr === null,
    });
  }
  for (const a of adjs) {
    const o = get(a);
    o.adjustment_idr += a.amount;
    o.adjustments.push({ id: a.id, amount: a.amount, reason: a.reason, created_at: a.created_at, created_by_name: a.created_by_name });
  }
  const operators = [...ops.values()].map((o) => ({ ...o, gross_idr: round(o.gross_idr), adjustment_idr: round(o.adjustment_idr), net_idr: round(o.gross_idr + o.adjustment_idr) }))
    .sort((a, b) => a.operator_name.localeCompare(b.operator_name));
  return operators;
}

/** Scan beranomali dalam periode (ditampilkan terpisah; belum/tidak dibayar). */
async function periodAnomalies(p: any, operatorId?: number) {
  return query(
    `SELECT t.id AS task_id, u.full_name AS operator_name, u.operator_code, b.bundle_code, w.wo_no AS work_order,
            o.code AS operation_code, o.name AS operation_name, t.qty, t.duration_min,
            round(o.smv_minutes * t.qty, 2) AS standard_min, erp.fn_wib_date(t.completed_at)::text AS completed_date,
            CASE WHEN t.anomaly_reviewed_at IS NULL THEN 'PENDING_REVIEW' WHEN t.anomaly_accepted THEN 'ACCEPTED' ELSE 'REJECTED' END AS review_status,
            sum(lc.credit_qty) AS pass_qty_affected
     FROM ${LABOR_CREDITS_SQL} lc
     JOIN erp.wip_tasks t ON t.id = lc.task_id JOIN erp.users u ON u.id = t.operator_id
     JOIN erp.bundles b ON b.id = t.bundle_id JOIN erp.work_orders w ON w.id = b.work_order_id JOIN erp.operations o ON o.id = t.operation_id
     WHERE lc.is_anomaly AND lc.credit_date BETWEEN $1::date AND $2::date AND ($3::bigint IS NULL OR t.operator_id = $3)
     GROUP BY t.id, u.full_name, u.operator_code, b.bundle_code, w.wo_no, o.code, o.name, o.smv_minutes
     ORDER BY t.completed_at`, [p.period_start, p.period_end, operatorId ?? null]);
}

async function uninspectedCount(p: any) {
  const r = await queryOne(
    `SELECT count(DISTINCT b.id) AS n FROM erp.bundles b JOIN erp.wip_tasks t ON t.bundle_id = b.id
     WHERE b.status = 'SEWN' AND erp.fn_wib_date(t.completed_at) <= $1::date`, [p.period_end]);
  return Number(r?.n ?? 0);
}

// GET /payroll/runs/:id — detail draf/periode per operator
financeRouter.get('/payroll/runs/:id', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const p = await loadPeriod(req.params.id);
  const [operators, anomalies, noRate, uninspected] = [await payrollDetail(p.id), await periodAnomalies(p), await missingRateOps(p.id), await uninspectedCount(p)] as const;
  const gross = operators.reduce((s, o) => s + o.gross_idr, 0);
  const adj = operators.reduce((s, o) => s + o.adjustment_idr, 0);
  const warnings: string[] = [];
  if (!p.generated_at) warnings.push('Generate draf payroll terlebih dahulu.');
  if (p.status === 'DRAFT' && uninspected > 0) warnings.push(`${uninspected} bundel belum di-QC dan tidak masuk periode ini.`);
  const excluded = anomalies.filter((a: any) => a.review_status !== 'ACCEPTED').length;
  if (excluded > 0) warnings.push(`${excluded} scan anomali dikecualikan.`);
  for (const o of noRate) warnings.push(`Operasi ${o.name} tanpa tarif.`);
  res.json({
    ...p,
    totals: { operators: operators.length, qty_pass: operators.reduce((s, o) => s + o.qty_pass, 0), gross_idr: round(gross), adjustment_idr: round(adj), net_idr: round(gross + adj) },
    operators, anomalies, operations_without_rate: noRate,
    uninspected_bundles: p.status === 'DRAFT' ? uninspected : null,
    can_approve: p.status === 'DRAFT' && !!p.generated_at && noRate.length === 0,
    warnings,
  });
}));

// POST /payroll/runs/:id/adjustments — penyesuaian ± dengan alasan wajib
financeRouter.post('/payroll/runs/:id/adjustments', allow('FINANCE'), ah(async (req, res) => {
  const b = req.body ?? {};
  required({ ...b, operator_id: b.operator_id ?? b.operator_code }, ['operator_id', 'amount', 'reason']);
  const amount = num(b.amount, 'amount');
  if (amount === 0) throw badRequest('amount tidak boleh 0.', { field: 'amount' });
  const reason = String(b.reason).trim();
  if (!reason) throw badRequest('Alasan penyesuaian wajib diisi.', { field: 'reason' });
  const p = await loadPeriod(req.params.id);
  if (p.status !== 'DRAFT') throw new AppError(422, 'PAYROLL_LOCKED', 'Periode payroll sudah di-approve dan terkunci. Gunakan adjustment di periode berikutnya.');
  const row = await withTx(req.user!.id, async (c) => {
    const op = await resolveOperator(b.operator_id ?? b.operator_code, c);
    return (await c.query(
      `INSERT INTO erp.payroll_adjustments (period_id, operator_id, amount, reason, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, period_id, operator_id, amount, reason, created_at`,
      [p.id, op.id, amount, `${reason}`, req.user!.id])).rows[0];
  });
  res.status(201).json(row);
}));

// PATCH /payroll/runs/:id/approve — approve & kunci (ditolak bila ada operasi tanpa tarif / sudah approved)
financeRouter.patch('/payroll/runs/:id/approve', allow('FINANCE'), ah(async (req, res) => {
  const p = await loadPeriod(req.params.id);
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_approve_payroll($1, $2)`, [p.id, req.user!.id]));
  const after = await loadPeriod(String(p.id));
  res.json({ ...after, message: 'Periode payroll di-approve dan terkunci.' });
}));

// GET /payroll/runs/:id/export?format=xlsx|pdf
financeRouter.get('/payroll/runs/:id/export', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const format = oneOf(String(req.query.format ?? 'xlsx').toLowerCase(), ['xlsx', 'pdf'] as const, 'format');
  const p = await loadPeriod(req.params.id);
  const operators = await payrollDetail(p.id);
  const fname = `payroll_${p.period_start}_${p.period_end}${p.status === 'DRAFT' ? '_DRAFT' : ''}`;
  if (format === 'xlsx') await exportXlsx(res, p, operators, fname);
  else exportPdf(res, p, operators, fname);
}));

async function exportXlsx(res: Response, p: any, operators: any[], fname: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Garment ERP';
  const title = `Payroll Borongan ${p.period_start} s/d ${p.period_end} (${p.frequency}) — ${p.status}`;
  const money = '#,##0';

  const s1 = wb.addWorksheet('Ringkasan');
  s1.addRow([title]).font = { bold: true, size: 13 };
  s1.addRow([]);
  const h1 = s1.addRow(['No', 'Kode Operator', 'Nama', 'Lini', 'Qty Pass', 'Upah Kotor (Rp)', 'Penyesuaian (Rp)', 'Total Dibayar (Rp)']);
  h1.font = { bold: true };
  operators.forEach((o, i) => s1.addRow([i + 1, o.operator_code, o.operator_name, o.line_code, o.qty_pass, o.gross_idr, o.adjustment_idr, o.net_idr]));
  const tot = s1.addRow(['', '', 'TOTAL', '', operators.reduce((s, o) => s + o.qty_pass, 0), operators.reduce((s, o) => s + o.gross_idr, 0),
    operators.reduce((s, o) => s + o.adjustment_idr, 0), operators.reduce((s, o) => s + o.net_idr, 0)]);
  tot.font = { bold: true };
  [6, 7, 8].forEach((c) => (s1.getColumn(c).numFmt = money));
  [6, 16, 28, 10, 10, 18, 18, 20].forEach((w, i) => (s1.getColumn(i + 1).width = w));

  const s2 = wb.addWorksheet('Rincian');
  const h2 = s2.addRow(['Kode Operator', 'Nama', 'SPK', 'SKU', 'Kode Operasi', 'Operasi', 'Qty Pass', 'Tarif (Rp)', 'Jumlah (Rp)']);
  h2.font = { bold: true };
  for (const o of operators) for (const d of o.details) {
    s2.addRow([o.operator_code, o.operator_name, d.work_order, d.sku_code, d.operation_code, d.operation_name, d.qty_pass, d.rate_idr ?? 'TANPA TARIF', d.amount]);
  }
  [8, 9].forEach((c) => (s2.getColumn(c).numFmt = money));
  [16, 28, 18, 16, 16, 28, 10, 14, 16].forEach((w, i) => (s2.getColumn(i + 1).width = w));

  const s3 = wb.addWorksheet('Penyesuaian');
  s3.addRow(['Kode Operator', 'Nama', 'Jumlah (Rp)', 'Alasan', 'Dibuat oleh', 'Waktu']).font = { bold: true };
  for (const o of operators) for (const a of o.adjustments) s3.addRow([o.operator_code, o.operator_name, a.amount, a.reason, a.created_by_name, a.created_at]);
  s3.getColumn(3).numFmt = money;
  [16, 28, 16, 40, 24, 22].forEach((w, i) => (s3.getColumn(i + 1).width = w));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

const idr = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

function exportPdf(res: Response, p: any, operators: any[], fname: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}.pdf"`);
  doc.pipe(res);
  doc.fontSize(14).font('Helvetica-Bold').text('Slip Payroll Borongan', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Periode ${p.period_start} s/d ${p.period_end} · ${p.frequency} · Status ${p.status}`, { align: 'center' });
  if (p.status === 'DRAFT') doc.fillColor('red').text('DRAF — belum di-approve, bukan dasar pencairan.', { align: 'center' }).fillColor('black');
  doc.moveDown();

  const cols = [40, 110, 230, 330, 390, 455];
  for (const o of operators) {
    if (doc.y > 700) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(10).text(`${o.operator_code ?? '-'} · ${o.operator_name}${o.line_code ? ' · ' + o.line_code : ''}`, 40);
    doc.font('Helvetica-Bold').fontSize(8);
    const hy = doc.y + 2;
    ['SPK', 'Operasi', 'SKU', 'Qty Pass', 'Tarif', 'Jumlah'].forEach((h, i) => doc.text(h, cols[i], hy, { width: (cols[i + 1] ?? 555) - cols[i] - 4 }));
    doc.font('Helvetica');
    for (const d of o.details) {
      if (doc.y > 760) doc.addPage();
      const y = doc.y + 2;
      [d.work_order, d.operation_name, d.sku_code, String(d.qty_pass), d.rate_idr === null || d.rate_idr === undefined ? 'TANPA TARIF' : idr(d.rate_idr), idr(d.amount)]
        .forEach((v, i) => doc.text(v, cols[i], y, { width: (cols[i + 1] ?? 555) - cols[i] - 4 }));
    }
    for (const a of o.adjustments) doc.text(`Penyesuaian ${idr(a.amount)} — ${a.reason}`, 40);
    doc.font('Helvetica-Bold').text(`Qty Pass ${o.qty_pass} · Upah ${idr(o.gross_idr)} · Penyesuaian ${idr(o.adjustment_idr)} · Total ${idr(o.net_idr)}`, 40);
    doc.font('Helvetica').moveDown(0.8);
  }
  const net = operators.reduce((s, o) => s + o.net_idr, 0);
  doc.moveDown().font('Helvetica-Bold').fontSize(11).text(`TOTAL PERIODE: ${idr(net)} (${operators.length} operator)`, 40);
  if (!operators.length) doc.font('Helvetica').text('Tidak ada baris payroll pada periode ini.', 40);
  doc.end();
}

// ---------------------------------------------------------------------
// Slip milik sendiri (Staff, opsional — diaktifkan Admin via role_permissions STAFF.PAYROLL)
// ---------------------------------------------------------------------
async function mySlipList(req: Request, res: Response) {
  await assertStaffFeature('PAYROLL');
  const me = req.user!.id;
  const rows = await query(
    `SELECT p.id, p.period_start::text, p.period_end::text, p.frequency, p.status,
            coalesce(l.qty_pass, 0) AS qty_pass, coalesce(l.gross, 0) AS gross_idr, coalesce(a.adj, 0) AS adjustment_idr,
            coalesce(l.gross, 0) + coalesce(a.adj, 0) AS net_idr
     FROM erp.payroll_periods p
     LEFT JOIN LATERAL (SELECT sum(qty_pass) AS qty_pass, sum(amount) AS gross FROM erp.payroll_lines WHERE period_id = p.id AND operator_id = $1) l ON true
     LEFT JOIN LATERAL (SELECT sum(amount) AS adj FROM erp.payroll_adjustments WHERE period_id = p.id AND operator_id = $1) a ON true
     WHERE p.generated_at IS NOT NULL AND (l.qty_pass IS NOT NULL OR a.adj IS NOT NULL)
     ORDER BY p.period_start DESC LIMIT 52`, [me]);
  res.json({ data: rows.map((r) => ({ ...r, is_estimate: r.status === 'DRAFT' })), page: 1, limit: 52, total: rows.length });
}

async function mySlipDetail(req: Request, res: Response) {
  await assertStaffFeature('PAYROLL');
  const p = await loadPeriod(req.params.runId);
  const [op] = await payrollDetail(p.id, req.user!.id, { hideRate: true });
  if (!op) throw notFound('Slip Anda untuk periode ini tidak ditemukan.', 'SLIP_NOT_FOUND');
  const anomalies = (await periodAnomalies(p, req.user!.id)).map((a: any) => ({
    bundle_code: a.bundle_code, work_order: a.work_order, operation_name: a.operation_name, completed_date: a.completed_date, review_status: a.review_status,
  }));
  res.json({
    period: { id: p.id, period_start: p.period_start, period_end: p.period_end, frequency: p.frequency, status: p.status },
    is_estimate: p.status === 'DRAFT', ...op, anomalies,
  });
}

financeRouter.get('/payroll/my-slips', allow({ staff: '*' }), ah(mySlipList));
financeRouter.get('/payroll/my-slips/:runId', allow({ staff: '*' }), ah(mySlipDetail));
financeRouter.get('/me/payroll', allow({ staff: '*' }), ah(mySlipList)); // alias FR-STF-C2

// =====================================================================
// FR-07.2 OVERHEAD (Founder R, Finance CRU)
// =====================================================================
const OH_CATEGORIES = ['ELECTRICITY', 'MAINTENANCE', 'SPAREPART', 'OPERATIONAL', 'RENT', 'SCRAP_SALE_CREDIT', 'OTHER'] as const;
const OH_ALIAS: Record<string, string> = {
  LISTRIK: 'ELECTRICITY', SPARE_PART: 'SPAREPART', OPERASIONAL: 'OPERATIONAL', SEWA: 'RENT', LAINNYA: 'OTHER',
  LIMBAH: 'SCRAP_SALE_CREDIT', PENJUALAN_LIMBAH: 'SCRAP_SALE_CREDIT', KREDIT_LIMBAH: 'SCRAP_SALE_CREDIT',
};
const OH_LABEL: Record<string, string> = {
  ELECTRICITY: 'Listrik', MAINTENANCE: 'Maintenance', SPAREPART: 'Spare part', OPERATIONAL: 'Operasional', RENT: 'Sewa',
  SCRAP_SALE_CREDIT: 'Kredit penjualan limbah', OTHER: 'Lainnya',
};
function ohCategory(v: unknown): string {
  const k = String(v ?? '').trim().toUpperCase().replace(/[\s-]/g, '_');
  const cat = OH_ALIAS[k] ?? k;
  return oneOf(cat, OH_CATEGORIES, 'category');
}
// Kredit limbah selalu negatif; kategori lain positif (boleh 0)
function ohAmount(cat: string, v: unknown): number {
  const n = num(v, 'amount');
  if (cat === 'SCRAP_SALE_CREDIT') {
    if (n === 0) throw badRequest('Nominal kredit limbah tidak boleh 0.', { field: 'amount' });
    return -Math.abs(n);
  }
  if (n < 0) throw badRequest('Nominal biaya overhead tidak boleh negatif.', { field: 'amount' });
  return n;
}

async function overheadPeriodDetail(periodId: number) {
  const p = await queryOne(
    `SELECT p.id, to_char(p.period_month, 'YYYY-MM') AS month, p.period_month::text, p.status, p.locked_at, u.full_name AS locked_by_name
     FROM erp.overhead_periods p LEFT JOIN erp.users u ON u.id = p.locked_by WHERE p.id = $1`, [periodId]);
  if (!p) throw notFound('Periode overhead tidak ditemukan.', 'PERIOD_NOT_FOUND');
  const entries = await query(
    `SELECT e.id, e.category, e.amount, e.description, e.ref_table, e.ref_id, (e.ref_table IS NOT NULL) AS is_auto,
            e.created_at, u.full_name AS created_by_name
     FROM erp.overhead_entries e LEFT JOIN erp.users u ON u.id = e.created_by WHERE e.period_id = $1 ORDER BY e.created_at, e.id`, [periodId]);
  const byCat = OH_CATEGORIES.map((c) => {
    const list = entries.filter((e: any) => e.category === c);
    return { category: c, label: OH_LABEL[c], entries: list.length, amount: round(list.reduce((s: number, e: any) => s + e.amount, 0)) };
  });
  const gross = entries.filter((e: any) => e.amount > 0).reduce((s: number, e: any) => s + e.amount, 0);
  const credit = entries.filter((e: any) => e.amount < 0).reduce((s: number, e: any) => s + e.amount, 0);
  const smv = await queryOne(
    `SELECT coalesce(sum(t.qty * o.smv_minutes), 0) AS smv FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
     WHERE t.completed_at IS NOT NULL AND date_trunc('month', erp.fn_wib_date(t.completed_at)) = $1::date`, [p.period_month]);
  const total = gross + credit;
  return {
    ...p, entries, by_category: byCat,
    totals: { gross_idr: round(gross), scrap_credit_idr: round(credit), net_idr: round(total) },
    smv_minutes_produced: Number(smv?.smv ?? 0),
    rate_per_smv_minute: Number(smv?.smv) > 0 ? round(total / Number(smv!.smv), 2) : null,
    manual_entries: entries.filter((e: any) => !e.is_auto).length,
  };
}

// GET /overhead?from=YYYY-MM&to=YYYY-MM — daftar periode + total per kategori · ?month=YYYY-MM → detail satu bulan
financeRouter.get('/overhead', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const month = monthParam(req.query.month);
  if (month) {
    const p = await queryOne(`SELECT id FROM erp.overhead_periods WHERE period_month = $1::date`, [month]);
    if (!p) {
      return res.json({ id: null, month: month.slice(0, 7), period_month: month, status: 'NOT_CREATED', entries: [],
        by_category: OH_CATEGORIES.map((c) => ({ category: c, label: OH_LABEL[c], entries: 0, amount: 0 })),
        totals: { gross_idr: 0, scrap_credit_idr: 0, net_idr: 0 }, manual_entries: 0, note: 'Overhead bulan ini belum diinput.' });
    }
    return res.json(await overheadPeriodDetail(Number(p.id)));
  }
  const { limit, offset, page } = paging(req.query);
  const from = monthParam(req.query.from, 'from');
  const to = monthParam(req.query.to, 'to');
  const rows = await query(
    `SELECT p.id, to_char(p.period_month, 'YYYY-MM') AS month, p.period_month::text, p.status, p.locked_at,
            coalesce(sum(e.amount) FILTER (WHERE e.amount > 0), 0) AS gross_idr,
            coalesce(sum(e.amount) FILTER (WHERE e.amount < 0), 0) AS scrap_credit_idr,
            coalesce(sum(e.amount), 0) AS net_idr,
            count(e.id) AS entries, count(e.id) FILTER (WHERE e.ref_table IS NULL) AS manual_entries,
            coalesce(jsonb_object_agg(e.category, e.cat_sum) FILTER (WHERE e.category IS NOT NULL), '{}') AS by_category,
            count(*) OVER () AS _total
     FROM erp.overhead_periods p
     LEFT JOIN (SELECT e.*, sum(e.amount) OVER (PARTITION BY e.period_id, e.category) AS cat_sum FROM erp.overhead_entries e) e ON e.period_id = p.id
     WHERE ($1::date IS NULL OR p.period_month >= $1::date) AND ($2::date IS NULL OR p.period_month <= $2::date)
     GROUP BY p.id ORDER BY p.period_month DESC LIMIT $3 OFFSET $4`, [from, to, limit, offset]);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0 });
}));

// GET /overhead/summary?month=YYYY-MM (alias ringkasan satu bulan, default bulan berjalan)
financeRouter.get('/overhead/summary', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  const month = monthParam(req.query.month) ?? todayWib().slice(0, 8) + '01';
  const p = await queryOne(`SELECT id FROM erp.overhead_periods WHERE period_month = $1::date`, [month]);
  if (!p) return res.json({ id: null, month: month.slice(0, 7), status: 'NOT_CREATED', by_category: [], totals: { gross_idr: 0, scrap_credit_idr: 0, net_idr: 0 }, note: 'Overhead bulan ini belum diinput.' });
  const d = await overheadPeriodDetail(Number(p.id));
  const { entries, ...rest } = d;
  res.json(rest);
}));

// GET /overhead/periods/:id — detail periode (id atau YYYY-MM)
financeRouter.get('/overhead/periods/:id', allow('FINANCE', 'FOUNDER'), ah(async (req, res) => {
  res.json(await overheadPeriodDetail(await resolveOverheadPeriod(req.params.id)));
}));

// POST /overhead — input biaya overhead: { month: "2026-09", category, amount, description } atau { entries: [...] }
financeRouter.post('/overhead', allow('FINANCE'), ah(async (req, res) => {
  const b = req.body ?? {};
  const items: any[] = Array.isArray(b.entries) ? b.entries : [b];
  if (!items.length || items.length > 50) throw badRequest('entries berisi 1–50 baris.', { field: 'entries' });
  const month = monthParam(b.month ?? b.period_month ?? items[0]?.month ?? items[0]?.period_month, 'month');
  if (!month) throw badRequest('Field wajib diisi: month.', { missing: ['month'] });
  const rows = items.map((it, i) => {
    required(it, ['category', 'amount', 'description']);
    const cat = ohCategory(it.category);
    const desc = String(it.description).trim();
    if (!desc) throw badRequest(`Deskripsi baris ${i + 1} wajib diisi.`, { field: 'description' });
    return { cat, amount: ohAmount(cat, it.amount), desc };
  });
  const out = await withTx(req.user!.id, async (c) => {
    const pid = Number((await c.query(`SELECT erp.fn_ensure_overhead_period($1::date) AS id`, [month])).rows[0].id);
    const ins = [];
    for (const r of rows) {
      ins.push((await c.query(
        `INSERT INTO erp.overhead_entries (period_id, category, amount, description, created_by) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, period_id, category, amount, description, created_at`, [pid, r.cat, r.amount, r.desc, req.user!.id])).rows[0]);
    }
    return { pid, ins };
  });
  const d = await overheadPeriodDetail(out.pid);
  res.status(201).json({ created: out.ins, period: { id: d.id, month: d.month, status: d.status, by_category: d.by_category, totals: d.totals } });
}));

// PUT /overhead/entries/:id — ubah entri manual (periode OPEN; entri otomatis spare part/limbah tidak dapat diubah)
financeRouter.put('/overhead/entries/:id', allow('FINANCE'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = req.body ?? {};
  const cur = await queryOne(`SELECT e.*, p.status AS period_status FROM erp.overhead_entries e JOIN erp.overhead_periods p ON p.id = e.period_id WHERE e.id = $1`, [id]);
  if (!cur) throw notFound('Entri overhead tidak ditemukan.', 'ENTRY_NOT_FOUND');
  if (cur.period_status === 'LOCKED') throw new AppError(422, 'PERIOD_LOCKED', 'Periode overhead sudah dikunci.');
  if (cur.ref_table) throw new AppError(422, 'AUTO_ENTRY', 'Entri otomatis (spare part / penjualan limbah) tidak dapat diubah manual.');
  const cat = b.category !== undefined ? ohCategory(b.category) : cur.category;
  const amount = b.amount !== undefined ? ohAmount(cat, b.amount) : (cat === cur.category ? cur.amount : ohAmount(cat, cur.amount));
  const desc = b.description !== undefined ? String(b.description).trim() : cur.description;
  if (!desc) throw badRequest('Deskripsi wajib diisi.', { field: 'description' });
  const row = await withTx(req.user!.id, async (c) => (await c.query(
    `UPDATE erp.overhead_entries SET category = $2, amount = $3, description = $4 WHERE id = $1
     RETURNING id, period_id, category, amount, description, created_at`, [id, cat, amount, desc])).rows[0]);
  res.json(row);
}));

// PATCH /overhead/periods/:id/lock — kunci periode; HPP SPK yang ditutup di bulan itu dihitung ulang → FINAL
financeRouter.patch('/overhead/periods/:id/lock', allow('FINANCE'), ah(async (req, res) => {
  const pid = await resolveOverheadPeriod(req.params.id);
  const n = await withTx(req.user!.id, async (c) => {
    if (await hasLaborView(c)) return Number((await c.query(`SELECT erp.fn_lock_overhead_period($1, $2) AS n`, [pid, req.user!.id])).rows[0].n);
    // Setara fn_lock_overhead_period (tanpa ketergantungan v_labor_credits)
    await c.query(`SELECT erp.fn_assert_user($1, ARRAY['FINANCE']::erp.user_role[])`, [req.user!.id]);
    const per = (await c.query(
      `UPDATE erp.overhead_periods SET status = 'LOCKED', locked_by = $2, locked_at = now() WHERE id = $1 AND status = 'OPEN'
       RETURNING period_month::text`, [pid, req.user!.id])).rows[0];
    if (!per) throw new AppError(422, 'INVALID_STATUS', 'Periode tidak ditemukan atau sudah dikunci.');
    const wos = (await c.query(
      `SELECT c.work_order_id FROM erp.work_order_costings c JOIN erp.work_orders wo ON wo.id = c.work_order_id
       WHERE date_trunc('month', erp.fn_wib_date(wo.closed_at)) = $1::date`, [per.period_month])).rows;
    for (const w of wos) await calculateCosting(c, Number(w.work_order_id));
    return wos.length;
  });
  const d = await overheadPeriodDetail(pid);
  res.json({ id: d.id, month: d.month, status: d.status, locked_at: d.locked_at, finalized_work_orders: n,
    message: `Periode overhead ${d.month} dikunci. ${n} SPK berstatus FINAL.` });
}));

// =====================================================================
// FR-07.2 COSTING (HANYA Founder & Finance — role lain 403 + audit oleh allow())
// =====================================================================

/** Hitung HPP per SPK: fn_calculate_wo_costing bila view tersedia, selain itu implementasi setara. */
export async function calculateCosting(c: PoolClient, woId: number) {
  if (await hasLaborView(c)) {
    return (await c.query(`SELECT (erp.fn_calculate_wo_costing($1)).*`, [woId])).rows[0];
  }
  const w = (await c.query(`SELECT id, wo_no, closed_at, est_material_per_pcs, est_labor_per_pcs, est_overhead_per_pcs FROM erp.work_orders WHERE id = $1`, [woId])).rows[0];
  const base = (await c.query(
    `SELECT (SELECT coalesce(sum(i.qty), 0) FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
              WHERE u.work_order_id = $1 AND u.status = 'CONFIRMED') AS fg,
            (SELECT coalesce(sum(q.qty_reject), 0) FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id WHERE b.work_order_id = $1) AS rej,
            (SELECT coalesce(-sum(qty * unit_cost), 0) FROM erp.stock_movements
              WHERE work_order_id = $1 AND movement_type IN ('ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_PACKING')) AS mat,
            (SELECT coalesce(sum(credit_qty * coalesce(rate_idr, 0)), 0) FROM ${LABOR_CREDITS_SQL} lc WHERE lc.work_order_id = $1 AND lc.is_payable) AS lab,
            date_trunc('month', erp.fn_wib_date(coalesce($2::timestamptz, now())))::date::text AS month`, [woId, w.closed_at])).rows[0];
  const fg = Number(base.fg);
  if (fg === 0) throw new AppError(422, 'NO_FG', `${w.wo_no} belum memiliki barang jadi.`);
  const per = (await c.query(`SELECT id, status FROM erp.overhead_periods WHERE period_month = $1::date`, [base.month])).rows[0];
  let ovh = 0;
  if (per) {
    const o = (await c.query(
      `SELECT (SELECT coalesce(sum(amount), 0) FROM erp.overhead_entries WHERE period_id = $1) AS total,
              (SELECT coalesce(sum(t.qty * o.smv_minutes), 0) FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
                WHERE t.completed_at IS NOT NULL AND date_trunc('month', erp.fn_wib_date(t.completed_at)) = $2::date) AS smv_month,
              (SELECT coalesce(sum(t.qty * o.smv_minutes), 0) FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
                JOIN erp.bundles b ON b.id = t.bundle_id WHERE b.work_order_id = $3 AND t.completed_at IS NOT NULL) AS smv_wo`,
      [per.id, base.month, woId])).rows[0];
    if (Number(o.smv_month) > 0) ovh = (Number(o.total) * Number(o.smv_wo)) / Number(o.smv_month);
  }
  const row = (await c.query(
    `INSERT INTO erp.work_order_costings (work_order_id, status, fg_qty, reject_qty, est_material, est_labor, est_overhead,
                                         act_material, act_labor, act_overhead, overhead_period_id, calculated_at)
     VALUES ($1, $2::erp.costing_status, $3::int, $4::int, coalesce($5::numeric, 0), coalesce($6::numeric, 0), coalesce($7::numeric, 0), round($8::numeric / $3::int, 2), round($9::numeric / $3::int, 2), round($10::numeric / $3::int, 2), $11::bigint, now())
     ON CONFLICT (work_order_id) DO UPDATE SET
       status = EXCLUDED.status, fg_qty = EXCLUDED.fg_qty, reject_qty = EXCLUDED.reject_qty,
       act_material = EXCLUDED.act_material, act_labor = EXCLUDED.act_labor, act_overhead = EXCLUDED.act_overhead,
       overhead_period_id = EXCLUDED.overhead_period_id, calculated_at = now()
     RETURNING *`,
    [woId, per?.status === 'LOCKED' ? 'FINAL' : 'PROVISIONAL', fg, Number(base.rej), w.est_material_per_pcs, w.est_labor_per_pcs, w.est_overhead_per_pcs,
      Number(base.mat), Number(base.lab), ovh, per?.id ?? null])).rows[0];
  // Notifikasi variance > ambang (setara fn_calculate_wo_costing)
  const thr = Number((await c.query(`SELECT erp.fn_setting_num('cost_variance_threshold_pct', 5) AS v`)).rows[0].v);
  if (row.variance_pct !== null && Math.abs(row.variance_pct) > thr) {
    await c.query(
      `SELECT erp.fn_notify('COST_VARIANCE', format('Variance HPP %s %s%%', $1::text, erp.fn_fmt($2::numeric, 1)),
         format('Estimasi Rp %s → aktual Rp %s per pcs.', erp.fn_fmt($3::numeric), erp.fn_fmt($4::numeric)), NULL, 'FINANCE', 'work_orders', $5::text),
              erp.fn_notify('COST_VARIANCE', format('Variance HPP %s %s%%', $1::text, erp.fn_fmt($2::numeric, 1)), NULL, NULL, 'FOUNDER', 'work_orders', $5::text)`,
      [w.wo_no, row.variance_pct, row.est_total, row.act_total, String(woId)]);
  }
  return row;
}

const pct = (est: number, act: number) => (est ? round(((act - est) / est) * 100, 1) : null);

/** Bentuk respons HPP per SPK (format contoh FRD FR-07.2 + informasi tambahan). */
export async function costingView(woId: number, c?: PoolClient) {
  const one = async (sql: string, p: unknown[]) => (c ? (await c.query(sql, p)).rows[0] ?? null : queryOne(sql, p));
  const r = await one(
    `SELECT w.id, w.wo_no, w.status AS wo_status, w.closed_at, w.target_qty, s.code AS sku_code, s.name AS sku_name,
            s.selling_price, s.pack_qty, br.code AS brand_code, br.name AS brand_name,
            c.status, c.fg_qty, c.reject_qty, c.est_material, c.est_labor, c.est_overhead, c.act_material, c.act_labor, c.act_overhead,
            c.est_total, c.act_total, c.variance_pct, c.calculated_at,
            op.id AS overhead_period_id, to_char(op.period_month, 'YYYY-MM') AS overhead_month, op.status AS overhead_status,
            (w.est_material_per_pcs IS NULL OR w.est_material_per_pcs = 0) AS est_material_missing,
            NOT EXISTS (SELECT 1 FROM erp.stock_movements m WHERE m.work_order_id = w.id
                        AND m.movement_type IN ('ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_PACKING')) AS no_material_issue,
            (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('code', mt.code, 'name', mt.name)), '[]')
               FROM erp.stock_movements m JOIN erp.materials mt ON mt.id = m.material_id
              WHERE m.work_order_id = w.id AND m.movement_type IN ('ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_PACKING') AND m.unit_cost = 0) AS zero_cost_materials,
            (SELECT coalesce(jsonb_agg(DISTINCT o.name), '[]') FROM ${LABOR_CREDITS_SQL} lc JOIN erp.operations o ON o.id = lc.operation_id
              WHERE lc.work_order_id = w.id AND lc.rate_idr IS NULL) AS ops_without_rate
     FROM erp.work_orders w JOIN erp.skus s ON s.id = w.sku_id JOIN erp.brands br ON br.id = s.brand_id
     LEFT JOIN erp.work_order_costings c ON c.work_order_id = w.id
     LEFT JOIN erp.overhead_periods op ON op.id = c.overhead_period_id
     WHERE w.id = $1`, [woId]);
  if (!r) throw notFound('SPK tidak ditemukan.', 'WO_NOT_FOUND');
  if (!r.status) {
    throw notFound(r.wo_status === 'CLOSED' ? `HPP ${r.wo_no} belum dihitung. Gunakan Hitung Ulang.` : `${r.wo_no} belum Closed; HPP aktual tersedia setelah SPK ditutup.`, 'COSTING_NOT_FOUND');
  }
  const thr = await varianceThreshold();
  const comp = (e: number, a: number) => ({ estimated: e, actual: a, variance_pct: pct(e, a) });
  const per_pcs = {
    material: comp(r.est_material, r.act_material),
    labor: comp(r.est_labor, r.act_labor),
    overhead: comp(r.est_overhead, r.act_overhead),
    total: comp(r.est_total, r.act_total),
  };
  const highlights = Object.entries(per_pcs).filter(([, v]) => v.variance_pct !== null && Math.abs(v.variance_pct) > thr).map(([k]) => k);
  const zero = r.zero_cost_materials as any[];
  const materialIncomplete = r.no_material_issue || zero.length > 0 || r.est_material_missing;
  const notes: string[] = [];
  if (r.status === 'PROVISIONAL') notes.push('Overhead periode belum dikunci Finance.');
  if (materialIncomplete) notes.push('Data harga tidak lengkap');
  if ((r.ops_without_rate as any[]).length) notes.push(`Operasi tanpa tarif: ${(r.ops_without_rate as any[]).join(', ')}.`);
  const pricePerPcs = r.selling_price !== null ? r.selling_price / (r.pack_qty || 1) : null;
  return {
    work_order: r.wo_no,
    status: r.status,
    fg_qty: r.fg_qty,
    per_pcs,
    currency: 'IDR',
    // --- informasi tambahan ---
    work_order_id: r.id,
    sku: { code: r.sku_code, name: r.sku_name },
    brand: { code: r.brand_code, name: r.brand_name },
    reject_qty: r.reject_qty,
    closed_at: r.closed_at,
    calculated_at: r.calculated_at,
    overhead_period: r.overhead_period_id ? { id: r.overhead_period_id, month: r.overhead_month, status: r.overhead_status } : null,
    variance_threshold_pct: thr,
    variance_idr_per_pcs: {
      material: round(r.act_material - r.est_material), labor: round(r.act_labor - r.est_labor),
      overhead: round(r.act_overhead - r.est_overhead), total: round(r.act_total - r.est_total),
    },
    highlights, // komponen dengan variance > ±ambang → tampil merah
    data_completeness: {
      material: materialIncomplete ? 'Data harga tidak lengkap' : 'OK',
      zero_cost_materials: zero,
      operations_without_rate: r.ops_without_rate,
    },
    margin: pricePerPcs !== null
      ? { selling_price_per_pcs: round(pricePerPcs), margin_per_pcs: round(pricePerPcs - r.act_total), margin_pct: pricePerPcs > 0 ? round(((pricePerPcs - r.act_total) / pricePerPcs) * 100, 1) : null }
      : { selling_price_per_pcs: null, margin_per_pcs: null, margin_pct: null, note: 'Harga jual belum diisi' },
    notes,
  };
}

// GET /costing/work-orders — daftar SPK Closed + ringkasan variance
financeRouter.get('/costing/work-orders', allow('FOUNDER', 'FINANCE'), ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const { from, to } = rangeParam(req.query, 3660);
  const thr = await varianceThreshold();
  const status = str(req.query.status)?.toUpperCase() ?? null;
  if (status) oneOf(status, ['FINAL', 'PROVISIONAL', 'NOT_CALCULATED'], 'status');
  const overOnly = req.query.over_threshold === 'true' || req.query.over_threshold === '1';
  const rows = await query(
    `SELECT w.id AS work_order_id, w.wo_no AS work_order, w.closed_at, w.close_type, s.code AS sku_code, s.name AS sku_name,
            br.code AS brand_code, br.name AS brand_name, w.target_qty,
            coalesce(c.status::text, 'NOT_CALCULATED') AS costing_status, c.fg_qty, c.reject_qty,
            c.est_total, c.act_total, c.variance_pct, (abs(c.variance_pct) > $3) AS over_threshold, c.calculated_at,
            count(*) OVER () AS _total
     FROM erp.work_orders w JOIN erp.skus s ON s.id = w.sku_id JOIN erp.brands br ON br.id = s.brand_id
     LEFT JOIN erp.work_order_costings c ON c.work_order_id = w.id
     WHERE w.status = 'CLOSED' AND erp.fn_wib_date(w.closed_at) BETWEEN $1::date AND $2::date
       AND ($4::text IS NULL OR coalesce(c.status::text, 'NOT_CALCULATED') = $4)
       AND (NOT $5::boolean OR abs(c.variance_pct) > $3)
       AND ($6::text IS NULL OR upper(br.code) = upper($6) OR br.id::text = $6)
       AND ($7::text IS NULL OR upper(s.code) = upper($7) OR s.id::text = $7)
     ORDER BY w.closed_at DESC LIMIT $8 OFFSET $9`,
    [from, to, thr, status, overOnly, str(req.query.brand), str(req.query.sku), limit, offset]);
  const summary = await queryOne(
    `SELECT count(*) AS closed, count(c.work_order_id) AS calculated,
            count(*) FILTER (WHERE abs(c.variance_pct) > $3) AS over_threshold,
            count(*) FILTER (WHERE c.status = 'PROVISIONAL') AS provisional,
            CASE WHEN sum(c.fg_qty * c.est_total) > 0 THEN round((sum(c.fg_qty * c.act_total) - sum(c.fg_qty * c.est_total)) / sum(c.fg_qty * c.est_total) * 100, 2) END AS weighted_variance_pct
     FROM erp.work_orders w LEFT JOIN erp.work_order_costings c ON c.work_order_id = w.id
     WHERE w.status = 'CLOSED' AND erp.fn_wib_date(w.closed_at) BETWEEN $1::date AND $2::date`, [from, to, thr]);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0, from, to, variance_threshold_pct: thr, summary });
}));

// GET /costing/work-orders/:id — HPP aktual vs estimasi per SPK
financeRouter.get('/costing/work-orders/:id', allow('FOUNDER', 'FINANCE'), ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  res.json(await costingView(wo.id));
}));

// POST /costing/work-orders/:id/recalculate — hitung ulang (SPK Closed yang belum Final)
financeRouter.post('/costing/work-orders/:id/recalculate', allow('FINANCE'), ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  if (wo.status !== 'CLOSED') throw new AppError(422, 'INVALID_STATUS', `${wo.wo_no} belum Closed. HPP aktual dihitung untuk SPK Closed.`);
  const cur = await queryOne(`SELECT status FROM erp.work_order_costings WHERE work_order_id = $1`, [wo.id]);
  if (cur?.status === 'FINAL') throw new AppError(422, 'COSTING_FINAL', 'HPP SPK ini sudah FINAL (periode overhead terkunci).');
  await withTx(req.user!.id, (c) => calculateCosting(c, wo.id));
  res.json(await costingView(wo.id));
}));

// GET /costing/summary?group_by=brand|sku&from=&to= — profitabilitas agregat (berbobot qty FG)
financeRouter.get('/costing/summary', allow('FOUNDER', 'FINANCE'), ah(async (req, res) => {
  const groupBy = oneOf(String(req.query.group_by ?? 'brand').toLowerCase(), ['brand', 'sku'] as const, 'group_by');
  const { from, to } = rangeParam(req.query, 3660);
  res.json({ group_by: groupBy, from, to, currency: 'IDR', variance_threshold_pct: await varianceThreshold(), data: await costingSummary(groupBy, from, to) });
}));

/** Agregat HPP per brand/SKU dari SPK Closed yang sudah dihitung (dipakai juga dasbor Founder). */
export async function costingSummary(groupBy: 'brand' | 'sku', from: string, to: string) {
  const key = groupBy === 'brand' ? 'br.id, br.code, br.name' : 's.id, s.code, s.name, br.code';
  const rows = await query(
    `SELECT ${groupBy === 'brand' ? 'br.code, br.name' : 's.code, s.name, br.code AS brand_code'},
            count(*) AS work_orders, sum(c.fg_qty) AS fg_qty, sum(c.reject_qty) AS reject_qty,
            count(*) FILTER (WHERE c.status = 'PROVISIONAL') AS provisional_count,
            round(sum(c.fg_qty * c.est_total) / nullif(sum(c.fg_qty), 0), 2) AS est_hpp_per_pcs,
            round(sum(c.fg_qty * c.act_total) / nullif(sum(c.fg_qty), 0), 2) AS act_hpp_per_pcs,
            round(sum(c.fg_qty * c.act_material) / nullif(sum(c.fg_qty), 0), 2) AS act_material_per_pcs,
            round(sum(c.fg_qty * c.act_labor) / nullif(sum(c.fg_qty), 0), 2) AS act_labor_per_pcs,
            round(sum(c.fg_qty * c.act_overhead) / nullif(sum(c.fg_qty), 0), 2) AS act_overhead_per_pcs,
            round((sum(c.fg_qty * c.act_total) - sum(c.fg_qty * c.est_total)) / nullif(sum(c.fg_qty * c.est_total), 0) * 100, 2) AS variance_pct,
            -- margin hanya dari SPK yang SKU-nya punya harga jual (harga per pcs = harga pack / isi pack)
            sum(c.fg_qty) FILTER (WHERE s.selling_price IS NOT NULL) AS priced_fg_qty,
            round(sum(c.fg_qty * s.selling_price / s.pack_qty) FILTER (WHERE s.selling_price IS NOT NULL), 2) AS revenue_idr,
            round(sum(c.fg_qty * c.act_total) FILTER (WHERE s.selling_price IS NOT NULL), 2) AS priced_cost_idr
     FROM erp.work_order_costings c
     JOIN erp.work_orders w ON w.id = c.work_order_id JOIN erp.skus s ON s.id = w.sku_id JOIN erp.brands br ON br.id = s.brand_id
     WHERE w.status = 'CLOSED' AND erp.fn_wib_date(w.closed_at) BETWEEN $1::date AND $2::date
     GROUP BY ${key} ORDER BY ${groupBy === 'brand' ? 'br.code' : 's.code'}`, [from, to]);
  return rows.map((r: any) => {
    const priced = Number(r.priced_fg_qty ?? 0);
    const margin = priced > 0 && r.revenue_idr > 0 ? round(((r.revenue_idr - r.priced_cost_idr) / r.revenue_idr) * 100, 1) : null;
    return {
      ...r,
      selling_price_per_pcs: priced > 0 ? round(r.revenue_idr / priced) : null,
      margin_pct: margin,
      margin_note: priced === 0 ? 'Harga jual belum diisi' : priced < Number(r.fg_qty) ? 'Sebagian SKU belum memiliki harga jual' : null,
      status_label: Number(r.provisional_count) > 0 ? 'Sementara' : 'Final',
    };
  }).sort((a: any, b: any) => (b.margin_pct ?? -1e9) - (a.margin_pct ?? -1e9));
}

