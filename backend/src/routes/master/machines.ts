// FR-01.5 Machine Asset Directory — daftar mesin, teknisi penanggung jawab, riwayat downtime & spare part
import express from 'express';
import { PoolClient } from 'pg';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, conflict, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { ALL, MGMT, buildSet, dateStr, resolveLine, resolveMachine, str } from './common.ts';

export const machinesRouter = express.Router();

const MACHINE_SELECT = `
  SELECT m.id, m.asset_code, m.brand_model, m.machine_type, m.line_id, m.technician_id, m.purchase_date::text AS purchase_date,
         m.status, m.created_at, m.updated_at, l.code AS line_code, l.name AS line_name, u.full_name AS technician_name, u.operator_code AS technician_code,
         t.ticket_no AS open_ticket_no, t.status AS open_ticket_status
  FROM erp.machines m
  LEFT JOIN erp.production_lines l ON l.id = m.line_id
  LEFT JOIN erp.users u ON u.id = m.technician_id
  LEFT JOIN erp.downtime_tickets t ON t.machine_id = m.id AND t.status <> 'RESOLVED'`;

function machineOut(r: any, user: any) {
  const { _total, ...m } = r;
  // Staff: kode mesin saja (+ status & lini untuk memilih mesin di kios)
  if (user.role === 'STAFF') return { id: m.id, asset_code: m.asset_code, line_code: m.line_code, status: m.status };
  return m;
}

const machineById = async (id: number, user: any) => machineOut(await queryOne(`${MACHINE_SELECT} WHERE m.id = $1`, [id]), user);

// GET /machines?line=&status=&q=
machinesRouter.get('/machines', allow(...ALL), ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const lineId = q.line ?? q.line_id ? await resolveLine(q.line ?? q.line_id) : null;
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS _total FROM (${MACHINE_SELECT}) x
     WHERE ($1::int IS NULL OR x.line_id = $1) AND ($2::text IS NULL OR x.status::text = ANY(string_to_array(upper($2), ',')))
       AND ($3::text IS NULL OR x.asset_code ILIKE '%' || $3 || '%' OR x.brand_model ILIKE '%' || $3 || '%')
     ORDER BY x.line_code NULLS LAST, x.asset_code LIMIT $4 OFFSET $5`, [lineId, str(q.status), str(q.q), p.limit, p.offset]);
  res.json({ data: rows.map((r) => machineOut(r, req.user)), page: p.page, limit: p.limit, total: rows[0]?._total ?? 0 });
}));

machinesRouter.get('/machines/:id', allow(...ALL), ah(async (req, res) => {
  res.json(await machineById(await resolveMachine(req.params.id), req.user));
}));

/** Teknisi penanggung jawab wajib user aktif berfungsi Teknisi. */
async function technicianId(c: PoolClient, raw: unknown): Promise<number | null> {
  if (raw === null || raw === '') return null;
  const v = String(raw).trim();
  const u = (await c.query(
    `SELECT id, status, role, staff_function FROM erp.users WHERE ${/^\d+$/.test(v) ? 'id = $1::bigint' : 'upper(operator_code) = upper($1)'}`, [v])).rows[0];
  if (!u || u.status !== 'ACTIVE') throw new AppError(422, 'TECHNICIAN_INVALID', 'Teknisi penanggung jawab harus user aktif.');
  if (u.role !== 'STAFF' || u.staff_function !== 'TEKNISI') throw new AppError(422, 'TECHNICIAN_INVALID', 'Teknisi penanggung jawab harus user dengan fungsi Teknisi.');
  return Number(u.id);
}

async function fields(c: PoolClient, b: any) {
  return {
    asset_code: b.asset_code !== undefined ? String(b.asset_code).trim().toUpperCase() : undefined,
    brand_model: b.brand_model !== undefined ? String(b.brand_model).trim() : undefined,
    machine_type: b.machine_type !== undefined ? String(b.machine_type).trim() : undefined,
    line_id: b.line_id ?? b.line_code ?? b.line ? await resolveLine(b.line_id ?? b.line_code ?? b.line, c) : (b.line_id === null ? null : undefined),
    technician_id: (b.technician_id ?? b.technician_code) !== undefined ? await technicianId(c, b.technician_id ?? b.technician_code) : undefined,
    purchase_date: b.purchase_date !== undefined ? (b.purchase_date === null ? null : dateStr(b.purchase_date, 'purchase_date')) : undefined,
  };
}

// POST /machines — Admin
machinesRouter.post('/machines', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['asset_code', 'brand_model', 'machine_type']);
  const id = await withTx(req.user!.id, async (c) => {
    const f: Record<string, unknown> = await fields(c, b);
    const cols = Object.keys(f).filter((k) => f[k] !== undefined);
    return (await c.query(`INSERT INTO erp.machines (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      cols.map((k) => f[k]))).rows[0].id;
  });
  res.status(201).json(await machineById(id, req.user));
}));

// PUT /machines/:id — Admin. Status Running/Down/Maintenance diatur modul downtime; di sini hanya
// mengaktifkan kembali (RUNNING) mesin INACTIVE atau set MAINTENANCE terjadwal bila tidak ada tiket terbuka.
machinesRouter.put('/machines/:id', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveMachine(req.params.id);
  const b = req.body ?? {};
  await withTx(req.user!.id, async (c) => {
    const f: Record<string, unknown> = await fields(c, b);
    if (b.status !== undefined) {
      const st = oneOf(String(b.status).toUpperCase(), ['RUNNING', 'MAINTENANCE', 'INACTIVE'] as const, 'status');
      const open = (await c.query(`SELECT ticket_no FROM erp.downtime_tickets WHERE machine_id = $1 AND status <> 'RESOLVED'`, [id])).rows[0];
      if (open) throw conflict(`Status mesin dikelola tiket downtime ${open.ticket_no} yang masih terbuka.`, 'OPEN_TICKET');
      f.status = st;
    }
    const { sets, params } = buildSet(f);
    if (!sets.length) throw badRequest('Tidak ada field yang diubah.');
    await c.query(`UPDATE erp.machines SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]);
  });
  res.json(await machineById(id, req.user));
}));

// PATCH /machines/:id/deactivate — Admin. Ditolak bila ada tiket downtime terbuka (trigger tg_machines_guard).
machinesRouter.patch('/machines/:id/deactivate', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveMachine(req.params.id);
  await withTx(req.user!.id, async (c) => {
    const m = (await c.query(`SELECT status FROM erp.machines WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (m.status === 'INACTIVE') throw conflict('Mesin sudah nonaktif.', 'ALREADY_INACTIVE');
    await c.query(`UPDATE erp.machines SET status = 'INACTIVE' WHERE id = $1`, [id]);
  });
  res.json({ status: 'OK', message: 'Mesin dinonaktifkan.', machine: await machineById(id, req.user) });
}));

// GET /machines/:id/history — riwayat tiket downtime + spare part (harga hanya untuk Admin/Founder/Finance)
machinesRouter.get('/machines/:id/history', allow(...MGMT), ah(async (req, res) => {
  const id = await resolveMachine(req.params.id);
  const p = paging(req.query);
  const cost = canSeeCost(req.user);
  const tickets = await query(
    `SELECT t.id, t.ticket_no, t.issue_type, t.description, t.status, t.reported_at, ru.full_name AS reported_by_name,
            au.full_name AS assigned_to_name, t.acknowledged_at, t.escalated_at, t.resolved_at, t.resolution_note,
            cu.full_name AS confirmed_by_name, t.confirmed_at,
            coalesce(t.downtime_min, round((extract(epoch FROM now() - t.reported_at) / 60)::numeric, 2)) AS downtime_min,
            coalesce((SELECT json_agg(json_build_object('material_code', m.code, 'material_name', m.name, 'uom', m.uom, 'qty', d.qty,
                       'is_shortage', d.is_shortage, 'recorded_at', d.recorded_at, 'recorded_by', uu.full_name
                       ${cost ? `, 'unit_cost', d.unit_cost, 'total_cost', round(d.qty * d.unit_cost, 2)` : ''}) ORDER BY d.id)
                      FROM erp.downtime_spareparts d JOIN erp.materials m ON m.id = d.material_id LEFT JOIN erp.users uu ON uu.id = d.recorded_by
                      WHERE d.ticket_id = t.id), '[]') AS spareparts,
            count(*) OVER() AS _total
     FROM erp.downtime_tickets t
     JOIN erp.users ru ON ru.id = t.reported_by LEFT JOIN erp.users au ON au.id = t.assigned_to LEFT JOIN erp.users cu ON cu.id = t.confirmed_by
     WHERE t.machine_id = $1 ORDER BY t.reported_at DESC LIMIT $2 OFFSET $3`, [id, p.limit, p.offset]);
  const sum = await queryOne(
    `SELECT count(*) AS ticket_count, coalesce(sum(downtime_min), 0) AS total_downtime_min,
            (SELECT coalesce(sum(d.qty * d.unit_cost), 0) FROM erp.downtime_spareparts d JOIN erp.downtime_tickets t2 ON t2.id = d.ticket_id WHERE t2.machine_id = $1) AS sparepart_cost
     FROM erp.downtime_tickets WHERE machine_id = $1`, [id]);
  if (!cost) delete sum.sparepart_cost;
  res.json({
    machine: await machineById(id, req.user), summary: sum,
    data: tickets.map(({ _total, ...t }) => t), page: p.page, limit: p.limit, total: tickets[0]?._total ?? 0,
  });
}));
