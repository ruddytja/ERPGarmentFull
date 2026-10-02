// FR-03.2 Cutting Yield & Scrap Calculator (Weight-Based) — input gelar/potong, koreksi Supervisor, laporan yield
import express from 'express';
import { PoolClient } from 'pg';
import { audit, query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, num, paging } from '../../lib/http.ts';
import { allow } from '../../lib/auth.ts';
import { dateParam, resolveCutting, resolveWo } from './common.ts';

export const cuttingRouter = express.Router();

const READ = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: ['CUTTING'] });

const CUT_SELECT = `
  SELECT cr.id, cr.cut_no, cr.work_order_id, w.wo_no, w.sku_id, s.code AS sku_code, s.name AS sku_name,
         cr.lot_id, l.lot_no, m.code AS material_code, m.name AS material_name,
         cr.spread_kg, cr.cut_pcs, cr.scrap_kg, cr.yield_pcs_per_kg, cr.net_gram_per_pcs, cr.scrap_rate_pct,
         cr.bom_gram_per_pcs, cr.variance_pct, cr.variance_note,
         abs(cr.variance_pct) > erp.fn_setting_num('cutting_variance_pct', 5) AS variance_flag,
         cr.cut_by, u.full_name AS cut_by_name, cr.cut_at,
         (SELECT count(*) FROM erp.bundles b WHERE b.cutting_record_id = cr.id)::int AS bundle_count
  FROM erp.cutting_records cr
  JOIN erp.work_orders w ON w.id = cr.work_order_id
  JOIN erp.skus s ON s.id = w.sku_id
  JOIN erp.material_lots l ON l.id = cr.lot_id
  JOIN erp.materials m ON m.id = l.material_id
  LEFT JOIN erp.users u ON u.id = cr.cut_by`;

async function cutLines(id: number) {
  return query(
    `SELECT crl.sku_variant_id, v.size, v.color, crl.qty FROM erp.cutting_record_lines crl
     JOIN erp.sku_variants v ON v.id = crl.sku_variant_id WHERE crl.cutting_record_id = $1 ORDER BY v.size_order, v.color`, [id]);
}

/** Lot kain utama SPK: id atau lot_no. Bila kosong & hanya ada satu alokasi kain utama aktif, dipakai otomatis. */
async function resolveFabricLot(ref: unknown, wo: any, c: PoolClient) {
  const v = ref === undefined || ref === null ? '' : String(ref).trim();
  const base = `SELECT l.id, l.lot_no, l.material_id FROM erp.material_lots l
                WHERE EXISTS (SELECT 1 FROM erp.bom_lines bl WHERE bl.bom_id = $1 AND bl.material_id = l.material_id AND bl.is_main_fabric)`;
  if (!v) {
    const rows = (await c.query(`${base} AND EXISTS (SELECT 1 FROM erp.material_allocations a WHERE a.work_order_id = $2 AND a.lot_id = l.id AND a.status = 'RESERVED')`,
      [wo.bom_id, wo.id])).rows;
    if (rows.length === 1) return rows[0];
    throw badRequest('Lot kain wajib dipilih.', { field: 'lot', candidates: rows.map((r) => r.lot_no) });
  }
  if (/^\d+$/.test(v)) {
    const r = (await c.query(`SELECT id, lot_no, material_id FROM erp.material_lots WHERE id = $1`, [v])).rows[0];
    if (!r) throw new AppError(404, 'LOT_NOT_FOUND', `Lot ${v} tidak ditemukan.`);
    return r;
  }
  // lot_no unik per material → utamakan kain utama BOM SPK ini
  const main = (await c.query(`${base} AND upper(l.lot_no) = upper($2)`, [wo.bom_id, v])).rows[0];
  if (main) return main;
  const any = (await c.query(`SELECT id, lot_no, material_id FROM erp.material_lots WHERE upper(lot_no) = upper($1) LIMIT 1`, [v])).rows[0];
  if (!any) throw new AppError(404, 'LOT_NOT_FOUND', `Lot ${v} tidak ditemukan.`);
  return any; // fn_record_cutting akan menolak dengan LOT_MISMATCH
}

/** Bagi total pcs ke baris SPK secara proporsional terhadap sisa target (metode sisa terbesar). */
async function distribute(woId: number, total: number, c: PoolClient) {
  const rows = (await c.query(
    `SELECT wl.sku_variant_id, wl.target_qty,
            greatest(wl.target_qty - coalesce((SELECT sum(crl.qty) FROM erp.cutting_record_lines crl JOIN erp.cutting_records cr ON cr.id = crl.cutting_record_id
                                                WHERE cr.work_order_id = wl.work_order_id AND crl.sku_variant_id = wl.sku_variant_id), 0), 0)::int AS remaining
     FROM erp.work_order_lines wl JOIN erp.sku_variants v ON v.id = wl.sku_variant_id
     WHERE wl.work_order_id = $1 ORDER BY v.size_order, v.color`, [woId])).rows;
  if (!rows.length) throw new AppError(422, 'EMPTY', 'SPK belum memiliki baris qty.');
  const sumRem = rows.reduce((a, r) => a + r.remaining, 0);
  const weights = rows.map((r) => (sumRem > 0 ? r.remaining : r.target_qty));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sumW);
  const alloc = raw.map(Math.floor);
  let left = total - alloc.reduce((a, b) => a + b, 0);
  raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => { if (left > 0) { alloc[i]++; left--; } });
  return rows.map((r, i) => ({ sku_variant_id: r.sku_variant_id, qty: alloc[i] })).filter((x) => x.qty > 0);
}

async function parseCutLines(raw: unknown, wo: any, c: PoolClient) {
  if (!Array.isArray(raw) || !raw.length) throw badRequest('Isi qty hasil potong per size/warna.', { field: 'lines' });
  const out: { sku_variant_id: number; qty: number }[] = [];
  for (const [i, l] of raw.entries()) {
    const qty = num(l?.qty, `lines[${i}].qty`, { int: true, gt: 0 });
    let vid: number | null = null;
    if (l?.sku_variant_id != null) vid = num(l.sku_variant_id, `lines[${i}].sku_variant_id`, { int: true });
    else if (l?.size && l?.color) {
      vid = (await c.query(`SELECT id FROM erp.sku_variants WHERE sku_id = $1 AND upper(size) = upper($2) AND upper(color) = upper($3)`,
        [wo.sku_id, String(l.size).trim(), String(l.color).trim()])).rows[0]?.id ?? null;
    }
    if (!vid) throw new AppError(422, 'VARIANT_MISMATCH', `Varian pada baris ${i + 1} tidak sesuai SPK.`, { index: i });
    out.push({ sku_variant_id: vid, qty });
  }
  return out;
}

function cutOut(r: any) {
  // Urutan & nama field sesuai contoh respons FRD FR-03.2
  return {
    yield_pcs_per_kg: r.yield_pcs_per_kg, net_gram_per_pcs: r.net_gram_per_pcs, scrap_rate_pct: r.scrap_rate_pct,
    bom_gram_per_pcs: r.bom_gram_per_pcs, variance_pct: r.variance_pct,
    id: r.id, cut_no: r.cut_no, work_order: r.wo_no, lot: r.lot_no, spread_kg: r.spread_kg, cut_pcs: r.cut_pcs, scrap_kg: r.scrap_kg,
    variance_flag: r.variance_flag, variance_note: r.variance_note,
  };
}

// POST /cutting-records — Staff Cutting / Supervisor → fn_record_cutting
cuttingRouter.post('/cutting-records', allow('SUPERVISOR', { staff: ['CUTTING'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  const spread = num(b.spread_kg, 'spread_kg', { gt: 0, max: 100000 });
  const scrap = num(b.scrap_kg ?? 0, 'scrap_kg', { min: 0 });
  if (scrap >= spread) throw new AppError(422, 'INVALID_SCRAP', 'Berat scrap tidak valid.');
  const note = typeof (b.note ?? b.variance_note) === 'string' ? String(b.note ?? b.variance_note).trim() : null;

  const id = await withTx(req.user!.id, async (c) => {
    const wo = await resolveWo(b.work_order ?? b.work_order_id ?? b.wo, c);
    if (wo.status !== 'ACTIVE') throw new AppError(422, 'WO_NOT_ACTIVE', `${wo.wo_no} belum Active.`);
    const lot = await resolveFabricLot(b.lot ?? b.lot_id ?? b.lot_no, wo, c);
    let lines: { sku_variant_id: number; qty: number }[];
    if (b.lines !== undefined) {
      lines = await parseCutLines(b.lines, wo, c);
      const sum = lines.reduce((a, l) => a + l.qty, 0);
      if (b.cut_pcs !== undefined && num(b.cut_pcs, 'cut_pcs', { int: true }) !== sum) {
        throw badRequest(`cut_pcs (${b.cut_pcs}) tidak sama dengan total qty per size/warna (${sum}).`, { field: 'cut_pcs' });
      }
    } else {
      const total = num(b.cut_pcs, 'cut_pcs', { int: true, gt: 0 });
      lines = await distribute(wo.id, total, c);
    }
    return (await c.query(`SELECT erp.fn_record_cutting($1, $2, $3, $4, $5::jsonb, $6, $7) AS id`,
      [wo.id, lot.id, spread, scrap, JSON.stringify(lines), req.user!.id, note || null])).rows[0].id;
  });
  const row = await queryOne(`${CUT_SELECT} WHERE cr.id = $1`, [id]);
  res.status(201).json({ ...cutOut(row), lines: await cutLines(id) });
}));

// GET /cutting-records?wo=&from=&to=
cuttingRouter.get('/cutting-records', READ, ah(async (req, res) => {
  const { limit, offset, page } = paging(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.wo) { params.push((await resolveWo(req.query.wo)).id); where.push(`cr.work_order_id = $${params.length}`); }
  const from = dateParam(req.query.from, 'from'); const to = dateParam(req.query.to, 'to');
  if (from) { params.push(from); where.push(`erp.fn_wib_date(cr.cut_at) >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`erp.fn_wib_date(cr.cut_at) <= $${params.length}::date`); }
  if (req.query.flagged === 'true') where.push(`abs(cr.variance_pct) > erp.fn_setting_num('cutting_variance_pct', 5)`);
  params.push(limit, offset);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS total FROM (${CUT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) x
     ORDER BY x.cut_at DESC, x.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  const data = [];
  for (const { total, ...r } of rows) data.push({ ...r, lines: await cutLines(r.id) });
  res.json({ data, page, limit, total: rows[0]?.total ?? 0 });
}));

// GET /cutting-records/{id}
cuttingRouter.get('/cutting-records/:id', READ, ah(async (req, res) => {
  const cr = await resolveCutting(req.params.id);
  const row = await queryOne(`${CUT_SELECT} WHERE cr.id = $1`, [cr.id]);
  res.json({ ...row, lines: await cutLines(cr.id) });
}));

// PATCH /cutting-records/{id} — koreksi Supervisor. Berat/qty sudah memotong stok (ledger immutable),
// jadi yang dapat dikoreksi di sini hanya catatan variance (penyebab). Koreksi berat → stock adjustment.
cuttingRouter.patch('/cutting-records/:id', allow('SUPERVISOR'), ah(async (req, res) => {
  const b = req.body ?? {};
  const blocked = ['spread_kg', 'scrap_kg', 'cut_pcs', 'lines', 'lot', 'work_order'].filter((k) => b[k] !== undefined);
  if (blocked.length) {
    throw new AppError(422, 'CORRECTION_NOT_ALLOWED',
      'Berat dan qty cutting sudah memotong stok dan tidak dapat diubah. Gunakan stock adjustment untuk koreksi berat.', { fields: blocked });
  }
  const note = typeof (b.variance_note ?? b.note) === 'string' ? String(b.variance_note ?? b.note).trim() : '';
  const cr = await resolveCutting(req.params.id);
  const thr = (await queryOne(`SELECT erp.fn_setting_num('cutting_variance_pct', 5) AS t`))!.t;
  if (!note && Math.abs(cr.variance_pct) > thr) {
    throw new AppError(422, 'VARIANCE_NOTE_REQUIRED', `Variance ${cr.variance_pct}% melebihi ±${thr}% dari BOM. Isi catatan penyebab.`);
  }
  await withTx(req.user!.id, async (c) => {
    await c.query(`UPDATE erp.cutting_records SET variance_note = $2 WHERE id = $1`, [cr.id, note || null]);
    await audit({ userId: req.user!.id, action: 'UPDATE', entity: 'cutting_records', entityId: cr.id, note: 'Koreksi catatan variance oleh Supervisor',
      oldValue: { variance_note: cr.variance_note }, newValue: { variance_note: note || null }, ip: req.ip }, c);
  });
  const row = await queryOne(`${CUT_SELECT} WHERE cr.id = $1`, [cr.id]);
  res.json({ ...row, lines: await cutLines(cr.id) });
}));

// GET /reports/cutting-yield?from=&to=&wo=&sku=
cuttingRouter.get('/reports/cutting-yield', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const from = dateParam(req.query.from, 'from'); const to = dateParam(req.query.to, 'to');
  if (from) { params.push(from); where.push(`erp.fn_wib_date(cr.cut_at) >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`erp.fn_wib_date(cr.cut_at) <= $${params.length}::date`); }
  if (req.query.wo) { params.push((await resolveWo(req.query.wo)).id); where.push(`cr.work_order_id = $${params.length}`); }
  if (req.query.sku) { params.push(String(req.query.sku)); where.push(`(s.code = upper($${params.length}) OR s.id::text = $${params.length})`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const records = await query(`${CUT_SELECT} ${w} ORDER BY cr.cut_at DESC LIMIT 1000`, params);
  const bySku = await query(
    `SELECT s.id AS sku_id, s.code AS sku_code, s.name AS sku_name, count(*)::int AS records,
            sum(cr.spread_kg) AS spread_kg, sum(cr.cut_pcs)::int AS cut_pcs, sum(cr.scrap_kg) AS scrap_kg,
            round(sum(cr.cut_pcs) / nullif(sum(cr.spread_kg), 0), 3) AS yield_pcs_per_kg,
            round((sum(cr.spread_kg) - sum(cr.scrap_kg)) / nullif(sum(cr.cut_pcs), 0) * 1000, 2) AS net_gram_per_pcs,
            round(sum(cr.scrap_kg) / nullif(sum(cr.spread_kg), 0) * 100, 2) AS scrap_rate_pct,
            round(sum(cr.bom_gram_per_pcs * cr.cut_pcs) / nullif(sum(cr.cut_pcs), 0), 2) AS bom_gram_per_pcs,
            round(((sum(cr.spread_kg) - sum(cr.scrap_kg)) / nullif(sum(cr.cut_pcs), 0) * 1000
                   - sum(cr.bom_gram_per_pcs * cr.cut_pcs) / nullif(sum(cr.cut_pcs), 0))
                  / nullif(sum(cr.bom_gram_per_pcs * cr.cut_pcs) / nullif(sum(cr.cut_pcs), 0), 0) * 100, 2) AS variance_pct,
            count(*) FILTER (WHERE abs(cr.variance_pct) > erp.fn_setting_num('cutting_variance_pct', 5))::int AS flagged_records
     FROM erp.cutting_records cr JOIN erp.work_orders wo ON wo.id = cr.work_order_id JOIN erp.skus s ON s.id = wo.sku_id
     ${w} GROUP BY s.id ORDER BY s.code`, params);
  const t = records.reduce((a, r) => ({ spread: a.spread + r.spread_kg, pcs: a.pcs + r.cut_pcs, scrap: a.scrap + r.scrap_kg, flagged: a.flagged + (r.variance_flag ? 1 : 0) }),
    { spread: 0, pcs: 0, scrap: 0, flagged: 0 });
  const r2 = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  res.json({
    from, to,
    summary: {
      records: records.length, spread_kg: r2(t.spread, 3), cut_pcs: t.pcs, scrap_kg: r2(t.scrap, 3),
      yield_pcs_per_kg: t.spread ? r2(t.pcs / t.spread, 3) : null,
      net_gram_per_pcs: t.pcs ? r2(((t.spread - t.scrap) / t.pcs) * 1000) : null,
      scrap_rate_pct: t.spread ? r2((t.scrap / t.spread) * 100) : null,
      flagged_records: t.flagged,
    },
    by_sku: bySku,
    data: records,
  });
}));
