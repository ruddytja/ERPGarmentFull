// FR-01.2 Standard Minute Value (SMV) & Tarif Borongan — operasi + histori tarif
import express from 'express';
import { PoolClient } from 'pg';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { ah, badRequest, conflict, num, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeRates } from '../../lib/auth.ts';
import { MGMT, STATUS, buildSet, dateStr, decimals, resolveOperation, str } from './common.ts';

export const operationsRouter = express.Router();

const LINE_TYPES = ['CUTTING', 'SEWING', 'BONDING', 'QC', 'PACKING'] as const;

const OP_SELECT = `
  SELECT o.*,
         cr.rate_idr AS current_rate_idr, cr.effective_from::text AS current_rate_effective_from,
         nr.rate_idr AS next_rate_idr, nr.effective_from::text AS next_rate_effective_from,
         (SELECT count(*) FROM erp.sku_routings r WHERE r.operation_id = o.id) AS routing_usage
  FROM erp.operations o
  LEFT JOIN LATERAL (SELECT rate_idr, effective_from FROM erp.piece_rates p
                     WHERE p.operation_id = o.id AND p.effective_from <= erp.fn_wib_date(now())
                     ORDER BY effective_from DESC LIMIT 1) cr ON true
  LEFT JOIN LATERAL (SELECT rate_idr, effective_from FROM erp.piece_rates p
                     WHERE p.operation_id = o.id AND p.effective_from > erp.fn_wib_date(now())
                     ORDER BY effective_from LIMIT 1) nr ON true`;

const RATE_KEYS = ['current_rate_idr', 'current_rate_effective_from', 'next_rate_idr', 'next_rate_effective_from'];

function opOut(r: any, user: any) {
  const { _total, ...o } = r;
  if (!canSeeRates(user)) for (const k of RATE_KEYS) delete o[k];
  return o;
}

const opById = async (id: number, user: any) => opOut(await queryOne(`${OP_SELECT} WHERE o.id = $1`, [id]), user);

// GET /operations?line_type=&status=&q= — Admin/Founder/Finance (dengan tarif), Supervisor (SMV saja)
operationsRouter.get('/operations', allow(...MGMT), ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS _total FROM (${OP_SELECT}) x
     WHERE ($1::text IS NULL OR x.line_type::text = upper($1)) AND ($2::text IS NULL OR x.status::text = upper($2))
       AND ($3::text IS NULL OR x.code ILIKE '%' || $3 || '%' OR x.name ILIKE '%' || $3 || '%')
     ORDER BY x.line_type, x.code LIMIT $4 OFFSET $5`, [str(q.line_type), str(q.status), str(q.q), p.limit, p.offset]);
  res.json({ data: rows.map((r) => opOut(r, req.user)), page: p.page, limit: p.limit, total: rows[0]?._total ?? 0 });
}));

operationsRouter.get('/operations/:id', allow(...MGMT), ah(async (req, res) => {
  res.json(await opById(await resolveOperation(req.params.id), req.user));
}));

/** Insert tarif baru (trigger tg_piece_rates_guard menolak tanggal di periode payroll approved). */
async function insertRate(c: PoolClient, opId: number, rate: unknown, effective: unknown, userId: number) {
  const r = num(rate, 'rate_idr', { min: 0 });
  decimals(r, 2, 'rate_idr');
  const d = dateStr(effective, 'effective_date');
  await c.query(
    `INSERT INTO erp.piece_rates (operation_id, rate_idr, effective_from, created_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (operation_id, effective_from) DO UPDATE SET rate_idr = EXCLUDED.rate_idr, created_by = EXCLUDED.created_by, created_at = now()`,
    [opId, r, d, userId]);
}

function smvOf(v: unknown) {
  const n = num(v, 'smv_minutes', { gt: 0, max: 9999 });
  return decimals(n, 3, 'smv_minutes');
}

// POST /operations — Admin. Tarif awal opsional: rate_idr + effective_date (default hari ini).
operationsRouter.post('/operations', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['code', 'name', 'line_type', 'smv_minutes']);
  oneOf(b.line_type, LINE_TYPES, 'line_type');
  const smv = smvOf(b.smv_minutes);
  const id = await withTx(req.user!.id, async (c) => {
    const opId = Number((await c.query(
      `INSERT INTO erp.operations (code, name, line_type, machine_type, smv_minutes)
       VALUES (upper(trim($1)), trim($2), $3, nullif(trim($4), ''), $5) RETURNING id`,
      [b.code, b.name, b.line_type, b.machine_type ?? null, smv])).rows[0].id);
    if (b.rate_idr !== undefined && b.rate_idr !== null) {
      const eff = b.effective_date ?? (await c.query(`SELECT erp.fn_wib_date(now())::text AS d`)).rows[0].d;
      await insertRate(c, opId, b.rate_idr, eff, req.user!.id);
    }
    return opId;
  });
  res.status(201).json(await opById(id, req.user));
}));

// PUT /operations/:id — Admin. Ubah SMV/atribut; perubahan tarif wajib dengan effective_date → baris piece_rates baru.
operationsRouter.put('/operations/:id', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveOperation(req.params.id);
  const b = req.body ?? {};
  const hasRate = b.rate_idr !== undefined && b.rate_idr !== null;
  if (hasRate && !b.effective_date) throw badRequest('Perubahan tarif wajib menyertakan effective_date (tanggal efektif).', { field: 'effective_date' });
  const { sets, params } = buildSet({
    code: b.code !== undefined ? String(b.code).trim().toUpperCase() : undefined,
    name: b.name !== undefined ? String(b.name).trim() : undefined,
    line_type: b.line_type !== undefined ? oneOf(b.line_type, LINE_TYPES, 'line_type') : undefined,
    machine_type: b.machine_type !== undefined ? str(b.machine_type) : undefined,
    smv_minutes: b.smv_minutes !== undefined ? smvOf(b.smv_minutes) : undefined,
    status: b.status !== undefined ? oneOf(b.status, STATUS, 'status') : undefined,
  });
  if (!sets.length && !hasRate) throw badRequest('Tidak ada field yang diubah.');
  await withTx(req.user!.id, async (c) => {
    if (sets.length) await c.query(`UPDATE erp.operations SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]);
    if (hasRate) await insertRate(c, id, b.rate_idr, b.effective_date, req.user!.id);
  });
  res.json(await opById(id, req.user));
}));

// POST /operations/:id/rates — Admin (FRD Role Admin): tambah tarif dengan tanggal efektif
operationsRouter.post('/operations/:id/rates', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveOperation(req.params.id);
  required(req.body ?? {}, ['rate_idr', 'effective_date']);
  await withTx(req.user!.id, (c) => insertRate(c, id, req.body.rate_idr, req.body.effective_date, req.user!.id));
  res.status(201).json(await opById(id, req.user));
}));

// GET /operations/:id/rates — histori tarif (Admin/Founder/Finance; Supervisor & Staff ditolak)
operationsRouter.get('/operations/:id/rates', allow('ADMIN', 'FOUNDER', 'FINANCE'), ah(async (req, res) => {
  const id = await resolveOperation(req.params.id);
  const op = await queryOne(`SELECT id, code, name FROM erp.operations WHERE id = $1`, [id]);
  const rows = await query(
    `SELECT p.id, p.rate_idr, p.effective_from::text AS effective_from, p.created_at, u.full_name AS created_by_name,
            (p.effective_from <= erp.fn_wib_date(now()) AND p.effective_from = (
               SELECT max(effective_from) FROM erp.piece_rates x WHERE x.operation_id = p.operation_id AND x.effective_from <= erp.fn_wib_date(now()))) AS is_current,
            (p.effective_from <= coalesce((SELECT max(period_end) FROM erp.payroll_periods WHERE status = 'APPROVED'), '-infinity'::date)) AS is_locked
     FROM erp.piece_rates p LEFT JOIN erp.users u ON u.id = p.created_by
     WHERE p.operation_id = $1 ORDER BY p.effective_from DESC`, [id]);
  const lock = await queryOne(`SELECT max(period_end)::text AS locked_until FROM erp.payroll_periods WHERE status = 'APPROVED'`);
  res.json({ operation: op, payroll_locked_until: lock?.locked_until ?? null, data: rows });
}));

// PATCH /operations/:id/deactivate — Admin. Operasi tidak pernah dihapus (bisa dipakai routing/WIP/payroll).
operationsRouter.patch('/operations/:id/deactivate', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveOperation(req.params.id);
  const used = await withTx(req.user!.id, async (c) => {
    const o = (await c.query(`SELECT status FROM erp.operations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (o.status === 'INACTIVE') throw conflict('Operasi sudah nonaktif.', 'ALREADY_INACTIVE');
    const r = (await c.query(
      `SELECT s.code FROM erp.sku_routings r JOIN erp.skus s ON s.id = r.sku_id WHERE r.operation_id = $1 ORDER BY s.code`, [id])).rows;
    const wo = (await c.query(
      `SELECT w.wo_no FROM erp.work_orders w JOIN erp.sku_routings r ON r.sku_id = w.sku_id
       WHERE r.operation_id = $1 AND w.status = 'ACTIVE' ORDER BY w.id LIMIT 1`, [id])).rows[0];
    if (wo) throw conflict(`Operasi masih dipakai routing ${wo.wo_no} yang sedang aktif. Nonaktifkan setelah SPK ditutup.`, 'OPERATION_IN_USE');
    await c.query(`UPDATE erp.operations SET status = 'INACTIVE' WHERE id = $1`, [id]);
    return r.map((x: any) => x.code);
  });
  res.json({
    status: 'OK', message: 'Operasi dinonaktifkan.', operation: await opById(id, req.user),
    ...(used.length ? { warning: `Operasi masih tercantum di routing SKU: ${used.join(', ')}. Perbarui routing SKU tersebut.`, used_in_skus: used } : {}),
  });
}));
