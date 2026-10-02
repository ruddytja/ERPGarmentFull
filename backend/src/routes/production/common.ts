// Helper bersama modul produksi (FR-03.x, FR-04.x): resolver entitas & util kecil.
import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool } from '../../lib/db.ts';
import { AppError, badRequest, notFound } from '../../lib/http.ts';

type Db = PoolClient | typeof pool;

const isNumId = (v: unknown) => /^\d+$/.test(String(v ?? '').trim());

// Ambil satu baris; lempar 404 bila tidak ada
async function one(db: Db, sql: string, params: unknown[], msg: string, code: string) {
  const r = await db.query(sql, params);
  if (!r.rows[0]) throw notFound(msg, code);
  return r.rows[0];
}

/** SPK: id numerik atau nomor dokumen (SPK-2026-0101). */
export async function resolveWo(ref: unknown, db: Db = pool, lock = false) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('SPK wajib diisi.', { field: 'work_order' });
  const where = isNumId(v) ? 'id = $1::bigint' : 'wo_no = upper($1)';
  return one(db, `SELECT w.*, w.due_date::text AS due_date FROM erp.work_orders w WHERE ${where}${lock ? ' FOR UPDATE' : ''}`, [v], `SPK ${v} tidak ditemukan.`, 'WO_NOT_FOUND');
}

/** Cutting record: id atau CUT-2026-0001. */
export async function resolveCutting(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  const where = isNumId(v) ? 'id = $1::bigint' : 'cut_no = upper($1)';
  return one(db, `SELECT * FROM erp.cutting_records WHERE ${where}`, [v], `Data cutting ${v} tidak ditemukan.`, 'CUTTING_NOT_FOUND');
}

/** Bundel: id, kode BDL-0101-012, atau isi QR "BDL-0101-012:2" (versi diabaikan di sini). */
export async function resolveBundle(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('Bundel wajib diisi.', { field: 'bundle_id' });
  const code = v.split(':')[0].trim();
  const where = isNumId(code) ? 'id = $1::bigint' : 'bundle_code = upper($1)';
  return one(db, `SELECT * FROM erp.bundles WHERE ${where}`, [code], `Bundel ${code} tidak ditemukan.`, 'BUNDLE_NOT_FOUND');
}

/** Tiket downtime: id atau DT-2026-0001. */
export async function resolveTicket(ref: unknown, db: Db = pool, lock = false) {
  const v = String(ref ?? '').trim();
  const where = isNumId(v) ? 'id = $1::bigint' : 'ticket_no = upper($1)';
  return one(db, `SELECT * FROM erp.downtime_tickets WHERE ${where}${lock ? ' FOR UPDATE' : ''}`, [v], `Tiket ${v} tidak ditemukan.`, 'TICKET_NOT_FOUND');
}

/** Mesin: id atau kode aset (MC-SRB-F007-03). */
export async function resolveMachine(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('Mesin wajib diisi.', { field: 'machine' });
  const where = isNumId(v) ? 'id = $1::bigint' : 'asset_code = upper($1)';
  return one(db, `SELECT * FROM erp.machines WHERE ${where}`, [v], `Mesin ${v} tidak terdaftar.`, 'MACHINE_NOT_FOUND');
}

/** SKU: id atau kode (NQL-BRF-001). */
export async function resolveSku(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('SKU wajib diisi.', { field: 'sku' });
  const where = isNumId(v) ? 'id = $1::bigint' : 'code = upper($1)';
  return one(db, `SELECT * FROM erp.skus WHERE ${where}`, [v], `SKU ${v} tidak ditemukan.`, 'SKU_NOT_FOUND');
}

/** Material: id atau kode (SP-JRM-DB11). */
export async function resolveMaterial(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  if (!v) throw badRequest('Material wajib diisi.', { field: 'material' });
  const where = isNumId(v) ? 'id = $1::bigint' : 'code = upper($1)';
  return one(db, `SELECT * FROM erp.materials WHERE ${where}`, [v], `Material ${v} tidak ditemukan.`, 'MATERIAL_NOT_FOUND');
}

/** Pelanggan B2B: id atau kode. */
export async function resolveCustomer(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  const where = isNumId(v) ? 'id = $1::bigint' : 'code = upper($1)';
  return one(db, `SELECT * FROM erp.customers WHERE ${where}`, [v], `Klien ${v} tidak ditemukan.`, 'CUSTOMER_NOT_FOUND');
}

/** Lini produksi: id atau kode (SEW-1). Mengembalikan null bila kosong. */
export async function resolveLine(ref: unknown, db: Db = pool) {
  const v = String(ref ?? '').trim();
  if (!v) return null;
  const where = isNumId(v) ? 'id = $1::smallint' : 'code = upper($1)';
  return one(db, `SELECT * FROM erp.production_lines WHERE ${where}`, [v], `Lini ${v} tidak ditemukan.`, 'LINE_NOT_FOUND');
}

/** Tanggal YYYY-MM-DD dari query (opsional). */
export function dateParam(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  return s;
}

/** Alasan wajib (teks tidak kosong). */
export function reasonParam(v: unknown, message = 'Alasan wajib diisi.', code = 'REASON_REQUIRED'): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new AppError(400, code, message, { field: 'reason' });
  return s;
}

/** UUID deterministik (format v5-like) dari string kunci — untuk idempotensi scan offline. */
export function stableUuid(key: string): string {
  const h = crypto.createHash('sha1').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Error bisnis dari DB (P0001) → { code, message } atau null. */
export function pgBusiness(err: any): { code: string; message: string } | null {
  if (err && err.code === 'P0001') return { code: err.hint || 'BUSINESS_RULE', message: err.message };
  return null;
}
