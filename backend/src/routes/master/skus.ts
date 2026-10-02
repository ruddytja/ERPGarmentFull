// FR-01.3 Brand & SKU Directory · FR-01.2 Routing per SKU
import express from 'express';
import { PoolClient } from 'pg';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { AppError, ah, badRequest, conflict, num, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeCost, canSeeRates } from '../../lib/auth.ts';
import { ALL, MGMT, STATUS, buildSet, listResult, materialFromInput, resolveBrand, resolveOperation, resolveSku, str } from './common.ts';

export const skusRouter = express.Router();

const BRAND_TYPES = ['INTERNAL', 'B2B_CLIENT'] as const;
const PACK = ['SINGLE', 'MULTIPACK'] as const;

// ---------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------
skusRouter.get('/brands', allow(...ALL), ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const rows = await query(
    `SELECT b.*, (SELECT count(*) FROM erp.skus s WHERE s.brand_id = b.id AND s.status = 'ACTIVE') AS sku_count,
            count(*) OVER() AS _total
     FROM erp.brands b
     WHERE ($1::text IS NULL OR b.status::text = upper($1)) AND ($2::text IS NULL OR b.brand_type::text = upper($2))
       AND ($3::text IS NULL OR b.code ILIKE '%' || $3 || '%' OR b.name ILIKE '%' || $3 || '%')
     ORDER BY b.brand_type, b.name LIMIT $4 OFFSET $5`, [str(q.status), str(q.brand_type), str(q.q), p.limit, p.offset]);
  res.json(listResult(rows, p));
}));

skusRouter.get('/brands/:id', allow(...ALL), ah(async (req, res) => {
  res.json(await queryOne(`SELECT * FROM erp.brands WHERE id = $1`, [await resolveBrand(req.params.id)]));
}));

skusRouter.post('/brands', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['code', 'name', 'brand_type']);
  oneOf(b.brand_type, BRAND_TYPES, 'brand_type');
  const id = await withTx(req.user!.id, async (c) => (await c.query(
    `INSERT INTO erp.brands (code, name, brand_type) VALUES (upper(trim($1)), trim($2), $3) RETURNING id`,
    [b.code, b.name, b.brand_type])).rows[0].id);
  res.status(201).json(await queryOne(`SELECT * FROM erp.brands WHERE id = $1`, [id]));
}));

skusRouter.put('/brands/:id', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveBrand(req.params.id);
  const b = req.body ?? {};
  const { sets, params } = buildSet({
    code: b.code !== undefined ? String(b.code).trim().toUpperCase() : undefined,
    name: b.name !== undefined ? String(b.name).trim() : undefined,
    brand_type: b.brand_type !== undefined ? oneOf(b.brand_type, BRAND_TYPES, 'brand_type') : undefined,
    status: b.status !== undefined ? oneOf(b.status, STATUS, 'status') : undefined,
  });
  if (!sets.length) throw badRequest('Tidak ada field yang diubah.');
  await withTx(req.user!.id, (c) => c.query(`UPDATE erp.brands SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]));
  res.json(await queryOne(`SELECT * FROM erp.brands WHERE id = $1`, [id]));
}));

// ---------------------------------------------------------------------
// SKU
// ---------------------------------------------------------------------
// Kolom turunan: BOM aktif, jumlah routing, kesiapan SPK, histori produksi
const SKU_SELECT = `
  SELECT s.*, b.code AS brand_code, b.name AS brand_name, b.brand_type,
         ab.id AS active_bom_id, ab.version AS active_bom_version,
         (SELECT count(*) FROM erp.sku_routings r WHERE r.sku_id = s.id) AS routing_count,
         (SELECT count(*) FROM erp.sku_variants v WHERE v.sku_id = s.id AND v.status = 'ACTIVE') AS variant_count,
         (EXISTS (SELECT 1 FROM erp.work_orders w WHERE w.sku_id = s.id)
          OR EXISTS (SELECT 1 FROM erp.pack_units pu JOIN erp.sku_variants pv ON pv.id = pu.fg_variant_id WHERE pv.sku_id = s.id)) AS has_production_history
  FROM erp.skus s
  JOIN erp.brands b ON b.id = s.brand_id
  LEFT JOIN erp.boms ab ON ab.sku_id = s.id AND ab.status = 'ACTIVE'`;

function readiness(r: any) {
  const reasons: string[] = [];
  if (r.status !== 'ACTIVE') reasons.push('SKU diarsipkan/nonaktif.');
  if (!r.active_bom_id) reasons.push('SKU belum memiliki BOM aktif.');
  if (!Number(r.routing_count)) reasons.push('SKU belum memiliki routing aktif.');
  return { ready_for_spk: reasons.length === 0, not_ready_reasons: reasons };
}

function skuOut(r: any, user: any) {
  const { _total, ...s } = r;
  if (user.role === 'STAFF') {
    // Staff: nama & varian saja
    return { id: s.id, code: s.code, name: s.name, brand_name: s.brand_name, status: s.status };
  }
  const out: any = { ...s, ...readiness(s) };
  if (!canSeeCost(user)) delete out.selling_price;
  return out;
}

skusRouter.get('/skus', allow(...ALL), ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  // default: hanya SKU aktif; ?status=all untuk termasuk arsip
  const status = q.status === undefined ? 'ACTIVE' : String(q.status).toLowerCase() === 'all' ? null : String(q.status).toUpperCase();
  let brandId: number | null = null;
  if (q.brand ?? q.brand_id) brandId = await resolveBrand(q.brand ?? q.brand_id);
  const rows = await query(
    `SELECT x.*, count(*) OVER() AS _total FROM (${SKU_SELECT}) x
     WHERE ($1::text IS NULL OR x.status::text = $1) AND ($2::bigint IS NULL OR x.brand_id = $2)
       AND ($3::text IS NULL OR x.category ILIKE $3) AND ($4::text IS NULL OR x.pack_config::text = upper($4))
       AND ($5::text IS NULL OR x.code ILIKE '%' || $5 || '%' OR x.name ILIKE '%' || $5 || '%')
       AND ($8::boolean IS NULL OR (x.status = 'ACTIVE' AND x.active_bom_id IS NOT NULL AND x.routing_count > 0) = $8)
     ORDER BY x.brand_name, x.code LIMIT $6 OFFSET $7`,
    [status, brandId, str(q.category), str(q.pack_config), str(q.q), p.limit, p.offset,
      q.ready_for_spk === undefined ? null : String(q.ready_for_spk) === 'true']);
  let data = rows.map((r) => skuOut(r, req.user));
  if (req.user!.role === 'STAFF' && rows.length) {
    // varian ikut dikirim agar Staff bisa memilih size/warna
    const vars = await query(`SELECT sku_id, id, size, size_order, color, barcode FROM erp.sku_variants
                              WHERE sku_id = ANY($1) AND status = 'ACTIVE' ORDER BY size_order, size, color`, [rows.map((r) => r.id)]);
    data = data.map((d: any) => ({ ...d, variants: vars.filter((v) => v.sku_id === d.id).map(({ sku_id, ...v }) => v) }));
  }
  res.json({ data, page: p.page, limit: p.limit, total: rows[0]?._total ?? 0 });
}));

async function skuDetail(id: number, user: any) {
  const r = await queryOne(`${SKU_SELECT} WHERE s.id = $1`, [id]);
  const variants = await query(
    `SELECT v.id, v.size, v.size_order, v.color, v.barcode, v.status,
            coalesce((SELECT json_agg(json_build_object('variant_id', cv.id, 'sku_code', cs.code, 'size', cv.size, 'color', cv.color, 'qty', pc.qty) ORDER BY cv.id)
                      FROM erp.pack_components pc JOIN erp.sku_variants cv ON cv.id = pc.component_variant_id
                      JOIN erp.skus cs ON cs.id = cv.sku_id WHERE pc.pack_variant_id = v.id), '[]') AS components
     FROM erp.sku_variants v WHERE v.sku_id = $1 ORDER BY v.size_order, v.size, v.color`, [id]);
  const out: any = skuOut(r, user);
  if (user.role === 'STAFF') {
    out.variants = variants.filter((v) => v.status === 'ACTIVE').map(({ components, status, ...v }) => v);
    return out;
  }
  out.variants = r.pack_config === 'MULTIPACK' ? variants : variants.map(({ components, ...v }) => v);
  out.packaging = await query(
    `SELECT m.id AS material_id, m.code, m.name, m.uom, p.qty_per_pack FROM erp.sku_packaging p
     JOIN erp.materials m ON m.id = p.material_id WHERE p.sku_id = $1 ORDER BY m.code`, [id]);
  out.routing = await routingRows(id, user);
  out.boms = await query(`SELECT id, version, status, created_at, activated_at FROM erp.boms WHERE sku_id = $1 ORDER BY version DESC`, [id]);
  return out;
}

skusRouter.get('/skus/:id', allow(...ALL), ah(async (req, res) => {
  res.json(await skuDetail(await resolveSku(req.params.id), req.user));
}));

/** Varian + komposisi pack + kemasan (dipakai POST & PUT). */
async function saveVariants(c: PoolClient, skuId: number, sku: { pack_config: string; pack_qty: number }, variants: any[], replaceAll: boolean) {
  if (!Array.isArray(variants)) throw badRequest('variants harus berupa array.');
  const seen = new Set<string>();
  const keepIds: number[] = [];
  for (const [i, v] of variants.entries()) {
    required(v ?? {}, ['size', 'color']);
    const key = `${String(v.size).trim().toUpperCase()}|${String(v.color).trim().toUpperCase()}`;
    if (seen.has(key)) throw badRequest(`Varian ${v.size} / ${v.color} duplikat.`, { index: i });
    seen.add(key);
    const st = v.status !== undefined ? oneOf(v.status, STATUS, `variants[${i}].status`) : 'ACTIVE';
    const order = v.size_order !== undefined ? num(v.size_order, `variants[${i}].size_order`, { int: true, min: 0 }) : null;
    const row = (await c.query(
      `INSERT INTO erp.sku_variants (sku_id, size, size_order, color, barcode, status)
       VALUES ($1, trim($2), coalesce($3, 0), trim($4), nullif(trim($5), ''), $6)
       ON CONFLICT (sku_id, size, color) DO UPDATE
         SET size_order = coalesce($3, erp.sku_variants.size_order),
             barcode = CASE WHEN $7 THEN nullif(trim($5), '') ELSE erp.sku_variants.barcode END,
             status = $6
       RETURNING id`,
      [skuId, v.size, order, v.color, v.barcode ?? null, st, v.barcode !== undefined])).rows[0];
    keepIds.push(Number(row.id));

    if (sku.pack_config === 'MULTIPACK' && (v.components !== undefined || replaceAll)) {
      const comps = v.components ?? [];
      if (!Array.isArray(comps) || !comps.length) throw badRequest(`Komposisi pack wajib diisi untuk varian ${v.size} / ${v.color}.`, { index: i });
      await c.query(`DELETE FROM erp.pack_components WHERE pack_variant_id = $1`, [row.id]);
      let total = 0;
      for (const comp of comps) {
        const qty = num(comp.qty ?? 1, 'components.qty', { int: true, gt: 0 });
        total += qty;
        let cv: any;
        if (comp.variant_id !== undefined) {
          cv = (await c.query(`SELECT v.*, s.pack_config FROM erp.sku_variants v JOIN erp.skus s ON s.id = v.sku_id WHERE v.id = $1`, [comp.variant_id])).rows[0];
        } else {
          required(comp, ['sku_code', 'size', 'color']);
          cv = (await c.query(
            `SELECT v.*, s.pack_config FROM erp.sku_variants v JOIN erp.skus s ON s.id = v.sku_id
             WHERE upper(s.code) = upper($1) AND upper(v.size) = upper($2) AND upper(v.color) = upper($3)`,
            [comp.sku_code, comp.size, comp.color])).rows[0];
        }
        if (!cv) throw new AppError(422, 'VARIANT_NOT_FOUND', 'Varian komponen pack tidak ditemukan.', { component: comp });
        if (cv.pack_config !== 'SINGLE') throw new AppError(422, 'INVALID_COMPONENT', 'Komponen pack harus varian SKU single.', { component: comp });
        await c.query(`INSERT INTO erp.pack_components (pack_variant_id, component_variant_id, qty) VALUES ($1, $2, $3)
                       ON CONFLICT (pack_variant_id, component_variant_id) DO UPDATE SET qty = erp.pack_components.qty + EXCLUDED.qty`,
          [row.id, cv.id, qty]);
      }
      if (total !== Number(sku.pack_qty)) {
        throw new AppError(422, 'PACK_QTY_MISMATCH', `Total komponen pack varian ${v.size} / ${v.color} (${total}) harus sama dengan isi pack (${sku.pack_qty}).`);
      }
    }
  }
  if (replaceAll) {
    // varian yang tidak dikirim ulang dinonaktifkan (tidak dihapus: bisa sudah dipakai SPK/FG)
    await c.query(`UPDATE erp.sku_variants SET status = 'INACTIVE' WHERE sku_id = $1 AND NOT (id = ANY($2)) AND status = 'ACTIVE'`, [skuId, keepIds]);
  }
}

async function savePackaging(c: PoolClient, skuId: number, items: any[]) {
  if (!Array.isArray(items)) throw badRequest('packaging harus berupa array.');
  await c.query(`DELETE FROM erp.sku_packaging WHERE sku_id = $1`, [skuId]);
  for (const it of items) {
    const m = await materialFromInput(it, c);
    if (!['PACKAGING', 'ACCESSORY'].includes(m.category)) throw new AppError(422, 'INVALID_MATERIAL', `Material ${m.code} bukan material kemasan/aksesoris.`);
    const qty = num(it.qty_per_pack ?? it.qty, 'qty_per_pack', { gt: 0 });
    await c.query(`INSERT INTO erp.sku_packaging (sku_id, material_id, qty_per_pack) VALUES ($1, $2, $3)`, [skuId, m.id, qty]);
  }
}

function packFields(b: any, cur?: any) {
  const cfg = b.pack_config !== undefined ? oneOf(b.pack_config, PACK, 'pack_config') : cur?.pack_config ?? 'SINGLE';
  let qty = b.pack_qty !== undefined ? num(b.pack_qty, 'pack_qty', { int: true, min: 1, max: 12 }) : cur?.pack_qty ?? (cfg === 'SINGLE' ? 1 : undefined);
  if (cfg === 'SINGLE' && b.pack_qty === undefined) qty = 1;
  if (cfg === 'MULTIPACK' && (qty === undefined || qty < 2)) throw badRequest('pack_qty untuk multipack minimal 2.');
  if (cfg === 'SINGLE' && qty !== 1) throw badRequest('SKU single harus pack_qty = 1.');
  return { pack_config: cfg, pack_qty: qty };
}

// POST /skus — Admin
skusRouter.post('/skus', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['code', 'name', 'category']);
  if (b.brand_id === undefined && b.brand_code === undefined && b.brand === undefined) throw badRequest('Field wajib diisi: brand_id.');
  const brandId = await resolveBrand(b.brand_id ?? b.brand_code ?? b.brand);
  const pack = packFields(b);
  const price = b.selling_price !== undefined && b.selling_price !== null ? num(b.selling_price, 'selling_price', { min: 0 }) : null;
  const id = await withTx(req.user!.id, async (c) => {
    const skuId = Number((await c.query(
      `INSERT INTO erp.skus (brand_id, code, name, category, pack_config, pack_qty, selling_price)
       VALUES ($1, upper(trim($2)), trim($3), lower(trim($4)), $5, $6, $7) RETURNING id`,
      [brandId, b.code, b.name, b.category, pack.pack_config, pack.pack_qty, price])).rows[0].id);
    if (b.variants !== undefined) await saveVariants(c, skuId, pack, b.variants, false);
    if (b.packaging !== undefined) await savePackaging(c, skuId, b.packaging);
    return skuId;
  });
  res.status(201).json(await skuDetail(id, req.user));
}));

// PUT /skus/:id — Admin. `variants` = daftar lengkap (yang tidak dikirim → INACTIVE), `packaging` = ganti seluruhnya.
skusRouter.put('/skus/:id', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveSku(req.params.id);
  const b = req.body ?? {};
  await withTx(req.user!.id, async (c) => {
    const cur = (await c.query(`SELECT * FROM erp.skus WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    const pack = packFields(b, cur);
    const packChanged = pack.pack_config !== cur.pack_config || pack.pack_qty !== cur.pack_qty;
    if (packChanged) {
      const used = (await c.query(
        `SELECT 1 FROM erp.work_orders WHERE sku_id = $1
         UNION ALL SELECT 1 FROM erp.pack_units pu JOIN erp.sku_variants v ON v.id = pu.fg_variant_id WHERE v.sku_id = $1 LIMIT 1`, [id])).rowCount;
      if (used) throw conflict('SKU dengan histori produksi tidak dapat diubah konfigurasi pack-nya. Buat SKU baru.', 'SKU_IN_USE');
      if (pack.pack_config === 'MULTIPACK' && b.variants === undefined) throw badRequest('Perubahan konfigurasi multipack wajib menyertakan variants beserta komposisi pack.');
      if (pack.pack_config === 'SINGLE') {
        await c.query(`DELETE FROM erp.pack_components WHERE pack_variant_id IN (SELECT id FROM erp.sku_variants WHERE sku_id = $1)`, [id]);
      }
    }
    const { sets, params } = buildSet({
      brand_id: b.brand_id ?? b.brand_code ?? b.brand ? await resolveBrand(b.brand_id ?? b.brand_code ?? b.brand, c) : undefined,
      code: b.code !== undefined ? String(b.code).trim().toUpperCase() : undefined,
      name: b.name !== undefined ? String(b.name).trim() : undefined,
      category: b.category !== undefined ? String(b.category).trim().toLowerCase() : undefined,
      pack_config: pack.pack_config !== cur.pack_config ? pack.pack_config : undefined,
      pack_qty: pack.pack_qty !== cur.pack_qty ? pack.pack_qty : undefined,
      selling_price: b.selling_price !== undefined ? (b.selling_price === null ? null : num(b.selling_price, 'selling_price', { min: 0 })) : undefined,
    });
    if (sets.length) await c.query(`UPDATE erp.skus SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]);
    if (b.variants !== undefined) await saveVariants(c, id, pack, b.variants, true);
    if (b.packaging !== undefined) await savePackaging(c, id, b.packaging);
    if (!sets.length && b.variants === undefined && b.packaging === undefined) throw badRequest('Tidak ada field yang diubah.');
  });
  res.json(await skuDetail(id, req.user));
}));

// PATCH /skus/:id/archive — Admin. SKU tidak pernah dihapus; yang punya histori produksi hanya diarsipkan.
skusRouter.patch('/skus/:id/archive', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveSku(req.params.id);
  await withTx(req.user!.id, async (c) => {
    const s = (await c.query(`SELECT * FROM erp.skus WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (s.archived_at) throw conflict('SKU sudah diarsipkan.', 'ALREADY_ARCHIVED');
    const wo = (await c.query(`SELECT wo_no FROM erp.work_orders WHERE sku_id = $1 AND status IN ('DRAFT','ACTIVE') ORDER BY id LIMIT 1`, [id])).rows[0];
    if (wo) throw conflict(`SKU masih dipakai ${wo.wo_no} yang belum ditutup. Tutup/batalkan SPK terlebih dahulu.`, 'SKU_IN_USE');
    await c.query(`UPDATE erp.skus SET status = 'INACTIVE', archived_at = now() WHERE id = $1`, [id]);
  });
  res.json({ status: 'OK', message: 'SKU diarsipkan.', sku: await skuDetail(id, req.user) });
}));

// ---------------------------------------------------------------------
// Routing per SKU (FR-01.2) — Supervisor: SMV tanpa tarif; Staff tidak ada akses
// ---------------------------------------------------------------------
async function routingRows(skuId: number, user: any) {
  const rows = await query(
    `SELECT r.seq, o.id AS operation_id, o.code, o.name, o.line_type, o.machine_type, o.smv_minutes, o.status,
            erp.fn_rate_at(o.id, erp.fn_wib_date(now())) AS rate_idr
     FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
     WHERE r.sku_id = $1 ORDER BY r.seq`, [skuId]);
  return canSeeRates(user) ? rows : rows.map(({ rate_idr, ...r }) => r);
}

skusRouter.get('/skus/:id/routing', allow(...MGMT), ah(async (req, res) => {
  const id = await resolveSku(req.params.id);
  const sku = await queryOne(`SELECT id, code, name FROM erp.skus WHERE id = $1`, [id]);
  const ops = await routingRows(id, req.user);
  const out: any = {
    sku_id: sku.id, sku: sku.code, name: sku.name, operations: ops,
    total_smv_minutes: Math.round(ops.reduce((a: number, o: any) => a + Number(o.smv_minutes), 0) * 1000) / 1000,
  };
  if (canSeeRates(req.user)) {
    out.total_rate_idr = ops.reduce((a: number, o: any) => a + Number(o.rate_idr ?? 0), 0);
    out.rates_complete = ops.every((o: any) => o.rate_idr !== null);
  }
  res.json(out);
}));

// PUT /skus/:id/routing — Admin. Body: { operations: [{ seq, operation_id | operation_code }] } atau array kode berurutan.
skusRouter.put('/skus/:id/routing', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveSku(req.params.id);
  const list = Array.isArray(req.body) ? req.body : req.body?.operations;
  if (!Array.isArray(list) || list.length === 0) throw new AppError(422, 'ROUTING_EMPTY', 'Routing minimal 1 operasi.');
  await withTx(req.user!.id, async (c) => {
    const wo = (await c.query(`SELECT wo_no FROM erp.work_orders WHERE sku_id = $1 AND status = 'ACTIVE' ORDER BY id LIMIT 1`, [id])).rows[0];
    if (wo) throw conflict(`Routing dipakai ${wo.wo_no} yang sedang aktif. Ubah routing setelah SPK ditutup.`, 'ROUTING_LOCKED');
    const seqs = new Set<number>();
    const opIds = new Set<number>();
    const rows: [number, number][] = [];
    for (const [i, it] of list.entries()) {
      const item = typeof it === 'object' && it !== null ? it : { operation_code: it };
      const seq = item.seq !== undefined ? num(item.seq, `operations[${i}].seq`, { int: true, gt: 0 }) : i + 1;
      if (seqs.has(seq)) throw new AppError(422, 'ROUTING_SEQ_DUPLICATE', `Urutan routing ${seq} duplikat.`);
      seqs.add(seq);
      const opId = await resolveOperation(item.operation_id ?? item.operation_code ?? item.operation, c);
      if (opIds.has(opId)) throw new AppError(422, 'ROUTING_OP_DUPLICATE', 'Operasi yang sama tidak boleh muncul dua kali dalam routing.');
      opIds.add(opId);
      const op = (await c.query(`SELECT code, status FROM erp.operations WHERE id = $1`, [opId])).rows[0];
      if (op.status !== 'ACTIVE') throw new AppError(422, 'OPERATION_INACTIVE', `Operasi ${op.code} nonaktif dan tidak dapat dipakai di routing.`);
      rows.push([seq, opId]);
    }
    await c.query(`DELETE FROM erp.sku_routings WHERE sku_id = $1`, [id]);
    for (const [seq, opId] of rows.sort((a, b) => a[0] - b[0])) {
      await c.query(`INSERT INTO erp.sku_routings (sku_id, seq, operation_id) VALUES ($1, $2, $3)`, [id, seq, opId]);
    }
  });
  const ops = await routingRows(id, req.user);
  res.json({ sku_id: id, operations: ops });
}));
