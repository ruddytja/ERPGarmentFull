// FR-01 Master pendukung — material, supplier, customer, kanal penjualan, lini produksi
import express from 'express';
import { query, queryOne, withTx } from '../../lib/db.ts';
import { ah, badRequest, conflict, num, oneOf, paging, required } from '../../lib/http.ts';
import { allow, canSeeCost } from '../../lib/auth.ts';
import { ALL, STATUS, buildSet, listResult, resolveBrand, resolveCustomer, resolveMaterial, resolveSupplier, str } from './common.ts';

export const lookupsRouter = express.Router();

const MAT_CATEGORIES = ['FABRIC', 'ELASTIC', 'THREAD', 'BONDING_TAPE', 'ACCESSORY', 'PACKAGING', 'SPAREPART'] as const;
const UOMS = ['KG', 'PCS', 'M', 'L'] as const;
const WEIGHT_CATS = ['FABRIC', 'ELASTIC', 'THREAD', 'BONDING_TAPE'];

// ---------------------------------------------------------------------
// Materials (master material). avg_cost hanya untuk Admin/Founder/Finance.
// ---------------------------------------------------------------------
function materialOut(r: any, cost: boolean) {
  const { _total, avg_cost, ...rest } = r;
  return cost ? { ...rest, avg_cost } : rest;
}

async function materialById(id: number, cost: boolean) {
  const r = await queryOne(`SELECT * FROM erp.materials WHERE id = $1`, [id]);
  return materialOut(r, cost);
}

// GET /materials?category=&status=&q=
lookupsRouter.get('/materials', allow(...ALL), ah(async (req, res) => {
  const p = paging(req.query);
  const q = req.query as Record<string, string>;
  const rows = await query(
    `SELECT m.*, count(*) OVER() AS _total FROM erp.materials m
     WHERE ($1::text IS NULL OR m.category::text = ANY(string_to_array(upper($1), ',')))
       AND ($2::text IS NULL OR m.status::text = upper($2))
       AND ($3::text IS NULL OR m.code ILIKE '%' || $3 || '%' OR m.name ILIKE '%' || $3 || '%')
     ORDER BY m.category, m.code LIMIT $4 OFFSET $5`,
    [str(q.category), str(q.status), str(q.q), p.limit, p.offset],
  );
  const cost = canSeeCost(req.user);
  res.json({ data: rows.map((r) => materialOut(r, cost)), page: p.page, limit: p.limit, total: rows[0]?._total ?? 0 });
}));

lookupsRouter.get('/materials/:id', allow(...ALL), ah(async (req, res) => {
  res.json(await materialById(await resolveMaterial(req.params.id), canSeeCost(req.user)));
}));

function validateMaterial(b: any, partial: boolean) {
  if (!partial) required(b, ['code', 'name', 'category', 'uom']);
  if (b.category !== undefined) oneOf(b.category, MAT_CATEGORIES, 'category');
  if (b.uom !== undefined) oneOf(b.uom, UOMS, 'uom');
  if (b.shrinkage_pct !== undefined && b.shrinkage_pct !== null) num(b.shrinkage_pct, 'shrinkage_pct', { min: 0, max: 20 });
  if (b.min_stock !== undefined && b.min_stock !== null) num(b.min_stock, 'min_stock', { min: 0 });
  if (b.status !== undefined) oneOf(b.status, STATUS, 'status');
  if (b.avg_cost !== undefined) throw badRequest('avg_cost dihitung otomatis dari receiving (moving average) dan tidak dapat diisi manual.');
}

// POST /materials — Admin
lookupsRouter.post('/materials', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  validateMaterial(b, false);
  if (WEIGHT_CATS.includes(b.category) && b.uom !== 'KG') throw badRequest('Kain, karet, benang, dan bonding tape wajib bersatuan KG.');
  const id = await withTx(req.user!.id, async (c) => (await c.query(
    `INSERT INTO erp.materials (code, name, category, uom, is_lot_tracked, shrinkage_pct, min_stock)
     VALUES (upper(trim($1)), trim($2), $3, $4, coalesce($5::boolean, $6::boolean), coalesce($7::numeric, 0), coalesce($8::numeric, 0)) RETURNING id`,
    [b.code, b.name, b.category, b.uom, b.is_lot_tracked ?? null, WEIGHT_CATS.includes(b.category), b.shrinkage_pct ?? null, b.min_stock ?? null],
  )).rows[0].id);
  res.status(201).json(await materialById(id, canSeeCost(req.user)));
}));

// PUT /materials/:id — Admin. Kategori/satuan hanya bisa diubah bila belum ada lot stok.
lookupsRouter.put('/materials/:id', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveMaterial(req.params.id);
  const b = req.body ?? {};
  validateMaterial(b, true);
  await withTx(req.user!.id, async (c) => {
    const cur = (await c.query(`SELECT * FROM erp.materials WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if ((b.category !== undefined && b.category !== cur.category) || (b.uom !== undefined && b.uom !== cur.uom)) {
      const used = (await c.query(`SELECT 1 FROM erp.material_lots WHERE material_id = $1 UNION ALL SELECT 1 FROM erp.bom_lines WHERE material_id = $1 LIMIT 1`, [id])).rowCount;
      if (used) throw conflict('Kategori/satuan material yang sudah memiliki stok atau dipakai BOM tidak dapat diubah.', 'MATERIAL_IN_USE');
    }
    const cat = b.category ?? cur.category;
    const uom = b.uom ?? cur.uom;
    if (WEIGHT_CATS.includes(cat) && uom !== 'KG') throw badRequest('Kain, karet, benang, dan bonding tape wajib bersatuan KG.');
    const { sets, params } = buildSet({
      code: b.code !== undefined ? String(b.code).trim().toUpperCase() : undefined,
      name: b.name !== undefined ? String(b.name).trim() : undefined,
      category: b.category, uom: b.uom, is_lot_tracked: b.is_lot_tracked,
      shrinkage_pct: b.shrinkage_pct, min_stock: b.min_stock, status: b.status,
    });
    if (!sets.length) throw badRequest('Tidak ada field yang diubah.');
    await c.query(`UPDATE erp.materials SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]);
  });
  res.json(await materialById(id, canSeeCost(req.user)));
}));

// ---------------------------------------------------------------------
// Suppliers & Customers (CRUD sederhana — Admin; baca semua peran)
// ---------------------------------------------------------------------
function simpleMaster(path: string, table: string, resolve: (raw: unknown) => Promise<number>, extra: string[] = []) {
  lookupsRouter.get(`/${path}`, allow(...ALL), ah(async (req, res) => {
    const p = paging(req.query);
    const q = req.query as Record<string, string>;
    const rows = await query(
      `SELECT t.*, count(*) OVER() AS _total FROM erp.${table} t
       WHERE ($1::text IS NULL OR t.status::text = upper($1))
         AND ($2::text IS NULL OR t.code ILIKE '%' || $2 || '%' OR t.name ILIKE '%' || $2 || '%')
       ORDER BY t.code LIMIT $3 OFFSET $4`, [str(q.status), str(q.q), p.limit, p.offset]);
    res.json(listResult(rows, p));
  }));

  lookupsRouter.get(`/${path}/:id`, allow(...ALL), ah(async (req, res) => {
    res.json(await queryOne(`SELECT * FROM erp.${table} WHERE id = $1`, [await resolve(req.params.id)]));
  }));

  const fieldsOf = async (b: any) => {
    const f: Record<string, unknown> = {
      code: b.code !== undefined ? String(b.code).trim().toUpperCase() : undefined,
      name: b.name !== undefined ? String(b.name).trim() : undefined,
      phone: b.phone, address: b.address,
      status: b.status !== undefined ? oneOf(b.status, STATUS, 'status') : undefined,
    };
    if (extra.includes('brand_id') && b.brand_id !== undefined) f.brand_id = b.brand_id === null ? null : await resolveBrand(b.brand_id);
    return f;
  };

  lookupsRouter.post(`/${path}`, allow('ADMIN'), ah(async (req, res) => {
    const b = req.body ?? {};
    required(b, ['code', 'name']);
    const f = await fieldsOf(b);
    const cols = Object.keys(f).filter((k) => f[k] !== undefined);
    const id = await withTx(req.user!.id, async (c) => (await c.query(
      `INSERT INTO erp.${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      cols.map((k) => f[k]))).rows[0].id);
    res.status(201).json(await queryOne(`SELECT * FROM erp.${table} WHERE id = $1`, [id]));
  }));

  lookupsRouter.put(`/${path}/:id`, allow('ADMIN'), ah(async (req, res) => {
    const id = await resolve(req.params.id);
    const { sets, params } = buildSet(await fieldsOf(req.body ?? {}));
    if (!sets.length) throw badRequest('Tidak ada field yang diubah.');
    await withTx(req.user!.id, (c) => c.query(`UPDATE erp.${table} SET ${sets.join(', ')} WHERE id = $${params.length + 1}`, [...params, id]));
    res.json(await queryOne(`SELECT * FROM erp.${table} WHERE id = $1`, [id]));
  }));

}

simpleMaster('suppliers', 'suppliers', resolveSupplier);
simpleMaster('customers', 'customers', resolveCustomer, ['brand_id']);

// ---------------------------------------------------------------------
// Lookup read-only
// ---------------------------------------------------------------------
lookupsRouter.get('/sales-channels', allow(...ALL), ah(async (_req, res) => {
  const rows = await query(`SELECT id, code, name FROM erp.sales_channels ORDER BY id`);
  const stores = await query(`SELECT id, code, name, status FROM erp.online_stores ORDER BY id`);
  res.json({ data: rows, online_stores: stores, page: 1, limit: rows.length, total: rows.length });
}));

lookupsRouter.get('/production-lines', allow(...ALL), ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const rows = await query(
    `SELECT l.id, l.code, l.name, l.line_type, l.status,
            (SELECT count(*) FROM erp.machines m WHERE m.line_id = l.id AND m.status <> 'INACTIVE') AS machine_count
     FROM erp.production_lines l
     WHERE ($1::text IS NULL OR l.line_type::text = upper($1)) AND ($2::text IS NULL OR l.status::text = upper($2))
     ORDER BY l.id`, [str(q.line_type), str(q.status)]);
  res.json({ data: rows, page: 1, limit: rows.length, total: rows.length });
}));
