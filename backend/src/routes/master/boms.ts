// FR-01.1 Bill of Materials (BOM) Berbasis Berat — versi, aktivasi, kebutuhan material, HPP estimasi
import express from 'express';
import { PoolClient } from 'pg';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, notFound, num, oneOf, paging } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { decimals, materialFromInput, resolveBrand, resolveSku, str } from './common.ts';

export const bomsRouter = express.Router();

// BOM: Admin CRUD, Founder/Finance R (dengan harga), Supervisor R (tanpa harga), Staff —
const BOM_READ = allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR');
const UNITS = ['GRAM', 'PCS', 'CM'] as const;
// Satuan BOM harus cocok dengan satuan stok material (GRAM→Kg, PCS→pcs, CM→m)
const UNIT_UOM: Record<string, string> = { GRAM: 'KG', PCS: 'PCS', CM: 'M' };
const DEFAULT_UNIT: Record<string, string> = { KG: 'GRAM', PCS: 'PCS', M: 'CM' };

/**
 * `{id}` BOM menerima: id numerik / "BOM-12", atau kode SKU ("NQL-BRF-001" / "BOM-NQL-BRF-001").
 * Untuk kode SKU dipilih ?version=, lalu BOM Active (atau Draft terbaru bila prefer='draft'), lalu versi terbaru.
 */
async function resolveBom(raw: string, opts: { version?: unknown; prefer?: 'active' | 'draft' } = {}, c?: PoolClient) {
  const run = async (sql: string, p: unknown[]) => (c ? (await c.query(sql, p)).rows[0] : await queryOne(sql, p)) ?? null;
  const v = String(raw ?? '').trim();
  let skuId: number | null = null;
  let bom: any = null;
  const m = v.match(/^(?:BOM-)?(\d+)$/i);
  if (m) bom = await run(`SELECT * FROM erp.boms WHERE id = $1`, [Number(m[1])]);
  if (!bom) {
    const sku = (await run(`SELECT id FROM erp.skus WHERE upper(code) = upper($1)`, [v]))
      ?? (await run(`SELECT id FROM erp.skus WHERE upper(code) = upper($1)`, [v.replace(/^BOM-/i, '')]));
    if (!sku) throw notFound(`BOM ${v} tidak ditemukan.`, 'BOM_NOT_FOUND');
    skuId = Number(sku.id);
  } else skuId = Number(bom.sku_id);

  const ver = opts.version !== undefined && opts.version !== '' ? num(opts.version, 'version', { int: true, gt: 0 }) : null;
  if (ver !== null) {
    bom = await run(`SELECT * FROM erp.boms WHERE sku_id = $1 AND version = $2`, [skuId, ver]);
    if (!bom) throw notFound(`BOM versi ${ver} tidak ditemukan.`, 'BOM_NOT_FOUND');
  } else if (!m || !bom) {
    const order = opts.prefer === 'draft' ? `(status = 'DRAFT') DESC, (status = 'ACTIVE') DESC` : `(status = 'ACTIVE') DESC`;
    bom = await run(`SELECT * FROM erp.boms WHERE sku_id = $1 ORDER BY ${order}, version DESC LIMIT 1`, [skuId]);
    if (!bom) throw notFound('SKU belum memiliki BOM.', 'BOM_NOT_FOUND');
  }
  return bom;
}

// ---------------------------------------------------------------------
// Detail BOM: baris per size, shrinkage efektif, HPP estimasi (hanya untuk canSeeCost)
// ---------------------------------------------------------------------
async function bomDetail(bomId: number, user: any) {
  const b = await queryOne(
    `SELECT b.*, s.code AS sku, s.name AS sku_name, br.code AS brand_code, br.name AS brand_name,
            u.full_name AS created_by_name, sm.sample_no AS source_sample_no
     FROM erp.boms b JOIN erp.skus s ON s.id = b.sku_id JOIN erp.brands br ON br.id = s.brand_id
     LEFT JOIN erp.users u ON u.id = b.created_by LEFT JOIN erp.samples sm ON sm.id = b.source_sample_id
     WHERE b.id = $1`, [bomId]);
  const lines = await query(
    `SELECT bl.id, bl.size, bl.material_id, m.code, m.name, m.category, m.uom, bl.qty_per_pcs, bl.qty_unit, bl.is_main_fabric,
            bl.shrinkage_pct AS shrinkage_pct_override,
            coalesce(bl.shrinkage_pct, CASE WHEN m.category = 'FABRIC' THEN m.shrinkage_pct ELSE 0 END) AS shrinkage_pct,
            m.avg_cost, round(erp.fn_bom_qty_to_uom(bl.qty_per_pcs, bl.qty_unit) * m.avg_cost, 2) AS line_cost,
            coalesce((SELECT min(v.size_order) FROM erp.sku_variants v WHERE v.sku_id = $2 AND v.size = bl.size), 999) AS size_order
     FROM erp.bom_lines bl JOIN erp.materials m ON m.id = bl.material_id
     WHERE bl.bom_id = $1 ORDER BY size_order, bl.size, bl.is_main_fabric DESC, m.category, m.code`, [bomId, b.sku_id]);
  const cost = canSeeCost(user);
  const sizes: any[] = [];
  for (const l of lines) {
    let s = sizes.find((x) => x.size === l.size);
    if (!s) sizes.push((s = { size: l.size, lines: [] as any[], _cost: 0, _missing: [] as string[] }));
    s._cost += Number(l.line_cost);
    if (!(Number(l.avg_cost) > 0)) s._missing.push(l.code);
    const { size, size_order, avg_cost, line_cost, ...rest } = l;
    s.lines.push(cost ? { ...rest, avg_cost, line_cost } : rest);
  }
  const usedBy = await query(`SELECT id, wo_no, status FROM erp.work_orders WHERE bom_id = $1 AND status = 'ACTIVE' ORDER BY id`, [bomId]);
  const versions = await query(`SELECT id, version, status, created_at, activated_at FROM erp.boms WHERE sku_id = $1 ORDER BY version DESC`, [b.sku_id]);
  const missingSizes = await query(
    `SELECT DISTINCT v.size, v.size_order FROM erp.sku_variants v WHERE v.sku_id = $1 AND v.status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM erp.bom_lines bl WHERE bl.bom_id = $2 AND bl.size = v.size AND bl.is_main_fabric)
     ORDER BY v.size_order`, [b.sku_id, bomId]);

  const out: any = {
    id: b.id, bom_code: `BOM-${b.id}`, sku_id: b.sku_id, sku: b.sku, sku_name: b.sku_name, brand_code: b.brand_code, brand_name: b.brand_name,
    version: b.version, status: b.status, notes: b.notes, source_sample_id: b.source_sample_id, source_sample_no: b.source_sample_no,
    created_by_name: b.created_by_name, created_at: b.created_at, activated_at: b.activated_at,
    editable: b.status === 'DRAFT', used_by_active_wo: usedBy.map((w) => w.wo_no),
    missing_main_fabric_sizes: missingSizes.map((x) => x.size),
    versions,
    sizes: sizes.map(({ _cost, _missing, ...s }) => {
      if (!cost) return s;
      const complete = _missing.length === 0;
      return { ...s, hpp_material_per_pcs: Math.round(_cost * 100) / 100, hpp_complete: complete,
        hpp_status: complete ? 'Lengkap' : 'Belum lengkap', ...(complete ? {} : { materials_without_price: _missing }) };
    }),
  };
  if (cost) {
    const incomplete = out.sizes.some((s: any) => !s.hpp_complete);
    out.hpp_status = incomplete ? 'Belum lengkap' : 'Lengkap';
  }
  return out;
}

// ---------------------------------------------------------------------
// Validasi baris BOM
// ---------------------------------------------------------------------
async function validateLines(c: PoolClient, skuId: number, lines: any[]) {
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('lines wajib diisi minimal 1 baris material.');
  const sizes = (await c.query(`SELECT DISTINCT size FROM erp.sku_variants WHERE sku_id = $1`, [skuId])).rows.map((r) => r.size as string);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const [i, l] of lines.entries()) {
    const f = `lines[${i}]`;
    if (l?.size === undefined || String(l.size).trim() === '') throw badRequest(`${f}.size wajib diisi.`, { index: i });
    const size = sizes.find((s) => s.toUpperCase() === String(l.size).trim().toUpperCase());
    if (!size) throw new AppError(422, 'SIZE_NOT_FOUND', `Size ${l.size} tidak terdaftar pada varian SKU.`, { index: i });
    const m = await materialFromInput(l, c);
    if (m.status !== 'ACTIVE') throw new AppError(422, 'MATERIAL_INACTIVE', `Material ${m.code} nonaktif.`, { index: i });
    if (m.category === 'SPAREPART') throw new AppError(422, 'INVALID_MATERIAL', `Material ${m.code} adalah spare part, bukan bahan produksi.`, { index: i });
    const qtyRaw = l.qty_per_pcs ?? l.gram_per_pcs ?? l.qty;
    if (qtyRaw === undefined || qtyRaw === null || qtyRaw === '') throw badRequest(`${f}.qty_per_pcs wajib diisi.`, { index: i });
    const qty = decimals(num(qtyRaw, `${f}.qty_per_pcs`, { gt: 0, max: 99999999 }), 2, `${f}.qty_per_pcs`);
    const unit = l.qty_unit !== undefined ? oneOf(String(l.qty_unit).toUpperCase(), UNITS, `${f}.qty_unit`) : DEFAULT_UNIT[m.uom];
    if (!unit || UNIT_UOM[unit] !== m.uom) {
      throw new AppError(422, 'UNIT_MISMATCH', `Satuan ${unit ?? '-'} tidak sesuai untuk material ${m.code} (stok dalam ${m.uom}).`, { index: i });
    }
    let shr: number | null = null;
    if (l.shrinkage_pct !== undefined && l.shrinkage_pct !== null && l.shrinkage_pct !== '') {
      shr = decimals(num(l.shrinkage_pct, `${f}.shrinkage_pct`, { min: 0, max: 20 }), 2, `${f}.shrinkage_pct`);
    }
    const main = l.is_main_fabric === true || l.is_main_fabric === 'true';
    if (main && m.category !== 'FABRIC') throw new AppError(422, 'INVALID_MAIN_FABRIC', `Kain utama harus material kategori kain (${m.code} adalah ${m.category}).`, { index: i });
    const key = `${size}|${m.id}`;
    if (seen.has(key)) throw new AppError(422, 'DUPLICATE_LINE', `Material ${m.code} muncul dua kali untuk size ${size}.`, { index: i });
    seen.add(key);
    out.push({ size, material_id: m.id, qty, unit, main, shr });
  }
  // Setiap size yang diisi wajib punya minimal 1 kain utama
  for (const s of [...new Set(out.map((l) => l.size))]) {
    if (!out.some((l) => l.size === s && l.main)) throw new AppError(422, 'BOM_INCOMPLETE', `Kain utama wajib diisi untuk size ${s}.`, { size: s });
  }
  return out;
}

async function replaceLines(c: PoolClient, bomId: number, lines: any[]) {
  await c.query(`DELETE FROM erp.bom_lines WHERE bom_id = $1`, [bomId]);
  for (const l of lines) {
    await c.query(
      `INSERT INTO erp.bom_lines (bom_id, size, material_id, qty_per_pcs, qty_unit, is_main_fabric, shrinkage_pct) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [bomId, l.size, l.material_id, l.qty, l.unit, l.main, l.shr]);
  }
}

/** BOM non-Draft tidak bisa diubah: pesan FRD bila sedang dipakai SPK Active. */
async function assertEditable(c: PoolClient, bom: any) {
  if (bom.status === 'DRAFT') return;
  const wo = (await c.query(`SELECT wo_no FROM erp.work_orders WHERE bom_id = $1 AND status = 'ACTIVE' LIMIT 1`, [bom.id])).rows[0];
  if (wo) throw new AppError(422, 'BOM_IN_USE', 'BOM digunakan oleh SPK aktif. Buat versi baru.', { work_order: wo.wo_no });
  throw new AppError(422, 'BOM_LOCKED', 'BOM sudah aktif/arsip dan mungkin dipakai SPK. Buat versi baru.');
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
// GET /boms?sku=&brand=&status=
bomsRouter.get('/boms', BOM_READ, ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const skuId = q.sku ?? q.sku_id ? await resolveSku(q.sku ?? q.sku_id) : null;
  const brandId = q.brand ?? q.brand_id ? await resolveBrand(q.brand ?? q.brand_id) : null;
  const rows = await query(
    `SELECT b.id, 'BOM-' || b.id AS bom_code, b.sku_id, s.code AS sku, s.name AS sku_name, br.name AS brand_name,
            b.version, b.status, b.notes, b.source_sample_id, b.created_at, b.activated_at,
            (SELECT count(*) FROM erp.bom_lines bl WHERE bl.bom_id = b.id) AS line_count,
            (SELECT string_agg(DISTINCT bl.size, ', ') FROM erp.bom_lines bl WHERE bl.bom_id = b.id) AS sizes,
            EXISTS (SELECT 1 FROM erp.work_orders w WHERE w.bom_id = b.id AND w.status = 'ACTIVE') AS used_by_active_wo,
            count(*) OVER() AS _total
     FROM erp.boms b JOIN erp.skus s ON s.id = b.sku_id JOIN erp.brands br ON br.id = s.brand_id
     WHERE ($1::bigint IS NULL OR b.sku_id = $1) AND ($2::bigint IS NULL OR s.brand_id = $2)
       AND ($3::text IS NULL OR b.status::text = upper($3))
       AND ($4::text IS NULL OR s.code ILIKE '%' || $4 || '%' OR s.name ILIKE '%' || $4 || '%')
     ORDER BY s.code, b.version DESC LIMIT $5 OFFSET $6`,
    [skuId, brandId, str(q.status), str(q.q), p.limit, p.offset]);
  res.json({ data: rows.map(({ _total, ...r }) => r), page: p.page, limit: p.limit, total: rows[0]?._total ?? 0 });
}));

// GET /boms/:id/requirement?qty=1200&size=M — kebutuhan material (Kg) termasuk shrinkage
bomsRouter.get('/boms/:id/requirement', BOM_READ, ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const bom = await resolveBom(req.params.id, { version: q.version });
  if (q.qty === undefined || q.qty === '') throw badRequest('Parameter qty wajib diisi.', { field: 'qty' });
  const qty = num(q.qty, 'qty', { int: true, gt: 0 });
  if (!q.size) throw badRequest('Parameter size wajib diisi.', { field: 'size' });
  const rows = await query(
    `SELECT bl.size, m.code, m.name, m.category, m.uom, bl.qty_per_pcs, bl.qty_unit, m.avg_cost,
            coalesce(bl.shrinkage_pct, CASE WHEN m.category = 'FABRIC' THEN m.shrinkage_pct ELSE 0 END) AS shrinkage_pct,
            $2::numeric * erp.fn_bom_qty_to_uom(bl.qty_per_pcs, bl.qty_unit)
              * (1 + coalesce(bl.shrinkage_pct, CASE WHEN m.category = 'FABRIC' THEN m.shrinkage_pct ELSE 0 END) / 100) AS total
     FROM erp.bom_lines bl JOIN erp.materials m ON m.id = bl.material_id
     WHERE bl.bom_id = $1 AND upper(bl.size) = upper($3)
     ORDER BY bl.is_main_fabric DESC, m.category, m.code`, [bom.id, qty, String(q.size).trim()]);
  if (!rows.length) throw new AppError(422, 'SIZE_NOT_FOUND', `BOM tidak memiliki size ${q.size}.`);
  const sku = await queryOne(`SELECT code FROM erp.skus WHERE id = $1`, [bom.sku_id]);
  const cost = canSeeCost(req.user);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let totalCost = 0;
  let missing = false;
  const materials = rows.map((r) => {
    const shr = Number(r.shrinkage_pct);
    const item: any = r.qty_unit === 'GRAM'
      ? { code: r.code, name: r.name, gram_per_pcs: r.qty_per_pcs, ...(shr > 0 || r.category === 'FABRIC' ? { shrinkage_pct: shr } : {}), total_kg: r2(r.total) }
      : { code: r.code, name: r.name, qty_per_pcs: r.qty_per_pcs, unit: r.qty_unit, ...(shr > 0 ? { shrinkage_pct: shr } : {}),
          total_qty: r2(r.total), uom: r.uom };
    if (cost) {
      item.avg_cost = r.avg_cost;
      item.est_cost = r2(r.total * r.avg_cost);
      totalCost += r.total * r.avg_cost;
      if (!(Number(r.avg_cost) > 0)) missing = true;
    }
    return item;
  });
  const out: any = { sku: sku.code, bom_id: bom.id, version: bom.version, status: bom.status, size: rows[0].size, qty, materials };
  if (cost) {
    out.est_material_cost = r2(totalCost);
    out.hpp_status = missing ? 'Belum lengkap' : 'Lengkap';
  }
  res.json(out);
}));

// GET /boms/:id?version=
bomsRouter.get('/boms/:id', BOM_READ, ah(async (req, res) => {
  const bom = await resolveBom(req.params.id, { version: (req.query as any).version });
  res.json(await bomDetail(bom.id, req.user));
}));

// POST /boms — Admin. Buat BOM (versi berikutnya, via fn_new_bom_version) + baris; opsional langsung aktif.
bomsRouter.post('/boms', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const skuKey = b.sku_id ?? b.sku_code ?? b.sku;
  if (skuKey === undefined) throw badRequest('Field wajib diisi: sku_id.');
  const skuId = await resolveSku(skuKey);
  const id = await withTx(req.user!.id, async (c) => {
    const sku = (await c.query(`SELECT pack_config, status FROM erp.skus WHERE id = $1`, [skuId])).rows[0];
    if (sku.status !== 'ACTIVE') throw new AppError(422, 'SKU_INACTIVE', 'SKU sudah diarsipkan.');
    if (sku.pack_config !== 'SINGLE') throw new AppError(422, 'SKU_MULTIPACK', 'BOM hanya untuk SKU single. Multipack disusun dari varian single (komposisi pack).');
    const lines = b.lines !== undefined ? await validateLines(c, skuId, b.lines) : null;
    const bomId = Number((await c.query(`SELECT erp.fn_new_bom_version($1, $2, $3) AS id`, [skuId, req.user!.id, str(b.notes)])).rows[0].id);
    if (lines) await replaceLines(c, bomId, lines);
    if (b.activate === true) await c.query(`SELECT erp.fn_activate_bom($1, $2)`, [bomId, req.user!.id]);
    return bomId;
  });
  res.status(201).json(await bomDetail(id, req.user));
}));

// POST /boms/:id/versions — Admin. {id} = BOM atau kode SKU; menyalin BOM aktif menjadi Draft versi berikutnya.
bomsRouter.post('/boms/:id/versions', allow('ADMIN'), ah(async (req, res) => {
  const src = await resolveBom(req.params.id);
  const b = req.body ?? {};
  const id = await withTx(req.user!.id, async (c) => {
    const lines = b.lines !== undefined ? await validateLines(c, src.sku_id, b.lines) : null;
    const bomId = Number((await c.query(`SELECT erp.fn_new_bom_version($1, $2, $3) AS id`, [src.sku_id, req.user!.id, str(b.notes)])).rows[0].id);
    if (lines) await replaceLines(c, bomId, lines);
    return bomId;
  });
  res.status(201).json(await bomDetail(id, req.user));
}));

// PUT /boms/:id — Admin. Hanya BOM Draft; Active/Archived wajib lewat versi baru.
bomsRouter.put('/boms/:id', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const found = await resolveBom(req.params.id, { version: b.version ?? (req.query as any).version, prefer: 'draft' });
  if (b.lines === undefined && b.notes === undefined) throw badRequest('Tidak ada field yang diubah (lines/notes).');
  await withTx(req.user!.id, async (c) => {
    const bom = (await c.query(`SELECT * FROM erp.boms WHERE id = $1 FOR UPDATE`, [found.id])).rows[0];
    await assertEditable(c, bom);
    if (b.lines !== undefined) await replaceLines(c, bom.id, await validateLines(c, bom.sku_id, b.lines));
    if (b.notes !== undefined) await c.query(`UPDATE erp.boms SET notes = $2 WHERE id = $1`, [bom.id, str(b.notes)]);
  });
  res.json(await bomDetail(found.id, req.user));
}));

// PATCH /boms/:id/activate — Admin. fn_activate_bom: versi aktif lama otomatis jadi Arsip.
bomsRouter.patch('/boms/:id/activate', allow('ADMIN'), ah(async (req, res) => {
  const found = await resolveBom(req.params.id, { version: (req.body ?? {}).version ?? (req.query as any).version, prefer: 'draft' });
  await withTx(req.user!.id, async (c) => {
    const n = (await c.query(`SELECT count(*)::int AS n FROM erp.bom_lines WHERE bom_id = $1`, [found.id])).rows[0].n;
    if (found.status === 'DRAFT' && n === 0) throw new AppError(422, 'BOM_INCOMPLETE', 'BOM belum memiliki baris material.');
    await c.query(`SELECT erp.fn_activate_bom($1, $2)`, [found.id, req.user!.id]);
  });
  res.json({ status: 'OK', message: `BOM versi ${found.version} diaktifkan.`, bom: await bomDetail(found.id, req.user) });
}));
