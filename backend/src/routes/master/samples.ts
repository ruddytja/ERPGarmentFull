// FR-01.4 Sample & Prototyping Room — request, konsumsi material, waktu operasi, status, konversi ke BOM
import express from 'express';
import { PoolClient } from 'pg';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, conflict, num, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { decimals, listResult, materialFromInput, resolveOperation, resolveSample, resolveSku, str } from './common.ts';

export const samplesRouter = express.Router();

// Admin R+A, Founder/Finance R, Supervisor CRU, Staff C (input konsumsi/waktu; baca terbatas untuk memilih sampel)
const SAMPLE_READ = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: '*' });
const SAMPLE_INPUT = allow('SUPERVISOR', { staff: '*' });
const OPEN_STATUSES = ['REQUESTED', 'IN_PROGRESS', 'REVISION'];

const SAMPLE_SELECT = `
  SELECT sm.*, s.code AS sku, coalesce(s.name, sm.proposed_name) AS display_name,
         ru.full_name AS requested_by_name, du.full_name AS decided_by_name,
         (SELECT b.id FROM erp.boms b WHERE b.source_sample_id = sm.id ORDER BY b.id DESC LIMIT 1) AS converted_bom_id
  FROM erp.samples sm
  LEFT JOIN erp.skus s ON s.id = sm.sku_id
  JOIN erp.users ru ON ru.id = sm.requested_by
  LEFT JOIN erp.users du ON du.id = sm.decided_by`;

async function sampleDetail(id: number, user: any) {
  const s = await queryOne(`${SAMPLE_SELECT} WHERE sm.id = $1`, [id]);
  const cons = await query(
    `SELECT sm.id, sm.moved_at, m.id AS material_id, m.code, m.name, m.uom, l.lot_no, -sm.qty AS qty, sm.unit_cost,
            round(-sm.qty * sm.unit_cost, 2) AS cost, u.full_name AS recorded_by
     FROM erp.stock_movements sm JOIN erp.materials m ON m.id = sm.material_id JOIN erp.material_lots l ON l.id = sm.lot_id
     LEFT JOIN erp.users u ON u.id = sm.user_id
     WHERE sm.ref_table = 'samples' AND sm.ref_id = $1 AND sm.movement_type = 'ISSUE_SAMPLE' ORDER BY sm.moved_at, sm.id`, [id]);
  const logs = await query(
    `SELECT g.id, g.operation_id, o.code, o.name, o.smv_minutes AS standard_smv, g.minutes, g.operator_id, u.full_name AS operator_name, u.operator_code
     FROM erp.sample_operation_logs g JOIN erp.operations o ON o.id = g.operation_id LEFT JOIN erp.users u ON u.id = g.operator_id
     WHERE g.sample_id = $1 ORDER BY g.id`, [id]);
  const cost = canSeeCost(user);
  return {
    ...s,
    consumptions: cost ? cons : cons.map(({ unit_cost, cost: _c, ...r }) => r),
    ...(cost ? { total_material_cost: Math.round(cons.reduce((a, r) => a + Number(r.cost), 0) * 100) / 100 } : {}),
    operation_logs: logs,
    total_minutes: Math.round(logs.reduce((a, r) => a + Number(r.minutes), 0) * 100) / 100,
  };
}

// GET /samples?status=&sku=&q=
samplesRouter.get('/samples', SAMPLE_READ, ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const skuId = q.sku ? await resolveSku(q.sku) : null;
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS _total FROM (${SAMPLE_SELECT}) x
     WHERE ($1::text IS NULL OR x.status::text = ANY(string_to_array(upper($1), ',')))
       AND ($2::bigint IS NULL OR x.sku_id = $2)
       AND ($3::text IS NULL OR x.sample_no ILIKE '%' || $3 || '%' OR x.display_name ILIKE '%' || $3 || '%')
     ORDER BY x.created_at DESC LIMIT $4 OFFSET $5`, [str(q.status), skuId, str(q.q), p.limit, p.offset]);
  res.json(listResult(rows, p));
}));

samplesRouter.get('/samples/:id', SAMPLE_READ, ah(async (req, res) => {
  res.json(await sampleDetail(await resolveSample(req.params.id), req.user));
}));

// POST /samples — Supervisor membuat Sample Request (SKU eksisting atau nama SKU baru)
samplesRouter.post('/samples', allow('SUPERVISOR'), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['size', 'color']);
  const skuKey = b.sku_id ?? b.sku_code ?? b.sku;
  const skuId = skuKey !== undefined && skuKey !== null && skuKey !== '' ? await resolveSku(skuKey) : null;
  if (!skuId && !str(b.proposed_name)) throw badRequest('Pilih SKU eksisting atau isi proposed_name untuk SKU baru.');
  const id = await withTx(req.user!.id, async (c) => (await c.query(
    `INSERT INTO erp.samples (sample_no, sku_id, proposed_name, size, color, requested_by, notes)
     VALUES (erp.fn_next_doc_no('SMP'), $1, $2, trim($3), trim($4), $5, $6) RETURNING id`,
    [skuId, str(b.proposed_name), b.size, b.color, req.user!.id, str(b.notes)])).rows[0].id);
  res.status(201).json(await sampleDetail(id, req.user));
}));

async function lockOpenSample(c: PoolClient, id: number) {
  const s = (await c.query(`SELECT * FROM erp.samples WHERE id = $1 FOR UPDATE`, [id])).rows[0];
  if (!OPEN_STATUSES.includes(s.status)) {
    throw new AppError(422, 'INVALID_STATUS', `Sampel ${s.sample_no} berstatus ${s.status}; input tidak dapat ditambahkan.`);
  }
  return s;
}

const markInProgress = (c: PoolClient, id: number) =>
  c.query(`UPDATE erp.samples SET status = 'IN_PROGRESS' WHERE id = $1 AND status = 'REQUESTED'`, [id]);

// POST /samples/:id/consumptions — Staff/Supervisor catat material terpakai (memotong stok, kategori ISSUE_SAMPLE).
// Body: { lot_id | (material + lot_no) | material (FIFO otomatis), qty } atau { items: [...] }. qty dalam satuan stok (Kg/pcs).
samplesRouter.post('/samples/:id/consumptions', SAMPLE_INPUT, ah(async (req, res) => {
  const id = await resolveSample(req.params.id);
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [req.body ?? {}];
  if (!items.length) throw badRequest('items wajib diisi.');
  await withTx(req.user!.id, async (c) => {
    await lockOpenSample(c, id);
    for (const [i, it] of items.entries()) {
      const qty = decimals(num(it.qty, `items[${i}].qty`, { gt: 0 }), 3, `items[${i}].qty`);
      let lot: any;
      if (it.lot_id !== undefined) {
        lot = (await c.query(`SELECT l.*, m.name AS material_name FROM erp.material_lots l JOIN erp.materials m ON m.id = l.material_id WHERE l.id = $1 FOR UPDATE OF l`, [it.lot_id])).rows[0];
        if (!lot) throw new AppError(404, 'LOT_NOT_FOUND', `Lot ${it.lot_id} tidak ditemukan.`);
      } else {
        const m = await materialFromInput(it, c);
        if (it.lot_no) {
          lot = (await c.query(`SELECT l.*, $3::text AS material_name FROM erp.material_lots l WHERE l.material_id = $1 AND upper(l.lot_no) = upper($2) FOR UPDATE`, [m.id, it.lot_no, m.name])).rows[0];
          if (!lot) throw new AppError(404, 'LOT_NOT_FOUND', `Lot ${it.lot_no} untuk ${m.name} tidak ditemukan.`);
        } else {
          // FIFO: lot PASS pertama dengan stok bebas cukup
          lot = (await c.query(
            `SELECT l.*, $3::text AS material_name FROM erp.material_lots l
             WHERE l.material_id = $1 AND l.qc_status = 'PASS' AND l.qty_on_hand - l.qty_reserved >= $2
             ORDER BY l.received_at, l.id LIMIT 1 FOR UPDATE`, [m.id, qty, m.name])).rows[0];
          if (!lot) throw new AppError(409, 'INSUFFICIENT_STOCK', `Stok ${m.name} tidak mencukupi untuk sampel.`);
        }
      }
      if (lot.qc_status !== 'PASS') throw new AppError(422, 'LOT_NOT_PASS', `Lot ${lot.lot_no} berstatus ${lot.qc_status} dan tidak dapat dipakai.`);
      if (Number(lot.qty_on_hand) - Number(lot.qty_reserved) < qty) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Stok ${lot.material_name} tidak mencukupi untuk sampel.`, {
          lot_no: lot.lot_no, available: Number(lot.qty_on_hand) - Number(lot.qty_reserved), requested: qty });
      }
      await c.query(`SELECT erp.fn_sample_consume($1, $2, $3, $4)`, [id, lot.id, qty, req.user!.id]);
    }
    await markInProgress(c, id);
  });
  res.status(201).json(await sampleDetail(id, req.user));
}));

// POST /samples/:id/operation-logs — waktu per operasi. Body: { operation, minutes, operator_code? } atau { items: [...] }
samplesRouter.post('/samples/:id/operation-logs', SAMPLE_INPUT, ah(async (req, res) => {
  const id = await resolveSample(req.params.id);
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [req.body ?? {}];
  await withTx(req.user!.id, async (c) => {
    await lockOpenSample(c, id);
    for (const [i, it] of items.entries()) {
      const opKey = it.operation_id ?? it.operation_code ?? it.operation;
      if (opKey === undefined) throw badRequest(`items[${i}].operation_id wajib diisi.`);
      const opId = await resolveOperation(opKey, c);
      const minutes = decimals(num(it.minutes, `items[${i}].minutes`, { gt: 0, max: 99999 }), 2, `items[${i}].minutes`);
      let operatorId: number | null = req.user!.role === 'STAFF' ? req.user!.id : null;
      const opr = it.operator_id ?? it.operator_code;
      if (opr !== undefined && opr !== null && opr !== '') {
        const u = (await c.query(`SELECT id, status FROM erp.users WHERE ${/^\d+$/.test(String(opr)) ? 'id = $1::bigint' : 'upper(operator_code) = upper($1)'}`, [String(opr)])).rows[0];
        if (!u || u.status !== 'ACTIVE') throw new AppError(422, 'OPERATOR_INVALID', `ID operator ${opr} tidak terdaftar atau tidak aktif.`);
        operatorId = Number(u.id);
      }
      await c.query(`INSERT INTO erp.sample_operation_logs (sample_id, operation_id, minutes, operator_id) VALUES ($1, $2, $3, $4)`,
        [id, opId, minutes, operatorId]);
    }
    await markInProgress(c, id);
  });
  res.status(201).json(await sampleDetail(id, req.user));
}));

// PATCH /samples/:id/status — Supervisor: APPROVED / REVISION / REJECTED (atau IN_PROGRESS untuk lanjut revisi)
samplesRouter.patch('/samples/:id/status', allow('SUPERVISOR'), ah(async (req, res) => {
  const id = await resolveSample(req.params.id);
  const status = oneOf(String(req.body?.status ?? '').toUpperCase(), ['IN_PROGRESS', 'APPROVED', 'REVISION', 'REJECTED'] as const, 'status');
  await withTx(req.user!.id, async (c) => {
    const s = (await c.query(`SELECT * FROM erp.samples WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!OPEN_STATUSES.includes(s.status)) {
      throw new AppError(422, 'INVALID_STATUS', `Sampel berstatus ${s.status} sudah final dan tidak dapat diubah.`);
    }
    if (s.status === status) throw conflict(`Sampel sudah berstatus ${status}.`, 'INVALID_STATUS');
    if (status === 'REJECTED' || status === 'REVISION') {
      if (!str(req.body?.notes)) throw badRequest('Catatan (notes) wajib diisi untuk status Revisi/Ditolak.', { field: 'notes' });
    }
    if (status === 'APPROVED') {
      const has = (await c.query(`SELECT 1 FROM erp.stock_movements WHERE ref_table = 'samples' AND ref_id = $1 AND movement_type = 'ISSUE_SAMPLE' LIMIT 1`, [id])).rowCount;
      if (!has) throw new AppError(422, 'SAMPLE_NO_CONSUMPTION', 'Sampel belum memiliki catatan konsumsi material.');
    }
    const decided = status !== 'IN_PROGRESS';
    await c.query(
      `UPDATE erp.samples SET status = $2,
              decided_by = CASE WHEN $3 THEN $4::bigint ELSE decided_by END, decided_at = CASE WHEN $3 THEN now() ELSE decided_at END,
              notes = coalesce($5, notes)
       WHERE id = $1`, [id, status, decided, req.user!.id, str(req.body?.notes)]);
  });
  res.json(await sampleDetail(id, req.user));
}));

// POST /samples/:id/convert-to-bom — Admin approve: sampel Approved → BOM Draft (fn_convert_sample_to_bom)
samplesRouter.post('/samples/:id/convert-to-bom', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveSample(req.params.id);
  const b = req.body ?? {};
  const bomId = await withTx(req.user!.id, async (c) => {
    const s = (await c.query(`SELECT * FROM erp.samples WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (s.status !== 'APPROVED') throw new AppError(422, 'INVALID_STATUS', 'Hanya sampel Approved yang dapat dikonversi ke BOM.');
    // SKU baru: Admin boleh menautkan SKU yang sudah didaftarkan saat konversi
    const skuKey = b.sku_id ?? b.sku_code ?? b.sku;
    if (!s.sku_id && skuKey !== undefined) {
      const skuId = await resolveSku(skuKey, c);
      await c.query(`UPDATE erp.samples SET sku_id = $2 WHERE id = $1`, [id, skuId]);
    }
    const done = (await c.query(`SELECT id, version FROM erp.boms WHERE source_sample_id = $1 LIMIT 1`, [id])).rows[0];
    if (done) throw conflict(`Sampel sudah dikonversi ke BOM versi ${done.version} (BOM-${done.id}).`, 'ALREADY_CONVERTED', { bom_id: done.id });
    const has = (await c.query(`SELECT 1 FROM erp.stock_movements WHERE ref_table = 'samples' AND ref_id = $1 AND movement_type = 'ISSUE_SAMPLE' LIMIT 1`, [id])).rowCount;
    if (!has) throw new AppError(422, 'SAMPLE_NO_CONSUMPTION', 'Sampel belum memiliki catatan konsumsi material.');
    return Number((await c.query(`SELECT erp.fn_convert_sample_to_bom($1, $2) AS id`, [id, req.user!.id])).rows[0].id);
  });
  // Usulan SMV dari waktu aktual sampel (draf; operasi tidak diubah otomatis)
  const smv = await query(
    `SELECT o.id AS operation_id, o.code, o.name, o.smv_minutes AS current_smv, round(avg(g.minutes), 3) AS sample_minutes
     FROM erp.sample_operation_logs g JOIN erp.operations o ON o.id = g.operation_id WHERE g.sample_id = $1
     GROUP BY o.id ORDER BY min(g.id)`, [id]);
  const bom = await queryOne(`SELECT id, version, status, sku_id FROM erp.boms WHERE id = $1`, [bomId]);
  res.status(201).json({
    status: 'OK', message: `Draf BOM versi ${bom.version} dibuat dari sampel. Tinjau lalu aktifkan.`,
    bom_id: bom.id, bom_code: `BOM-${bom.id}`, version: bom.version, bom_status: bom.status, smv_suggestions: smv,
  });
}));
