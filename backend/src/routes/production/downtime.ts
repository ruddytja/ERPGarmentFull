// FR-04.2 Downtime & Machine Ticketing · FR-04.3 Spare Part Consumption
import express, { Request } from 'express';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, conflict, num, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { dateParam, pgBusiness, resolveLine, resolveMachine, resolveMaterial, resolveTicket } from './common.ts';

export const downtimeRouter = express.Router();

const READ = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: ['TEKNISI'] });
const REPORTERS = allow('SUPERVISOR', { staff: ['OPERATOR', 'CUTTING', 'QC', 'PACKING', 'TEKNISI'] });
const STATUS_Q: Record<string, string> = { open: 'OPEN', in_progress: 'IN_PROGRESS', resolved: 'RESOLVED' };

const TICKET_SELECT = `
  SELECT dt.id, dt.ticket_no, dt.status, dt.machine_id, m.asset_code AS machine_code, m.brand_model, m.machine_type,
         m.status AS machine_status, dt.line_id, pl.code AS line_code, dt.issue_type, dt.description,
         dt.reported_by, rb.full_name AS reported_by_name, dt.reported_at,
         dt.assigned_to, asg.full_name AS assigned_to_name, dt.acknowledged_at, dt.escalated_at,
         dt.resolved_at, dt.resolution_note, dt.confirmed_by, cb.full_name AS confirmed_by_name, dt.confirmed_at,
         dt.downtime_min,
         round((extract(epoch FROM (coalesce(dt.resolved_at, now()) - dt.reported_at)) / 60)::numeric, 1) AS elapsed_min,
         CASE WHEN dt.acknowledged_at IS NOT NULL THEN round((extract(epoch FROM (dt.acknowledged_at - dt.reported_at)) / 60)::numeric, 1) END AS response_min,
         (SELECT count(*) FROM erp.downtime_spareparts sp WHERE sp.ticket_id = dt.id)::int AS sparepart_count,
         (SELECT bool_or(sp.is_shortage) FROM erp.downtime_spareparts sp WHERE sp.ticket_id = dt.id) AS has_shortage,
         (SELECT coalesce(sum(oe.amount), 0) FROM erp.overhead_entries oe JOIN erp.downtime_spareparts sp ON oe.ref_table = 'downtime_spareparts' AND oe.ref_id = sp.id WHERE sp.ticket_id = dt.id) AS sparepart_cost
  FROM erp.downtime_tickets dt
  JOIN erp.machines m ON m.id = dt.machine_id
  LEFT JOIN erp.production_lines pl ON pl.id = dt.line_id
  LEFT JOIN erp.users rb ON rb.id = dt.reported_by
  LEFT JOIN erp.users asg ON asg.id = dt.assigned_to
  LEFT JOIN erp.users cb ON cb.id = dt.confirmed_by`;

// Biaya spare part hanya untuk Admin/Founder/Finance (teknisi & supervisor tidak melihat biaya)
const costOut = (r: any, req: Request) => {
  if (canSeeCost(req.user)) return r;
  const { sparepart_cost, ...rest } = r;
  return rest;
};

async function spareparts(ticketId: number, req: Request) {
  const rows = await query(
    `SELECT sp.id, sp.material_id, m.code AS material_code, m.name AS material_name, m.uom, sp.qty, sp.unit_cost,
            round(sp.qty * sp.unit_cost, 2) AS total_cost, sp.is_shortage,
            CASE WHEN sp.is_shortage THEN 'Kekurangan Stok' END AS shortage_label,
            sp.recorded_by, u.full_name AS recorded_by_name, sp.recorded_at
     FROM erp.downtime_spareparts sp JOIN erp.materials m ON m.id = sp.material_id LEFT JOIN erp.users u ON u.id = sp.recorded_by
     WHERE sp.ticket_id = $1 ORDER BY sp.id`, [ticketId]);
  return canSeeCost(req.user) ? rows : rows.map(({ unit_cost, total_cost, ...r }) => r);
}

async function ticketDetail(id: number, req: Request) {
  const row = await queryOne(`${TICKET_SELECT} WHERE dt.id = $1`, [id]);
  return { ...costOut(row, req), spareparts: await spareparts(id, req) };
}

// POST /downtime-tickets — Supervisor / operator kios → fn_report_downtime
downtimeRouter.post('/downtime-tickets', REPORTERS, ah(async (req, res) => {
  const b = req.body ?? {};
  const issue = String(b.issue_type ?? b.issue ?? '').trim();
  if (!issue) throw badRequest('Jenis kendala (issue_type) wajib diisi.', { field: 'issue_type' });
  const m = await resolveMachine(b.machine ?? b.machine_id ?? b.machine_code);
  if (m.status === 'INACTIVE') throw new AppError(422, 'MACHINE_INACTIVE', `Mesin ${m.asset_code} tidak aktif.`);
  let no: string;
  try {
    no = await withTx(req.user!.id, async (c) =>
      (await c.query(`SELECT erp.fn_report_downtime($1, $2, $3, $4) AS no`, [m.asset_code, issue, req.user!.id, b.description ? String(b.description) : null])).rows[0].no);
  } catch (e: any) {
    const err = pgBusiness(e);
    if (err?.code === 'TICKET_EXISTS' || e?.code === '23505') {
      const open = await queryOne(`SELECT id, ticket_no, status FROM erp.downtime_tickets WHERE machine_id = $1 AND status <> 'RESOLVED'`, [m.id]);
      throw conflict(err?.message ?? `Mesin ini sudah memiliki tiket terbuka ${open?.ticket_no ?? ''}.`.trim(), 'TICKET_EXISTS',
        { ticket_id: open?.id, ticket_no: open?.ticket_no, status: open?.status });
    }
    throw e;
  }
  const t = await queryOne(`SELECT id FROM erp.downtime_tickets WHERE ticket_no = $1`, [no]);
  res.status(201).json(await ticketDetail(t!.id, req));
}));

// GET /downtime-tickets?status=open|in_progress|resolved&machine=&line=&assigned=me&from=&to=
downtimeRouter.get('/downtime-tickets', READ, ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.status) {
    const list = String(req.query.status).toLowerCase().split(',').map((s) => {
      const k = s.trim();
      if (k === 'active' || k === 'unresolved') return ['OPEN', 'IN_PROGRESS'];
      return [STATUS_Q[oneOf(k, ['open', 'in_progress', 'resolved'] as const, 'status')]];
    }).flat();
    params.push(list); where.push(`dt.status = ANY($${params.length}::erp.ticket_status[])`);
  }
  if (req.query.machine) { params.push((await resolveMachine(req.query.machine)).id); where.push(`dt.machine_id = $${params.length}`); }
  const line = await resolveLine(req.query.line);
  if (line) { params.push(line.id); where.push(`dt.line_id = $${params.length}`); }
  if (req.query.assigned === 'me') { params.push(req.user!.id); where.push(`dt.assigned_to = $${params.length}`); }
  const from = dateParam(req.query.from, 'from'); const to = dateParam(req.query.to, 'to');
  if (from) { params.push(from); where.push(`erp.fn_wib_date(dt.reported_at) >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`erp.fn_wib_date(dt.reported_at) <= $${params.length}::date`); }
  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${TICKET_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) x
     ORDER BY (x.status = 'RESOLVED'), x.reported_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows.map(({ total, ...r }) => costOut(r, req)), page, limit, total: rows[0]?.total ?? 0 });
}));

// GET /downtime-tickets/{id}
downtimeRouter.get('/downtime-tickets/:id', READ, ah(async (req, res) => {
  const t = await resolveTicket(req.params.id);
  res.json(await ticketDetail(t.id, req));
}));

// PATCH /downtime-tickets/{id} — Teknisi: status IN_PROGRESS / RESOLVED (+ resolution_note);
// Supervisor: konfirmasi mesin berjalan (confirm: true), ubah teknisi (assigned_to), juga boleh ubah status.
downtimeRouter.patch('/downtime-tickets/:id', allow('SUPERVISOR', { staff: ['TEKNISI'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  const u = req.user!;
  const isSpv = u.role === 'SUPERVISOR';
  const id = await withTx(u.id, async (c) => {
    const t = await resolveTicket(req.params.id, c, true);
    const sets: string[] = [];
    const params: unknown[] = [t.id];
    const set = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (b.status !== undefined) {
      const st = oneOf(String(b.status).toUpperCase(), ['IN_PROGRESS', 'RESOLVED'] as const, 'status');
      if (t.status === 'RESOLVED') {
        throw new AppError(422, 'INVALID_STATUS', 'Tiket yang sudah Resolved tidak dapat dibuka kembali. Buat tiket baru.');
      }
      if (st === 'RESOLVED') {
        const note = String(b.resolution_note ?? b.action_taken ?? t.resolution_note ?? '').trim();
        if (!note) throw new AppError(422, 'NOTE_REQUIRED', 'Isi tindakan perbaikan sebelum menandai Resolved.', { field: 'resolution_note' });
        set('resolution_note', note);
      }
      if (st !== t.status) set('status', st);
      // Teknisi yang mengambil tiket tanpa penanggung jawab otomatis menjadi assignee
      if (!isSpv && !t.assigned_to) set('assigned_to', u.id);
    } else if (b.resolution_note !== undefined) {
      set('resolution_note', String(b.resolution_note).trim() || null);
    }

    if (b.assigned_to !== undefined) {
      if (!isSpv) throw new AppError(403, 'ACCESS_DENIED', 'Hanya Supervisor yang dapat mengubah teknisi penanggung jawab.');
      const ref = String(b.assigned_to).trim();
      const tech = (await c.query(`SELECT id FROM erp.users WHERE status = 'ACTIVE' AND role = 'STAFF' AND staff_function = 'TEKNISI'
                                    AND (${/^\d+$/.test(ref) ? 'id = $1::bigint' : 'operator_code = upper($1)'})`, [ref])).rows[0];
      if (!tech) throw new AppError(422, 'TECHNICIAN_INVALID', 'Teknisi tidak ditemukan atau tidak aktif.');
      set('assigned_to', tech.id);
    }

    if (b.confirm === true || b.confirmed === true) {
      if (!isSpv) throw new AppError(403, 'ACCESS_DENIED', 'Konfirmasi mesin berjalan hanya oleh Supervisor.');
      const willResolve = t.status === 'RESOLVED' || String(b.status ?? '').toUpperCase() === 'RESOLVED';
      if (!willResolve) throw new AppError(422, 'INVALID_STATUS', 'Mesin hanya dapat dikonfirmasi berjalan setelah tiket Resolved.');
      if (t.confirmed_at) throw new AppError(422, 'ALREADY_CONFIRMED', 'Mesin sudah dikonfirmasi berjalan.');
      set('confirmed_by', u.id);
      sets.push('confirmed_at = now()');
    }
    if (!sets.length) throw badRequest('Tidak ada perubahan. Isi status, resolution_note, assigned_to, atau confirm.');
    await c.query(`UPDATE erp.downtime_tickets SET ${sets.join(', ')} WHERE id = $1`, params);
    if (b.confirm === true || b.confirmed === true) {
      await c.query(`UPDATE erp.machines SET status = 'RUNNING' WHERE id = $1 AND status = 'DOWN'`, [t.machine_id]);
    }
    return t.id;
  });
  res.json(await ticketDetail(id, req));
}));

// POST /downtime-tickets/{id}/spareparts — Teknisi: { items: [{ material, qty }] } atau { material, qty }
// Stok berkurang otomatis (trigger) + biaya ke overhead; stok kurang → dicatat "Kekurangan Stok".
downtimeRouter.post('/downtime-tickets/:id/spareparts', allow({ staff: ['TEKNISI'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  const items: any[] = Array.isArray(b.items) ? b.items : Array.isArray(b) ? b : [b];
  if (!items.length) throw badRequest('Isi spare part yang dipakai.', { field: 'items' });
  const t = await resolveTicket(req.params.id);
  if (t.confirmed_at) throw new AppError(422, 'TICKET_CLOSED', 'Tiket sudah dikonfirmasi Supervisor; spare part tidak dapat ditambahkan.');
  const created = await withTx(req.user!.id, async (c) => {
    const ids: number[] = [];
    for (const [i, it] of items.entries()) {
      required({ material: it?.material ?? it?.material_id ?? it?.material_code, qty: it?.qty }, ['material', 'qty']);
      const m = await resolveMaterial(it.material ?? it.material_id ?? it.material_code, c);
      if (m.category !== 'SPAREPART') throw new AppError(422, 'NOT_SPAREPART', `${m.name} bukan spare part.`, { index: i });
      const qty = num(it.qty, `items[${i}].qty`, { gt: 0, max: 100000 });
      ids.push((await c.query(`INSERT INTO erp.downtime_spareparts (ticket_id, material_id, qty, recorded_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [t.id, m.id, qty, req.user!.id])).rows[0].id);
    }
    return ids;
  });
  const all = await spareparts(t.id, req);
  const added = all.filter((x: any) => created.includes(x.id));
  const shortage = added.filter((x: any) => x.is_shortage);
  res.status(201).json({
    ticket_no: t.ticket_no, data: added,
    message: shortage.length ? `Tercatat. Kekurangan Stok: ${shortage.map((x: any) => x.material_name).join(', ')}.` : 'Spare part tercatat dan stok berkurang.',
  });
}));

// GET /reports/downtime?machine=&line=&from=&to= — rekap per mesin (biaya hanya Admin/Founder/Finance)
downtimeRouter.get('/reports/downtime', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.machine) { params.push((await resolveMachine(req.query.machine)).id); where.push(`dt.machine_id = $${params.length}`); }
  const line = await resolveLine(req.query.line);
  if (line) { params.push(line.id); where.push(`dt.line_id = $${params.length}`); }
  const from = dateParam(req.query.from, 'from'); const to = dateParam(req.query.to, 'to');
  if (from) { params.push(from); where.push(`erp.fn_wib_date(dt.reported_at) >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`erp.fn_wib_date(dt.reported_at) <= $${params.length}::date`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const cost = canSeeCost(req.user);
  const byMachine = await query(
    `SELECT m.id AS machine_id, m.asset_code AS machine_code, m.brand_model, m.status AS machine_status, pl.code AS line_code,
            count(*)::int AS tickets,
            count(*) FILTER (WHERE dt.status <> 'RESOLVED')::int AS open_tickets,
            round(coalesce(sum(round((extract(epoch FROM (coalesce(dt.resolved_at, now()) - dt.reported_at)) / 60)::numeric, 2)), 0), 1) AS downtime_min,
            round(avg(extract(epoch FROM (dt.acknowledged_at - dt.reported_at)) / 60)::numeric, 1) AS avg_response_min,
            round(avg(dt.downtime_min), 1) AS avg_repair_min,
            count(*) FILTER (WHERE dt.escalated_at IS NOT NULL)::int AS escalated,
            mode() WITHIN GROUP (ORDER BY dt.issue_type) AS top_issue
            ${cost ? `, coalesce(sum((SELECT sum(oe.amount) FROM erp.overhead_entries oe JOIN erp.downtime_spareparts sp ON oe.ref_table = 'downtime_spareparts' AND oe.ref_id = sp.id WHERE sp.ticket_id = dt.id)), 0) AS sparepart_cost` : ''}
     FROM erp.downtime_tickets dt JOIN erp.machines m ON m.id = dt.machine_id LEFT JOIN erp.production_lines pl ON pl.id = m.line_id
     ${w} GROUP BY m.id, pl.code ORDER BY downtime_min DESC`, params);
  const byIssue = await query(
    `SELECT dt.issue_type, count(*)::int AS tickets, round(coalesce(sum(dt.downtime_min), 0), 1) AS downtime_min
     FROM erp.downtime_tickets dt ${w} GROUP BY dt.issue_type ORDER BY tickets DESC`, params);
  const tickets = await query(`${TICKET_SELECT} ${w} ORDER BY dt.reported_at DESC LIMIT 500`, params);
  const sum = (k: string) => Math.round(byMachine.reduce((a, r) => a + (Number(r[k]) || 0), 0) * 10) / 10;
  res.json({
    from, to,
    summary: { tickets: sum('tickets'), open_tickets: sum('open_tickets'), downtime_min: sum('downtime_min'), escalated: sum('escalated'),
      ...(cost ? { sparepart_cost: sum('sparepart_cost') } : {}) },
    by_machine: byMachine, by_issue: byIssue, data: tickets.map((r) => costOut(r, req)),
  });
}));
