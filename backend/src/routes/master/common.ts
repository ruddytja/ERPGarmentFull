// FR-01 Master Data — helper bersama: resolver id/kode, validasi kecil, peran
import { PoolClient } from 'pg';
import { queryOne } from '../../lib/db.ts';
import { AppError, badRequest, notFound } from '../../lib/http.ts';
import type { Role, StaffFn } from '../../lib/auth.ts';

type Spec = Role | { staff: StaffFn[] | '*' };

// Kelompok peran (sesuai matriks hak akses FRD)
export const ALL: Spec[] = ['ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', { staff: '*' }];
export const MGMT: Spec[] = ['ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'];

type Runner = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> } | PoolClient;

async function one(sql: string, params: unknown[], c?: Runner) {
  if (c) return (await c.query(sql, params)).rows[0] ?? null;
  return queryOne(sql, params);
}

/**
 * Resolver generik: `{id}` di URL boleh berupa kode (mis. NQL-BRF-001, SUP-001, MC-OBR-04)
 * atau id numerik ("12" / "SKU-12"). Kode dicoba lebih dulu agar kode seperti SUP-001
 * tidak tertukar dengan id 1.
 */
export async function resolveId(
  table: string, codeCol: string | null, raw: unknown, label: string, c?: Runner, notFoundCode = 'NOT_FOUND',
): Promise<number> {
  const v = String(raw ?? '').trim();
  if (!v) throw badRequest(`${label} wajib diisi.`);
  if (/^\d+$/.test(v)) {
    const r = await one(`SELECT id FROM erp.${table} WHERE id = $1`, [Number(v)], c);
    if (r) return Number(r.id);
  } else if (codeCol) {
    const r = await one(`SELECT id FROM erp.${table} WHERE upper(${codeCol}) = upper($1)`, [v], c);
    if (r) return Number(r.id);
  }
  const m = v.match(/^[A-Za-z]+-(\d+)$/);
  if (m) {
    const r = await one(`SELECT id FROM erp.${table} WHERE id = $1`, [Number(m[1])], c);
    if (r) return Number(r.id);
  }
  throw notFound(`${label} ${v} tidak ditemukan.`, notFoundCode);
}

export const resolveSku = (raw: unknown, c?: Runner) => resolveId('skus', 'code', raw, 'SKU', c, 'SKU_NOT_FOUND');
export const resolveBrand = (raw: unknown, c?: Runner) => resolveId('brands', 'code', raw, 'Brand', c, 'BRAND_NOT_FOUND');
export const resolveOperation = (raw: unknown, c?: Runner) => resolveId('operations', 'code', raw, 'Operasi', c, 'OPERATION_NOT_FOUND');
export const resolveMachine = (raw: unknown, c?: Runner) => resolveId('machines', 'asset_code', raw, 'Mesin', c, 'MACHINE_NOT_FOUND');
export const resolveSample = (raw: unknown, c?: Runner) => resolveId('samples', 'sample_no', raw, 'Sampel', c, 'SAMPLE_NOT_FOUND');
export const resolveSupplier = (raw: unknown, c?: Runner) => resolveId('suppliers', 'code', raw, 'Supplier', c, 'SUPPLIER_NOT_FOUND');
export const resolveCustomer = (raw: unknown, c?: Runner) => resolveId('customers', 'code', raw, 'Customer', c, 'CUSTOMER_NOT_FOUND');
export const resolveMaterial = (raw: unknown, c?: Runner) => resolveId('materials', 'code', raw, 'Material', c, 'MATERIAL_NOT_FOUND');
export const resolveLine = (raw: unknown, c?: Runner) => resolveId('production_lines', 'code', raw, 'Lini produksi', c, 'LINE_NOT_FOUND');

/** Material dari input BOM/kemasan — pesan FRD bila belum terdaftar (422, bukan 404). */
export async function materialFromInput(input: any, c?: Runner) {
  const key = input?.material_id ?? input?.material_code ?? input?.material;
  if (key === undefined || key === null || key === '') throw badRequest('Material wajib diisi.');
  const v = String(key).trim();
  const r = /^\d+$/.test(v)
    ? await one(`SELECT * FROM erp.materials WHERE id = $1`, [Number(v)], c)
    : await one(`SELECT * FROM erp.materials WHERE upper(code) = upper($1)`, [v], c);
  if (!r) throw new AppError(422, 'MATERIAL_NOT_FOUND', 'Material belum terdaftar. Tambahkan di Master Material.', { material: v });
  return r;
}

export const isUnset = (v: unknown) => v === undefined;
export const str = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);

/** Angka dengan presisi maksimum `dec` desimal. */
export function decimals(n: number, dec: number, field: string) {
  const scaled = n * 10 ** dec;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw badRequest(`${field} maksimal ${dec} angka desimal.`, { field });
  }
  return n;
}

export function dateStr(v: unknown, field: string): string {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  return s;
}

/** Bangun SET untuk UPDATE dari field yang dikirim saja. */
export function buildSet(fields: Record<string, unknown>, startIdx = 1) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${k} = $${startIdx + params.length - 1}`);
  }
  return { sets, params };
}

export const listResult = (rows: any[], p: { page: number; limit: number }) => ({
  data: rows.map(({ _total, ...r }) => r),
  page: p.page,
  limit: p.limit,
  total: rows[0]?._total ?? 0,
});

export const STATUS = ['ACTIVE', 'INACTIVE'] as const;
