// FR-06.1 Packing Verification · FR-06.2 Finished Goods Transfer & SPK Closure · FR-06.3 Dispatch & Fulfillment Routing
import express, { Response } from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { parse } from 'csv-parse/sync';
import { PoolClient } from 'pg';
import { audit, pool, query, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, conflict, notFound, num, oneOf, paging, required } from '../lib/http.ts';
import { allow } from '../lib/auth.ts';

export const fulfillmentRouter = express.Router();

const READERS = ['ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'] as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// ---------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------
type Db = PoolClient | null;
const run = async (c: Db, sql: string, params: unknown[] = []) => (c ? (await c.query(sql, params)).rows : query(sql, params));
const asNum = (s: string) => (/^\d{1,15}$/.test(s) ? Number(s) : null);

function dateParam(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  return v;
}

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-';
const fmtNum = (n: number) => Number(n).toLocaleString('id-ID');

async function resolveWo(v: unknown, c: Db = null) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return (await run(c, `SELECT * FROM erp.work_orders WHERE upper(wo_no) = upper($1) OR id = $2::bigint LIMIT 1`, [s, asNum(s)]))[0] ?? null;
}

// Varian: sku_variant_id | barcode/variant | sku + size + color
async function resolveVariant(c: Db, it: Record<string, any>, prefix = '') {
  const vid = it[`${prefix}sku_variant_id`] ?? (prefix ? it[`${prefix}variant_id`] : undefined);
  const code = it[`${prefix}barcode`] ?? it[`${prefix}variant`];
  let rows: any[];
  if (vid !== undefined && vid !== null && vid !== '') {
    rows = await run(c, `SELECT id FROM erp.sku_variants WHERE id = $1`, [num(vid, `${prefix}sku_variant_id`, { int: true })]);
  } else if (code) {
    rows = await run(c, `SELECT id FROM erp.sku_variants WHERE upper(barcode) = upper($1)`, [String(code).trim()]);
  } else if (it[`${prefix}sku`] && it[`${prefix}size`] && it[`${prefix}color`]) {
    rows = await run(c,
      `SELECT v.id FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id
       WHERE upper(k.code) = upper($1) AND upper(v.size) = upper($2) AND upper(v.color) = upper($3)`,
      [String(it[`${prefix}sku`]).trim(), String(it[`${prefix}size`]).trim(), String(it[`${prefix}color`]).trim()]);
  } else {
    throw badRequest(`Varian wajib diisi: ${prefix}sku_variant_id, ${prefix}barcode, atau ${prefix}sku + ${prefix}size + ${prefix}color.`);
  }
  if (!rows[0]) throw notFound(`Varian SKU ${code ?? vid ?? `${it[`${prefix}sku`]} ${it[`${prefix}size`]} ${it[`${prefix}color`]}`} tidak ditemukan.`, 'VARIANT_NOT_FOUND');
  return rows[0].id as number;
}

// Item dokumen [{…varian, qty}] → digabung per varian
async function resolveItems(c: Db, items: unknown) {
  if (!Array.isArray(items) || !items.length) throw badRequest('items wajib diisi minimal 1 baris.', { field: 'items' });
  const map = new Map<number, number>();
  for (const it of items) {
    const id = await resolveVariant(c, it ?? {});
    const qty = num(it?.qty, 'qty', { int: true, gt: 0 });
    map.set(id, (map.get(id) ?? 0) + qty);
  }
  return [...map].map(([sku_variant_id, qty]) => ({ sku_variant_id, qty }));
}

// Stok FG grade A tersedia = on hand − reserved − komitmen DO (Draft/Approved) & pesanan online (Imported/Packed) lain
async function fgShortages(c: Db, items: { sku_variant_id: number; qty: number }[], exclude: { doId?: number; orderId?: number } = {}) {
  const rows = await run(c,
    `SELECT v.id, k.code || ' ' || v.size || ' ' || v.color AS label,
            coalesce(s.qty_on_hand, 0) - coalesce(s.qty_reserved, 0)
            - coalesce((SELECT sum(i.qty) FROM erp.delivery_order_items i JOIN erp.delivery_orders d ON d.id = i.delivery_order_id
                        WHERE i.sku_variant_id = v.id AND d.status IN ('DRAFT','APPROVED') AND d.id IS DISTINCT FROM $2::bigint), 0)
            - coalesce((SELECT sum(i.qty) FROM erp.ecommerce_order_items i JOIN erp.ecommerce_orders o ON o.id = i.order_id
                        WHERE i.sku_variant_id = v.id AND o.status IN ('IMPORTED','PACKED') AND o.id IS DISTINCT FROM $3::bigint), 0) AS available
     FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id
     LEFT JOIN erp.fg_stock s ON s.sku_variant_id = v.id AND s.grade = 'A'
     WHERE v.id = ANY($1::bigint[])`,
    [items.map((i) => i.sku_variant_id), exclude.doId ?? null, exclude.orderId ?? null]);
  const out: { sku: string; requested: number; available: number; short: number; message: string }[] = [];
  for (const it of items) {
    const r = rows.find((x: any) => x.id === it.sku_variant_id);
    const avail = Math.max(Number(r?.available ?? 0), 0);
    if (it.qty > avail) {
      out.push({ sku: r?.label, requested: it.qty, available: avail, short: it.qty - avail, message: `Stok ${r?.label} kurang ${fmtNum(it.qty - avail)} pcs.` });
    }
  }
  return out;
}

function sendPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void | Promise<void>, opts: PDFKit.PDFDocumentOptions = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, ...opts });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  return Promise.resolve(build(doc)).then(() => { doc.end(); });
}

// Tabel sederhana untuk PDF
function pdfTable(doc: PDFKit.PDFDocument, cols: { label: string; width: number; align?: 'left' | 'right' | 'center' }[], rows: string[][]) {
  const x0 = doc.page.margins.left;
  const drawRow = (cells: string[], bold = false) => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    let x = x0;
    let h = 0;
    cells.forEach((t, i) => { h = Math.max(h, doc.heightOfString(t, { width: cols[i].width - 6 })); });
    if (y + h + 8 > doc.page.height - doc.page.margins.bottom) { doc.addPage(); return drawRow(cells, bold); }
    cells.forEach((t, i) => {
      doc.text(t, x + 3, y + 4, { width: cols[i].width - 6, align: cols[i].align ?? 'left' });
      x += cols[i].width;
    });
    const total = cols.reduce((a, c) => a + c.width, 0);
    doc.moveTo(x0, y + h + 8).lineTo(x0 + total, y + h + 8).lineWidth(0.5).stroke();
    doc.y = y + h + 8;
    doc.x = x0;
  };
  drawRow(cols.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r));
}

// ---------------------------------------------------------------------
// FR-06.1  Packing session
// ---------------------------------------------------------------------
const PACK_READ = allow(...READERS, { staff: ['PACKING'] });
const PACK_WRITE = allow('SUPERVISOR', { staff: ['PACKING'] });

async function findPack(v: string, c: Db = null) {
  const s = String(v).trim();
  return (await run(c, `SELECT * FROM erp.pack_units WHERE upper(pack_code) = upper($1) OR id = $2::bigint LIMIT 1`, [s, asNum(s)]))[0] ?? null;
}

async function packDetail(id: number) {
  const head = await queryOne(
    `SELECT p.id, p.pack_code, p.status, p.pack_count, w.wo_no, w.id AS work_order_id, w.status AS wo_status,
            k.code AS sku_code, k.name AS sku_name, k.pack_config, v.id AS fg_variant_id, v.size, v.color, v.barcode,
            u.full_name AS packed_by, p.created_at, p.confirmed_at
     FROM erp.pack_units p JOIN erp.work_orders w ON w.id = p.work_order_id
     JOIN erp.sku_variants v ON v.id = p.fg_variant_id JOIN erp.skus k ON k.id = v.sku_id JOIN erp.users u ON u.id = p.packed_by
     WHERE p.id = $1`, [id]);
  if (!head) return null;
  const components = await query(
    `SELECT v.id AS component_variant_id, v.size, v.color, v.barcode, c.qty AS qty_per_pack, c.qty * $2 AS required,
            coalesce((SELECT sum(i.qty) FROM erp.pack_unit_items i WHERE i.pack_unit_id = $1 AND i.component_variant_id = c.component_variant_id), 0)::int AS scanned,
            coalesce((SELECT sum(b.qty_pass - b.qty_packed) FROM erp.bundles b
                      WHERE b.work_order_id = $3 AND b.sku_variant_id = c.component_variant_id AND b.status = 'INSPECTED'), 0)::int
            - coalesce((SELECT sum(i.qty) FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id JOIN erp.bundles b ON b.id = i.bundle_id
                        WHERE u.status = 'OPEN' AND b.work_order_id = $3 AND b.sku_variant_id = c.component_variant_id), 0)::int AS pass_available_wo
     FROM erp.fn_pack_composition($4) c JOIN erp.sku_variants v ON v.id = c.component_variant_id
     ORDER BY v.size_order, v.color`, [id, head.pack_count, head.work_order_id, head.fg_variant_id]);
  const items = await query(
    `SELECT i.id, b.bundle_code, v.size, v.color, i.qty, i.scanned_at
     FROM erp.pack_unit_items i JOIN erp.bundles b ON b.id = i.bundle_id JOIN erp.sku_variants v ON v.id = i.component_variant_id
     WHERE i.pack_unit_id = $1 ORDER BY i.scanned_at, i.id`, [id]);
  const packaging = await query(
    `SELECT m.code AS material_code, m.name AS material_name, sp.qty_per_pack * $2 AS required,
            coalesce((SELECT sum(l.qty_on_hand - l.qty_reserved) FROM erp.material_lots l WHERE l.material_id = m.id AND l.qc_status = 'PASS'), 0) AS available
     FROM erp.sku_packaging sp JOIN erp.materials m ON m.id = sp.material_id
     WHERE sp.sku_id = (SELECT sku_id FROM erp.sku_variants WHERE id = $1) ORDER BY m.code`, [head.fg_variant_id, head.pack_count]);
  const checklist = components.map((c: any) => ({ ...c, complete: c.scanned >= c.required }));
  return {
    ...head,
    complete: checklist.every((c: any) => c.complete),
    components: checklist,
    items,
    packaging: packaging.map((p: any) => ({ ...p, sufficient: Number(p.available) >= Number(p.required) })),
  };
}

// GET /packing/sessions?wo=&status=
fulfillmentRouter.get('/packing/sessions', PACK_READ, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const { limit, offset, page } = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['OPEN', 'CONFIRMED', 'CANCELLED'] as const, 'status') : null;
  const rows = await query(
    `SELECT p.id, p.pack_code, p.status, p.pack_count, w.wo_no, k.code AS sku_code, v.size, v.color,
            u.full_name AS packed_by, p.created_at, p.confirmed_at, count(*) OVER()::int AS total_count
     FROM erp.pack_units p JOIN erp.work_orders w ON w.id = p.work_order_id
     JOIN erp.sku_variants v ON v.id = p.fg_variant_id JOIN erp.skus k ON k.id = v.sku_id JOIN erp.users u ON u.id = p.packed_by
     WHERE ($1::text IS NULL OR upper(w.wo_no) = upper($1) OR w.id::text = $1) AND ($2::text IS NULL OR p.status::text = $2)
     ORDER BY p.id DESC LIMIT $3 OFFSET $4`, [q.wo || null, status, limit, offset]);
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total: rows[0]?.total_count ?? 0 });
}));

// POST /packing/sessions — buka sesi packing (fn_pack_open)
fulfillmentRouter.post('/packing/sessions', PACK_WRITE, ah(async (req, res) => {
  const b = req.body ?? {};
  const woRef = b.work_order ?? b.work_order_id ?? b.wo_no;
  required({ work_order: woRef }, ['work_order']);
  const packCount = b.pack_count === undefined ? 1 : num(b.pack_count, 'pack_count', { int: true, min: 1, max: 1000 });
  const id = await withTx(req.user!.id, async (c) => {
    const w = await resolveWo(woRef, c);
    if (!w) throw notFound('SPK tidak ditemukan.', 'WORK_ORDER_NOT_FOUND');
    const fg = await resolveVariant(c, { sku_variant_id: b.fg_variant_id, barcode: b.fg_barcode ?? b.barcode, sku: b.sku ?? b.fg_sku, size: b.size, color: b.color });
    return (await c.query(`SELECT erp.fn_pack_open($1, $2, $3, $4) AS id`, [w.id, fg, req.user!.id, packCount])).rows[0].id;
  });
  res.status(201).json(await packDetail(id));
}));

// GET /packing/sessions/{id} — komposisi + checklist
fulfillmentRouter.get('/packing/sessions/:id', PACK_READ, ah(async (req, res) => {
  const p = await findPack(req.params.id);
  if (!p) throw notFound('Sesi packing tidak ditemukan.', 'PACK_NOT_FOUND');
  res.json(await packDetail(p.id));
}));

// POST /packing/sessions/{id}/scan — scan bundel Pass QC (fn_pack_scan)
fulfillmentRouter.post('/packing/sessions/:id/scan', PACK_WRITE, ah(async (req, res) => {
  const b = req.body ?? {};
  const qr = b.qr ?? b.bundle_code ?? b.bundle_id;
  required({ qr }, ['qr']);
  const qty = b.qty === undefined ? 1 : num(b.qty, 'qty', { int: true, gt: 0 });
  const p = await findPack(req.params.id);
  if (!p) throw notFound('Sesi packing tidak ditemukan.', 'PACK_NOT_FOUND');
  const r = await withTx(req.user!.id, async (c) =>
    (await c.query(`SELECT erp.fn_pack_scan($1, $2, $3) AS r`, [p.id, String(qr).trim(), qty])).rows[0].r);
  const components = (r.components ?? []).map((x: any) => ({ ...x, complete: x.scanned >= x.required }));
  res.json({ status: 'OK', pack: r.pack, complete: components.every((x: any) => x.complete), components });
}));

// PATCH /packing/sessions/{id}/cancel — batalkan sesi OPEN (melepas item yang sudah discan)
fulfillmentRouter.patch('/packing/sessions/:id/cancel', PACK_WRITE, ah(async (req, res) => {
  const p = await findPack(req.params.id);
  if (!p) throw notFound('Sesi packing tidak ditemukan.', 'PACK_NOT_FOUND');
  await withTx(req.user!.id, async (c) => {
    const r = await c.query(`UPDATE erp.pack_units SET status = 'CANCELLED' WHERE id = $1 AND status = 'OPEN'`, [p.id]);
    if (!r.rowCount) throw new AppError(422, 'PACK_CLOSED', 'Sesi packing sudah dikonfirmasi/dibatalkan.');
    await audit({ userId: req.user!.id, action: 'CANCEL', entity: 'pack_units', entityId: p.id, note: req.body?.reason ?? null, ip: req.ip }, c);
  });
  res.json({ status: 'OK', message: 'Sesi packing dibatalkan.' });
}));

// POST /packing/sessions/{id}/confirm — konfirmasi pack → stok FG +, kemasan −, cek penutupan SPK (fn_pack_confirm)
fulfillmentRouter.post('/packing/sessions/:id/confirm', PACK_WRITE, ah(async (req, res) => {
  const p = await findPack(req.params.id);
  if (!p) throw notFound('Sesi packing tidak ditemukan.', 'PACK_NOT_FOUND');
  let r: any;
  try {
    r = await withTx(req.user!.id, async (c) => (await c.query(`SELECT erp.fn_pack_confirm($1, $2) AS r`, [p.id, req.user!.id])).rows[0].r);
  } catch (e: any) {
    // Stok kemasan habis → notifikasi Staff Gudang (transaksi sudah di-rollback, jadi dicatat terpisah)
    if (e?.hint === 'PACKAGING_OUT') await notifyPackagingOut(p.id).catch((x) => console.error('[packing] notifikasi gagal:', x.message));
    throw e;
  }
  const closure = await closureCheck(p.work_order_id);
  res.json({ status: 'OK', pack: r.pack, packs_added: r.packs_added, wo_closed: r.wo_closed, closure });
}));

async function notifyPackagingOut(packId: number) {
  await pool.query(
    `WITH short AS (
       SELECT m.id, m.name FROM erp.pack_units p JOIN erp.sku_variants v ON v.id = p.fg_variant_id
       JOIN erp.sku_packaging sp ON sp.sku_id = v.sku_id JOIN erp.materials m ON m.id = sp.material_id
       WHERE p.id = $1 AND sp.qty_per_pack * p.pack_count >
             coalesce((SELECT sum(l.qty_on_hand - l.qty_reserved) FROM erp.material_lots l WHERE l.material_id = m.id AND l.qc_status = 'PASS'), 0))
     INSERT INTO erp.notifications (user_id, type, title, body, entity, entity_id)
     SELECT u.id, 'STOCK_CRITICAL', format('Stok %s habis', s.name), 'Packing tertahan karena stok kemasan habis. Segera isi ulang.',
            'materials', s.id::text
     FROM short s CROSS JOIN erp.users u
     WHERE u.role = 'STAFF' AND u.staff_function = 'GUDANG' AND u.status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM erp.notifications n WHERE n.user_id = u.id AND n.type = 'STOCK_CRITICAL'
                       AND n.entity = 'materials' AND n.entity_id = s.id::text AND n.read_at IS NULL)`, [packId]);
}

// GET /packing/sessions/{id}/label.pdf — label kemasan/karton
fulfillmentRouter.get('/packing/sessions/:id/label.pdf', PACK_READ, ah(async (req, res) => {
  const p = await findPack(req.params.id);
  if (!p) throw notFound('Sesi packing tidak ditemukan.', 'PACK_NOT_FOUND');
  const d = (await packDetail(p.id))!;
  const qr = await QRCode.toBuffer(d.pack_code, { margin: 1, width: 220 });
  await sendPdf(res, `${d.pack_code}.pdf`, (doc) => {
    doc.font('Helvetica-Bold').fontSize(16).text(d.pack_code, { align: 'center' });
    doc.moveDown(0.3).font('Helvetica').fontSize(9).text(d.status === 'CONFIRMED' ? `Dikonfirmasi ${fmtDate(d.confirmed_at)}` : `Status: ${d.status}`, { align: 'center' });
    doc.image(qr, (doc.page.width - 110) / 2, doc.y + 6, { width: 110 });
    doc.y += 122;
    doc.font('Helvetica-Bold').fontSize(12).text(`${d.sku_code}`, { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(d.sku_name, { align: 'center' });
    doc.text(`Size ${d.size} - ${d.color}`, { align: 'center' });
    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(14).text(`${fmtNum(d.pack_count)} pack`, { align: 'center' });
    doc.moveDown(0.4).font('Helvetica').fontSize(8);
    if (d.components.length > 1) doc.text('Isi: ' + d.components.map((c: any) => `${c.size} ${c.color} x${c.qty_per_pack}`).join(', '), { align: 'center' });
    doc.text(`SPK ${d.wo_no}${d.barcode ? `  |  ${d.barcode}` : ''}`, { align: 'center' });
    doc.text(`Packer: ${d.packed_by}`, { align: 'center' });
  }, { size: [288, 432], margin: 16 });
}));

// ---------------------------------------------------------------------
// FR-06.2  SPK closure check
// ---------------------------------------------------------------------
// Versi read-only dari erp.fn_check_wo_closure (fungsi DB itu dapat langsung menutup SPK).
async function closureCheck(woId: number) {
  const r = await queryOne(
    `SELECT w.id, w.wo_no, w.status, w.target_qty, w.closed_at, w.close_type,
            coalesce((SELECT sum(i.qty) FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
                      WHERE u.work_order_id = w.id AND u.status = 'CONFIRMED'), 0)::int AS packed_pcs,
            coalesce((SELECT sum(q.qty_reject) FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id
                      WHERE b.work_order_id = w.id), 0)::int AS reject_pcs,
            (SELECT count(*) FROM erp.bundles WHERE work_order_id = w.id
               AND (status IN ('IN_PROGRESS','SEWN') OR (status = 'CREATED' AND is_rework)))::int AS open_bundles,
            (SELECT count(*) FROM erp.bundles WHERE work_order_id = w.id AND is_rework AND status IN ('CREATED','IN_PROGRESS','SEWN'))::int AS open_rework_bundles,
            (SELECT count(*) FROM erp.bundles WHERE work_order_id = w.id AND NOT is_rework AND status = 'CREATED')::int AS unstarted_bundles,
            coalesce((SELECT sum(qty_pass - qty_packed) FROM erp.bundles WHERE work_order_id = w.id AND status = 'INSPECTED'), 0)::int AS pass_not_packed_pcs
     FROM erp.work_orders w WHERE w.id = $1`, [woId]);
  if (!r) return null;
  const reached = r.packed_pcs + r.reject_pcs >= r.target_qty;
  const reasons: string[] = [];
  if (r.status !== 'ACTIVE') reasons.push(`SPK berstatus ${r.status}.`);
  if (r.open_rework_bundles > 0) reasons.push(`SPK belum dapat ditutup: masih ada ${r.open_rework_bundles} bundel rework.`);
  if (!reached) reasons.push(`Target belum tercapai: FG ${fmtNum(r.packed_pcs)} + reject ${fmtNum(r.reject_pcs)} dari target ${fmtNum(r.target_qty)} pcs.`);
  const otherOpen = r.open_bundles - r.open_rework_bundles;
  if (otherOpen > 0) reasons.push(`SPK belum dapat ditutup: masih ada ${otherOpen} bundel dalam proses.`);
  const canClose = r.status === 'ACTIVE' && reached && r.open_bundles === 0;
  return {
    work_order: r.wo_no, work_order_id: r.id, status: r.status, closed_at: r.closed_at, close_type: r.close_type,
    target_qty: r.target_qty, packed_pcs: r.packed_pcs, reject_pcs: r.reject_pcs, fg_plus_reject: r.packed_pcs + r.reject_pcs,
    target_reached: reached, open_bundles: r.open_bundles, open_rework_bundles: r.open_rework_bundles,
    unstarted_bundles: r.unstarted_bundles, pass_not_packed_pcs: r.pass_not_packed_pcs,
    can_close: canClose, reasons, message: canClose ? 'SPK memenuhi syarat untuk ditutup otomatis.' : reasons[0],
  };
}

// GET /work-orders/{id}/closure-check — read-only
fulfillmentRouter.get('/work-orders/:id/closure-check', allow(...READERS, { staff: ['PACKING'] }), ah(async (req, res) => {
  const w = await resolveWo(req.params.id);
  if (!w) throw notFound('SPK tidak ditemukan.', 'WORK_ORDER_NOT_FOUND');
  res.json(await closureCheck(w.id));
}));

// POST /work-orders/{id}/closure-check — jalankan erp.fn_check_wo_closure (menutup SPK bila syarat terpenuhi)
fulfillmentRouter.post('/work-orders/:id/closure-check', allow('SUPERVISOR'), ah(async (req, res) => {
  const w = await resolveWo(req.params.id);
  if (!w) throw notFound('SPK tidak ditemukan.', 'WORK_ORDER_NOT_FOUND');
  // Commit dulu (notifikasi WO_CLOSED untuk Supervisor dari fungsi DB tetap tersimpan), baru laporkan hasil
  const closed: boolean = await withTx(req.user!.id, async (c) =>
    (await c.query(`SELECT erp.fn_check_wo_closure($1, $2) AS ok`, [w.id, req.user!.id])).rows[0].ok);
  const check = (await closureCheck(w.id))!;
  if (!closed) throw new AppError(422, 'WO_NOT_CLOSABLE', check.message ?? 'SPK belum dapat ditutup.', check);
  res.json({ status: 'OK', closed: true, message: `${w.wo_no} ditutup otomatis.`, ...check });
}));

// ---------------------------------------------------------------------
// FR-06.3  B2B Dispatch (Delivery Order)
// ---------------------------------------------------------------------
const DISPATCH_READ = allow(...READERS, { staff: ['GUDANG', 'PACKING'] });

async function findDo(v: string) {
  const s = String(v).trim();
  return queryOne(`SELECT * FROM erp.delivery_orders WHERE upper(do_no) = upper($1) OR id = $2::bigint LIMIT 1`, [s, asNum(s)]);
}

async function doDetail(id: number) {
  const head = await queryOne(
    `SELECT d.id, d.do_no, d.status, d.ship_date::text AS ship_date, d.notes, d.created_at, d.shipped_at,
            c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
            cu.full_name AS created_by, au.full_name AS approved_by
     FROM erp.delivery_orders d JOIN erp.customers c ON c.id = d.customer_id JOIN erp.users cu ON cu.id = d.created_by
     LEFT JOIN erp.users au ON au.id = d.approved_by WHERE d.id = $1`, [id]);
  if (!head) return null;
  const items = await query(
    `SELECT i.id, v.id AS sku_variant_id, k.code AS sku_code, k.name AS sku_name, v.size, v.color, v.barcode, i.qty,
            coalesce(s.qty_on_hand - s.qty_reserved, 0) AS fg_on_hand
     FROM erp.delivery_order_items i JOIN erp.sku_variants v ON v.id = i.sku_variant_id JOIN erp.skus k ON k.id = v.sku_id
     LEFT JOIN erp.fg_stock s ON s.sku_variant_id = v.id AND s.grade = 'A'
     WHERE i.delivery_order_id = $1 ORDER BY k.code, v.size_order, v.color`, [id]);
  return { ...head, total_qty: items.reduce((a: number, i: any) => a + i.qty, 0), items };
}

// POST /dispatch/b2b — buat Delivery Order (Draft, menunggu approval Supervisor)
fulfillmentRouter.post('/dispatch/b2b', allow('SUPERVISOR', { staff: ['GUDANG'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  const cust = b.customer ?? b.customer_id ?? b.customer_code;
  required({ customer: cust }, ['customer']);
  const shipDate = dateParam(b.ship_date, 'ship_date');
  const id = await withTx(req.user!.id, async (c) => {
    const s = String(cust).trim();
    const customer = (await c.query(`SELECT id FROM erp.customers WHERE (upper(code) = upper($1) OR id = $2::bigint) AND status = 'ACTIVE'`, [s, asNum(s)])).rows[0];
    if (!customer) throw notFound('Klien tidak ditemukan atau nonaktif.', 'CUSTOMER_NOT_FOUND');
    const items = await resolveItems(c, b.items);
    const short = await fgShortages(c, items);
    if (short.length) throw new AppError(422, 'INSUFFICIENT_FG', short.map((x) => x.message).join(' '), { shortages: short });
    const d = (await c.query(
      `INSERT INTO erp.delivery_orders (do_no, customer_id, ship_date, notes, created_by)
       VALUES (erp.fn_next_doc_no('DO'), $1, $2, $3, $4) RETURNING id, do_no`, [customer.id, shipDate, b.notes ?? null, req.user!.id])).rows[0];
    await c.query(
      `INSERT INTO erp.delivery_order_items (delivery_order_id, sku_variant_id, qty)
       SELECT $1, x.sku_variant_id, x.qty FROM jsonb_to_recordset($2::jsonb) AS x(sku_variant_id bigint, qty int)`, [d.id, JSON.stringify(items)]);
    await audit({ userId: req.user!.id, action: 'INSERT', entity: 'delivery_orders', entityId: d.id, note: `${d.do_no} dibuat`, ip: req.ip }, c);
    return d.id;
  });
  res.status(201).json(await doDetail(id));
}));

// GET /dispatch?status=&customer=&from=&to=
fulfillmentRouter.get('/dispatch', DISPATCH_READ, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const { limit, offset, page } = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['DRAFT', 'APPROVED', 'SHIPPED', 'CANCELLED'] as const, 'status') : null;
  const rows = await query(
    `SELECT d.id, d.do_no, d.status, d.ship_date::text AS ship_date, c.code AS customer_code, c.name AS customer_name,
            (SELECT count(*) FROM erp.delivery_order_items i WHERE i.delivery_order_id = d.id)::int AS items,
            (SELECT coalesce(sum(qty), 0) FROM erp.delivery_order_items i WHERE i.delivery_order_id = d.id)::int AS total_qty,
            cu.full_name AS created_by, au.full_name AS approved_by, d.created_at, d.shipped_at, count(*) OVER()::int AS total_count
     FROM erp.delivery_orders d JOIN erp.customers c ON c.id = d.customer_id JOIN erp.users cu ON cu.id = d.created_by
     LEFT JOIN erp.users au ON au.id = d.approved_by
     WHERE ($1::text IS NULL OR d.status::text = $1) AND ($2::text IS NULL OR upper(c.code) = upper($2) OR c.name ILIKE '%' || $2 || '%')
       AND ($3::date IS NULL OR erp.fn_wib_date(d.created_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(d.created_at) <= $4)
     ORDER BY d.id DESC LIMIT $5 OFFSET $6`,
    [status, q.customer || null, dateParam(q.from, 'from'), dateParam(q.to, 'to'), limit, offset]);
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total: rows[0]?.total_count ?? 0 });
}));

// GET /dispatch/{id} — id atau nomor DO
fulfillmentRouter.get('/dispatch/:id', DISPATCH_READ, ah(async (req, res) => {
  const d = await findDo(req.params.id);
  if (!d) throw notFound('Delivery Order tidak ditemukan.', 'DO_NOT_FOUND');
  res.json(await doDetail(d.id));
}));

// PATCH /dispatch/{id}/approve — Supervisor (fn_approve_delivery_order)
fulfillmentRouter.patch('/dispatch/:id/approve', allow('SUPERVISOR'), ah(async (req, res) => {
  const d = await findDo(req.params.id);
  if (!d) throw notFound('Delivery Order tidak ditemukan.', 'DO_NOT_FOUND');
  await withTx(req.user!.id, async (c) => {
    await c.query(`SELECT erp.fn_approve_delivery_order($1, $2)`, [d.id, req.user!.id]);
    await audit({ userId: req.user!.id, action: 'APPROVE', entity: 'delivery_orders', entityId: d.id, note: `${d.do_no} di-approve`, ip: req.ip }, c);
  });
  res.json({ status: 'OK', message: `${d.do_no} di-approve.`, delivery_order: await doDetail(d.id) });
}));

// PATCH /dispatch/{id}/ship — kirim: stok FG berkurang (fn_ship_delivery_order)
fulfillmentRouter.patch('/dispatch/:id/ship', allow('SUPERVISOR', { staff: ['GUDANG', 'PACKING'] }), ah(async (req, res) => {
  const d = await findDo(req.params.id);
  if (!d) throw notFound('Delivery Order tidak ditemukan.', 'DO_NOT_FOUND');
  await withTx(req.user!.id, async (c) => {
    await c.query(`SELECT erp.fn_ship_delivery_order($1, $2)`, [d.id, req.user!.id]);
    await audit({ userId: req.user!.id, action: 'SHIP', entity: 'delivery_orders', entityId: d.id, note: `${d.do_no} dikirim`, ip: req.ip }, c);
  });
  res.json({ status: 'OK', message: `${d.do_no} dikirim.`, delivery_order: await doDetail(d.id) });
}));

// GET /dispatch/{id}/delivery-note.pdf — surat jalan
fulfillmentRouter.get('/dispatch/:id/delivery-note.pdf', DISPATCH_READ, ah(async (req, res) => {
  const f = await findDo(req.params.id);
  if (!f) throw notFound('Delivery Order tidak ditemukan.', 'DO_NOT_FOUND');
  const d = (await doDetail(f.id))!;
  if (d.status === 'DRAFT') throw new AppError(422, 'INVALID_STATUS', 'Delivery Order belum di-approve Supervisor.');
  if (d.status === 'CANCELLED') throw new AppError(422, 'INVALID_STATUS', 'Delivery Order sudah dibatalkan.');
  await sendPdf(res, `${d.do_no}.pdf`, (doc) => {
    doc.font('Helvetica-Bold').fontSize(16).text('SURAT JALAN', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text('THEUNDERWEARSUPPLY', { align: 'center' }).moveDown();
    const y = doc.y;
    doc.fontSize(10).text(`No. DO    : ${d.do_no}`).text(`Tanggal   : ${d.ship_date ? new Date(d.ship_date).toLocaleDateString('id-ID') : fmtDate(d.shipped_at ?? d.created_at)}`)
      .text(`Status    : ${d.status}`);
    doc.text(`Kepada: ${d.customer_name} (${d.customer_code})`, 320, y, { width: 235 });
    if (d.customer_address) doc.text(d.customer_address, 320, doc.y, { width: 235 });
    if (d.customer_phone) doc.text(`Telp. ${d.customer_phone}`, 320, doc.y, { width: 235 });
    doc.x = doc.page.margins.left;
    doc.y = Math.max(doc.y, y + 50);
    doc.moveDown();
    pdfTable(doc, [
      { label: 'No', width: 30, align: 'right' }, { label: 'Kode SKU', width: 110 }, { label: 'Nama Barang', width: 175 },
      { label: 'Size', width: 50 }, { label: 'Warna', width: 80 }, { label: 'Qty (pcs)', width: 70, align: 'right' },
    ], d.items.map((i: any, n: number) => [String(n + 1), i.sku_code, i.sku_name, i.size, i.color, fmtNum(i.qty)]));
    doc.moveDown(0.5).font('Helvetica-Bold').text(`Total: ${fmtNum(d.total_qty)} pcs`, { align: 'right' });
    if (d.notes) doc.moveDown(0.5).font('Helvetica').text(`Catatan: ${d.notes}`);
    doc.moveDown(3).font('Helvetica').fontSize(10);
    const sy = doc.y;
    const col = (doc.page.width - 80) / 3;
    [['Dibuat oleh', d.created_by], ['Disetujui', d.approved_by ?? ''], ['Penerima', '']].forEach(([t, n], i) => {
      doc.text(t, 40 + i * col, sy, { width: col, align: 'center' });
      doc.text(`( ${n || '....................'} )`, 40 + i * col, sy + 60, { width: col, align: 'center' });
    });
  });
}));

// ---------------------------------------------------------------------
// FR-06.3  B2C Fulfillment (pesanan e-commerce)
// ---------------------------------------------------------------------
const ECOM_READ = allow(...READERS, { staff: ['GUDANG', 'PACKING'] });
const ECOM_WRITE = allow('SUPERVISOR', { staff: ['GUDANG', 'PACKING'] });

interface EcomInput { order_no: string; channel: string; store: string; buyer_name?: string | null; items: Record<string, any>[] }

// Buat 1 pesanan dalam transaksi c. Stok kurang → status ON_HOLD (pesanan ditahan) + peringatan.
async function createEcomOrder(c: PoolClient, input: EcomInput) {
  const orderNo = String(input.order_no ?? '').trim();
  if (!orderNo) throw badRequest('Nomor pesanan wajib diisi.', { field: 'order_no' });
  const ch = String(input.channel ?? '').trim();
  const st = String(input.store ?? '').trim();
  if (!ch) throw badRequest('Kanal wajib diisi.', { field: 'channel' });
  if (!st) throw badRequest('Toko wajib diisi.', { field: 'store' });
  const channel = (await c.query(`SELECT id, code FROM erp.sales_channels WHERE upper(code) = upper($1) OR upper(name) = upper($1) OR id::text = $1`, [ch])).rows[0];
  if (!channel) throw notFound(`Kanal ${ch} tidak dikenal.`, 'CHANNEL_NOT_FOUND');
  const store = (await c.query(`SELECT id FROM erp.online_stores WHERE (upper(code) = upper($1) OR id::text = $1) AND status = 'ACTIVE'`, [st])).rows[0];
  if (!store) throw notFound(`Toko ${st} tidak dikenal.`, 'STORE_NOT_FOUND');
  if ((await c.query(`SELECT 1 FROM erp.ecommerce_orders WHERE channel_id = $1 AND external_order_no = $2`, [channel.id, orderNo])).rowCount) {
    throw conflict('Nomor pesanan sudah diproses.', 'DUPLICATE_ORDER', { order_no: orderNo, channel: channel.code });
  }
  const items = await resolveItems(c, input.items);
  const short = await fgShortages(c, items);
  const o = (await c.query(
    `INSERT INTO erp.ecommerce_orders (channel_id, store_id, external_order_no, buyer_name, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, status`,
    [channel.id, store.id, orderNo, input.buyer_name || null, short.length ? 'ON_HOLD' : 'IMPORTED'])).rows[0];
  await c.query(
    `INSERT INTO erp.ecommerce_order_items (order_id, sku_variant_id, qty)
     SELECT $1, x.sku_variant_id, x.qty FROM jsonb_to_recordset($2::jsonb) AS x(sku_variant_id bigint, qty int)`, [o.id, JSON.stringify(items)]);
  return { id: o.id as number, status: o.status as string, shortages: short };
}

async function findOrder(v: string) {
  const s = String(v).trim();
  return queryOne(`SELECT * FROM erp.ecommerce_orders WHERE id = $2::bigint OR external_order_no = $1
                   ORDER BY (id = $2::bigint) DESC NULLS LAST LIMIT 1`, [s, asNum(s)]);
}

async function orderDetail(id: number) {
  const head = await queryOne(
    `SELECT o.id, o.external_order_no AS order_no, ch.code AS channel, ch.name AS channel_name, st.code AS store, st.name AS store_name,
            o.buyer_name, o.awb_no, o.status, o.imported_at, u.full_name AS packed_by, o.shipped_at
     FROM erp.ecommerce_orders o JOIN erp.sales_channels ch ON ch.id = o.channel_id JOIN erp.online_stores st ON st.id = o.store_id
     LEFT JOIN erp.users u ON u.id = o.packed_by WHERE o.id = $1`, [id]);
  if (!head) return null;
  const items = await query(
    `SELECT i.id, v.id AS sku_variant_id, k.code AS sku_code, k.name AS sku_name, v.size, v.color, v.barcode, i.qty, i.qty_scanned,
            i.qty_scanned >= i.qty AS complete, coalesce(s.qty_on_hand - s.qty_reserved, 0) AS fg_on_hand
     FROM erp.ecommerce_order_items i JOIN erp.sku_variants v ON v.id = i.sku_variant_id JOIN erp.skus k ON k.id = v.sku_id
     LEFT JOIN erp.fg_stock s ON s.sku_variant_id = v.id AND s.grade = 'A'
     WHERE i.order_id = $1 ORDER BY i.id`, [id]);
  return {
    ...head,
    total_qty: items.reduce((a: number, i: any) => a + i.qty, 0),
    scanned_qty: items.reduce((a: number, i: any) => a + i.qty_scanned, 0),
    scan_complete: items.every((i: any) => i.complete),
    items,
  };
}

// POST /fulfillment/orders — input pesanan manual
fulfillmentRouter.post('/fulfillment/orders', ECOM_WRITE, ah(async (req, res) => {
  const b = req.body ?? {};
  const r = await withTx(req.user!.id, (c) => createEcomOrder(c, {
    order_no: b.order_no ?? b.external_order_no, channel: b.channel ?? b.channel_id, store: b.store ?? b.store_id,
    buyer_name: b.buyer_name, items: b.items,
  }));
  res.status(201).json({ ...(await orderDetail(r.id)), warnings: r.shortages.map((s) => s.message), shortages: r.shortages });
}));

// POST /fulfillment/orders/import — upload CSV (field "file"). Kolom: order_no, channel, store, buyer_name,
// barcode/variant atau sku+size+color, qty. Baris dengan order_no+channel sama digabung jadi satu pesanan.
fulfillmentRouter.post('/fulfillment/orders/import', ECOM_WRITE, upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('File CSV wajib diunggah (field "file").', { field: 'file' });
  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer, {
      columns: (h: string[]) => h.map((x) => String(x).trim().toLowerCase().replace(/[\s-]+/g, '_')),
      bom: true, trim: true, skip_empty_lines: true, delimiter: [',', ';', '\t'], relax_column_count: true,
    });
  } catch (e: any) {
    throw badRequest('File CSV tidak dapat dibaca.', { detail: e?.message });
  }
  if (!records.length) throw badRequest('File CSV kosong.');
  if (records.length > 5000) throw badRequest('Maksimal 5.000 baris per impor.');

  const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== '') ?? '';
  type Row = { row: number; data: Record<string, any> };
  const groups = new Map<string, { input: EcomInput; rows: Row[] }>();
  const results: any[] = [];
  records.forEach((r, i) => {
    const row = i + 2; // baris 1 = header
    const orderNo = pick(r, 'order_no', 'external_order_no', 'no_pesanan', 'order_id');
    const channel = pick(r, 'channel', 'kanal', 'marketplace');
    const item = {
      sku_variant_id: pick(r, 'sku_variant_id') || undefined,
      barcode: pick(r, 'barcode', 'variant', 'sku_variant') || undefined,
      sku: pick(r, 'sku', 'sku_code') || undefined, size: pick(r, 'size', 'ukuran') || undefined, color: pick(r, 'color', 'warna') || undefined,
      qty: pick(r, 'qty', 'quantity', 'jumlah'),
    };
    if (!orderNo || !channel) {
      results.push({ row, order_no: orderNo || null, channel: channel || null, status: 'ERROR', message: 'order_no dan channel wajib diisi.' });
      return;
    }
    const key = `${channel.toUpperCase()}|${orderNo}`;
    if (!groups.has(key)) {
      groups.set(key, { input: { order_no: orderNo, channel, store: pick(r, 'store', 'toko', 'shop'), buyer_name: pick(r, 'buyer_name', 'buyer', 'pembeli') || null, items: [] }, rows: [] });
    }
    const g = groups.get(key)!;
    g.input.items.push(item);
    g.rows.push({ row, data: item });
  });

  for (const g of groups.values()) {
    try {
      const r = await withTx(req.user!.id, (c) => createEcomOrder(c, g.input));
      for (const x of g.rows) {
        results.push({ row: x.row, order_no: g.input.order_no, channel: g.input.channel, status: r.status === 'ON_HOLD' ? 'ON_HOLD' : 'CREATED',
          order_id: r.id, message: r.shortages.length ? r.shortages.map((s) => s.message).join(' ') : 'Pesanan dibuat.' });
      }
    } catch (e: any) {
      const known = e instanceof AppError || e?.code === 'P0001';
      if (!known) console.error('[import pesanan] error:', e);
      const dup = e?.code === 'DUPLICATE_ORDER' || e?.hint === 'DUPLICATE_ORDER' || e?.code === '23505';
      for (const x of g.rows) {
        results.push({ row: x.row, order_no: g.input.order_no, channel: g.input.channel, status: dup ? 'DUPLICATE' : 'ERROR',
          message: dup ? 'Nomor pesanan sudah diproses.' : known ? e.message : 'Terjadi kesalahan pada server.' });
      }
    }
  }
  results.sort((a, b) => a.row - b.row);
  const count = (s: string) => new Set(results.filter((r) => r.status === s).map((r) => `${r.channel}|${r.order_no}`)).size;
  await audit({ userId: req.user!.id, action: 'IMPORT', entity: 'ecommerce_orders', note: `Impor CSV ${req.file.originalname}: ${records.length} baris`, ip: req.ip });
  res.json({
    status: 'OK',
    summary: { rows: records.length, orders_created: count('CREATED'), orders_on_hold: count('ON_HOLD'), duplicates: count('DUPLICATE'),
      errors: results.filter((r) => r.status === 'ERROR').length },
    results,
  });
}));

// GET /fulfillment/orders?status=&channel=&store=&q=&from=&to=
fulfillmentRouter.get('/fulfillment/orders', ECOM_READ, ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const { limit, offset, page } = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['IMPORTED', 'ON_HOLD', 'PACKED', 'SHIPPED', 'CANCELLED'] as const, 'status') : null;
  const rows = await query(
    `SELECT o.id, o.external_order_no AS order_no, ch.code AS channel, st.code AS store, o.buyer_name, o.awb_no, o.status,
            (SELECT coalesce(sum(qty), 0) FROM erp.ecommerce_order_items i WHERE i.order_id = o.id)::int AS total_qty,
            (SELECT coalesce(sum(qty_scanned), 0) FROM erp.ecommerce_order_items i WHERE i.order_id = o.id)::int AS scanned_qty,
            o.imported_at, o.shipped_at, count(*) OVER()::int AS total_count
     FROM erp.ecommerce_orders o JOIN erp.sales_channels ch ON ch.id = o.channel_id JOIN erp.online_stores st ON st.id = o.store_id
     WHERE ($1::text IS NULL OR o.status::text = $1) AND ($2::text IS NULL OR upper(ch.code) = upper($2))
       AND ($3::text IS NULL OR upper(st.code) = upper($3))
       AND ($4::text IS NULL OR o.external_order_no ILIKE '%' || $4 || '%' OR o.buyer_name ILIKE '%' || $4 || '%' OR o.awb_no ILIKE '%' || $4 || '%')
       AND ($5::date IS NULL OR erp.fn_wib_date(o.imported_at) >= $5) AND ($6::date IS NULL OR erp.fn_wib_date(o.imported_at) <= $6)
     ORDER BY o.id DESC LIMIT $7 OFFSET $8`,
    [status, q.channel || null, q.store || null, q.q || null, dateParam(q.from, 'from'), dateParam(q.to, 'to'), limit, offset]);
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total: rows[0]?.total_count ?? 0 });
}));

// GET /fulfillment/orders/{id} — id atau nomor pesanan marketplace
fulfillmentRouter.get('/fulfillment/orders/:id', ECOM_READ, ah(async (req, res) => {
  const o = await findOrder(req.params.id);
  if (!o) throw notFound('Pesanan tidak ditemukan.', 'ORDER_NOT_FOUND');
  res.json(await orderDetail(o.id));
}));

// POST /fulfillment/orders/{id}/scan — scan barcode item (fn_ecom_scan); lengkap → status PACKED
fulfillmentRouter.post('/fulfillment/orders/:id/scan', ECOM_WRITE, ah(async (req, res) => {
  const barcode = String(req.body?.barcode ?? '').trim();
  if (!barcode) throw badRequest('barcode wajib diisi.', { field: 'barcode' });
  const o = await findOrder(req.params.id);
  if (!o) throw notFound('Pesanan tidak ditemukan.', 'ORDER_NOT_FOUND');
  if (o.status === 'PACKED') {
    // Semua item sudah discan (status PACKED): bedakan item berlebih vs item asing
    const inOrder = (await pool.query(
      `SELECT 1 FROM erp.ecommerce_order_items i JOIN erp.sku_variants v ON v.id = i.sku_variant_id WHERE i.order_id = $1 AND v.barcode = $2`,
      [o.id, barcode])).rowCount;
    throw inOrder ? new AppError(422, 'ITEM_COMPLETE', 'Item ini sudah lengkap untuk pesanan.') : new AppError(422, 'NOT_IN_ORDER', 'Item tidak ada di pesanan ini.');
  }
  const r = await withTx(req.user!.id, async (c) => {
    const s = (await c.query(`SELECT erp.fn_ecom_scan($1, $2) AS r`, [o.id, barcode])).rows[0].r;
    const done = !(await c.query(`SELECT 1 FROM erp.ecommerce_order_items WHERE order_id = $1 AND qty_scanned < qty`, [o.id])).rowCount;
    if (done) await c.query(`UPDATE erp.ecommerce_orders SET status = 'PACKED', packed_by = $2 WHERE id = $1 AND status IN ('IMPORTED','ON_HOLD')`, [o.id, req.user!.id]);
    return { order_no: s.order, barcode, scanned: s.scanned, required: s.required, scan_complete: done };
  });
  res.json({ status: 'OK', ...r, order: await orderDetail(o.id) });
}));

// PATCH /fulfillment/orders/{id}/ship — kirim dengan nomor resi (fn_ship_ecom_order)
fulfillmentRouter.patch('/fulfillment/orders/:id/ship', ECOM_WRITE, ah(async (req, res) => {
  const awb = String(req.body?.awb_no ?? req.body?.awb ?? req.body?.tracking_no ?? '').trim();
  if (!awb) throw new AppError(422, 'AWB_REQUIRED', 'Nomor resi wajib diisi.');
  const o = await findOrder(req.params.id);
  if (!o) throw notFound('Pesanan tidak ditemukan.', 'ORDER_NOT_FOUND');
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_ship_ecom_order($1, $2, $3)`, [o.id, req.user!.id, awb]));
  res.json({ status: 'OK', message: `Pesanan ${o.external_order_no} dikirim.`, order: await orderDetail(o.id) });
}));

// GET /fulfillment/orders/{id}/packing-list.pdf
fulfillmentRouter.get('/fulfillment/orders/:id/packing-list.pdf', ECOM_READ, ah(async (req, res) => {
  const f = await findOrder(req.params.id);
  if (!f) throw notFound('Pesanan tidak ditemukan.', 'ORDER_NOT_FOUND');
  const o = (await orderDetail(f.id))!;
  const qr = await QRCode.toBuffer(o.order_no, { margin: 1, width: 160 });
  await sendPdf(res, `packing-list-${o.order_no}.pdf`, (doc) => {
    doc.font('Helvetica-Bold').fontSize(15).text('PACKING LIST', 40, 40);
    doc.font('Helvetica').fontSize(10)
      .text(`No. Pesanan : ${o.order_no}`).text(`Kanal / Toko: ${o.channel_name} / ${o.store_name}`)
      .text(`Pembeli     : ${o.buyer_name ?? '-'}`).text(`No. Resi    : ${o.awb_no ?? '-'}`)
      .text(`Status      : ${o.status}`).text(`Diimpor     : ${fmtDate(o.imported_at)}`);
    doc.image(qr, doc.page.width - 40 - 90, 40, { width: 90 });
    doc.moveDown();
    pdfTable(doc, [
      { label: 'No', width: 28, align: 'right' }, { label: 'Barcode', width: 140 }, { label: 'Nama Barang', width: 150 },
      { label: 'Size', width: 45 }, { label: 'Warna', width: 70 }, { label: 'Qty', width: 40, align: 'right' }, { label: 'Cek', width: 42, align: 'center' },
    ], o.items.map((i: any, n: number) => [String(n + 1), i.barcode ?? i.sku_code, i.sku_name, i.size, i.color, fmtNum(i.qty), i.complete ? 'OK' : '[  ]']));
    doc.moveDown(0.5).font('Helvetica-Bold').text(`Total: ${fmtNum(o.total_qty)} pcs`, { align: 'right' });
  });
}));
