// FR-00.1 User Authentication & Login · FR-00.2 Session Management
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { audit, cleanIp, pool, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, required } from '../lib/http.ts';
import { authenticate, createSession, randomToken, sha256, signAccessToken } from '../lib/auth.ts';

export const authRouter = express.Router();

const RESET_SECRET = process.env.JWT_SECRET ? process.env.JWT_SECRET + ':reset' : crypto.randomBytes(32).toString('hex');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const LOGIN_STATUS: Record<string, number> = { BAD_CREDENTIALS: 401, ACCOUNT_LOCKED: 423, ACCOUNT_INACTIVE: 403, GOOGLE_NOT_REGISTERED: 403, OPERATOR_INVALID: 401, BAD_PIN: 401 };

function loginFail(r: any): never {
  throw new AppError(LOGIN_STATUS[r.code] ?? 401, r.code, r.message, r.attempts_left !== undefined ? { attempts_left: r.attempts_left } : {});
}

// POST /auth/login — username/email + password (bcrypt diverifikasi di erp.fn_login)
authRouter.post('/login', ah(async (req, res) => {
  const login = req.body?.username ?? req.body?.email ?? req.body?.identifier;
  required({ login, password: req.body?.password }, ['login', 'password']);
  const ip = cleanIp(req.ip);
  const r = (await queryOne(`SELECT erp.fn_login($1, $2, $3::inet, $4) AS r`, [String(login), String(req.body.password), ip, req.get('user-agent') ?? null]))!.r;
  if (!r.ok) loginFail(r);

  const tokens = await createSession({ id: r.user_id, role: r.role }, { device: req.body.device_label ?? req.get('user-agent')?.slice(0, 120), ip, mustChangePassword: r.must_change_password });
  await audit({ userId: r.user_id, action: 'LOGIN', entity: 'auth', entityId: r.user_id, note: 'Login standar berhasil', ip });
  res.json({
    ...tokens,
    user: { id: `USR-${String(r.user_id).padStart(3, '0')}`, raw_id: r.user_id, name: r.name, username: r.username, role: r.role, staff_function: r.staff_function },
    must_change_password: r.must_change_password,
    idle_minutes: r.idle_minutes,
    redirect: r.redirect,
  });
}));

// POST /auth/refresh — rotasi refresh token
authRouter.post('/refresh', ah(async (req, res) => {
  const raw = String(req.body?.refresh_token || '');
  const [sid, secret] = raw.split('.');
  if (!sid || !secret || !/^[0-9a-f-]{36}$/i.test(sid)) throw new AppError(401, 'TOKEN_INVALID', 'Refresh token tidak valid.');
  const next = randomToken();
  const row = await queryOne(
    `UPDATE erp.user_sessions s SET refresh_token_hash = $3
     FROM erp.users u LEFT JOIN erp.session_policies sp ON sp.role = u.role
     WHERE s.id = $1::uuid AND s.refresh_token_hash = $2 AND u.id = s.user_id AND s.revoked_at IS NULL
       AND s.expires_at > now() AND u.status = 'ACTIVE'
       AND s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) > now()
     RETURNING s.id, u.id AS user_id, u.role, coalesce(sp.idle_minutes, 15) AS idle_minutes,
               (SELECT must_change_password FROM erp.user_logins WHERE user_id = u.id) AS mcp`,
    [sid, sha256(secret), sha256(next)],
  );
  if (!row) throw new AppError(401, 'SESSION_INVALID', 'Sesi berakhir. Silakan login kembali.');
  res.json({
    access_token: signAccessToken({ sub: String(row.user_id), sid: row.id, role: row.role, mcp: !!row.mcp }),
    refresh_token: `${row.id}.${next}`,
    token_type: 'Bearer',
    idle_minutes: row.idle_minutes,
  });
}));

// POST /auth/logout
authRouter.post('/logout', authenticate, ah(async (req, res) => {
  await pool.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE id = $1`, [req.user!.sessionId]);
  await audit({ userId: req.user!.id, action: 'LOGOUT', entity: 'auth', entityId: req.user!.id, ip: req.ip });
  res.json({ status: 'OK' });
}));

// GET /auth/session — status sesi & sisa waktu idle (tidak memperpanjang sesi)
authRouter.get('/session', (req, _res, next) => { req.headers['x-passive'] = '1'; next(); }, authenticate, ah(async (req, res) => {
  const s = await queryOne(
    `SELECT s.created_at, s.last_activity_at, s.expires_at, coalesce(sp.idle_minutes, 15) AS idle_minutes,
            greatest(0, extract(epoch FROM s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) - now()))::int AS idle_seconds_left
     FROM erp.user_sessions s JOIN erp.users u ON u.id = s.user_id LEFT JOIN erp.session_policies sp ON sp.role = u.role
     WHERE s.id = $1`, [req.user!.sessionId]);
  res.json({ active: true, user: req.user, ...s });
}));

// POST /auth/keepalive — tombol "Tetap Masuk" (memperpanjang idle)
authRouter.post('/keepalive', authenticate, (_req, res) => { res.json({ status: 'OK' }); });

// GET /auth/me
authRouter.get('/me', authenticate, (req, res) => { res.json({ user: req.user }); });

// POST /auth/change-password — wajib bagi akun must_change_password
authRouter.post('/change-password', authenticate, ah(async (req, res) => {
  required(req.body ?? {}, ['old_password', 'new_password']);
  const u = req.user!;
  await withTx(u.id, (c) => c.query(`SELECT erp.fn_set_password($1, $2, $1, $3)`, [u.id, req.body.new_password, req.body.old_password]));
  await pool.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [u.id]);
  const tokens = await createSession({ id: u.id, role: u.role }, { device: req.get('user-agent')?.slice(0, 120), ip: cleanIp(req.ip) });
  res.json({ status: 'OK', message: 'Password berhasil diganti.', ...tokens });
}));

// POST /auth/forgot-password — kirim tautan reset (respons selalu generik)
authRouter.post('/forgot-password', ah(async (req, res) => {
  const login = String(req.body?.email ?? req.body?.username ?? '').trim().toLowerCase();
  if (!login) throw badRequest('Email atau username wajib diisi.');
  const row = await queryOne(
    `SELECT u.id, u.email, l.password_hash FROM erp.user_logins l JOIN erp.users u ON u.id = l.user_id
     WHERE (lower(l.username) = $1 OR lower(u.email) = $1) AND u.status = 'ACTIVE'`, [login]);
  if (row) {
    // Token sekali pakai: terikat ke fingerprint hash password saat ini
    const token = jwt.sign({ sub: String(row.id), fp: sha256(row.password_hash).slice(0, 16) }, RESET_SECRET, { expiresIn: '30m' });
    const link = `${FRONTEND_URL}/reset-password?token=${token}`;
    // TODO: kirim email via SMTP bila dikonfigurasi. Sementara dicatat di log server.
    console.log(`[auth] Tautan reset password untuk ${row.email ?? login}: ${link}`);
    await audit({ userId: row.id, action: 'PASSWORD_RESET_REQUEST', entity: 'user_logins', entityId: row.id, ip: req.ip });
  }
  res.json({ status: 'OK', message: 'Jika akun terdaftar, tautan reset password telah dikirim.' });
}));

// POST /auth/reset-password — set password baru dari tautan reset
authRouter.post('/reset-password', ah(async (req, res) => {
  required(req.body ?? {}, ['token', 'new_password']);
  let claims: any;
  try { claims = jwt.verify(req.body.token, RESET_SECRET); } catch { throw new AppError(400, 'RESET_TOKEN_INVALID', 'Tautan reset tidak valid atau kedaluwarsa.'); }
  const userId = Number(claims.sub);
  await withTx(userId, async (c) => {
    const l = (await c.query(`SELECT password_hash FROM erp.user_logins WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
    if (!l || sha256(l.password_hash).slice(0, 16) !== claims.fp) throw new AppError(400, 'RESET_TOKEN_INVALID', 'Tautan reset sudah dipakai atau kedaluwarsa.');
    await c.query(`SELECT erp.fn_password_policy_check($1)`, [req.body.new_password]);
    await c.query(
      `UPDATE erp.user_logins SET password_hash = crypt($2, gen_salt('bf', 10)), password_changed_at = now(),
              must_change_password = false, failed_count = 0, locked_until = NULL WHERE user_id = $1`, [userId, req.body.new_password]);
    await c.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await c.query(`INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, note) VALUES ($1, 'PASSWORD_RESET', 'user_logins', $1::text, 'Reset via tautan email')`, [userId]);
  });
  res.json({ status: 'OK', message: 'Password berhasil diubah. Silakan login.' });
}));

// ---------------------------------------------------------------------
// Google SSO (OAuth 2.0) — butuh GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// ---------------------------------------------------------------------
const google = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/google/callback',
};

authRouter.get('/google', (_req, res) => {
  if (!google.id || !google.secret) {
    return res.status(501).json({ error: { code: 'GOOGLE_NOT_CONFIGURED', message: 'Login Google belum dikonfigurasi. Gunakan login standar.', details: {} } });
  }
  const state = jwt.sign({ n: randomToken() }, RESET_SECRET, { expiresIn: '10m' });
  const p = new URLSearchParams({ client_id: google.id, redirect_uri: google.redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

authRouter.get('/google/callback', ah(async (req, res) => {
  const fail = (code: string, msg: string) => res.redirect(`${FRONTEND_URL}/login?error=${code}&message=${encodeURIComponent(msg)}`);
  const genericMsg = 'Login Google gagal. Silakan coba lagi atau gunakan login standar.';
  try { jwt.verify(String(req.query.state || ''), RESET_SECRET); } catch { return fail('OAUTH_FAILED', genericMsg); }
  if (!req.query.code || !google.id || !google.secret) return fail('OAUTH_FAILED', genericMsg);

  let profile: { email?: string; sub?: string; email_verified?: string | boolean; aud?: string };
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(req.query.code), client_id: google.id, client_secret: google.secret, redirect_uri: google.redirect, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10000),
    });
    const tok: any = await tokenRes.json();
    if (!tok.id_token) return fail('OAUTH_FAILED', genericMsg);
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tok.id_token}`, { signal: AbortSignal.timeout(10000) });
    profile = (await info.json()) as typeof profile;
  } catch {
    return fail('OAUTH_FAILED', genericMsg);
  }
  if (profile.aud !== google.id || !profile.email || String(profile.email_verified) !== 'true') return fail('OAUTH_FAILED', genericMsg);

  const ip = cleanIp(req.ip);
  const r = (await queryOne(`SELECT erp.fn_login_google($1, $2, $3::inet, $4) AS r`, [profile.email, profile.sub, ip, req.get('user-agent') ?? null]))!.r;
  if (!r.ok) return fail(r.code, r.message);
  const tokens = await createSession({ id: r.user_id, role: r.role }, { device: 'Google SSO', ip });
  await audit({ userId: r.user_id, action: 'LOGIN', entity: 'auth', entityId: r.user_id, note: 'Login Google SSO berhasil', ip });
  const frag = new URLSearchParams({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, redirect: r.redirect });
  res.redirect(`${FRONTEND_URL}/auth/callback#${frag}`);
}));

// ---------------------------------------------------------------------
// FR-04.1 — Login operator kios via kode operator + PIN
// ---------------------------------------------------------------------
export const kioskAuthRouter = express.Router();
kioskAuthRouter.post('/operator-login', ah(async (req, res) => {
  const code = req.body?.operator_id ?? req.body?.operator_code;
  required({ code, pin: req.body?.pin }, ['code', 'pin']);
  const r = (await queryOne(`SELECT erp.fn_kiosk_login($1, $2) AS r`, [String(code), String(req.body.pin)]))!.r;
  if (!r.ok) loginFail(r);
  const role = (await queryOne(`SELECT role FROM erp.users WHERE id = $1`, [r.user_id]))!.role;
  const tokens = await createSession({ id: r.user_id, role }, { device: req.body.device_label ?? 'Kios', ip: cleanIp(req.ip) });
  res.json({ ...tokens, operator: { id: r.user_id, code: String(code).toUpperCase(), name: r.name, role, function: r.function, line_id: r.line_id } });
}));
