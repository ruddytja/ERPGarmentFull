// FR-03.4 Bundle Ticket Generation — generate bundel, daftar/detail, cetak ulang (Supervisor), label PDF thermal + QR
import express, { Response } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { audit, query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, num, oneOf, paging } from '../../lib/http.ts';
import { allow } from '../../lib/auth.ts';
import { reasonParam, resolveBundle, resolveCutting, resolveWo } from './common.ts';

export const bundlesRouter = express.Router();

const READ = allow('ADMIN', 'FOUNDER', 'SUPERVISOR', { staff: '*' });
const STATUSES = ['CREATED', 'IN_PROGRESS', 'SEWN', 'INSPECTED', 'VOID'] as const;

// Bundel + konteks SPK + operasi berjalan + operasi berikutnya (dipakai juga oleh papan WIP)
export const BUNDLE_SELECT = `
  SELECT b.id, b.bundle_code, b.bundle_code || ':' || b.ticket_version AS qr, b.ticket_version, b.status,
         b.work_order_id, w.wo_no, w.status AS wo_status, s.id AS sku_id, s.code AS sku_code, s.name AS sku_name,
         b.sku_variant_id, v.size, v.color, b.qty, b.seq_no, b.seq_total, b.lot_id, l.lot_no,
         b.cutting_record_id, cr.cut_no, b.is_rework, b.parent_bundle_id, b.root_bundle_id,
         b.rework_operation_id, ro.name AS rework_operation, b.qty_pass, b.qty_packed, b.created_at,
         cur.task_id AS current_task_id, cur.operation AS current_operation, cur.operator_id AS current_operator_id,
         cur.operator_code AS current_operator_code, cur.operator_name AS current_operator_name,
         cur.machine_code AS current_machine, cur.line_code AS current_line, cur.started_at AS current_started_at,
         nx.operation_id AS next_operation_id, nx.name AS next_operation,
         (SELECT count(*) FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.completed_at IS NOT NULL)::int AS ops_done,
         CASE WHEN b.is_rework THEN 1 ELSE (SELECT count(*) FROM erp.sku_routings r WHERE r.sku_id = w.sku_id) END::int AS ops_total
  FROM erp.bundles b
  JOIN erp.work_orders w ON w.id = b.work_order_id
  JOIN erp.skus s ON s.id = w.sku_id
  JOIN erp.sku_variants v ON v.id = b.sku_variant_id
  LEFT JOIN erp.material_lots l ON l.id = b.lot_id
  LEFT JOIN erp.cutting_records cr ON cr.id = b.cutting_record_id
  LEFT JOIN erp.operations ro ON ro.id = b.rework_operation_id
  LEFT JOIN LATERAL (
    SELECT t.id AS task_id, o.name AS operation, t.operator_id, u.operator_code, u.full_name AS operator_name,
           mc.asset_code AS machine_code, pl.code AS line_code, t.started_at, t.line_id
    FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id JOIN erp.users u ON u.id = t.operator_id
    LEFT JOIN erp.machines mc ON mc.id = t.machine_id LEFT JOIN erp.production_lines pl ON pl.id = t.line_id
    WHERE t.bundle_id = b.id AND t.completed_at IS NULL LIMIT 1) cur ON true
  LEFT JOIN LATERAL (
    (SELECT o.id AS operation_id, o.name FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
     WHERE NOT b.is_rework AND r.sku_id = w.sku_id
       AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id)
     ORDER BY r.seq LIMIT 1)
    UNION ALL
    (SELECT o.id, o.name FROM erp.operations o
     WHERE b.is_rework AND o.id = b.rework_operation_id
       AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = o.id))
    LIMIT 1) nx ON true`;

export async function bundleRow(id: number) {
  return queryOne(`${BUNDLE_SELECT} WHERE b.id = $1`, [id]);
}

// ---------------------------------------------------------------------
// Label PDF thermal 58×40 mm (pdfkit + qrcode)
// ---------------------------------------------------------------------
const MM = 72 / 25.4;
const LABEL_W = 58 * MM;
const LABEL_H = 40 * MM;

async function sendLabels(res: Response, bundles: any[], filename: string) {
  const doc = new PDFDocument({ size: [LABEL_W, LABEL_H], margin: 0, autoFirstPage: false, info: { Title: filename, Author: 'Garment ERP' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  for (const b of bundles) {
    doc.addPage({ size: [LABEL_W, LABEL_H], margin: 0 });
    const qr = await QRCode.toBuffer(b.qr, { errorCorrectionLevel: 'M', margin: 0, width: 240 });
    const pad = 2.5 * MM;
    const qrSize = 27 * MM;
    doc.image(qr, pad, pad, { width: qrSize, height: qrSize });
    doc.font('Helvetica-Bold').fontSize(6.5).text(b.qr, pad, pad + qrSize + 1.2 * MM, { width: qrSize, align: 'center', lineBreak: false });
    const x = pad + qrSize + 2 * MM;
    const w = LABEL_W - x - pad;
    let y = pad;
    const row = (label: string, value: string, bold = false, size = 6.5) => {
      doc.font('Helvetica').fontSize(5).fillColor('#000').text(label, x, y, { width: w, lineBreak: false });
      y += 5.5;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(value || '-', x, y, { width: w, lineBreak: false, ellipsis: true });
      y += size + 2;
    };
    row('No SPK', b.wo_no, true, 7.5);
    row('SKU', b.sku_code, true);
    row('Size / Warna', `${b.size} / ${b.color}`, true);
    row('Qty', `${b.qty} pcs`, true, 8);
    row('Lot', b.lot_no ?? '-');
    doc.font('Helvetica-Bold').fontSize(7).text(`Bundel ${b.seq_no}/${b.seq_total}${b.is_rework ? ' · REWORK' : ''}`, x, y, { width: w, lineBreak: false });
    if (b.ticket_version > 1) {
      doc.font('Helvetica').fontSize(4.5).text(`Cetak ulang v${b.ticket_version}`, pad, LABEL_H - pad - 4, { width: LABEL_W - 2 * pad, align: 'right', lineBreak: false });
    }
  }
  doc.end();
}

// POST /work-orders/{id}/bundles — generate dari cutting record (default: semua cutting SPK yang belum dibundel)
bundlesRouter.post('/work-orders/:id/bundles', allow('SUPERVISOR', { staff: ['CUTTING'] }), ah(async (req, res) => {
  const body = req.body ?? {};
  const size = body.bundle_size !== undefined && body.bundle_size !== null ? num(body.bundle_size, 'bundle_size', { int: true, min: 1, max: 100 }) : null;
  const wo = await resolveWo(req.params.id);
  let cuttingIds: number[];
  if (body.cutting_record ?? body.cutting_record_id ?? body.cut_no) {
    const cr = await resolveCutting(body.cutting_record ?? body.cutting_record_id ?? body.cut_no);
    if (cr.work_order_id !== wo.id) throw new AppError(422, 'WO_MISMATCH', `Data cutting ${cr.cut_no} bukan milik ${wo.wo_no}.`);
    cuttingIds = [cr.id];
  } else {
    const rows = await query(
      `SELECT cr.id FROM erp.cutting_records cr WHERE cr.work_order_id = $1
         AND NOT EXISTS (SELECT 1 FROM erp.bundles b WHERE b.cutting_record_id = cr.id) ORDER BY cr.id`, [wo.id]);
    if (!rows.length) {
      const any = await queryOne(`SELECT 1 FROM erp.cutting_records WHERE work_order_id = $1 LIMIT 1`, [wo.id]);
      throw any
        ? new AppError(422, 'ALREADY_GENERATED', 'Bundel untuk hasil cutting ini sudah dibuat. Gunakan cetak ulang.')
        : new AppError(422, 'NO_CUTTING', `${wo.wo_no} belum memiliki data cutting.`);
    }
    cuttingIds = rows.map((r) => r.id);
  }
  const generated = await withTx(req.user!.id, async (c) => {
    let n = 0;
    for (const id of cuttingIds) n += (await c.query(`SELECT erp.fn_generate_bundles($1, $2, $3) AS n`, [id, req.user!.id, size])).rows[0].n;
    return n;
  });
  const bundles = await query(`${BUNDLE_SELECT} WHERE b.cutting_record_id = ANY($1::bigint[]) ORDER BY b.id`, [cuttingIds]);
  const base = `/api/v1/work-orders/${encodeURIComponent(wo.wo_no)}/bundles/labels.pdf`;
  res.status(201).json({
    wo_no: wo.wo_no, generated, total_qty: bundles.reduce((a, b) => a + b.qty, 0),
    label_pdf_url: `${base}?cutting=${cuttingIds.join(',')}`, data: bundles,
  });
}));

// GET /work-orders/{id}/bundles/labels.pdf?cutting=1,2&status= — semua label bundel SPK (default: bundel aktif non-VOID)
bundlesRouter.get('/work-orders/:id/bundles/labels.pdf', allow('ADMIN', 'FOUNDER', 'SUPERVISOR', { staff: ['CUTTING'] }), ah(async (req, res) => {
  const wo = await resolveWo(req.params.id);
  const params: unknown[] = [wo.id];
  let extra = ` AND b.status <> 'VOID'`;
  if (req.query.cutting) {
    const ids = String(req.query.cutting).split(',').map((x) => num(x, 'cutting', { int: true }));
    params.push(ids); extra += ` AND b.cutting_record_id = ANY($2::bigint[])`;
  }
  const rows = await query(`${BUNDLE_SELECT} WHERE b.work_order_id = $1 ${extra} ORDER BY b.is_rework, b.id`, params);
  if (!rows.length) throw new AppError(404, 'BUNDLE_NOT_FOUND', `${wo.wo_no} belum memiliki bundel.`);
  await sendLabels(res, rows, `label-${wo.wo_no}.pdf`);
}));

// GET /bundles?wo=&status=&cutting=&rework=
bundlesRouter.get('/bundles', READ, ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.wo) { params.push((await resolveWo(req.query.wo)).id); where.push(`b.work_order_id = $${params.length}`); }
  if (req.query.status) {
    const list = String(req.query.status).toUpperCase().split(',').map((s) => oneOf(s.trim(), STATUSES, 'status'));
    params.push(list); where.push(`b.status = ANY($${params.length}::erp.bundle_status[])`);
  }
  if (req.query.cutting) { params.push((await resolveCutting(req.query.cutting)).id); where.push(`b.cutting_record_id = $${params.length}`); }
  if (req.query.rework === 'true') where.push('b.is_rework');
  if (req.query.rework === 'false') where.push('NOT b.is_rework');
  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${BUNDLE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) x
     ORDER BY x.work_order_id DESC, x.is_rework, x.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows.map(({ total, ...r }) => r), page, limit, total: rows[0]?.total ?? 0 });
}));

// GET /bundles/resolve?qr= — input manual nomor bundel / hasil scan QR (validasi versi tiket)
bundlesRouter.get('/bundles/resolve', READ, ah(async (req, res) => {
  const qr = String(req.query.qr ?? req.query.code ?? '').trim();
  if (!qr) throw badRequest('Isi kode bundel atau QR.', { field: 'qr' });
  const b = await queryOne(`SELECT (erp.fn_resolve_ticket($1)).id AS id`, [qr]);
  const row = await bundleRow(b!.id);
  const smv = row.next_operation_id ? await queryOne(`SELECT smv_minutes FROM erp.operations WHERE id = $1`, [row.next_operation_id]) : null;
  res.json({ ...row, next_target_minutes: smv ? Math.round(smv.smv_minutes * row.qty * 10) / 10 : null,
    suggested_action: row.current_task_id ? 'COMPLETE' : row.next_operation_id ? 'START' : null });
}));

// GET /bundles/{id}
bundlesRouter.get('/bundles/:id', READ, ah(async (req, res) => {
  const b = await resolveBundle(req.params.id);
  const row = await bundleRow(b.id);
  const tasks = await query(
    `SELECT t.id, t.operation_id, o.code AS operation_code, o.name AS operation, t.operator_id, u.operator_code, u.full_name AS operator_name,
            mc.asset_code AS machine, pl.code AS line, t.qty, t.started_at, t.completed_at, t.duration_min,
            round(o.smv_minutes * t.qty, 2) AS standard_min, t.is_anomaly, t.anomaly_accepted, t.source, t.correction_reason
     FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id JOIN erp.users u ON u.id = t.operator_id
     LEFT JOIN erp.machines mc ON mc.id = t.machine_id LEFT JOIN erp.production_lines pl ON pl.id = t.line_id
     WHERE t.bundle_id = $1 ORDER BY t.started_at`, [b.id]);
  const prints = await query(
    `SELECT p.version, p.printed_at, p.printed_by, u.full_name AS printed_by_name, p.reason
     FROM erp.bundle_prints p JOIN erp.users u ON u.id = p.printed_by WHERE p.bundle_id = $1 ORDER BY p.version`, [b.id]);
  const qc = await queryOne(`SELECT id, inspected_at, qty_pass, qty_rework, qty_reject, rework_bundle_id FROM erp.qc_inspections WHERE bundle_id = $1`, [b.id]);
  // Operator tidak melihat label anomali (FR-STF-C1)
  const hideAnomaly = req.user!.role === 'STAFF';
  res.json({ ...row, tasks: hideAnomaly ? tasks.map(({ is_anomaly, anomaly_accepted, ...t }) => t) : tasks, prints, qc,
    label_pdf_url: `/api/v1/bundles/${encodeURIComponent(row.bundle_code)}/label.pdf` });
}));

// POST /bundles/{id}/reprint — Supervisor saja, wajib alasan; versi tiket naik, QR lama invalid
bundlesRouter.post('/bundles/:id/reprint', allow('SUPERVISOR'), ah(async (req, res) => {
  const reason = reasonParam(req.body?.reason, 'Alasan cetak ulang wajib diisi.');
  const b = await resolveBundle(req.params.id);
  const qr = await withTx(req.user!.id, async (c) => {
    const r = (await c.query(`SELECT erp.fn_reprint_bundle($1, $2, $3) AS qr`, [b.bundle_code, req.user!.id, reason])).rows[0].qr;
    await audit({ userId: req.user!.id, action: 'REPRINT', entity: 'bundles', entityId: b.id,
      note: `Cetak ulang ${b.bundle_code} v${b.ticket_version} → ${r}: ${reason}`, ip: req.ip,
      oldValue: { ticket_version: b.ticket_version }, newValue: { qr: r } }, c);
    return r;
  });
  const row = await bundleRow(b.id);
  res.json({ ...row, qr, previous_qr: `${b.bundle_code}:${b.ticket_version}`, label_pdf_url: `/api/v1/bundles/${encodeURIComponent(b.bundle_code)}/label.pdf` });
}));

// GET /bundles/{id}/label.pdf — label tunggal (versi tiket terkini)
bundlesRouter.get('/bundles/:id/label.pdf', allow('ADMIN', 'FOUNDER', 'SUPERVISOR', { staff: ['CUTTING'] }), ah(async (req, res) => {
  const b = await resolveBundle(req.params.id);
  if (b.status === 'VOID') throw new AppError(422, 'BUNDLE_VOID', 'Bundel ini sudah dibatalkan.');
  await sendLabels(res, [await bundleRow(b.id)], `label-${b.bundle_code}.pdf`);
}));
