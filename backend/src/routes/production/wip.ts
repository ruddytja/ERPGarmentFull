// FR-04.1 WIP Tracking (Barcode Scan) — scan kios START/COMPLETE, sinkron offline, papan WIP, anomali & koreksi scan
import express, { Request } from 'express';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, forbidden, num, oneOf, paging } from '../../lib/http.ts';
import { allow, AuthUser } from '../../lib/auth.ts';
import { dateParam, isUuid, pgBusiness, reasonParam, resolveLine, resolveMachine, resolveWo, stableUuid } from './common.ts';
import { BUNDLE_SELECT } from './bundles.ts';

export const wipRouter = express.Router();

const SCAN = allow('SUPERVISOR', { staff: ['OPERATOR'] });
const DUP_CODES = new Set(['ALREADY_RECORDED', 'ALREADY_STARTED']);
const DUP_MESSAGE = 'Sudah tercatat. Tidak perlu scan ulang.';

interface ScanInput {
  operator_id?: string; operator_code?: string; bundle_id?: string; bundle_code?: string; qr?: string;
  action?: string; machine_id?: string | number; machine_code?: string; scanned_at?: string; client_id?: string;
}

function parseTime(v: unknown, field: string): Date {
  if (v === undefined || v === null || v === '') return new Date();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} harus berformat ISO 8601.`, { field });
  if (d.getTime() > Date.now() + 5 * 60_000) throw badRequest(`${field} tidak boleh di masa depan.`, { field });
  return d;
}

/**
 * Proses satu scan. Mengembalikan hasil siap kirim; scan ganda → status DUPLICATE (bukan error).
 * stableKey=true: idempotensi berdasarkan scanned_at + bundel + operator + aksi (sinkron offline).
 */
async function scanOne(user: AuthUser, it: ScanInput, source: 'ONLINE' | 'OFFLINE_SYNC', stableKey: boolean) {
  const action = oneOf(String(it.action ?? '').toUpperCase(), ['START', 'COMPLETE'] as const, 'action');
  const qr = String(it.bundle_id ?? it.bundle_code ?? it.qr ?? '').trim();
  if (!qr) throw badRequest('bundle_id (kode/QR bundel) wajib diisi.', { field: 'bundle_id' });
  let op = String(it.operator_id ?? it.operator_code ?? '').trim().toUpperCase();
  if (!op && user.role === 'STAFF') op = (user.operatorCode ?? '').toUpperCase();
  if (!op) throw badRequest('operator_id wajib diisi.', { field: 'operator_id' });
  // Operator kios hanya boleh scan atas namanya sendiri; Supervisor boleh atas nama operator lain
  if (user.role !== 'SUPERVISOR' && op !== (user.operatorCode ?? '').toUpperCase()) {
    throw forbidden('Anda hanya dapat melakukan scan atas nama Anda sendiri.', 'OPERATOR_MISMATCH');
  }
  let machine: string | null = null;
  const mref = it.machine_id ?? it.machine_code;
  if (mref !== undefined && mref !== null && mref !== '') machine = (await resolveMachine(mref)).asset_code;
  const at = parseTime(it.scanned_at, 'scanned_at');
  const bundleKey = qr.split(':')[0].trim().toUpperCase();
  const ticketKey = qr.replace(/\s+/g, '').toUpperCase(); // kode + versi tiket (tiket lama tetap divalidasi)
  const clientId = !stableKey && isUuid(it.client_id) ? it.client_id! : stableUuid(`${at.toISOString()}|${ticketKey}|${op}|${action}`);

  let r: any;
  try {
    r = await withTx(user.id, async (c) =>
      (await c.query(`SELECT erp.fn_wip_scan($1, $2, $3, $4, $5::uuid, $6::timestamptz, $7::erp.scan_source) AS r`,
        [qr, op, action, machine, clientId, at.toISOString(), source])).rows[0].r);
  } catch (e: any) {
    const b = pgBusiness(e);
    if (b && DUP_CODES.has(b.code)) {
      return { status: 'DUPLICATE', code: b.code, message: b.code === 'ALREADY_RECORDED' ? DUP_MESSAGE : b.message, action, bundle: bundleKey, client_id: clientId };
    }
    throw e;
  }
  if (r.status === 'DUPLICATE_IGNORED') {
    return { status: 'DUPLICATE', code: 'DUPLICATE_IGNORED', message: DUP_MESSAGE, action, bundle: bundleKey, task_id: r.task_id, client_id: clientId };
  }
  const hide = user.role === 'STAFF';
  if (r.status === 'STARTED') {
    return {
      status: 'OK', action, task_id: r.task_id, bundle: r.bundle, operation: r.operation, qty: r.qty,
      target_minutes: r.target_minutes, message: `Mulai: ${r.operation} (${r.qty} pcs)`, client_id: clientId,
    };
  }
  return {
    status: 'OK', action, task_id: r.task_id, bundle: r.bundle, operation: r.operation, qty: r.qty, duration_min: r.duration_min,
    next_operation: r.next_operation, ...(hide ? {} : { is_anomaly: r.is_anomaly }),
    message: `Tercatat: ${r.qty} pcs ${r.operation}`, client_id: clientId,
  };
}

// POST /wip/scan — { operator_id, bundle_id, action, machine_id, scanned_at, client_id? }
wipRouter.post('/wip/scan', SCAN, ah(async (req, res) => {
  res.json(await scanOne(req.user!, req.body ?? {}, 'ONLINE', false));
}));

// POST /wip/sync — batch scan offline; idempoten (scanned_at + bundel + operator + aksi); hasil per item
wipRouter.post('/wip/sync', SCAN, ah(async (req, res) => {
  const items: ScanInput[] = Array.isArray(req.body) ? req.body : (req.body?.items ?? req.body?.scans);
  if (!Array.isArray(items) || !items.length) throw badRequest('items wajib berisi minimal satu scan.', { field: 'items' });
  if (items.length > 500) throw badRequest('Maksimal 500 scan per sinkronisasi.', { field: 'items' });
  // Proses berurutan sesuai waktu scan agar START diproses sebelum COMPLETE
  const order = items.map((it, index) => ({ it, index, t: Date.parse(String(it?.scanned_at ?? '')) || 0 }))
    .sort((a, b) => a.t - b.t || a.index - b.index);
  const results: any[] = new Array(items.length);
  for (const { it, index } of order) {
    try {
      results[index] = { index, ...(await scanOne(req.user!, it ?? {}, 'OFFLINE_SYNC', true)), client_ref: it?.client_id ?? null };
    } catch (e: any) {
      const b = pgBusiness(e);
      const ae = e instanceof AppError ? e : null;
      if (!b && !ae) throw e;
      results[index] = { index, status: 'ERROR', code: b?.code ?? ae!.code, message: b?.message ?? ae!.message, client_ref: it?.client_id ?? null };
    }
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  res.json({ synced: count('OK'), duplicates: count('DUPLICATE'), errors: count('ERROR'), results });
}));

// GET /wip/status?wo=&line=&status=&all=true — papan WIP real-time
wipRouter.get('/wip/status', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.wo) { params.push((await resolveWo(req.query.wo)).id); where.push(`b.work_order_id = $${params.length}`); }
  else where.push(`w.status = 'ACTIVE'`);
  const line = await resolveLine(req.query.line);
  if (line) {
    params.push(line.id);
    where.push(`EXISTS (SELECT 1 FROM erp.wip_tasks t WHERE t.bundle_id = b.id AND t.line_id = $${params.length})`);
  }
  if (req.query.status) {
    const list = String(req.query.status).toUpperCase().split(',').map((s) => oneOf(s.trim(), ['CREATED', 'IN_PROGRESS', 'SEWN', 'INSPECTED', 'VOID'] as const, 'status'));
    params.push(list); where.push(`b.status = ANY($${params.length}::erp.bundle_status[])`);
  } else if (req.query.all !== 'true') {
    where.push(`b.status IN ('CREATED','IN_PROGRESS','SEWN')`);
  }
  const w = `WHERE ${where.join(' AND ')}`;
  const summary = await queryOne(
    `SELECT count(*)::int AS bundles, coalesce(sum(b.qty), 0)::int AS pcs,
            count(*) FILTER (WHERE b.status = 'CREATED')::int AS created,
            count(*) FILTER (WHERE b.status = 'IN_PROGRESS')::int AS in_progress,
            count(*) FILTER (WHERE b.status = 'SEWN')::int AS sewn,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM erp.wip_tasks t WHERE t.bundle_id = b.id AND t.completed_at IS NULL))::int AS being_worked
     FROM erp.bundles b JOIN erp.work_orders w ON w.id = b.work_order_id ${w}`, params);
  const byOperation = await query(
    `SELECT o.name AS operation, count(*)::int AS bundles, sum(t.qty)::int AS pcs
     FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id JOIN erp.bundles b ON b.id = t.bundle_id
     JOIN erp.work_orders w ON w.id = b.work_order_id ${w} AND t.completed_at IS NULL GROUP BY o.name ORDER BY o.name`, params);
  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${BUNDLE_SELECT} ${w}) x
     ORDER BY (x.current_task_id IS NULL), x.current_started_at, x.work_order_id, x.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ summary: { ...summary, in_progress_by_operation: byOperation }, data: rows.map(({ total, ...r }) => r), page, limit, total: rows[0]?.total ?? 0 });
}));

const TASK_SELECT = `
  SELECT t.id, t.bundle_id, b.bundle_code, w.wo_no, s.code AS sku_code, v.size, v.color,
         t.operation_id, o.name AS operation, o.smv_minutes, t.operator_id, u.operator_code, u.full_name AS operator_name,
         mc.asset_code AS machine, pl.code AS line, t.qty, t.started_at, t.completed_at, t.duration_min,
         round(o.smv_minutes * t.qty, 2) AS standard_min,
         CASE WHEN o.smv_minutes * t.qty > 0 THEN round(t.duration_min / (o.smv_minutes * t.qty) * 100, 1) END AS duration_pct_of_standard,
         t.is_anomaly, t.anomaly_reviewed_by, rv.full_name AS anomaly_reviewed_by_name, t.anomaly_reviewed_at, t.anomaly_accepted,
         t.source, t.corrected_by, t.correction_reason, t.created_at
  FROM erp.wip_tasks t
  JOIN erp.bundles b ON b.id = t.bundle_id
  JOIN erp.work_orders w ON w.id = b.work_order_id
  JOIN erp.skus s ON s.id = w.sku_id
  JOIN erp.sku_variants v ON v.id = b.sku_variant_id
  JOIN erp.operations o ON o.id = t.operation_id
  JOIN erp.users u ON u.id = t.operator_id
  LEFT JOIN erp.users rv ON rv.id = t.anomaly_reviewed_by
  LEFT JOIN erp.machines mc ON mc.id = t.machine_id
  LEFT JOIN erp.production_lines pl ON pl.id = t.line_id`;

const taskRow = (id: number) => queryOne(`${TASK_SELECT} WHERE t.id = $1`, [id]);

// GET /wip/anomalies?status=pending|reviewed|all&from=&to=&wo=
wipRouter.get('/wip/anomalies', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const status = String(req.query.status ?? 'pending').toLowerCase();
  oneOf(status, ['pending', 'reviewed', 'all'] as const, 'status');
  const where = ['t.is_anomaly'];
  const params: unknown[] = [];
  if (status === 'pending') where.push('t.anomaly_reviewed_at IS NULL');
  if (status === 'reviewed') where.push('t.anomaly_reviewed_at IS NOT NULL');
  if (req.query.wo) { params.push((await resolveWo(req.query.wo)).id); where.push(`w.id = $${params.length}`); }
  const from = dateParam(req.query.from, 'from'); const to = dateParam(req.query.to, 'to');
  if (from) { params.push(from); where.push(`erp.fn_wib_date(t.completed_at) >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`erp.fn_wib_date(t.completed_at) <= $${params.length}::date`); }
  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${TASK_SELECT} WHERE ${where.join(' AND ')}) x
     ORDER BY x.completed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows.map(({ total, ...r }) => r), page, limit, total: rows[0]?.total ?? 0 });
}));

// GET /wip/tasks/{id}
wipRouter.get('/wip/tasks/:id', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const row = await taskRow(num(req.params.id, 'id', { int: true }));
  if (!row) throw new AppError(404, 'TASK_NOT_FOUND', 'Data scan tidak ditemukan.');
  res.json(row);
}));

// PATCH|POST /wip/tasks/{id}/review — Supervisor: { accept: true|false } → fn_review_anomaly
const review = ah(async (req: Request, res) => {
  const b = req.body ?? {};
  let accept: boolean;
  if (typeof b.accept === 'boolean') accept = b.accept;
  else if (b.decision) accept = oneOf(String(b.decision).toUpperCase(), ['ACCEPT', 'REJECT'] as const, 'decision') === 'ACCEPT';
  else throw badRequest('Field accept (true = Terima/dibayar, false = Tolak) wajib diisi.', { field: 'accept' });
  const id = num(req.params.id, 'id', { int: true });
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_review_anomaly($1, $2, $3)`, [id, req.user!.id, accept]));
  res.json(await taskRow(id));
});
wipRouter.patch('/wip/tasks/:id/review', allow('SUPERVISOR'), review);
wipRouter.post('/wip/tasks/:id/review', allow('SUPERVISOR'), review);

// PATCH /wip/tasks/{id} — koreksi scan Supervisor (operator/qty/waktu/mesin) dengan alasan; tercatat di audit
wipRouter.patch('/wip/tasks/:id', allow('SUPERVISOR'), ah(async (req, res) => {
  const b = req.body ?? {};
  const reason = reasonParam(b.reason ?? b.correction_reason, 'Alasan koreksi scan wajib diisi.', 'CORRECTION_REQUIRED');
  const id = num(req.params.id, 'id', { int: true });
  await withTx(req.user!.id, async (c) => {
    const t = (await c.query(
      `SELECT t.*, b.qty AS bundle_qty, b.status AS bundle_status, o.smv_minutes FROM erp.wip_tasks t
       JOIN erp.bundles b ON b.id = t.bundle_id JOIN erp.operations o ON o.id = t.operation_id WHERE t.id = $1 FOR UPDATE OF t`, [id])).rows[0];
    if (!t) throw new AppError(404, 'TASK_NOT_FOUND', 'Data scan tidak ditemukan.');
    if (['INSPECTED', 'VOID'].includes(t.bundle_status)) {
      throw new AppError(422, 'CORRECTION_NOT_ALLOWED', 'Bundel sudah selesai QC atau tidak berlaku; scan tidak dapat dikoreksi.');
    }
    const locked = (await c.query(
      `SELECT 1 FROM erp.payroll_periods p WHERE p.status = 'APPROVED'
         AND erp.fn_wib_date(coalesce($1::timestamptz, now())) BETWEEN p.period_start AND p.period_end`, [t.completed_at])).rows[0];
    if (locked) throw new AppError(422, 'PERIOD_LOCKED', 'Scan ini sudah masuk periode payroll yang di-approve dan tidak dapat dikoreksi.');

    const next: any = { operator_id: t.operator_id, qty: t.qty, started_at: t.started_at, completed_at: t.completed_at, machine_id: t.machine_id };
    if (b.operator_id !== undefined || b.operator_code !== undefined) {
      const ref = String(b.operator_id ?? b.operator_code).trim();
      const u = (await c.query(`SELECT id, role, staff_function, status FROM erp.users WHERE ${/^\d+$/.test(ref) ? 'id = $1::bigint' : 'operator_code = upper($1)'}`, [ref])).rows[0];
      if (!u || u.status !== 'ACTIVE' || u.role !== 'STAFF' || !['OPERATOR', 'CUTTING'].includes(u.staff_function)) {
        throw new AppError(422, 'OPERATOR_INVALID', 'ID ini bukan operator produksi aktif.');
      }
      next.operator_id = u.id;
    }
    if (b.qty !== undefined) next.qty = num(b.qty, 'qty', { int: true, min: 1, max: t.bundle_qty });
    if (b.started_at !== undefined) next.started_at = parseTime(b.started_at, 'started_at');
    if (b.completed_at !== undefined) next.completed_at = b.completed_at === null ? null : parseTime(b.completed_at, 'completed_at');
    if (b.machine_id !== undefined || b.machine_code !== undefined) {
      const m = b.machine_id ?? b.machine_code;
      next.machine_id = m === null || m === '' ? null : (await resolveMachine(m, c)).id;
    }
    if (t.completed_at && next.completed_at === null) throw new AppError(422, 'CORRECTION_NOT_ALLOWED', 'Scan yang sudah selesai tidak dapat dibuka kembali.');
    if (next.completed_at && new Date(next.completed_at) <= new Date(next.started_at)) {
      throw badRequest('Waktu selesai harus setelah waktu mulai.', { field: 'completed_at' });
    }
    // Hitung ulang flag anomali bila durasi/qty berubah pada scan yang sudah selesai
    let anomaly = t.is_anomaly;
    if (t.completed_at && next.completed_at) {
      const ratio = (await c.query(`SELECT erp.fn_setting_num('scan_anomaly_ratio', 0.5) AS r`)).rows[0].r;
      const mins = (new Date(next.completed_at).getTime() - new Date(next.started_at).getTime()) / 60000;
      anomaly = mins < t.smv_minutes * next.qty * ratio;
    }
    await c.query(
      `UPDATE erp.wip_tasks SET operator_id = $2, qty = $3, started_at = $4, completed_at = $5, machine_id = $6,
              is_anomaly = $7,
              anomaly_reviewed_by = CASE WHEN $7 = is_anomaly THEN anomaly_reviewed_by END,
              anomaly_reviewed_at = CASE WHEN $7 = is_anomaly THEN anomaly_reviewed_at END,
              anomaly_accepted   = CASE WHEN $7 = is_anomaly THEN anomaly_accepted END,
              source = 'MANUAL_CORRECTION', corrected_by = $8, correction_reason = $9
       WHERE id = $1`,
      [id, next.operator_id, next.qty, next.started_at, next.completed_at, next.machine_id, anomaly, req.user!.id, reason]);
  });
  res.json(await taskRow(id));
}));
