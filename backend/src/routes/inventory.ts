// FR-02.1 Penerimaan Bahan Baku · FR-02.2 Automated Material Allocation ·
// FR-02.3 Stock Management (stok, kartu stok, adjustment, opname) · FR-03.3 Scrap/Waste Disposal
import express, { Request } from 'express';
import { PoolClient } from 'pg';
import { audit, query, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, conflict, notFound, num, oneOf, paging, required } from '../lib/http.ts';
import { allow, AuthUser, canSeeCost } from '../lib/auth.ts';

export const inventoryRouter = express.Router();

type Db = PoolClient | null;
const run = async (c: Db, sql: string, params: unknown[] = []) => (c ? (await c.query(sql, params)).rows : await query(sql, params));
const one = async (c: Db, sql: string, params: unknown[] = []) => (await run(c, sql, params))[0] ?? null;

// ---------------------------------------------------------------------
// Hak akses (matriks FRD)
// ---------------------------------------------------------------------
const READ_INV = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: ['GUDANG'] });
const GUDANG_SPV = allow('SUPERVISOR', { staff: ['GUDANG'] });
const SPV = allow('SUPERVISOR');
const READ_SCRAP = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: ['GUDANG', 'CUTTING'] });

// Harga dokumen boleh dilihat penginput (Staff Gudang) & role biaya; avg_cost/nilai persediaan hanya role biaya.
const canSeePrice = (u?: AuthUser) => canSeeCost(u) || (u?.role === 'STAFF' && u.staffFunction === 'GUDANG');

// ---------------------------------------------------------------------
// Resolver: id numerik ATAU nomor dokumen/kode
// ---------------------------------------------------------------------
const isNumId = (v: unknown) => /^\d+$/.test(String(v ?? '').trim());

async function resolveMaterial(c: Db, ref: unknown) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('Material wajib diisi.', { field: 'material' });
  const m = await one(c, `SELECT * FROM erp.materials WHERE ${isNumId(v) ? 'id = $1::bigint' : 'upper(code) = upper($1)'}`, [v]);
  if (!m) throw notFound(`Material ${v} tidak ditemukan.`, 'MATERIAL_NOT_FOUND');
  return m;
}

async function resolveSupplier(c: Db, ref: unknown) {
  const v = String(ref ?? '').trim();
  const s = await one(c, `SELECT * FROM erp.suppliers WHERE ${isNumId(v) ? 'id = $1::bigint' : 'upper(code) = upper($1)'}`, [v]);
  if (!s) throw notFound(`Supplier ${v} tidak ditemukan.`, 'SUPPLIER_NOT_FOUND');
  return s;
}

async function resolveReceipt(c: Db, ref: string, lock = false) {
  const r = await one(c, `SELECT * FROM erp.goods_receipts WHERE ${isNumId(ref) ? 'id = $1::bigint' : 'upper(receipt_no) = upper($1)'}${lock ? ' FOR UPDATE' : ''}`, [ref]);
  if (!r) throw notFound('Penerimaan barang tidak ditemukan.', 'RECEIPT_NOT_FOUND');
  return r;
}

async function resolveWorkOrder(c: Db, ref: string) {
  const w = await one(c, `SELECT * FROM erp.work_orders WHERE ${isNumId(ref) ? 'id = $1::bigint' : 'upper(wo_no) = upper($1)'}`, [ref]);
  if (!w) throw notFound('SPK tidak ditemukan.', 'WO_NOT_FOUND');
  return w;
}

async function resolveAdjustment(c: Db, ref: string, lock = false) {
  const a = await one(c, `SELECT * FROM erp.stock_adjustments WHERE ${isNumId(ref) ? 'id = $1::bigint' : 'upper(adj_no) = upper($1)'}${lock ? ' FOR UPDATE' : ''}`, [ref]);
  if (!a) throw notFound('Adjustment stok tidak ditemukan.', 'ADJUSTMENT_NOT_FOUND');
  return a;
}

async function resolveDisposal(c: Db, ref: string, lock = false) {
  const d = await one(c, `SELECT * FROM erp.scrap_disposals WHERE ${isNumId(ref) ? 'id = $1::bigint' : 'upper(disposal_no) = upper($1)'}${lock ? ' FOR UPDATE' : ''}`, [ref]);
  if (!d) throw notFound('Data pengeluaran limbah tidak ditemukan.', 'DISPOSAL_NOT_FOUND');
  return d;
}

async function resolveVariant(c: Db, ref: string) {
  const v = await one(
    c,
    `SELECT v.*, k.code AS sku_code, k.name AS sku_name FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id
     WHERE ${isNumId(ref) ? 'v.id = $1::bigint' : 'upper(v.barcode) = upper($1)'}`,
    [ref],
  );
  if (!v) throw notFound('Varian SKU tidak ditemukan.', 'VARIANT_NOT_FOUND');
  return v;
}

// Lot material: id lot / lot_no; material non-lot memakai lot 'NO-LOT' (dibuat bila belum ada)
async function resolveLot(c: Db, material: any, lotRef: unknown, createNoLot = false) {
  const v = String(lotRef ?? '').trim();
  if (!v) {
    if (material.is_lot_tracked) throw new AppError(422, 'LOT_REQUIRED', `Lot wajib diisi untuk ${material.name}.`, { field: 'lot' });
    let l = await one(c, `SELECT * FROM erp.material_lots WHERE material_id = $1 AND lot_no = 'NO-LOT'`, [material.id]);
    if (!l && createNoLot && c) {
      l = await one(c, `INSERT INTO erp.material_lots (material_id, lot_no, unit_cost) VALUES ($1, 'NO-LOT', $2) RETURNING *`, [material.id, material.avg_cost]);
    }
    if (!l) throw notFound(`Stok ${material.name} belum pernah tercatat.`, 'LOT_NOT_FOUND');
    return l;
  }
  const l = await one(
    c,
    `SELECT * FROM erp.material_lots WHERE material_id = $1 AND (id::text = $2 OR upper(lot_no) = upper($2))`,
    [material.id, v],
  );
  if (!l) throw notFound(`Lot ${v} untuk ${material.name} tidak ditemukan.`, 'LOT_NOT_FOUND');
  return l;
}

// Filter tanggal (YYYY-MM-DD, zona WIB)
function dateParam(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  return s;
}

const fmtId = (n: number, dec = 2) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const uomLabel = (u: string) => ({ KG: 'Kg', PCS: 'pcs', M: 'm', L: 'L' } as Record<string, string>)[u] ?? u;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function list(res: express.Response, rows: any[], pg: { page: number; limit: number }) {
  const total = rows[0]?.total_count ?? 0;
  res.json({ data: rows.map(({ total_count, ...r }) => r), page: pg.page, limit: pg.limit, total });
}

// =====================================================================
// FR-02.1  GOODS RECEIPT
// =====================================================================
const RECEIPT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Menunggu Approval Supervisor',
  POSTED: 'Diposting',
  CANCELLED: 'Dibatalkan',
};

const tolerancePct = async (c: Db) => Number((await one(c, `SELECT erp.fn_setting_num('receiving_tolerance_pct', 2) AS v`))!.v);

async function receiptDetail(c: Db, id: number, u: AuthUser) {
  const r = await one(
    c,
    `SELECT g.*, s.code AS supplier_code, s.name AS supplier_name, ur.full_name AS received_by_name, ua.full_name AS approved_by_name
     FROM erp.goods_receipts g JOIN erp.suppliers s ON s.id = g.supplier_id
     JOIN erp.users ur ON ur.id = g.received_by LEFT JOIN erp.users ua ON ua.id = g.approved_by
     WHERE g.id = $1`,
    [id],
  );
  if (!r) throw notFound('Penerimaan barang tidak ditemukan.', 'RECEIPT_NOT_FOUND');
  const tol = await tolerancePct(c);
  const items = await run(
    c,
    `SELECT gi.*, m.code AS material_code, m.name AS material_name, m.uom, m.is_lot_tracked,
            l.id AS lot_id, l.qc_status AS lot_qc_status, l.qty_on_hand AS lot_on_hand, l.qty_reserved AS lot_reserved
     FROM erp.goods_receipt_items gi JOIN erp.materials m ON m.id = gi.material_id
     LEFT JOIN erp.material_lots l ON l.receipt_item_id = gi.id
     WHERE gi.receipt_id = $1 ORDER BY gi.id`,
    [id],
  );
  const showPrice = canSeePrice(u);
  return {
    id: r.id,
    receipt_no: r.receipt_no,
    delivery_note: r.delivery_note_no,
    supplier: { id: r.supplier_id, code: r.supplier_code, name: r.supplier_name },
    received_at: r.received_at,
    status: r.status,
    status_label: RECEIPT_STATUS_LABEL[r.status],
    received_by: { id: r.received_by, name: r.received_by_name },
    approved_by: r.approved_by ? { id: r.approved_by, name: r.approved_by_name } : null,
    approved_at: r.approved_at,
    posted_at: r.posted_at,
    notes: r.notes,
    manual_entry: items.some((i: any) => i.is_manual_entry),
    tolerance_pct: tol,
    items: items.map((i: any) => ({
      id: i.id,
      material: { id: i.material_id, code: i.material_code, name: i.material_name, uom: i.uom },
      lot: i.lot_no,
      lot_id: i.lot_id,
      rolls: i.rolls,
      doc_kg: i.doc_qty,
      actual_kg: i.actual_qty,
      variance_kg: round3(i.actual_qty - i.doc_qty),
      variance_pct: i.variance_pct,
      over_tolerance: Math.abs(i.variance_pct) > tol,
      ...(showPrice ? { price_per_kg: i.price_per_uom, amount: Math.round(i.actual_qty * i.price_per_uom * 100) / 100 } : {}),
      qc_status: i.lot_qc_status ?? i.qc_status,
      shrinkage_test_pct: i.shrinkage_test_pct,
      manual_entry: i.is_manual_entry,
      notes: i.notes,
      ...(i.lot_id ? { lot_on_hand: i.lot_on_hand, lot_reserved: i.lot_reserved } : {}),
    })),
  };
}

// POST /goods-receipts — buat penerimaan + posting (fn_post_goods_receipt) dalam satu transaksi
inventoryRouter.post('/goods-receipts', GUDANG_SPV, ah(async (req, res) => {
  const b = req.body ?? {};
  const deliveryNote = String(b.delivery_note ?? b.delivery_note_no ?? '').trim();
  required({ delivery_note: deliveryNote, supplier_id: b.supplier_id ?? b.supplier, items: b.items }, ['delivery_note', 'supplier_id', 'items']);
  if (!Array.isArray(b.items) || b.items.length === 0) throw badRequest('Minimal satu item penerimaan.', { field: 'items' });
  const manualAll = b.manual_entry === true;
  const receivedAt = b.received_at ? new Date(b.received_at) : null;
  if (receivedAt && Number.isNaN(receivedAt.getTime())) throw badRequest('received_at tidak valid.', { field: 'received_at' });
  const u = req.user!;

  const out = await withTx(u.id, async (c) => {
    const sup = await resolveSupplier(c, b.supplier_id ?? b.supplier);
    if (sup.status !== 'ACTIVE') throw new AppError(422, 'SUPPLIER_INACTIVE', `Supplier ${sup.code} tidak aktif.`);

    // Surat jalan + supplier tidak boleh duplikat (cek awal agar status 409; trigger DB tetap menjaga)
    const dup = await one(
      c,
      `SELECT received_at FROM erp.goods_receipts WHERE supplier_id = $1 AND upper(delivery_note_no) = upper($2) AND status <> 'CANCELLED'`,
      [sup.id, deliveryNote],
    );
    if (dup) {
      const d = new Date(dup.received_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      throw conflict(`Surat jalan ${deliveryNote} sudah pernah diterima pada ${d}.`, 'DUPLICATE_DELIVERY_NOTE');
    }

    const tol = await tolerancePct(c);
    const items: any[] = [];
    const seenLots = new Set<string>();
    for (const [idx, it] of (b.items as any[]).entries()) {
      const f = (name: string) => `items[${idx}].${name}`;
      const m = await resolveMaterial(c, it?.material ?? it?.material_id ?? it?.material_code);
      if (m.status !== 'ACTIVE') throw new AppError(422, 'MATERIAL_INACTIVE', `Material ${m.code} tidak aktif.`);
      const docQty = num(it.doc_kg ?? it.doc_qty, f('doc_kg'), { gt: 0 });
      const actQty = num(it.actual_kg ?? it.actual_qty, f('actual_kg'), { gt: 0 });
      const price = num(it.price_per_kg ?? it.price_per_uom ?? it.price, f('price_per_kg'), { min: 0 });
      const rolls = it.rolls === undefined || it.rolls === null || it.rolls === '' ? null : num(it.rolls, f('rolls'), { min: 0, int: true, max: 32767 });
      const qc = it.qc_status ? oneOf(String(it.qc_status).toUpperCase(), ['PASS', 'HOLD', 'REJECT'] as const, f('qc_status')) : 'PASS';
      const shrink = it.shrinkage_test_pct === undefined || it.shrinkage_test_pct === null || it.shrinkage_test_pct === ''
        ? null : num(it.shrinkage_test_pct, f('shrinkage_test_pct'), { min: -100, max: 100 });
      const lot = String(it.lot ?? it.lot_no ?? '').trim();
      if (m.is_lot_tracked) {
        if (!lot) throw new AppError(422, 'LOT_REQUIRED', 'Lot number wajib untuk kain, karet, dan benang.', { field: f('lot') });
        if (lot.toUpperCase() === 'NO-LOT') throw badRequest('Lot number tidak valid.', { field: f('lot') });
        const key = `${m.id}|${lot.toUpperCase()}`;
        if (seenLots.has(key)) throw conflict(`Lot ${lot} tercantum lebih dari sekali.`, 'DUPLICATE_LOT');
        seenLots.add(key);
        const exists = await one(
          c,
          `SELECT 1 FROM erp.material_lots WHERE material_id = $1 AND upper(lot_no) = upper($2)
           UNION ALL
           SELECT 1 FROM erp.goods_receipt_items gi JOIN erp.goods_receipts g ON g.id = gi.receipt_id
           WHERE gi.material_id = $1 AND upper(gi.lot_no) = upper($2) AND g.status IN ('DRAFT','PENDING_APPROVAL')
           LIMIT 1`,
          [m.id, lot],
        );
        if (exists) throw conflict(`Lot ${lot} sudah pernah diterima.`, 'DUPLICATE_LOT');
      }
      const variance = Math.round(((actQty - docQty) / docQty) * 10000) / 100;
      items.push({ m, docQty, actQty, price, rolls, qc, shrink, lot: m.is_lot_tracked ? lot : lot || null,
        manual: manualAll || it.manual_entry === true, notes: it.notes ? String(it.notes) : null, variance });
    }

    // Selisih > toleransi wajib catatan (persetujuan Supervisor diproses fn_post_goods_receipt)
    const over = items.filter((i) => Math.abs(i.variance) > tol);
    if (over.length && !String(b.notes ?? '').trim() && over.some((i) => !i.notes?.trim())) {
      throw new AppError(400, 'NOTE_REQUIRED', `Selisih timbang melebihi toleransi ±${fmtId(tol, 0)}%: catatan wajib diisi.`, {
        items: over.map((i) => ({ material: i.m.code, lot: i.lot, variance_pct: i.variance })),
      });
    }

    const g = await one(
      c,
      `INSERT INTO erp.goods_receipts (delivery_note_no, supplier_id, received_at, received_by, notes)
       VALUES ($1, $2, coalesce($3::timestamptz, now()), $4, $5) RETURNING id, receipt_no`,
      [deliveryNote, sup.id, receivedAt, u.id, b.notes ? String(b.notes) : null],
    );
    for (const i of items) {
      await c.query(
        `INSERT INTO erp.goods_receipt_items (receipt_id, material_id, lot_no, rolls, doc_qty, actual_qty, price_per_uom, qc_status,
                                              shrinkage_test_pct, is_manual_entry, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [g.id, i.m.id, i.lot, i.rolls, i.docQty, i.actQty, i.price, i.qc, i.shrink, i.manual, i.notes],
      );
    }
    const status = (await one(c, `SELECT erp.fn_post_goods_receipt($1, $2) AS s`, [g.id, u.id])).s as string;

    if (items.some((i) => i.manual)) {
      await audit({ userId: u.id, action: 'MANUAL_ENTRY', entity: 'goods_receipts', entityId: g.id, ip: req.ip,
        note: `Manual Entry (timbangan offline) — ${g.receipt_no}, surat jalan ${deliveryNote}` }, c);
    }
    return receiptDetail(c, g.id, u);
  });
  res.status(201).json({
    ...out,
    message: out.status === 'POSTED'
      ? 'Penerimaan diposting. Stok bertambah sesuai berat aktual.'
      : 'Selisih timbang melebihi toleransi. Menunggu approval Supervisor.',
  });
}));

// GET /goods-receipts?status=&supplier=&from=&to=&q=
inventoryRouter.get('/goods-receipts', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED'] as const, 'status') : null;
  const supplier = q.supplier || q.supplier_id ? (await resolveSupplier(null, q.supplier ?? q.supplier_id)).id : null;
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const showPrice = canSeePrice(req.user);
  const rows = await query(
    `SELECT g.id, g.receipt_no, g.delivery_note_no AS delivery_note, g.received_at, g.status, g.posted_at, g.approved_at,
            s.id AS supplier_id, s.code AS supplier_code, s.name AS supplier_name, u.full_name AS received_by_name,
            count(gi.id)::int AS item_count, coalesce(sum(gi.doc_qty), 0) AS total_doc_kg, coalesce(sum(gi.actual_qty), 0) AS total_actual_kg,
            coalesce(sum(gi.actual_qty * gi.price_per_uom), 0) AS total_amount,
            coalesce(max(abs(gi.variance_pct)), 0) AS max_variance_pct, bool_or(gi.is_manual_entry) AS manual_entry,
            count(*) OVER () AS total_count
     FROM erp.goods_receipts g JOIN erp.suppliers s ON s.id = g.supplier_id JOIN erp.users u ON u.id = g.received_by
     LEFT JOIN erp.goods_receipt_items gi ON gi.receipt_id = g.id
     WHERE ($1::erp.receipt_status IS NULL OR g.status = $1) AND ($2::bigint IS NULL OR g.supplier_id = $2)
       AND ($3::date IS NULL OR erp.fn_wib_date(g.received_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(g.received_at) <= $4)
       AND ($5::text IS NULL OR g.receipt_no ILIKE '%' || $5 || '%' OR g.delivery_note_no ILIKE '%' || $5 || '%')
     GROUP BY g.id, s.id, u.full_name
     ORDER BY g.received_at DESC, g.id DESC LIMIT $6 OFFSET $7`,
    [status, supplier, from, to, q.q ? String(q.q) : null, pg.limit, pg.offset],
  );
  list(res, rows.map((r: any) => {
    const { total_amount, ...rest } = r;
    return { ...rest, status_label: RECEIPT_STATUS_LABEL[r.status], ...(showPrice ? { total_amount } : {}) };
  }), pg);
}));

// GET /goods-receipts/{id}
inventoryRouter.get('/goods-receipts/:id', READ_INV, ah(async (req, res) => {
  const r = await resolveReceipt(null, String(req.params.id));
  res.json(await receiptDetail(null, r.id, req.user!));
}));

// PATCH /goods-receipts/{id}/approve — Supervisor, catatan wajib → fn_approve_goods_receipt
inventoryRouter.patch('/goods-receipts/:id/approve', SPV, ah(async (req, res) => {
  const note = String(req.body?.note ?? req.body?.notes ?? '').trim();
  if (!note) throw new AppError(400, 'NOTE_REQUIRED', 'Catatan approval selisih wajib diisi.', { field: 'note' });
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const r = await resolveReceipt(c, String(req.params.id), true);
    if (r.status !== 'PENDING_APPROVAL') throw new AppError(422, 'INVALID_STATUS', 'Penerimaan ini tidak sedang menunggu approval.');
    await c.query(`SELECT erp.fn_approve_goods_receipt($1, $2, $3)`, [r.id, u.id, note]);
    await audit({ userId: u.id, action: 'APPROVE', entity: 'goods_receipts', entityId: r.id, note: `Approval selisih ${r.receipt_no}: ${note}`, ip: req.ip }, c);
    return receiptDetail(c, r.id, u);
  });
  res.json({ ...out, message: 'Selisih disetujui. Stok bertambah sesuai berat aktual.' });
}));

// PATCH /goods-receipts/{id}/cancel — Supervisor membatalkan penerimaan yang belum diposting
inventoryRouter.patch('/goods-receipts/:id/cancel', SPV, ah(async (req, res) => {
  const reason = String(req.body?.reason ?? req.body?.note ?? '').trim();
  if (!reason) throw new AppError(400, 'REASON_REQUIRED', 'Alasan pembatalan wajib diisi.', { field: 'reason' });
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const r = await resolveReceipt(c, String(req.params.id), true);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(r.status)) {
      throw new AppError(422, 'INVALID_STATUS', `Penerimaan ${r.receipt_no} berstatus ${RECEIPT_STATUS_LABEL[r.status]} dan tidak dapat dibatalkan.`);
    }
    await c.query(`UPDATE erp.goods_receipts SET status = 'CANCELLED', notes = concat_ws(' | ', notes, 'Dibatalkan: ' || $2::text) WHERE id = $1`, [r.id, reason]);
    await audit({ userId: u.id, action: 'CANCEL', entity: 'goods_receipts', entityId: r.id, note: reason, ip: req.ip }, c);
    return receiptDetail(c, r.id, u);
  });
  res.json(out);
}));

// PATCH /goods-receipts/{id}/lots/{lotId}/qc — ubah status QC bahan (PASS/HOLD/REJECT)
// lotId = id lot / lot_no (penerimaan POSTED) atau id item / lot_no (penerimaan belum diposting)
inventoryRouter.patch('/goods-receipts/:id/lots/:lotId/qc', GUDANG_SPV, ah(async (req, res) => {
  const qc = oneOf(String(req.body?.qc_status ?? '').toUpperCase(), ['PASS', 'HOLD', 'REJECT'] as const, 'qc_status');
  const note = req.body?.note ? String(req.body.note) : null;
  const shrink = req.body?.shrinkage_test_pct === undefined || req.body?.shrinkage_test_pct === null
    ? null : num(req.body.shrinkage_test_pct, 'shrinkage_test_pct', { min: -100, max: 100 });
  const u = req.user!;
  const lotRef = String(req.params.lotId);
  const out = await withTx(u.id, async (c) => {
    const r = await resolveReceipt(c, String(req.params.id), true);
    if (r.status === 'CANCELLED') throw new AppError(422, 'INVALID_STATUS', 'Penerimaan sudah dibatalkan.');
    const item = await one(
      c,
      `SELECT gi.*, m.name AS material_name, m.is_lot_tracked, m.avg_cost, m.uom, l.id AS lot_id, l.qc_status AS lot_qc,
              l.qty_on_hand, l.qty_reserved, l.unit_cost
       FROM erp.goods_receipt_items gi JOIN erp.materials m ON m.id = gi.material_id
       LEFT JOIN erp.material_lots l ON l.receipt_item_id = gi.id
       WHERE gi.receipt_id = $1 AND (${r.status === 'POSTED' ? 'l.id' : 'gi.id'}::text = $2 OR upper(gi.lot_no) = upper($2))
       FOR UPDATE OF gi`,
      [r.id, lotRef],
    );
    if (!item) throw notFound(`Lot ${lotRef} tidak ada pada penerimaan ${r.receipt_no}.`, 'LOT_NOT_FOUND');
    const old = item.lot_qc ?? item.qc_status;

    if (r.status === 'POSTED') {
      if (!item.lot_id) throw new AppError(422, 'LOT_NOT_TRACKED', `${item.material_name} bukan material ber-lot; status QC tidak dapat diubah per lot.`);
      if (qc !== 'PASS' && item.qty_reserved > 0) {
        throw conflict(`Lot ${item.lot_no} masih di-reserve ${fmtId(item.qty_reserved)} ${uomLabel(item.uom)} untuk SPK. Lepas alokasi terlebih dahulu.`, 'LOT_RESERVED');
      }
      // Harga rata-rata hanya dari stok PASS (sama dengan fn_post_goods_receipt):
      // HOLD/REJECT → PASS menambah kontribusi lot, PASS → HOLD/REJECT mengeluarkannya.
      const dir = old !== 'PASS' && qc === 'PASS' ? 1 : old === 'PASS' && qc !== 'PASS' ? -1 : 0;
      if (dir !== 0 && item.qty_on_hand > 0) {
        await c.query(
          `UPDATE erp.materials m SET avg_cost = CASE WHEN s.pass_qty + $4::numeric * $2::numeric > 0
                 THEN greatest(round((s.pass_qty * m.avg_cost + $4::numeric * $2::numeric * $3::numeric) / (s.pass_qty + $4::numeric * $2::numeric), 2), 0)
                 ELSE m.avg_cost END
           FROM (SELECT coalesce(sum(qty_on_hand), 0) AS pass_qty FROM erp.material_lots WHERE material_id = $1 AND qc_status = 'PASS') s
           WHERE m.id = $1`,
          [item.material_id, item.qty_on_hand, item.unit_cost, dir],
        );
      }
      await c.query(`UPDATE erp.material_lots SET qc_status = $2 WHERE id = $1`, [item.lot_id, qc]);
    }
    await c.query(
      `UPDATE erp.goods_receipt_items SET qc_status = $2, shrinkage_test_pct = coalesce($3, shrinkage_test_pct),
              notes = CASE WHEN $4::text IS NULL THEN notes ELSE concat_ws(' | ', notes, 'QC: ' || $4::text) END
       WHERE id = $1`,
      [item.id, qc, shrink, note],
    );
    await audit({ userId: u.id, action: 'QC_STATUS', entity: item.lot_id ? 'material_lots' : 'goods_receipt_items', entityId: item.lot_id ?? item.id, ip: req.ip,
      oldValue: { qc_status: old }, newValue: { qc_status: qc }, note: `${r.receipt_no} lot ${item.lot_no ?? '-'}: ${old} → ${qc}${note ? ` (${note})` : ''}` }, c);
    return receiptDetail(c, r.id, u);
  });
  res.json(out);
}));

// =====================================================================
// FR-02.3  STOK (bahan baku, packaging, spare part, FG, B-grade, limbah)
// =====================================================================
const CATEGORY_MAP: Record<string, string[]> = {
  raw: ['FABRIC', 'ELASTIC', 'THREAD', 'BONDING_TAPE', 'ACCESSORY'],
  packaging: ['PACKAGING'],
  sparepart: ['SPAREPART'],
  fabric: ['FABRIC'],
  elastic: ['ELASTIC'],
  thread: ['THREAD'],
  bonding_tape: ['BONDING_TAPE'],
  accessory: ['ACCESSORY'],
};

async function scrapSummary() {
  return (await queryOne(
    `SELECT (SELECT coalesce(sum(scrap_kg), 0) FROM erp.cutting_records) AS total_scrap_kg,
            coalesce(sum(qty_kg), 0) AS disposed_kg,
            coalesce(sum(qty_kg) FILTER (WHERE method = 'SOLD'), 0) AS sold_kg,
            coalesce(sum(qty_kg) FILTER (WHERE method = 'DISCARDED'), 0) AS discarded_kg,
            coalesce(sum(total_amount) FILTER (WHERE method = 'SOLD'), 0) AS sales_amount,
            (SELECT coalesce(sum(scrap_kg), 0) FROM erp.cutting_records) - coalesce(sum(qty_kg), 0) AS available_kg
     FROM erp.scrap_disposals`,
  ))!;
}

// GET /stock?category=raw|packaging|sparepart|fg|b-grade|scrap&q=&critical=true
inventoryRouter.get('/stock', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const cat = String(q.category ?? '').toLowerCase().replace('-', '_');
  const search = q.q ? String(q.q) : null;

  if (cat === 'scrap') {
    const s = await scrapSummary();
    return res.json({ data: [{ category: 'scrap', name: 'Limbah perca', uom: 'KG', on_hand: s.available_kg, reserved: 0, available: s.available_kg, min_stock: null, is_critical: false }], page: 1, limit: pg.limit, total: 1, summary: s });
  }

  if (cat === 'fg' || cat === 'b_grade') {
    const grade = cat === 'fg' ? 'A' : 'B';
    const rows = await query(
      `SELECT v.id AS sku_variant_id, k.code AS sku_code, k.name AS sku_name, v.size, v.color, v.barcode, $1::text AS grade,
              coalesce(f.qty_on_hand, 0) AS on_hand, coalesce(f.qty_reserved, 0) AS reserved,
              coalesce(f.qty_on_hand - f.qty_reserved, 0) AS available, 'PCS' AS uom, NULL::numeric AS min_stock, false AS is_critical,
              count(*) OVER () AS total_count
       FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id
       LEFT JOIN erp.fg_stock f ON f.sku_variant_id = v.id AND f.grade = $1::erp.fg_grade
       WHERE (f.sku_variant_id IS NOT NULL OR ($1 = 'A' AND v.status = 'ACTIVE' AND k.status = 'ACTIVE'))
         AND ($2::text IS NULL OR k.code ILIKE '%' || $2 || '%' OR k.name ILIKE '%' || $2 || '%' OR v.barcode = $2)
       ORDER BY k.code, v.size_order, v.size, v.color LIMIT $3 OFFSET $4`,
      [grade, search, pg.limit, pg.offset],
    );
    return list(res, rows.map((r: any) => ({ category: cat === 'fg' ? 'fg' : 'b-grade', ...r })), pg);
  }

  let cats: string[] | null = null;
  if (cat) {
    cats = CATEGORY_MAP[cat] ?? null;
    if (!cats) throw badRequest('category harus salah satu dari: raw, packaging, sparepart, fg, b-grade, scrap.', { field: 'category' });
  }
  const critical = q.critical === 'true' || q.critical === '1';
  const showCost = canSeeCost(req.user);
  const rows = await query(
    `WITH s AS (
       SELECT m.id, m.code, m.name, m.category, m.uom, m.min_stock, m.avg_cost, m.is_lot_tracked, m.status,
              coalesce(sum(l.qty_on_hand) FILTER (WHERE l.qc_status = 'PASS'), 0) AS on_hand,
              coalesce(sum(l.qty_on_hand) FILTER (WHERE l.qc_status = 'HOLD'), 0) AS hold_qty,
              coalesce(sum(l.qty_on_hand) FILTER (WHERE l.qc_status = 'REJECT'), 0) AS reject_qty,
              coalesce(sum(l.qty_reserved), 0) AS reserved,
              count(l.id) FILTER (WHERE l.qty_on_hand > 0)::int AS lot_count
       FROM erp.materials m LEFT JOIN erp.material_lots l ON l.material_id = m.id
       WHERE ($1::text[] IS NULL OR m.category::text = ANY ($1))
         AND ($2::text IS NULL OR m.code ILIKE '%' || $2 || '%' OR m.name ILIKE '%' || $2 || '%')
       GROUP BY m.id
     )
     SELECT *, on_hand - reserved AS available, (min_stock > 0 AND on_hand - reserved < min_stock) AS is_critical,
            count(*) OVER () AS total_count
     FROM s WHERE NOT $3::boolean OR (min_stock > 0 AND on_hand - reserved < min_stock)
     ORDER BY category, code LIMIT $4 OFFSET $5`,
    [cats, search, critical, pg.limit, pg.offset],
  );
  list(res, rows.map((r: any) => {
    const { avg_cost, ...rest } = r;
    return { ...rest, physical_qty: round3(r.on_hand + r.hold_qty + r.reject_qty),
      ...(showCost ? { avg_cost, stock_value: Math.round(r.on_hand * avg_cost * 100) / 100 } : {}) };
  }), pg);
}));

// ---------------------------------------------------------------------
// FR-02.3  Adjustment & Stock Opname
// ---------------------------------------------------------------------
async function adjustmentDetail(c: Db, id: number, u: AuthUser) {
  const a = await one(
    c,
    `SELECT a.*, ur.full_name AS requested_by_name, ua.full_name AS approved_by_name
     FROM erp.stock_adjustments a JOIN erp.users ur ON ur.id = a.requested_by LEFT JOIN erp.users ua ON ua.id = a.approved_by
     WHERE a.id = $1`,
    [id],
  );
  const items = await run(
    c,
    `SELECT i.id, i.lot_id, l.lot_no, m.id AS material_id, m.code AS material_code, m.name AS material_name, m.uom, m.avg_cost,
            i.system_qty, i.counted_qty, i.diff_qty, l.qty_on_hand AS current_qty, l.qty_reserved AS current_reserved
     FROM erp.stock_adjustment_items i JOIN erp.material_lots l ON l.id = i.lot_id JOIN erp.materials m ON m.id = l.material_id
     WHERE i.adjustment_id = $1 ORDER BY i.id`,
    [id],
  );
  const showCost = canSeeCost(u);
  const STATUS_LABEL: Record<string, string> = { PENDING: 'Menunggu Approval Supervisor', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
  return {
    id: a.id,
    adj_no: a.adj_no,
    type: a.is_opname ? 'OPNAME' : 'ADJUSTMENT',
    reason: a.reason,
    status: a.status,
    status_label: STATUS_LABEL[a.status],
    requested_by: { id: a.requested_by, name: a.requested_by_name },
    approved_by: a.approved_by ? { id: a.approved_by, name: a.approved_by_name } : null,
    approved_at: a.approved_at,
    created_at: a.created_at,
    items: items.map(({ avg_cost, ...i }: any) => ({ ...i, ...(showCost ? { diff_value: Math.round(i.diff_qty * avg_cost * 100) / 100 } : {}) })),
  };
}

// Buat adjustment PENDING. mode 'adjust': item.qty (+/−) atau counted_qty; mode 'opname': counted_qty wajib
async function createAdjustment(req: Request, mode: 'adjust' | 'opname') {
  const b = req.body ?? {};
  const u = req.user!;
  let reason = String(b.reason ?? '').trim();
  if (mode === 'adjust' && !reason) throw new AppError(400, 'REASON_REQUIRED', 'Alasan adjustment wajib diisi.', { field: 'reason' });
  if (!Array.isArray(b.items) || b.items.length === 0) throw badRequest('Minimal satu item.', { field: 'items' });

  return withTx(u.id, async (c) => {
    const lines: any[] = [];
    const seen = new Set<number>();
    for (const [idx, it] of (b.items as any[]).entries()) {
      const f = (n: string) => `items[${idx}].${n}`;
      let lot: any;
      let m: any;
      if (it?.lot_id !== undefined && (it.material === undefined && it.material_id === undefined)) {
        lot = await one(c, `SELECT * FROM erp.material_lots WHERE id = $1::bigint`, [num(it.lot_id, f('lot_id'), { int: true })]);
        if (!lot) throw notFound(`Lot ${it.lot_id} tidak ditemukan.`, 'LOT_NOT_FOUND');
        m = await resolveMaterial(c, lot.material_id);
      } else {
        m = await resolveMaterial(c, it?.material ?? it?.material_id);
        lot = await resolveLot(c, m, it.lot ?? it.lot_no ?? it.lot_id, true);
      }
      lot = (await c.query(`SELECT * FROM erp.material_lots WHERE id = $1 FOR UPDATE`, [lot.id])).rows[0];
      if (seen.has(lot.id)) throw badRequest(`Lot ${lot.lot_no} (${m.code}) tercantum lebih dari sekali.`, { field: f('lot') });
      seen.add(lot.id);
      let counted: number;
      if (mode === 'opname' || it.counted_qty !== undefined) {
        counted = num(it.counted_qty ?? it.physical_qty, f('counted_qty'));
      } else {
        const d = num(it.qty ?? it.diff_qty, f('qty'));
        if (d === 0) throw badRequest('Qty adjustment tidak boleh 0.', { field: f('qty') });
        counted = round3(lot.qty_on_hand + d);
      }
      // FR-02.3: stok tidak boleh negatif, dan tidak boleh di bawah qty yang sudah di-reserve SPK
      if (counted < 0) throw conflict(`Stok ${m.name} tidak mencukupi.`, 'INSUFFICIENT_STOCK', { material: m.code, lot: lot.lot_no, on_hand: lot.qty_on_hand });
      if (counted < lot.qty_reserved) {
        throw conflict(`Stok ${m.name} tidak mencukupi: lot ${lot.lot_no} masih di-reserve ${fmtId(lot.qty_reserved)} ${uomLabel(m.uom)} untuk SPK.`,
          'INSUFFICIENT_STOCK', { material: m.code, lot: lot.lot_no, reserved: lot.qty_reserved });
      }
      lines.push({ lot, m, system: lot.qty_on_hand, counted });
    }
    const diffs = lines.filter((l) => round3(l.counted - l.system) !== 0);
    if (mode === 'adjust' && diffs.length === 0) throw badRequest('Tidak ada selisih stok untuk di-adjust.', {}, 'NO_DIFFERENCE');
    if (mode === 'opname' && diffs.length === 0) return { status: 'NO_DIFFERENCE', message: 'Hasil hitung fisik sama dengan stok sistem. Tidak ada adjustment.', items: lines.length };
    if (mode === 'opname') reason = `Stock opname${reason ? `: ${reason}` : ''}`;

    const a = await one(
      c,
      `INSERT INTO erp.stock_adjustments (adj_no, reason, is_opname, requested_by) VALUES (erp.fn_next_doc_no($1), $2, $3, $4) RETURNING id`,
      [mode === 'opname' ? 'OPN' : 'ADJ', reason, mode === 'opname', u.id],
    );
    for (const l of mode === 'opname' ? diffs : lines) {
      await c.query(`INSERT INTO erp.stock_adjustment_items (adjustment_id, lot_id, system_qty, counted_qty) VALUES ($1, $2, $3, $4)`,
        [a.id, l.lot.id, l.system, l.counted]);
    }
    return adjustmentDetail(c, a.id, u);
  });
}

// POST /stock/adjustments — Staff Gudang/Supervisor, alasan wajib, status PENDING
inventoryRouter.post('/stock/adjustments', GUDANG_SPV, ah(async (req, res) => {
  res.status(201).json(await createAdjustment(req, 'adjust'));
}));

// POST /stock/opname — hitung fisik per item/lot → adjustment selisih otomatis (PENDING)
inventoryRouter.post('/stock/opname', GUDANG_SPV, ah(async (req, res) => {
  const out: any = await createAdjustment(req, 'opname');
  res.status(out.status === 'NO_DIFFERENCE' ? 200 : 201).json(out);
}));

// GET /stock/adjustments?status=&type=opname|adjustment&from=&to=
inventoryRouter.get('/stock/adjustments', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['PENDING', 'APPROVED', 'REJECTED'] as const, 'status') : null;
  const type = q.type ? oneOf(String(q.type).toLowerCase(), ['opname', 'adjustment'] as const, 'type') : null;
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const showCost = canSeeCost(req.user);
  const rows = await query(
    `SELECT a.id, a.adj_no, CASE WHEN a.is_opname THEN 'OPNAME' ELSE 'ADJUSTMENT' END AS type, a.reason, a.status, a.created_at,
            a.approved_at, ur.full_name AS requested_by_name, ua.full_name AS approved_by_name,
            count(i.id)::int AS item_count, coalesce(sum(i.diff_qty), 0) AS total_diff_qty,
            coalesce(sum(i.diff_qty * m.avg_cost), 0) AS total_diff_value, count(*) OVER () AS total_count
     FROM erp.stock_adjustments a JOIN erp.users ur ON ur.id = a.requested_by LEFT JOIN erp.users ua ON ua.id = a.approved_by
     LEFT JOIN erp.stock_adjustment_items i ON i.adjustment_id = a.id
     LEFT JOIN erp.material_lots l ON l.id = i.lot_id LEFT JOIN erp.materials m ON m.id = l.material_id
     WHERE ($1::erp.approval_status IS NULL OR a.status = $1) AND ($2::boolean IS NULL OR a.is_opname = $2)
       AND ($3::date IS NULL OR erp.fn_wib_date(a.created_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(a.created_at) <= $4)
     GROUP BY a.id, ur.full_name, ua.full_name
     ORDER BY a.created_at DESC, a.id DESC LIMIT $5 OFFSET $6`,
    [status, type === null ? null : type === 'opname', from, to, pg.limit, pg.offset],
  );
  list(res, rows.map(({ total_diff_value, ...r }: any) => ({ ...r, ...(showCost ? { total_diff_value: Math.round(total_diff_value * 100) / 100 } : {}) })), pg);
}));

// GET /stock/adjustments/{id}
inventoryRouter.get('/stock/adjustments/:id', READ_INV, ah(async (req, res) => {
  const a = await resolveAdjustment(null, String(req.params.id));
  res.json(await adjustmentDetail(null, a.id, req.user!));
}));

// PATCH|POST /stock/adjustments/{id}/approve — Supervisor → fn_approve_stock_adjustment (mutasi ADJUSTMENT)
const approveAdjustment = ah(async (req, res) => {
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const a = await resolveAdjustment(c, String(req.params.id), true);
    if (a.status !== 'PENDING') throw new AppError(422, 'INVALID_STATUS', 'Adjustment sudah diproses.');
    // Cek ulang terhadap saldo terkini: tidak negatif & tidak di bawah reserve
    const bad = await run(
      c,
      `SELECT m.name, l.lot_no, l.qty_on_hand, l.qty_reserved, i.diff_qty, m.uom
       FROM erp.stock_adjustment_items i JOIN erp.material_lots l ON l.id = i.lot_id JOIN erp.materials m ON m.id = l.material_id
       WHERE i.adjustment_id = $1 AND i.diff_qty <> 0 AND l.qty_on_hand + i.diff_qty < greatest(l.qty_reserved, 0)
       FOR UPDATE OF l`,
      [a.id],
    );
    if (bad.length) {
      throw conflict(`Stok ${bad[0].name} tidak mencukupi.`, 'INSUFFICIENT_STOCK', {
        items: bad.map((b: any) => ({ material: b.name, lot: b.lot_no, on_hand: b.qty_on_hand, reserved: b.qty_reserved, diff_qty: b.diff_qty })),
      });
    }
    await c.query(`SELECT erp.fn_approve_stock_adjustment($1, $2)`, [a.id, u.id]);
    return adjustmentDetail(c, a.id, u);
  });
  res.json({ ...out, message: 'Adjustment disetujui. Mutasi ADJUSTMENT tercatat di kartu stok.' });
});
inventoryRouter.patch('/stock/adjustments/:id/approve', SPV, approveAdjustment);
inventoryRouter.post('/stock/adjustments/:id/approve', SPV, approveAdjustment);

// PATCH|POST /stock/adjustments/{id}/reject — Supervisor, alasan wajib
const rejectAdjustment = ah(async (req, res) => {
  const note = String(req.body?.reason ?? req.body?.note ?? '').trim();
  if (!note) throw new AppError(400, 'REASON_REQUIRED', 'Alasan penolakan wajib diisi.', { field: 'reason' });
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const a = await resolveAdjustment(c, String(req.params.id), true);
    if (a.status !== 'PENDING') throw new AppError(422, 'INVALID_STATUS', 'Adjustment sudah diproses.');
    await c.query(`UPDATE erp.stock_adjustments SET status = 'REJECTED', approved_by = $2, approved_at = now() WHERE id = $1`, [a.id, u.id]);
    await audit({ userId: u.id, action: 'REJECT', entity: 'stock_adjustments', entityId: a.id, note: `${a.adj_no} ditolak: ${note}`, ip: req.ip }, c);
    return adjustmentDetail(c, a.id, u);
  });
  res.json({ ...out, reject_reason: note });
});
inventoryRouter.patch('/stock/adjustments/:id/reject', SPV, rejectAdjustment);
inventoryRouter.post('/stock/adjustments/:id/reject', SPV, rejectAdjustment);

// ---------------------------------------------------------------------
// Kartu stok
// ---------------------------------------------------------------------
const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: 'Penerimaan', ISSUE_CUTTING: 'Pemakaian cutting', ISSUE_ACCESSORY: 'Pemakaian aksesoris', ISSUE_SAMPLE: 'Pemakaian sample',
  ISSUE_PACKING: 'Pemakaian packing', ISSUE_MAINTENANCE: 'Pemakaian maintenance', ADJUSTMENT: 'Adjustment', RETURN_TO_SUPPLIER: 'Retur ke supplier',
  PACKING_IN: 'Masuk dari packing', RETURN_IN: 'Retur pelanggan', DISPATCH_B2B: 'Kirim B2B', DISPATCH_ECOM: 'Kirim e-commerce',
};

// GET /stock/fg/{variant}/card?grade=A|B&from=&to= — kartu stok FG (fg_movements)
inventoryRouter.get('/stock/fg/:variant/card', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const v = await resolveVariant(null, String(req.params.variant));
  const grade = q.grade ? oneOf(String(q.grade).toUpperCase(), ['A', 'B'] as const, 'grade') : null;
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const rows = await query(
    `WITH mv AS (
       SELECT f.*, sum(f.qty) OVER (PARTITION BY f.grade ORDER BY f.moved_at, f.id) AS balance
       FROM erp.fg_movements f WHERE f.sku_variant_id = $1 AND ($2::erp.fg_grade IS NULL OR f.grade = $2)
     )
     SELECT mv.id, mv.moved_at, mv.movement_type, mv.grade, greatest(mv.qty, 0) AS qty_in, greatest(-mv.qty, 0) AS qty_out, mv.qty,
            mv.balance, mv.ref_table, mv.ref_id, w.wo_no, u.full_name AS user_name, mv.reason, count(*) OVER () AS total_count
     FROM mv LEFT JOIN erp.work_orders w ON w.id = mv.work_order_id LEFT JOIN erp.users u ON u.id = mv.user_id
     WHERE ($3::date IS NULL OR erp.fn_wib_date(mv.moved_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(mv.moved_at) <= $4)
     ORDER BY mv.moved_at DESC, mv.id DESC LIMIT $5 OFFSET $6`,
    [v.id, grade, from, to, pg.limit, pg.offset],
  );
  const stock = await query(`SELECT grade, qty_on_hand AS on_hand, qty_reserved AS reserved, qty_on_hand - qty_reserved AS available FROM erp.fg_stock WHERE sku_variant_id = $1 ORDER BY grade`, [v.id]);
  const total = rows[0]?.total_count ?? 0;
  res.json({
    variant: { id: v.id, sku_code: v.sku_code, sku_name: v.sku_name, size: v.size, color: v.color, barcode: v.barcode },
    stock,
    data: rows.map(({ total_count, ...r }: any) => ({ ...r, movement_label: MOVEMENT_LABEL[r.movement_type] ?? r.movement_type })),
    page: pg.page, limit: pg.limit, total,
  });
}));

// GET /stock/{material}/lots?include_empty=true — stok per lot (FIFO)
inventoryRouter.get('/stock/:material/lots', READ_INV, ah(async (req, res) => {
  const m = await resolveMaterial(null, req.params.material);
  const includeEmpty = req.query.include_empty === 'true' || req.query.include_empty === '1';
  const showCost = canSeeCost(req.user);
  const rows = await query(
    `SELECT l.id, l.lot_no, l.qc_status, l.qty_on_hand AS on_hand, l.qty_reserved AS reserved,
            CASE WHEN l.qc_status = 'PASS' THEN l.qty_on_hand - l.qty_reserved ELSE 0 END AS available,
            l.received_at, (erp.fn_wib_date(now()) - erp.fn_wib_date(l.received_at))::int AS age_days, l.unit_cost,
            s.code AS supplier_code, s.name AS supplier_name, g.id AS receipt_id, g.receipt_no
     FROM erp.material_lots l LEFT JOIN erp.suppliers s ON s.id = l.supplier_id
     LEFT JOIN erp.goods_receipt_items gi ON gi.id = l.receipt_item_id LEFT JOIN erp.goods_receipts g ON g.id = gi.receipt_id
     WHERE l.material_id = $1 AND ($2::boolean OR l.qty_on_hand > 0)
     ORDER BY l.received_at, l.id`,
    [m.id, includeEmpty],
  );
  const data = rows.map(({ unit_cost, ...r }: any) => ({ ...r, ...(showCost ? { unit_cost } : {}) }));
  const sum = (k: string) => round3(data.reduce((a: number, r: any) => a + (k === 'on_hand' ? (r.qc_status === 'PASS' ? r.on_hand : 0) : r[k]), 0));
  res.json({
    material: { id: m.id, code: m.code, name: m.name, category: m.category, uom: m.uom, min_stock: m.min_stock, ...(showCost ? { avg_cost: m.avg_cost } : {}) },
    summary: { on_hand: sum('on_hand'), reserved: sum('reserved'), available: sum('available') },
    data,
  });
}));

// GET /stock/{material}/card?lot=&from=&to=&page= — kartu stok (mutasi + saldo berjalan)
inventoryRouter.get('/stock/:material/card', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const m = await resolveMaterial(null, req.params.material);
  const lot = q.lot ? await resolveLot(null, m, q.lot) : null;
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const showCost = canSeeCost(req.user);
  const rows = await query(
    `WITH mv AS (
       SELECT sm.*, sum(sm.qty) OVER (ORDER BY sm.moved_at, sm.id) AS balance
       FROM erp.stock_movements sm WHERE sm.material_id = $1 AND ($2::bigint IS NULL OR sm.lot_id = $2)
     )
     SELECT mv.id, mv.moved_at, mv.movement_type, l.lot_no, greatest(mv.qty, 0) AS qty_in, greatest(-mv.qty, 0) AS qty_out, mv.qty,
            mv.balance, mv.unit_cost, mv.ref_table, mv.ref_id,
            coalesce(g.receipt_no, a.adj_no, w.wo_no) AS ref_no, w.wo_no, u.full_name AS user_name, mv.reason,
            count(*) OVER () AS total_count
     FROM mv JOIN erp.material_lots l ON l.id = mv.lot_id
     LEFT JOIN erp.goods_receipt_items gi ON mv.ref_table = 'goods_receipt_items' AND gi.id = mv.ref_id
     LEFT JOIN erp.goods_receipts g ON g.id = gi.receipt_id
     LEFT JOIN erp.stock_adjustments a ON mv.ref_table = 'stock_adjustments' AND a.id = mv.ref_id
     LEFT JOIN erp.work_orders w ON w.id = mv.work_order_id
     LEFT JOIN erp.users u ON u.id = mv.user_id
     WHERE ($3::date IS NULL OR erp.fn_wib_date(mv.moved_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(mv.moved_at) <= $4)
     ORDER BY mv.moved_at DESC, mv.id DESC LIMIT $5 OFFSET $6`,
    [m.id, lot?.id ?? null, from, to, pg.limit, pg.offset],
  );
  res.json({
    material: { id: m.id, code: m.code, name: m.name, category: m.category, uom: m.uom },
    lot: lot ? { id: lot.id, lot_no: lot.lot_no } : null,
    data: rows.map(({ total_count, unit_cost, ...r }: any) => ({ ...r, movement_label: MOVEMENT_LABEL[r.movement_type] ?? r.movement_type,
      ...(showCost ? { unit_cost } : {}) })),
    page: pg.page, limit: pg.limit, total: rows[0]?.total_count ?? 0,
  });
}));

// =====================================================================
// FR-02.2  MATERIAL ALLOCATION
// =====================================================================
// GET /allocations?wo=&status=&material=
inventoryRouter.get('/allocations', READ_INV, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const wo = q.wo ? (await resolveWorkOrder(null, String(q.wo))).id : null;
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['RESERVED', 'CONSUMED', 'RELEASED'] as const, 'status') : null;
  const mat = q.material ? (await resolveMaterial(null, q.material)).id : null;
  const rows = await query(
    `SELECT a.id, a.work_order_id, w.wo_no, w.status AS wo_status, a.material_id, m.code AS material_code, m.name AS material_name, m.uom,
            a.lot_id, l.lot_no, a.qty_reserved, a.qty_consumed,
            CASE WHEN a.status = 'RESERVED' THEN greatest(a.qty_reserved - a.qty_consumed, 0) ELSE 0 END AS qty_remaining,
            a.status, a.created_at, a.closed_at, count(*) OVER () AS total_count
     FROM erp.material_allocations a JOIN erp.work_orders w ON w.id = a.work_order_id
     JOIN erp.materials m ON m.id = a.material_id JOIN erp.material_lots l ON l.id = a.lot_id
     WHERE ($1::bigint IS NULL OR a.work_order_id = $1) AND ($2::erp.allocation_status IS NULL OR a.status = $2)
       AND ($3::bigint IS NULL OR a.material_id = $3)
     ORDER BY a.created_at DESC, w.wo_no, m.code, l.received_at, a.id LIMIT $4 OFFSET $5`,
    [wo, status, mat, pg.limit, pg.offset],
  );
  list(res, rows, pg);
}));

// Kebutuhan vs ketersediaan per material untuk satu SPK (outstanding = kebutuhan − sudah dialokasikan/terpakai)
async function allocationPlan(c: Db, woId: number) {
  return run(
    c,
    `SELECT r.material_id, m.code, m.name, m.uom, r.required_qty,
            coalesce(al.covered, 0) AS allocated_qty,
            greatest(r.required_qty - coalesce(al.covered, 0), 0) AS outstanding_qty,
            coalesce(av.available, 0) AS available_qty
     FROM erp.fn_wo_requirements($1) r JOIN erp.materials m ON m.id = r.material_id
     LEFT JOIN (SELECT material_id, sum(CASE WHEN status = 'RESERVED' THEN qty_reserved ELSE qty_consumed END) AS covered
                FROM erp.material_allocations WHERE work_order_id = $1 GROUP BY material_id) al ON al.material_id = r.material_id
     LEFT JOIN (SELECT material_id, sum(qty_on_hand - qty_reserved) AS available
                FROM erp.material_lots WHERE qc_status = 'PASS' GROUP BY material_id) av ON av.material_id = r.material_id
     ORDER BY m.code`,
    [woId],
  );
}

function shortageError(short: any[]) {
  const text = short.map((s) => `${s.name} ${fmtId(s.shortage)} ${uomLabel(s.uom)}`).join('; ');
  return conflict(`SPK tetap Draft. Kekurangan: ${text}`, 'INSUFFICIENT_STOCK', {
    shortages: short.map((s) => ({ material: s.code, name: s.name, uom: s.uom, required: s.outstanding_qty, available: s.available_qty,
      shortage: s.shortage, message: `Kekurangan: ${s.name} ${fmtId(s.shortage)} ${uomLabel(s.uom)}` })),
  });
}

// POST /work-orders/{id}/allocate — SPK Draft: cek stok lalu reserve FIFO + aktivasi (fn_activate_work_order).
// SPK Active: reserve ulang kekurangan alokasi (mis. setelah release manual). Body { dry_run: true } = hanya cek.
inventoryRouter.post('/work-orders/:id/allocate', SPV, ah(async (req, res) => {
  const u = req.user!;
  const dryRun = req.body?.dry_run === true || req.query.dry_run === 'true';
  const out = await withTx(u.id, async (c) => {
    const w0 = await resolveWorkOrder(c, String(req.params.id));
    const w = (await c.query(`SELECT * FROM erp.work_orders WHERE id = $1 FOR UPDATE`, [w0.id])).rows[0];
    if (!['DRAFT', 'ACTIVE'].includes(w.status)) {
      throw new AppError(422, 'INVALID_STATUS', `${w.wo_no} berstatus ${w.status}; alokasi hanya untuk SPK Draft/Active.`);
    }
    if (w.target_qty <= 0) throw new AppError(422, 'EMPTY', 'Qty SPK harus lebih dari 0.');
    const plan = await allocationPlan(c, w.id);
    const short = plan.map((p: any) => ({ ...p, shortage: round3(p.outstanding_qty - p.available_qty) })).filter((p: any) => p.shortage > 0);
    const planOut = plan.map((p: any) => ({ material: p.code, name: p.name, uom: p.uom, required_qty: p.required_qty,
      allocated_qty: p.allocated_qty, outstanding_qty: p.outstanding_qty, available_qty: p.available_qty }));
    if (dryRun) return { wo_no: w.wo_no, status: w.status, dry_run: true, sufficient: short.length === 0, requirements: planOut,
      shortages: short.map((s: any) => `Kekurangan: ${s.name} ${fmtId(s.shortage)} ${uomLabel(s.uom)}`) };
    if (short.length) throw shortageError(short);

    if (w.status === 'DRAFT') {
      const r = (await one(c, `SELECT erp.fn_activate_work_order($1, $2) AS r`, [w.id, u.id])).r;
      return { wo_no: w.wo_no, status: 'ACTIVE', allocations_created: r.allocations, requirements: planOut };
    }

    // ACTIVE: reserve FIFO untuk sisa kebutuhan (logika sama dengan fn_activate_work_order)
    let created = 0;
    for (const p of plan.filter((x: any) => x.outstanding_qty > 0)) {
      let need = Number(p.outstanding_qty);
      const lots = await run(
        c,
        `SELECT id, qty_on_hand - qty_reserved AS free FROM erp.material_lots
         WHERE material_id = $1 AND qc_status = 'PASS' AND qty_on_hand - qty_reserved > 0 ORDER BY received_at, id FOR UPDATE`,
        [p.material_id],
      );
      for (const l of lots) {
        if (need <= 0) break;
        const take = round3(Math.min(need, l.free));
        await c.query(
          `INSERT INTO erp.material_allocations (work_order_id, lot_id, material_id, qty_reserved) VALUES ($1, $2, $3, $4)
           ON CONFLICT (work_order_id, lot_id) DO UPDATE SET
             qty_reserved = CASE WHEN erp.material_allocations.status = 'RESERVED' THEN erp.material_allocations.qty_reserved + EXCLUDED.qty_reserved
                                 ELSE erp.material_allocations.qty_consumed + EXCLUDED.qty_reserved END,
             status = 'RESERVED', closed_at = NULL`,
          [w.id, l.id, p.material_id, take],
        );
        need = round3(need - take);
        created++;
      }
    }
    if (created) await audit({ userId: u.id, action: 'ALLOCATE', entity: 'work_orders', entityId: w.id, note: `Reserve ulang ${w.wo_no}: ${created} lot`, ip: req.ip }, c);
    return { wo_no: w.wo_no, status: w.status, allocations_created: created, requirements: planOut };
  });
  res.status(dryRun || !(out as any).allocations_created ? 200 : 201).json(out);
}));

// POST /allocations/{id}/release — Supervisor melepas sisa reserve secara manual
inventoryRouter.post('/allocations/:id/release', SPV, ah(async (req, res) => {
  const u = req.user!;
  const reason = String(req.body?.reason ?? req.body?.note ?? '').trim();
  if (!reason) throw new AppError(400, 'REASON_REQUIRED', 'Alasan release alokasi wajib diisi.', { field: 'reason' });
  if (!isNumId(req.params.id)) throw badRequest('id tidak valid.', { field: 'id' });
  const out = await withTx(u.id, async (c) => {
    const a = await one(
      c,
      `SELECT a.*, w.wo_no, l.lot_no, m.name AS material_name, m.uom FROM erp.material_allocations a
       JOIN erp.work_orders w ON w.id = a.work_order_id JOIN erp.material_lots l ON l.id = a.lot_id JOIN erp.materials m ON m.id = a.material_id
       WHERE a.id = $1 FOR UPDATE OF a`,
      [req.params.id],
    );
    if (!a) throw notFound('Alokasi tidak ditemukan.', 'ALLOCATION_NOT_FOUND');
    if (a.status !== 'RESERVED') throw new AppError(422, 'INVALID_STATUS', `Alokasi sudah berstatus ${a.status}.`);
    const released = round3(Math.max(a.qty_reserved - a.qty_consumed, 0));
    const r = await one(
      c,
      `UPDATE erp.material_allocations SET status = CASE WHEN qty_consumed > 0 THEN 'CONSUMED'::erp.allocation_status ELSE 'RELEASED'::erp.allocation_status END,
              closed_at = now() WHERE id = $1 RETURNING id, status, qty_reserved, qty_consumed, closed_at`,
      [a.id],
    );
    await audit({ userId: u.id, action: 'RELEASE', entity: 'material_allocations', entityId: a.id, ip: req.ip,
      note: `Release manual ${a.wo_no} lot ${a.lot_no}: ${fmtId(released)} ${uomLabel(a.uom)} — ${reason}` }, c);
    return { ...r, wo_no: a.wo_no, lot_no: a.lot_no, material: a.material_name, released_qty: released };
  });
  res.json({ ...out, message: `Reserve ${fmtId(out.released_qty)} dilepas.` });
}));

// =====================================================================
// FR-03.3  SCRAP / WASTE DISPOSAL
// =====================================================================
// GET /scrap/stock?days=30 — saldo limbah + rekap harian
inventoryRouter.get('/scrap/stock', READ_SCRAP, ah(async (req, res) => {
  const days = req.query.days ? num(req.query.days, 'days', { int: true, min: 1, max: 366 }) : 30;
  const s = await scrapSummary();
  const daily = await query(
    `WITH d AS (SELECT generate_series(erp.fn_wib_date(now()) - ($1::int - 1), erp.fn_wib_date(now()), '1 day')::date AS day)
     SELECT d.day::text AS day,
            coalesce((SELECT sum(scrap_kg) FROM erp.cutting_records c WHERE erp.fn_wib_date(c.cut_at) = d.day), 0) AS scrap_in_kg,
            coalesce((SELECT sum(qty_kg) FROM erp.scrap_disposals x WHERE erp.fn_wib_date(x.disposed_at) = d.day AND x.method = 'SOLD'), 0) AS sold_kg,
            coalesce((SELECT sum(qty_kg) FROM erp.scrap_disposals x WHERE erp.fn_wib_date(x.disposed_at) = d.day AND x.method = 'DISCARDED'), 0) AS discarded_kg,
            coalesce((SELECT sum(total_amount) FROM erp.scrap_disposals x WHERE erp.fn_wib_date(x.disposed_at) = d.day AND x.method = 'SOLD'), 0) AS sales_amount
     FROM d ORDER BY d.day DESC`,
    [days],
  );
  res.json({ ...s, uom: 'KG', daily: daily.filter((r: any) => r.scrap_in_kg || r.sold_kg || r.discarded_kg) });
}));

const SCRAP_SELECT = `SELECT x.id, x.disposal_no, x.disposed_at, x.method, CASE x.method WHEN 'SOLD' THEN 'Dijual' ELSE 'Dibuang' END AS method_label,
            x.buyer_name, x.qty_kg, x.price_per_kg, x.total_amount, x.recorded_by, ur.full_name AS recorded_by_name,
            x.approved_by, ua.full_name AS approved_by_name
     FROM erp.scrap_disposals x JOIN erp.users ur ON ur.id = x.recorded_by LEFT JOIN erp.users ua ON ua.id = x.approved_by`;

// GET /scrap/disposals?method=SOLD|DISPOSED&from=&to=&approved=
inventoryRouter.get('/scrap/disposals', READ_SCRAP, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const pg = paging(q);
  const method = q.method ? normMethod(q.method) : null;
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const approved = q.approved === undefined ? null : q.approved === 'true' || q.approved === '1';
  const rows = await query(
    `${SCRAP_SELECT.replace('SELECT', 'SELECT count(*) OVER () AS total_count,')}
     WHERE ($1::erp.scrap_method IS NULL OR x.method = $1) AND ($2::date IS NULL OR erp.fn_wib_date(x.disposed_at) >= $2)
       AND ($3::date IS NULL OR erp.fn_wib_date(x.disposed_at) <= $3) AND ($4::boolean IS NULL OR (x.approved_by IS NOT NULL) = $4)
     ORDER BY x.disposed_at DESC, x.id DESC LIMIT $5 OFFSET $6`,
    [method, from, to, approved, pg.limit, pg.offset],
  );
  list(res, rows, pg);
}));

function normMethod(v: unknown) {
  const s = String(v ?? '').toUpperCase();
  const m = s === 'DISPOSED' || s === 'DIBUANG' ? 'DISCARDED' : s === 'DIJUAL' ? 'SOLD' : s;
  return oneOf(m, ['SOLD', 'DISCARDED'] as const, 'method');
}

// POST /scrap/disposals — SOLD (pembeli, Kg, harga/Kg) atau DISPOSED/DISCARDED
inventoryRouter.post('/scrap/disposals', allow('SUPERVISOR', { staff: ['GUDANG', 'CUTTING'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['method', 'qty_kg']);
  const method = normMethod(b.method);
  const qty = num(b.qty_kg, 'qty_kg', { gt: 0 });
  let buyer: string | null = null;
  let price = 0;
  if (method === 'SOLD') {
    buyer = String(b.buyer_name ?? b.buyer ?? '').trim();
    if (!buyer) throw badRequest('Nama pembeli wajib diisi untuk limbah yang dijual.', { field: 'buyer_name' });
    price = num(b.price_per_kg, 'price_per_kg', { gt: 0 });
  }
  const disposedAt = b.disposed_at ? new Date(b.disposed_at) : null;
  if (disposedAt && Number.isNaN(disposedAt.getTime())) throw badRequest('disposed_at tidak valid.', { field: 'disposed_at' });
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    // Serialisasi pengeluaran limbah agar validasi stok limbah (trigger) tidak balapan
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('erp.scrap_disposals'))`);
    const r = await one(
      c,
      `INSERT INTO erp.scrap_disposals (disposed_at, method, buyer_name, qty_kg, price_per_kg, recorded_by)
       VALUES (coalesce($1::timestamptz, now()), $2, $3, $4, $5, $6) RETURNING id`,
      [disposedAt, method, buyer, qty, price, u.id],
    );
    await audit({ userId: u.id, action: 'INSERT', entity: 'scrap_disposals', entityId: r.id, ip: req.ip,
      note: `${method === 'SOLD' ? 'Jual' : 'Buang'} limbah ${fmtId(qty)} Kg${b.notes ? ` — ${b.notes}` : ''}` }, c);
    return one(c, `${SCRAP_SELECT} WHERE x.id = $1`, [r.id]);
  });
  res.status(201).json(out);
}));

// PATCH /scrap/disposals/{id} — Finance memperbarui nilai jual (harga/Kg, pembeli); kredit overhead ikut diperbarui
inventoryRouter.patch('/scrap/disposals/:id', allow('FINANCE'), ah(async (req, res) => {
  const b = req.body ?? {};
  if (b.price_per_kg === undefined && b.buyer_name === undefined) throw badRequest('Isi price_per_kg dan/atau buyer_name.');
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const d = await resolveDisposal(c, String(req.params.id), true);
    if (d.method !== 'SOLD') throw new AppError(422, 'INVALID_METHOD', 'Nilai jual hanya untuk limbah yang dijual.');
    const price = b.price_per_kg === undefined ? d.price_per_kg : num(b.price_per_kg, 'price_per_kg', { gt: 0 });
    const buyer = b.buyer_name === undefined ? d.buyer_name : String(b.buyer_name).trim();
    if (!buyer) throw badRequest('Nama pembeli wajib diisi untuk limbah yang dijual.', { field: 'buyer_name' });
    const r = await one(c, `UPDATE erp.scrap_disposals SET price_per_kg = $2, buyer_name = $3 WHERE id = $1 RETURNING total_amount`, [d.id, price, buyer]);
    // Entri kredit overhead (dibuat trigger saat insert) ikut disesuaikan; periode LOCKED ditolak trigger DB (PERIOD_LOCKED)
    await c.query(
      `UPDATE erp.overhead_entries SET amount = $2 WHERE ref_table = 'scrap_disposals' AND ref_id = $1 AND category = 'SCRAP_SALE_CREDIT'`,
      [d.id, -r.total_amount],
    );
    await audit({ userId: u.id, action: 'UPDATE', entity: 'scrap_disposals', entityId: d.id, ip: req.ip,
      oldValue: { price_per_kg: d.price_per_kg, buyer_name: d.buyer_name }, newValue: { price_per_kg: price, buyer_name: buyer },
      note: `Update nilai jual ${d.disposal_no}` }, c);
    return one(c, `${SCRAP_SELECT} WHERE x.id = $1`, [d.id]);
  });
  res.json(out);
}));

// PATCH /scrap/disposals/{id}/approve — Supervisor
inventoryRouter.patch('/scrap/disposals/:id/approve', SPV, ah(async (req, res) => {
  const u = req.user!;
  const out = await withTx(u.id, async (c) => {
    const d = await resolveDisposal(c, String(req.params.id), true);
    if (d.approved_by) throw new AppError(422, 'INVALID_STATUS', 'Pengeluaran limbah ini sudah di-approve.');
    await c.query(`UPDATE erp.scrap_disposals SET approved_by = $2 WHERE id = $1`, [d.id, u.id]);
    await audit({ userId: u.id, action: 'APPROVE', entity: 'scrap_disposals', entityId: d.id, ip: req.ip, note: req.body?.note ? String(req.body.note) : d.disposal_no }, c);
    return one(c, `${SCRAP_SELECT} WHERE x.id = $1`, [d.id]);
  });
  res.json(out);
}));
