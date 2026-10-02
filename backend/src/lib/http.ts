import { NextFunction, Request, RequestHandler, Response } from 'express';

// Format error standar FRD: { error: { code, message, details } }
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

export const badRequest = (message: string, details: Record<string, unknown> = {}, code = 'VALIDATION_ERROR') =>
  new AppError(400, code, message, details);
export const notFound = (message = 'Data tidak ditemukan.', code = 'NOT_FOUND') => new AppError(404, code, message);
export const forbidden = (message = 'Anda tidak memiliki akses ke fitur ini.', code = 'ACCESS_DENIED') =>
  new AppError(403, code, message);
export const conflict = (message: string, code = 'CONFLICT', details: Record<string, unknown> = {}) =>
  new AppError(409, code, message, details);

// Bungkus handler async agar error diteruskan ke errorHandler
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// Kode error bisnis dari DB (HINT) → status HTTP
const HINT_STATUS: Record<string, number> = {
  ACCESS_DENIED: 403,
  USER_INVALID: 403,
  NOT_FOUND: 404,
  INSUFFICIENT_STOCK: 409,
  DUPLICATE: 409,
};

function fromPg(err: any): AppError | null {
  if (!err || typeof err.code !== 'string') return null;
  // P0001 = erp.fn_err: MESSAGE = pesan siap tampil, HINT = kode API
  if (err.code === 'P0001') {
    const code = err.hint || 'BUSINESS_RULE';
    const status = HINT_STATUS[code] ?? (/NOT_FOUND$/.test(code) ? 404 : /(_TAKEN|_DUPLICATE|^DUPLICATE_|^INSUFFICIENT_)/.test(code) ? 409 : 422);
    return new AppError(status, code, err.message);
  }
  if (err.code === '23505') return new AppError(409, 'DUPLICATE', 'Data sudah ada (duplikat).', { constraint: err.constraint });
  if (err.code === '23503') return new AppError(422, 'REFERENCE_INVALID', 'Data referensi tidak ditemukan atau masih dipakai.', { constraint: err.constraint });
  if (err.code === '23514') return new AppError(422, 'CHECK_VIOLATION', 'Data tidak memenuhi aturan validasi.', { constraint: err.constraint });
  if (err.code === '23502') return new AppError(400, 'VALIDATION_ERROR', `Kolom ${err.column} wajib diisi.`);
  if (err.code === '22P02' || err.code === '22003' || err.code === '22007' || err.code === '22008')
    return new AppError(400, 'VALIDATION_ERROR', 'Format data tidak valid.', { detail: err.message });
  if (err.code === '40001' || err.code === '40P01') return new AppError(409, 'CONCURRENT_UPDATE', 'Data sedang diubah pengguna lain. Coba lagi.');
  return null;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const appErr = err instanceof AppError ? err : fromPg(err);
  if (appErr) {
    return res.status(appErr.status).json({ error: { code: appErr.code, message: appErr.message, details: appErr.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body JSON tidak valid.', details: {} } });
  }
  console.error('[ERP API] Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.', details: {} } });
}

// ---------------------------------------------------------------------
// Validasi input sederhana
// ---------------------------------------------------------------------
export function required<T extends Record<string, any>>(body: T, fields: (keyof T & string)[]) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
  if (missing.length) throw badRequest(`Field wajib diisi: ${missing.join(', ')}.`, { missing });
}

export function num(value: unknown, field: string, opts: { min?: number; max?: number; int?: boolean; gt?: number } = {}): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : (value as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest(`${field} harus berupa angka.`, { field });
  if (opts.int && !Number.isInteger(n)) throw badRequest(`${field} harus bilangan bulat.`, { field });
  if (opts.gt !== undefined && !(n > opts.gt)) throw badRequest(`${field} harus lebih dari ${opts.gt}.`, { field });
  if (opts.min !== undefined && n < opts.min) throw badRequest(`${field} minimal ${opts.min}.`, { field });
  if (opts.max !== undefined && n > opts.max) throw badRequest(`${field} maksimal ${opts.max}.`, { field });
  return n;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw badRequest(`${field} harus salah satu dari: ${allowed.join(', ')}.`, { field });
  return value as T;
}

// Query string paging: ?page=1&limit=50 (maks 200)
export function paging(q: Record<string, any>) {
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const page = Math.max(Number(q.page) || 1, 1);
  return { limit, offset: (page - 1) * limit, page };
}

// Ambil id numerik dari param; menerima "123" atau "USR-123". Nomor dokumen
// seperti SPK-2026-0101 BUKAN id — resolve lewat kolom nomor dokumennya.
export function idParam(value: string, field = 'id'): number {
  const m = String(value).match(/^(?:[A-Za-z]+-)?(\d+)$/);
  if (!m) throw badRequest(`${field} tidak valid.`, { field });
  return Number(m[1]);
}
