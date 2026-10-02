import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { audit, pool, queryOne } from './db.ts';
import { AppError, forbidden } from './http.ts';

export type Role = 'ADMIN' | 'FOUNDER' | 'FINANCE' | 'SUPERVISOR' | 'STAFF';
export type StaffFn = 'GUDANG' | 'CUTTING' | 'OPERATOR' | 'QC' | 'PACKING' | 'TEKNISI';

export interface AuthUser {
  id: number;
  name: string;
  role: Role;
  staffFunction: StaffFn | null;
  lineId: number | null;
  operatorCode: string | null;
  sessionId: string;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    console.warn('[auth] JWT_SECRET belum di-set di .env — memakai secret acak (token hilang saat restart).');
    return crypto.randomBytes(48).toString('hex');
  })();

export const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC) || 15 * 60;
export const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS) || 7;

interface AccessClaims {
  sub: string;
  sid: string;
  role: Role;
  mcp?: boolean; // must change password
}

export function signAccessToken(c: AccessClaims) {
  return jwt.sign(c, JWT_SECRET, { expiresIn: ACCESS_TTL_SEC, issuer: 'garment-erp' });
}

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

/** Buat sesi (refresh token) baru dan kembalikan pasangan token. */
export async function createSession(
  user: { id: number; role: Role },
  opts: { device?: string | null; ip?: string | null; mustChangePassword?: boolean } = {},
) {
  const refresh = randomToken();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO erp.user_sessions (user_id, refresh_token_hash, device_label, ip_address, expires_at)
     VALUES ($1, $2, $3, $4::inet, now() + make_interval(days => $5)) RETURNING id`,
    [user.id, sha256(refresh), opts.device ?? null, opts.ip ?? null, REFRESH_TTL_DAYS],
  );
  const access = signAccessToken({ sub: String(user.id), sid: row!.id, role: user.role, mcp: !!opts.mustChangePassword });
  return { access_token: access, refresh_token: `${row!.id}.${refresh}`, token_type: 'Bearer', expires_in: ACCESS_TTL_SEC, session_id: row!.id };
}

/**
 * Middleware autentikasi: verifikasi JWT, lalu cek sesi di DB (belum dicabut,
 * belum melewati batas idle per role — FR-00.2, user masih ACTIVE).
 * Setiap request memperbarui last_activity_at, kecuali header `X-Passive: 1`
 * (dipakai polling/SSE agar tidak menahan sesi tetap hidup).
 */
export const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.access_token as string | undefined); // query: utk SSE/unduh PDF
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan login terlebih dahulu.');

    let claims: AccessClaims;
    try {
      claims = jwt.verify(token, JWT_SECRET, { issuer: 'garment-erp' }) as unknown as AccessClaims;
    } catch (e: any) {
      throw new AppError(401, e?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', 'Sesi berakhir. Silakan login kembali.');
    }

    const passive = req.headers['x-passive'] === '1';
    const row = await queryOne(
      `WITH s AS (
         SELECT s.id, u.id AS user_id, u.full_name, u.role, u.staff_function, u.line_id, u.operator_code,
                s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) > now() AS within_idle
         FROM erp.user_sessions s
         JOIN erp.users u ON u.id = s.user_id
         LEFT JOIN erp.session_policies sp ON sp.role = u.role
         WHERE s.id = $1::uuid AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'ACTIVE'
       ), t AS (
         UPDATE erp.user_sessions us SET last_activity_at = now()
         FROM s WHERE us.id = s.id AND s.within_idle AND NOT $3::boolean
       )
       SELECT * FROM s`,
      [claims.sid, Number(claims.sub), passive],
    );
    if (!row) throw new AppError(401, 'SESSION_INVALID', 'Sesi tidak valid atau akun nonaktif. Silakan login kembali.');
    if (!row.within_idle) {
      await pool.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE id = $1`, [row.id]);
      throw new AppError(401, 'SESSION_IDLE_TIMEOUT', 'Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.');
    }

    req.user = {
      id: row.user_id,
      name: row.full_name,
      role: row.role,
      staffFunction: row.staff_function,
      lineId: row.line_id,
      operatorCode: row.operator_code,
      sessionId: row.id,
      mustChangePassword: !!claims.mcp,
    };

    // Akun dengan password awal/hasil reset hanya boleh mengakses endpoint akun
    if (req.user.mustChangePassword && !/\/auth\/(change-password|logout|session|me)$/.test(req.path)) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Anda wajib mengganti password sebelum melanjutkan.');
    }
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * RBAC. Contoh:
 *   allow('ADMIN')                                   → hanya Admin
 *   allow('SUPERVISOR', { staff: ['GUDANG'] })       → Supervisor atau Staff fungsi Gudang
 *   allow({ staff: '*' })                            → semua Staff
 * Penolakan dicatat di audit log (ACCESS_DENIED) — wajib untuk modul Costing (FR-07.2).
 */
export function allow(...specs: (Role | { staff: StaffFn[] | '*' })[]): RequestHandler {
  const roles = specs.filter((s): s is Role => typeof s === 'string');
  const staff = specs.find((s): s is { staff: StaffFn[] | '*' } => typeof s === 'object')?.staff;
  return (req, _res, next) => {
    const u = req.user;
    if (!u) return next(new AppError(401, 'UNAUTHENTICATED', 'Silakan login terlebih dahulu.'));
    const ok =
      roles.includes(u.role) ||
      (u.role === 'STAFF' && staff !== undefined && (staff === '*' || (u.staffFunction !== null && staff.includes(u.staffFunction))));
    if (ok) return next();
    audit({ userId: u.id, action: 'ACCESS_DENIED', entity: req.baseUrl + req.path, note: `${req.method} ditolak untuk ${u.role}${u.staffFunction ? ` (${u.staffFunction})` : ''}`, ip: req.ip });
    next(forbidden());
  };
}

// Role yang boleh melihat data harga/biaya (BOM harga, avg cost, tarif, costing)
export const canSeeCost = (u?: AuthUser) => !!u && ['ADMIN', 'FOUNDER', 'FINANCE'].includes(u.role);
export const canSeeRates = (u?: AuthUser) => !!u && ['ADMIN', 'FOUNDER', 'FINANCE'].includes(u.role);
