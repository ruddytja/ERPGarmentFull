// FR-03.1 Work Order (SPK) Generation — daftar, buat (Draft), ubah, revisi, aktivasi, tutup, batal, progres
import express, { Request } from 'express';
import { PoolClient } from 'pg';
import { audit, query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, conflict, num, oneOf, paging } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { dateParam, pgBusiness, reasonParam, resolveCustomer, resolveSku, resolveWo } from './common.ts';

export const workOrdersRouter = express.Router();

const DESTINATIONS = ['B2B', 'INTERNAL_STOCK', 'ECOMMERCE'] as const;
const STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;
const READ_ROLES = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: '*' });

// Kolom ringkas SPK (tanpa estimasi biaya; ditambahkan terpisah untuk role yang berhak)
const WO_SELECT = `
  SELECT w.id, w.wo_no, w.status, w.sku_id, s.code AS sku_code, s.name AS sku_name, w.bom_id, b.version AS bom_version,
         w.target_qty, w.due_date::text AS due_date, w.destination, w.customer_id, c.code AS customer_code, c.name AS customer_name,
         w.notes, w.created_by, cu.full_name AS created_by_name, w.created_at, w.activated_by, w.activated_at,
         w.closed_by, w.closed_at, w.close_type, w.close_reason, w.updated_at,
         w.est_material_per_pcs, w.est_labor_per_pcs, w.est_overhead_per_pcs,
         (SELECT coalesce(sum(cr.cut_pcs), 0) FROM erp.cutting_records cr WHERE cr.work_order_id = w.id)::int AS cut_pcs,
         (SELECT coalesce(sum(bd.qty_packed), 0) FROM erp.bundles bd WHERE bd.work_order_id = w.id)::int AS packed_pcs
  FROM erp.work_orders w
  JOIN erp.skus s ON s.id = w.sku_id
  JOIN erp.boms b ON b.id = w.bom_id
  LEFT JOIN erp.customers c ON c.id = w.customer_id
  LEFT JOIN erp.users cu ON cu.id = w.created_by`;

function woOut(row: any, req: Request) {
  const { est_material_per_pcs, est_labor_per_pcs, est_overhead_per_pcs, ...rest } = row;
  const out: any = { ...rest, progress_pct: row.target_qty ? Math.round((row.packed_pcs / row.target_qty) * 1000) / 10 : 0 };
  // Estimasi HPP hanya untuk Admin/Founder/Finance (FR-SPV-02: Supervisor tidak melihat est_per_pcs)
  if (canSeeCost(req.user) && est_material_per_pcs != null) {
    out.est_per_pcs = {
      material: est_material_per_pcs, labor: est_labor_per_pcs, overhead: est_overhead_per_pcs,
      total: Math.round((est_material_per_pcs + est_labor_per_pcs + est_overhead_per_pcs) * 100) / 100,
    };
  }
  return out;
}

async function woDetail(id: number, req: Request) {
  const row = await queryOne(`${WO_SELECT} WHERE w.id = $1`, [id]);
  const lines = await query(
    `SELECT wl.id, wl.sku_variant_id, v.size, v.color, v.size_order, wl.target_qty,
            coalesce((SELECT sum(crl.qty) FROM erp.cutting_record_lines crl JOIN erp.cutting_records cr ON cr.id = crl.cutting_record_id
                      WHERE cr.work_order_id = wl.work_order_id AND crl.sku_variant_id = wl.sku_variant_id), 0)::int AS cut_qty
     FROM erp.work_order_lines wl JOIN erp.sku_variants v ON v.id = wl.sku_variant_id
     WHERE wl.work_order_id = $1 ORDER BY v.size_order, v.color`, [id]);
  const allocations = await query(
    `SELECT a.id, a.material_id, m.code AS material_code, m.name AS material_name, m.uom, l.id AS lot_id, l.lot_no,
            a.qty_reserved, a.qty_consumed, greatest(a.qty_reserved - a.qty_consumed, 0) AS qty_remaining, a.status, a.created_at, a.closed_at
     FROM erp.material_allocations a JOIN erp.materials m ON m.id = a.material_id JOIN erp.material_lots l ON l.id = a.lot_id
     WHERE a.work_order_id = $1 ORDER BY m.category, m.code, a.id`, [id]);
  return { ...woOut(row, req), lines, allocations };
}

/** Staff hanya melihat SPK Active di stasiunnya. Stasiun Sewing/Bonding → SPK yang routing-nya memuat operasi lini itu. */
async function staffScope(req: Request): Promise<{ sql: string; params: unknown[] } | null> {
  const u = req.user!;
  if (u.role !== 'STAFF') return null;
  if (u.lineId) {
    const line = await queryOne(`SELECT line_type FROM erp.production_lines WHERE id = $1`, [u.lineId]);
    if (line && ['SEWING', 'BONDING'].includes(line.line_type)) {
      return {
        sql: `w.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
                                               WHERE r.sku_id = w.sku_id AND o.line_type = $X::erp.line_type)`,
        params: [line.line_type],
      };
    }
  }
  return { sql: `w.status = 'ACTIVE'`, params: [] };
}

/** Parse baris qty per size × warna. Menerima {sku_variant_id, qty} atau {size, color, qty}. */
async function parseLines(raw: unknown, skuId: number, db: PoolClient) {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest('Isi qty per size & warna (lines) minimal satu baris.', { field: 'lines' });
  const out = new Map<number, number>();
  for (const [i, l] of raw.entries()) {
    const qty = num(l?.qty ?? l?.target_qty, `lines[${i}].qty`, { int: true, gt: 0, max: 1_000_000 });
    let vid: number | null = null;
    if (l?.sku_variant_id != null) {
      const v = (await db.query(`SELECT id FROM erp.sku_variants WHERE id = $1 AND sku_id = $2`, [num(l.sku_variant_id, `lines[${i}].sku_variant_id`, { int: true }), skuId])).rows[0];
      vid = v?.id ?? null;
    } else if (l?.size && l?.color) {
      const v = (await db.query(`SELECT id FROM erp.sku_variants WHERE sku_id = $1 AND upper(size) = upper($2) AND upper(color) = upper($3)`,
        [skuId, String(l.size).trim(), String(l.color).trim()])).rows[0];
      vid = v?.id ?? null;
    }
    if (!vid) throw new AppError(422, 'VARIANT_MISMATCH', `Varian pada baris ${i + 1} tidak sesuai dengan SKU SPK.`, { index: i });
    if (out.has(vid)) throw badRequest(`Varian pada baris ${i + 1} duplikat.`, { index: i });
    out.set(vid, qty);
  }
  return [...out.entries()].map(([sku_variant_id, qty]) => ({ sku_variant_id, qty }));
}

/** Validasi header SPK (tujuan, klien, tanggal). Mengembalikan nilai yang sudah dinormalisasi. */
async function parseHeader(body: any, db: PoolClient, current?: any) {
  if (body.due_date === undefined && body.target_date !== undefined) body.due_date = body.target_date;
  const destination = body.destination !== undefined ? oneOf(String(body.destination).toUpperCase(), DESTINATIONS, 'destination') : current?.destination;
  if (!destination) throw badRequest('Tujuan SPK wajib diisi (B2B / INTERNAL_STOCK / ECOMMERCE).', { field: 'destination' });
  let customerId = current?.customer_id ?? null;
  if (body.customer !== undefined || body.customer_id !== undefined) {
    const ref = body.customer ?? body.customer_id;
    customerId = ref === null || ref === '' ? null : (await resolveCustomer(ref, db)).id;
  }
  if (destination !== 'B2B') customerId = body.customer !== undefined || body.customer_id !== undefined ? customerId : null;
  if (destination === 'B2B' && !customerId) throw new AppError(422, 'CUSTOMER_REQUIRED', 'Tujuan B2B wajib memilih klien.', { field: 'customer' });
  const due = body.due_date !== undefined ? dateParam(body.due_date, 'due_date') : current?.due_date;
  if (!due) throw badRequest('Tanggal target selesai (due_date) wajib diisi.', { field: 'due_date' });
  const today = (await db.query(`SELECT erp.fn_wib_date(now())::text AS d`)).rows[0].d;
  if ((body.due_date !== undefined || !current) && due < today) {
    throw new AppError(422, 'DUE_DATE_PAST', 'Tanggal target tidak boleh sebelum hari ini.', { field: 'due_date' });
  }
  return { destination, customerId, due };
}

/** BOM aktif untuk SKU (opsional versi tertentu yang harus Active). */
async function activeBom(skuId: number, version: unknown, db: PoolClient) {
  const params: unknown[] = [skuId];
  let sql = `SELECT id, version FROM erp.boms WHERE sku_id = $1 AND status = 'ACTIVE'`;
  if (version !== undefined && version !== null && version !== '') {
    params.push(num(version, 'bom_version', { int: true, gt: 0 }));
    sql += ` AND version = $2`;
  }
  const bom = (await db.query(sql, params)).rows[0];
  if (!bom) throw new AppError(422, 'BOM_INACTIVE', 'SKU belum memiliki BOM aktif.');
  const routing = (await db.query(`SELECT 1 FROM erp.sku_routings WHERE sku_id = $1 LIMIT 1`, [skuId])).rows[0];
  if (!routing) throw new AppError(422, 'ROUTING_MISSING', 'SKU belum memiliki routing aktif.');
  return bom;
}

async function insertWo(c: PoolClient, userId: number, body: any) {
  const sku = await resolveSku(body.sku ?? body.sku_id ?? body.sku_code, c);
  if (sku.status !== 'ACTIVE') throw new AppError(422, 'SKU_INACTIVE', `SKU ${sku.code} tidak aktif.`);
  const bom = await activeBom(sku.id, body.bom_version, c);
  const h = await parseHeader(body, c);
  const lines = await parseLines(body.lines, sku.id, c);
  const wo = (await c.query(
    `INSERT INTO erp.work_orders (sku_id, bom_id, due_date, destination, customer_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, wo_no`,
    [sku.id, bom.id, h.due, h.destination, h.customerId, body.notes ? String(body.notes) : null, userId])).rows[0];
  for (const l of lines) {
    await c.query(`INSERT INTO erp.work_order_lines (work_order_id, sku_variant_id, target_qty) VALUES ($1, $2, $3)`, [wo.id, l.sku_variant_id, l.qty]);
  }
  return wo;
}

// GET /work-orders?status=&sku=&from=&to=&q=
workOrdersRouter.get('/work-orders', READ_ROLES, ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, ...vals: unknown[]) => {
    let s = sql;
    for (const v of vals) { params.push(v); s = s.replace('$X', `$${params.length}`); }
    where.push(s);
  };
  if (req.query.status) {
    const list = String(req.query.status).toUpperCase().split(',').map((s) => oneOf(s.trim(), STATUSES, 'status'));
    add(`w.status = ANY($X::erp.wo_status[])`, list);
  }
  if (req.query.sku) {
    const v = String(req.query.sku);
    if (/^\d+$/.test(v)) add(`w.sku_id = $X::bigint`, v); else add(`s.code = upper($X)`, v);
  }
  const from = dateParam(req.query.from, 'from');
  const to = dateParam(req.query.to, 'to');
  if (from) add(`erp.fn_wib_date(w.created_at) >= $X::date`, from);
  if (to) add(`erp.fn_wib_date(w.created_at) <= $X::date`, to);
  if (req.query.q) add(`(w.wo_no ILIKE '%' || $X || '%' OR s.name ILIKE '%' || $X || '%')`, String(req.query.q), String(req.query.q));
  if (req.query.destination) add(`w.destination = $X::erp.wo_destination`, oneOf(String(req.query.destination).toUpperCase(), DESTINATIONS, 'destination'));
  const scope = await staffScope(req);
  if (scope) add(scope.sql, ...scope.params);

  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${WO_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) x
     ORDER BY x.created_at DESC, x.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows.map(({ total, ...r }) => woOut(r, req)), page, limit, total: rows[0]?.total ?? 0 });
}));

// POST /work-orders — buat SPK Draft (Supervisor)
workOrdersRouter.post('/work-orders', allow('SUPERVISOR'), ah(async (req, res) => {
  const body = req.body ?? {};
  const wo = await withTx(req.user!.id, (c) => insertWo(c, req.user!.id, body));
  res.status(201).json(await woDetail(wo.id, req));
}));

// GET /work-orders/{id}
workOrdersRouter.get('/work-orders/:id', READ_ROLES, ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  const scope = await staffScope(req);
  if (scope) {
    const ok = await queryOne(`SELECT 1 FROM erp.work_orders w WHERE w.id = $1 AND ${scope.sql.replace('$X', '$2')}`, [wo.id, ...scope.params]);
    if (!ok) throw new AppError(404, 'WO_NOT_FOUND', `SPK ${wo.wo_no} tidak tersedia di stasiun Anda.`);
  }
  res.json(await woDetail(wo.id, req));
}));

// PUT /work-orders/{id} — Draft: semua field; Active: hanya due_date & notes (qty via revisi)
workOrdersRouter.put('/work-orders/:id', allow('SUPERVISOR'), ah(async (req, res) => {
  const body = req.body ?? {};
  const id = await withTx(req.user!.id, async (c) => {
    const wo = await resolveWo(req.params.id, c, true);
    if (wo.status === 'CLOSED' || wo.status === 'CANCELLED') throw new AppError(422, 'WO_LOCKED', `${wo.wo_no} sudah ${wo.status === 'CLOSED' ? 'ditutup' : 'dibatalkan'} dan tidak dapat diubah.`);
    if (wo.status === 'ACTIVE') {
      const locked = ['sku', 'sku_id', 'bom_version', 'destination', 'customer', 'customer_id', 'lines'].filter((k) => body[k] !== undefined);
      if (locked.length) {
        throw new AppError(422, 'WO_LOCKED', 'Qty SPK yang sudah Active tidak dapat diubah. Tutup dan buat SPK revisi.', { fields: locked });
      }
      const due = body.due_date !== undefined ? dateParam(body.due_date, 'due_date') : null;
      if (due) {
        const today = (await c.query(`SELECT erp.fn_wib_date(now())::text AS d`)).rows[0].d;
        if (due < today) throw new AppError(422, 'DUE_DATE_PAST', 'Tanggal target tidak boleh sebelum hari ini.');
      }
      await c.query(`UPDATE erp.work_orders SET due_date = coalesce($2::date, due_date), notes = CASE WHEN $3::boolean THEN $4 ELSE notes END WHERE id = $1`,
        [wo.id, due, body.notes !== undefined, body.notes ?? null]);
      return wo.id;
    }
    // DRAFT
    let skuId = wo.sku_id;
    let bomId = wo.bom_id;
    if (body.sku !== undefined || body.sku_id !== undefined || body.bom_version !== undefined) {
      skuId = (await resolveSku(body.sku ?? body.sku_id ?? wo.sku_id, c)).id;
      bomId = (await activeBom(skuId, body.bom_version, c)).id;
    }
    const h = await parseHeader(body, c, wo);
    const dueParam = body.due_date !== undefined ? h.due : null;
    if (skuId !== wo.sku_id && body.lines === undefined) {
      throw badRequest('SKU berubah — isi ulang qty per size & warna (lines).', { field: 'lines' });
    }
    if (body.lines !== undefined) await c.query(`DELETE FROM erp.work_order_lines WHERE work_order_id = $1`, [wo.id]);
    await c.query(
      `UPDATE erp.work_orders SET sku_id = $2, bom_id = $3, destination = $4, customer_id = $5, due_date = coalesce($6::date, due_date),
              notes = CASE WHEN $7::boolean THEN $8 ELSE notes END WHERE id = $1`,
      [wo.id, skuId, bomId, h.destination, h.customerId, dueParam, body.notes !== undefined, body.notes ?? null]);
    if (body.lines !== undefined) {
      const lines = await parseLines(body.lines, skuId, c);
      for (const l of lines) {
        await c.query(`INSERT INTO erp.work_order_lines (work_order_id, sku_variant_id, target_qty) VALUES ($1, $2, $3)`, [wo.id, l.sku_variant_id, l.qty]);
      }
    }
    return wo.id;
  });
  res.json(await woDetail(id, req));
}));

// POST /work-orders/{id}/revisions — revisi qty SPK Active tercatat: buat SPK Draft baru (salinan + qty baru),
// opsional menutup/membatalkan SPK lama. Skema tidak punya tabel revisi; jejak disimpan di notes + audit log.
workOrdersRouter.post('/work-orders/:id/revisions', allow('SUPERVISOR'), ah(async (req, res) => {
  const body = req.body ?? {};
  const reason = reasonParam(body.reason, 'Alasan revisi wajib diisi.');
  const result = await withTx(req.user!.id, async (c) => {
    const old = await resolveWo(req.params.id, c, true);
    if (old.status !== 'ACTIVE' && old.status !== 'DRAFT') throw new AppError(422, 'INVALID_STATUS', `${old.wo_no} sudah ditutup; buat SPK baru.`);
    const sku = (await c.query(`SELECT code FROM erp.skus WHERE id = $1`, [old.sku_id])).rows[0];
    const wo = await insertWo(c, req.user!.id, {
      sku: old.sku_id,
      destination: body.destination ?? old.destination,
      customer: body.customer ?? old.customer_id ?? undefined,
      due_date: body.due_date ?? (await c.query(`SELECT greatest($1::date, erp.fn_wib_date(now()))::text AS d`, [old.due_date])).rows[0].d,
      lines: body.lines,
      notes: `Revisi dari ${old.wo_no}: ${reason}${body.notes ? ` — ${body.notes}` : ''}`,
    });
    let oldAction: string | null = null;
    if (body.close_original === true) {
      const hasCut = (await c.query(`SELECT 1 FROM erp.cutting_records WHERE work_order_id = $1 LIMIT 1`, [old.id])).rows[0];
      if (old.status === 'ACTIVE' && hasCut) {
        await c.query(`SELECT erp.fn_close_work_order($1, $2, $3)`, [old.id, req.user!.id, `Direvisi menjadi ${wo.wo_no}: ${reason}`]);
        oldAction = 'CLOSED';
      } else {
        await c.query(`SELECT erp.fn_cancel_work_order($1, $2, $3)`, [old.id, req.user!.id, `Direvisi menjadi ${wo.wo_no}: ${reason}`]);
        oldAction = 'CANCELLED';
      }
    }
    await audit({ userId: req.user!.id, action: 'WO_REVISION', entity: 'work_orders', entityId: old.id,
      note: `${old.wo_no} (${sku?.code}) direvisi menjadi ${wo.wo_no}: ${reason}`, ip: req.ip,
      newValue: { revision_wo_id: wo.id, revision_wo_no: wo.wo_no, original_action: oldAction } }, c);
    return { wo, oldAction, oldNo: old.wo_no };
  });
  res.status(201).json({ original: { wo_no: result.oldNo, action: result.oldAction }, revision: await woDetail(result.wo.id, req) });
}));

/** Daftar kekurangan material bila SPK diaktifkan (untuk 409 INSUFFICIENT_STOCK). */
async function shortages(woId: number) {
  return query(
    `SELECT m.id AS material_id, m.code AS material_code, m.name AS material_name, m.uom,
            r.required_qty, coalesce(av.avail, 0) AS available_qty, round(r.required_qty - coalesce(av.avail, 0), 3) AS shortage_qty
     FROM erp.fn_wo_requirements($1) r
     JOIN erp.materials m ON m.id = r.material_id
     LEFT JOIN LATERAL (SELECT sum(qty_on_hand - qty_reserved) AS avail FROM erp.material_lots
                        WHERE material_id = r.material_id AND qc_status = 'PASS') av ON true
     WHERE coalesce(av.avail, 0) < r.required_qty ORDER BY m.code`, [woId]);
}

// PATCH /work-orders/{id}/activate — fn_activate_work_order (cek stok, reserve FIFO, snapshot HPP)
workOrdersRouter.patch('/work-orders/:id/activate', allow('SUPERVISOR'), ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  let r: any;
  try {
    r = await withTx(req.user!.id, async (c) => (await c.query(`SELECT erp.fn_activate_work_order($1, $2) AS r`, [wo.id, req.user!.id])).rows[0].r);
  } catch (e: any) {
    const b = pgBusiness(e);
    if (b?.code === 'INSUFFICIENT_STOCK') {
      throw conflict(b.message, 'INSUFFICIENT_STOCK', { wo_no: wo.wo_no, status: 'DRAFT', shortages: await shortages(wo.id).catch(() => []) });
    }
    throw e;
  }
  const detail = await woDetail(wo.id, req);
  res.json({ status: 'ACTIVE', wo_no: r.wo_no, allocations_created: r.allocations, ...(canSeeCost(req.user) ? { est_per_pcs: r.est_per_pcs } : {}), work_order: detail });
}));

// GET /work-orders/{id}/requirements — kebutuhan material vs stok tersedia (bantu sebelum aktivasi)
workOrdersRouter.get('/work-orders/:id/requirements', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  const rows = await query(
    `SELECT m.id AS material_id, m.code AS material_code, m.name AS material_name, m.uom, r.required_qty,
            coalesce(av.avail, 0) AS available_qty, greatest(round(r.required_qty - coalesce(av.avail, 0), 3), 0) AS shortage_qty
            ${canSeeCost(req.user) ? ', r.est_cost' : ''}
     FROM erp.fn_wo_requirements($1) r JOIN erp.materials m ON m.id = r.material_id
     LEFT JOIN LATERAL (SELECT sum(qty_on_hand - qty_reserved) AS avail FROM erp.material_lots
                        WHERE material_id = r.material_id AND qc_status = 'PASS') av ON true
     ORDER BY m.category, m.code`, [wo.id]);
  res.json({ wo_no: wo.wo_no, status: wo.status, data: rows, sufficient: rows.every((x) => x.shortage_qty <= 0) });
}));

// PATCH /work-orders/{id}/close — tutup manual (wajib alasan)
workOrdersRouter.patch('/work-orders/:id/close', allow('SUPERVISOR'), ah(async (req, res) => {
  const reason = reasonParam(req.body?.reason, 'Alasan penutupan wajib diisi.');
  const wo = await resolveWo(req.params.id);
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_close_work_order($1, $2, $3)`, [wo.id, req.user!.id, reason]));
  await audit({ userId: req.user!.id, action: 'WO_CLOSE_MANUAL', entity: 'work_orders', entityId: wo.id, note: `${wo.wo_no}: ${reason}`, ip: req.ip });
  res.json(await woDetail(wo.id, req));
}));

// PATCH /work-orders/{id}/cancel — batal (Draft, atau Active tanpa cutting)
workOrdersRouter.patch('/work-orders/:id/cancel', allow('SUPERVISOR'), ah(async (req, res) => {
  const reason = reasonParam(req.body?.reason, 'Alasan pembatalan wajib diisi.');
  const wo = await resolveWo(req.params.id);
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_cancel_work_order($1, $2, $3)`, [wo.id, req.user!.id, reason]));
  await audit({ userId: req.user!.id, action: 'WO_CANCEL', entity: 'work_orders', entityId: wo.id, note: `${wo.wo_no}: ${reason}`, ip: req.ip });
  res.json(await woDetail(wo.id, req));
}));

// GET /work-orders/{id}/progress — progres per tahap: cutting → operasi routing → QC → packing
workOrdersRouter.get('/work-orders/:id/progress', READ_ROLES, ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const cut = await queryOne(
    `SELECT count(*)::int AS records, coalesce(sum(cut_pcs), 0)::int AS cut_pcs, coalesce(sum(spread_kg), 0) AS spread_kg,
            coalesce(sum(scrap_kg), 0) AS scrap_kg FROM erp.cutting_records WHERE work_order_id = $1`, [wo.id]);
  const bundles = await queryOne(
    `SELECT count(*) FILTER (WHERE NOT is_rework)::int AS total,
            count(*) FILTER (WHERE NOT is_rework AND status = 'CREATED')::int AS created,
            count(*) FILTER (WHERE NOT is_rework AND status = 'IN_PROGRESS')::int AS in_progress,
            count(*) FILTER (WHERE NOT is_rework AND status = 'SEWN')::int AS sewn,
            count(*) FILTER (WHERE NOT is_rework AND status = 'INSPECTED')::int AS inspected,
            count(*) FILTER (WHERE status = 'VOID')::int AS void,
            count(*) FILTER (WHERE is_rework AND status NOT IN ('INSPECTED','VOID'))::int AS rework_open,
            coalesce(sum(qty) FILTER (WHERE NOT is_rework AND status <> 'VOID'), 0)::int AS bundled_pcs
     FROM erp.bundles WHERE work_order_id = $1`, [wo.id]);
  const ops = await query(
    `SELECT r.seq, o.id AS operation_id, o.code, o.name, o.line_type,
            coalesce(sum(t.qty) FILTER (WHERE t.completed_at IS NOT NULL AND NOT b.is_rework), 0)::int AS done_pcs,
            coalesce(sum(t.qty) FILTER (WHERE t.completed_at IS NULL AND NOT b.is_rework), 0)::int AS in_progress_pcs,
            count(t.id) FILTER (WHERE t.completed_at IS NOT NULL AND NOT b.is_rework)::int AS done_bundles,
            coalesce(sum(t.qty) FILTER (WHERE t.completed_at IS NOT NULL AND b.is_rework), 0)::int AS rework_done_pcs
     FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
     LEFT JOIN erp.bundles b ON b.work_order_id = $1
     LEFT JOIN erp.wip_tasks t ON t.bundle_id = b.id AND t.operation_id = r.operation_id
     WHERE r.sku_id = $2 GROUP BY r.seq, o.id ORDER BY r.seq`, [wo.id, wo.sku_id]);
  const qc = await queryOne(
    `SELECT count(*)::int AS inspections, coalesce(sum(q.qty_pass), 0)::int AS pass, coalesce(sum(q.qty_rework), 0)::int AS rework,
            coalesce(sum(q.qty_reject), 0)::int AS reject
     FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id WHERE b.work_order_id = $1`, [wo.id]);
  const pack = await queryOne(
    `SELECT coalesce(sum(qty_packed), 0)::int AS packed_pcs,
            (SELECT coalesce(sum(pack_count), 0)::int FROM erp.pack_units WHERE work_order_id = $1 AND status = 'CONFIRMED') AS packs_confirmed
     FROM erp.bundles WHERE work_order_id = $1`, [wo.id]);
  const target = wo.target_qty;
  const basis = cut.cut_pcs || target;
  res.json({
    wo_no: wo.wo_no, status: wo.status, target_qty: target,
    cutting: { ...cut, pct: pct(cut.cut_pcs, target) },
    bundles,
    operations: ops.map((o) => ({ ...o, pct: pct(o.done_pcs, basis) })),
    qc: { ...qc, inspected_pcs: qc.pass + qc.rework + qc.reject, pct: pct(qc.pass + qc.reject, basis) },
    packing: { ...pack, pct: pct(pack.packed_pcs, target) },
    overall_pct: pct(pack.packed_pcs + qc.reject, target),
  });
}));

