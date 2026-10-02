// FR-00.2 Session Policy · FR-00.3 User & Role Management + Audit Trail · FR-07.4 Notifications & Alerts
// Endpoint: /settings/*, /users/*, /sessions/*, /roles/*, /audit-logs, /login-attempts, /notifications/*
import express, { Request } from 'express';
import { PoolClient } from 'pg';
import { audit, query, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, conflict, forbidden, notFound, num, oneOf, paging, required } from '../lib/http.ts';
import { allow, AuthUser, Role } from '../lib/auth.ts';

export const adminRouter = express.Router();

const ROLES: readonly Role[] = ['ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR', 'STAFF'];
const STAFF_FNS = ['GUDANG', 'CUTTING', 'OPERATOR', 'QC', 'PACKING', 'TEKNISI'] as const;
const MODULES = ['USER_MGMT', 'BOM', 'SMV_RATE', 'BRAND_SKU', 'SAMPLE', 'MACHINE', 'RECEIVING', 'STOCK', 'WORK_ORDER',
  'CUTTING', 'BUNDLE', 'WIP_SCAN', 'DOWNTIME', 'QC', 'TRACEABILITY', 'RETURN', 'PACKING', 'DISPATCH', 'PAYROLL',
  'COSTING', 'ANALYTICS', 'AUDIT'] as const;
const PERM_FLAGS = ['can_create', 'can_read', 'can_update', 'can_delete', 'can_approve'] as const;
const DUP_MSG = 'Email/Operator ID sudah digunakan.';

const userCode = (id: number) => `USR-${String(id).padStart(3, '0')}`;
const isTrue = (v: unknown) => v === true || v === 'true' || v === '1' || v === 1;
const str = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

// =====================================================================
// Resolver
// =====================================================================

// {id} user: "12", "USR-012", kode operator (OP-0118) atau username (admin)
async function resolveUserId(raw: string, c?: PoolClient): Promise<number> {
  const v = String(raw).trim();
  const m = v.match(/^(?:USR-)?(\d+)$/i);
  const sql = m
    ? `SELECT id FROM erp.users WHERE id = $1`
    : `SELECT u.id FROM erp.users u LEFT JOIN erp.user_logins l ON l.user_id = u.id
       WHERE u.operator_code = upper($1) OR lower(l.username) = lower($1) OR lower(u.email) = lower($1) LIMIT 1`;
  const params = [m ? Number(m[1]) : v];
  const row = c ? (await c.query(sql, params)).rows[0] : await queryOne(sql, params);
  if (!row) throw notFound('Pengguna tidak ditemukan.', 'USER_NOT_FOUND');
  return Number(row.id);
}

// Lini produksi: id atau kode (SEW-1)
async function resolveLineId(raw: unknown, c: PoolClient): Promise<number | null> {
  const v = str(raw);
  if (v === null) return null;
  const r = (await c.query(`SELECT id FROM erp.production_lines WHERE id::text = $1 OR upper(code) = upper($1)`, [v])).rows[0];
  if (!r) throw badRequest('Lini produksi tidak ditemukan.', { field: 'line_id' });
  return Number(r.id);
}

// =====================================================================
// Users (FR-00.3) — tidak pernah mengembalikan password_hash / pin_hash
// =====================================================================
const USER_SELECT = `
  SELECT u.id, u.full_name, u.email, u.role, u.staff_function, u.operator_code, u.line_id,
         pl.code AS line_code, pl.name AS line_name, u.status,
         (u.pin_hash IS NOT NULL) AS has_pin,
         (l.user_id IS NOT NULL) AS has_login, l.username, l.must_change_password, l.password_changed_at,
         coalesce(l.failed_count, 0) AS login_failed_count, l.locked_until AS login_locked_until,
         u.failed_login_count AS pin_failed_count, u.locked_until AS pin_locked_until,
         (coalesce(l.locked_until > now(), false) OR coalesce(u.locked_until > now(), false)) AS is_locked,
         greatest(u.last_login_at, l.last_login_at) AS last_login_at,
         (u.google_sub IS NOT NULL) AS google_linked,
         (SELECT count(*) FROM erp.user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS active_sessions,
         u.created_at, u.updated_at, u.deactivated_at,
         count(*) OVER () AS _total
  FROM erp.users u
  LEFT JOIN erp.user_logins l ON l.user_id = u.id
  LEFT JOIN erp.production_lines pl ON pl.id = u.line_id`;

function shapeUser(r: any) {
  if (!r) return r;
  const { _total, ...rest } = r;
  return { ...rest, code: userCode(r.id) };
}

async function loadUser(id: number) {
  const r = await queryOne(`${USER_SELECT} WHERE u.id = $1`, [id]);
  if (!r) throw notFound('Pengguna tidak ditemukan.', 'USER_NOT_FOUND');
  return shapeUser(r);
}

// Supervisor hanya boleh melihat/membuka kunci akun Staff (operator) — FR-SPV-12
function assertScope(me: AuthUser, target: { role: Role }) {
  if (me.role === 'SUPERVISOR' && target.role !== 'STAFF') throw forbidden('Supervisor hanya dapat mengelola akun Staff/operator.');
}

function validPin(pin: unknown) {
  const p = String(pin ?? '');
  if (!/^\d{4,6}$/.test(p)) throw badRequest('PIN harus 4–6 digit angka.', { field: 'pin' });
  return p;
}

// Cek duplikat email / kode operator (pesan FRD), id dikecualikan saat update
async function assertUnique(c: PoolClient, email: string | null, opCode: string | null, exceptId: number | null) {
  if (!email && !opCode) return;
  const r = (await c.query(
    `SELECT 1 FROM erp.users WHERE id IS DISTINCT FROM $3
       AND ((($1)::text IS NOT NULL AND lower(email) = lower($1)) OR (($2)::text IS NOT NULL AND operator_code = upper($2))) LIMIT 1`,
    [email, opCode, exceptId])).rows[0];
  if (r) throw conflict(DUP_MSG, 'DUPLICATE');
}

// Pelanggaran unik (race) → pesan FRD
function mapDup(e: any): never {
  if (e?.code === '23505' && /users_(email|operator_code)/.test(e.constraint ?? '')) throw conflict(DUP_MSG, 'DUPLICATE');
  throw e;
}

// Normalisasi role/fungsi staff sesuai constraint users_staff_fn_ck
function roleFields(body: any, current?: { role: Role; staff_function: string | null }) {
  const role = body.role !== undefined ? oneOf(String(body.role).toUpperCase(), ROLES, 'role') : current?.role;
  let fn: string | null | undefined = body.staff_function !== undefined ? str(body.staff_function)?.toUpperCase() ?? null : current?.staff_function;
  if (role === 'STAFF') {
    if (!fn) throw badRequest('Fungsi staff wajib diisi untuk role Staff.', { field: 'staff_function' });
    oneOf(fn, STAFF_FNS, 'staff_function');
  } else {
    fn = null; // role non-Staff tidak memiliki fungsi staff
  }
  return { role: role as Role, staffFunction: fn };
}

// GET /users — Admin (semua), Supervisor (hanya Staff, untuk buka kunci operator)
adminRouter.get('/users', allow('ADMIN', 'SUPERVISOR'), ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const { limit, offset, page } = paging(q);
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)); };

  if (req.user!.role === 'SUPERVISOR') add(`u.role = ?::erp.user_role`, 'STAFF');
  if (q.role) add(`u.role = ?::erp.user_role`, oneOf(String(q.role).toUpperCase(), ROLES, 'role'));
  if (q.status) add(`u.status = ?::erp.record_status`, oneOf(String(q.status).toUpperCase(), ['ACTIVE', 'INACTIVE'] as const, 'status'));
  if (q.staff_function) add(`u.staff_function = ?::erp.staff_function`, oneOf(String(q.staff_function).toUpperCase(), STAFF_FNS, 'staff_function'));
  if (q.line) { p.push(String(q.line)); where.push(`(u.line_id::text = $${p.length} OR pl.code = upper($${p.length}))`); }
  if (q.locked !== undefined && isTrue(q.locked)) where.push(`(l.locked_until > now() OR u.locked_until > now())`);
  if (q.q) {
    p.push(`%${String(q.q).trim()}%`);
    const i = `$${p.length}`;
    where.push(`(u.full_name ILIKE ${i} OR u.email ILIKE ${i} OR u.operator_code ILIKE ${i} OR l.username ILIKE ${i})`);
  }
  p.push(limit, offset);
  const rows = await query(
    `${USER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.status, u.role, u.full_name LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  res.json({ data: rows.map(shapeUser), page, limit, total: rows[0]?._total ?? 0 });
}));

// GET /users/{id}
adminRouter.get('/users/:id', allow('ADMIN', 'SUPERVISOR'), ah(async (req, res) => {
  const u = await loadUser(await resolveUserId(req.params.id));
  assertScope(req.user!, u);
  res.json(u);
}));

// POST /users — buat akun (+ PIN kios opsional, + username/password awal opsional)
adminRouter.post('/users', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const fullName = str(b.full_name ?? b.name);
  required({ full_name: fullName, role: b.role }, ['full_name', 'role']);
  const { role, staffFunction } = roleFields(b);
  const email = str(b.email)?.toLowerCase() ?? null;
  const opCode = str(b.operator_code ?? b.operator_id)?.toUpperCase() ?? null;
  if (!email && !opCode) throw badRequest('Email atau kode operator wajib diisi salah satu.', { fields: ['email', 'operator_code'] });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Format email tidak valid.', { field: 'email' });
  const pin = str(b.pin) !== null ? validPin(b.pin) : null;
  if (pin && !opCode) throw badRequest('PIN kios membutuhkan kode operator.', { field: 'operator_code' });
  const username = str(b.username);
  const password = b.password ?? b.initial_password;
  if ((username && !password) || (!username && password)) throw badRequest('Username dan password awal harus diisi bersamaan.', { fields: ['username', 'password'] });

  const me = req.user!;
  const id = await withTx(me.id, async (c) => {
    const lineId = await resolveLineId(b.line_id ?? b.line, c);
    await assertUnique(c, email, opCode, null);
    const r = await c.query(
      `INSERT INTO erp.users (full_name, email, role, staff_function, operator_code, pin_hash, line_id)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::text IS NULL THEN NULL ELSE crypt($6, gen_salt('bf')) END, $7) RETURNING id`,
      [fullName, email, role, staffFunction, opCode, pin, lineId]).catch(mapDup);
    const newId = Number(r.rows[0].id);
    if (username) await c.query(`SELECT erp.fn_set_password($1, $2, $3, NULL, $4)`, [newId, String(password), me.id, username]);
    return newId;
  });
  res.status(201).json(await loadUser(id));
}));

// PUT /users/{id} — ubah profil (nama, email, role, fungsi, kode operator, lini)
adminRouter.put('/users/:id', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const me = req.user!;
  const id = await resolveUserId(req.params.id);
  await withTx(me.id, async (c) => {
    const cur = (await c.query(`SELECT * FROM erp.users WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    const { role, staffFunction } = roleFields(b, cur);
    const fullName = b.full_name !== undefined || b.name !== undefined ? str(b.full_name ?? b.name) : cur.full_name;
    if (!fullName) throw badRequest('Nama wajib diisi.', { field: 'full_name' });
    const email = b.email !== undefined ? str(b.email)?.toLowerCase() ?? null : cur.email;
    const opCode = b.operator_code !== undefined || b.operator_id !== undefined ? str(b.operator_code ?? b.operator_id)?.toUpperCase() ?? null : cur.operator_code;
    if (!email && !opCode) throw badRequest('Email atau kode operator wajib diisi salah satu.', { fields: ['email', 'operator_code'] });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Format email tidak valid.', { field: 'email' });
    const lineId = b.line_id !== undefined || b.line !== undefined ? await resolveLineId(b.line_id ?? b.line, c) : cur.line_id;
    // Menurunkan role Admin aktif terakhir sama dengan menghilangkan Admin terakhir
    if (cur.role === 'ADMIN' && role !== 'ADMIN' && cur.status === 'ACTIVE') {
      const other = (await c.query(`SELECT 1 FROM erp.users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id <> $1 LIMIT 1`, [id])).rows[0];
      if (!other) throw new AppError(422, 'LAST_ADMIN', 'Minimal harus ada satu Admin aktif.');
    }
    await assertUnique(c, email, opCode, id);
    await c.query(
      `UPDATE erp.users SET full_name = $2, email = $3, role = $4, staff_function = $5, operator_code = $6, line_id = $7,
              pin_hash = CASE WHEN $6::text IS NULL THEN NULL ELSE pin_hash END
       WHERE id = $1`,
      [id, fullName, email, role, staffFunction, opCode, lineId]).catch(mapDup);
    // Role berubah → cabut sesi agar konteks hak akses dimuat ulang
    if (role !== cur.role) await c.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
  });
  res.json(await loadUser(id));
}));

// PATCH /users/{id}/deactivate — trigger menolak Admin aktif terakhir (LAST_ADMIN); semua sesi dicabut
adminRouter.patch('/users/:id/deactivate', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveUserId(req.params.id);
  const revoked = await withTx(req.user!.id, async (c) => {
    await c.query(`UPDATE erp.users SET status = 'INACTIVE' WHERE id = $1 AND status = 'ACTIVE'`, [id]);
    const r = await c.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    return r.rowCount ?? 0;
  });
  res.json({ ...(await loadUser(id)), sessions_revoked: revoked });
}));

// PATCH /users/{id}/activate
adminRouter.patch('/users/:id/activate', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveUserId(req.params.id);
  await withTx(req.user!.id, (c) => c.query(`UPDATE erp.users SET status = 'ACTIVE' WHERE id = $1 AND status = 'INACTIVE'`, [id]));
  res.json(await loadUser(id));
}));

// POST /users/{id}/reset-password — Admin; membuat login bila belum ada (username wajib).
// Alias: POST /users/{id}/login (FR-ADM-01). User wajib ganti password saat login berikutnya.
const resetPassword = ah(async (req: Request, res) => {
  const b = req.body ?? {};
  const password = b.new_password ?? b.password;
  required({ password }, ['password']);
  const me = req.user!;
  const id = await resolveUserId(req.params.id);
  await withTx(me.id, async (c) => {
    await c.query(`SELECT erp.fn_set_password($1, $2, $3, NULL, $4)`, [id, String(password), me.id, str(b.username)]);
    if (id !== me.id) await c.query(`UPDATE erp.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
  });
  res.json({ status: 'OK', message: 'Password berhasil diatur. Pengguna wajib mengganti password saat login berikutnya.', user: await loadUser(id) });
});
adminRouter.post('/users/:id/reset-password', allow('ADMIN'), resetPassword);
adminRouter.post('/users/:id/login', allow('ADMIN'), resetPassword);

// PUT /users/{id}/pin — set/ganti PIN kios (bcrypt). Body { pin } ; pin null → hapus PIN
adminRouter.put('/users/:id/pin', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveUserId(req.params.id);
  const remove = req.body?.pin === null;
  const pin = remove ? null : validPin(req.body?.pin);
  await withTx(req.user!.id, async (c) => {
    const u = (await c.query(`SELECT operator_code FROM erp.users WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!remove && !u.operator_code) throw badRequest('Pengguna belum memiliki kode operator untuk login kios.', { field: 'operator_code' });
    await c.query(
      `UPDATE erp.users SET pin_hash = CASE WHEN $2::text IS NULL THEN NULL ELSE crypt($2, gen_salt('bf')) END,
              failed_login_count = 0, locked_until = NULL WHERE id = $1`, [id, pin]);
    await audit({ userId: req.user!.id, action: remove ? 'PIN_REMOVE' : 'PIN_SET', entity: 'users', entityId: id, note: remove ? 'PIN kios dihapus oleh Admin' : 'PIN kios diatur oleh Admin', ip: req.ip }, c);
  });
  res.json({ status: 'OK', message: remove ? 'PIN kios dihapus.' : 'PIN kios berhasil diatur.', user: await loadUser(id) });
}));

// POST /users/{id}/unlock — Admin (semua) / Supervisor (Staff saja) → fn_unlock_login
adminRouter.post('/users/:id/unlock', allow('ADMIN', 'SUPERVISOR'), ah(async (req, res) => {
  const id = await resolveUserId(req.params.id);
  const target = await queryOne(`SELECT role FROM erp.users WHERE id = $1`, [id]);
  assertScope(req.user!, target);
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_unlock_login($1, $2)`, [id, req.user!.id]));
  res.json({ status: 'OK', message: 'Kunci login berhasil dibuka.', user: await loadUser(id) });
}));

// GET /users/{id}/sessions — sesi aktif user
adminRouter.get('/users/:id/sessions', allow('ADMIN'), ah(async (req, res) => {
  const id = await resolveUserId(req.params.id);
  const all = isTrue(req.query.all);
  const rows = await query(
    `SELECT s.id, s.device_label, host(s.ip_address) AS ip_address, s.created_at, s.last_activity_at, s.expires_at, s.revoked_at,
            (s.revoked_at IS NULL AND s.expires_at > now()
              AND s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) > now()) AS is_active,
            s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) AS idle_expires_at
     FROM erp.user_sessions s JOIN erp.users u ON u.id = s.user_id LEFT JOIN erp.session_policies sp ON sp.role = u.role
     WHERE s.user_id = $1 AND ($2 OR (s.revoked_at IS NULL AND s.expires_at > now()))
     ORDER BY s.last_activity_at DESC LIMIT 100`, [id, all]);
  res.json({ data: rows.map((r) => ({ ...r, is_current: r.id === req.user!.sessionId })) });
}));

// DELETE /sessions/{id} — paksa logout
adminRouter.delete('/sessions/:id', allow('ADMIN'), ah(async (req, res) => {
  const sid = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(sid)) throw badRequest('ID sesi tidak valid.', { field: 'id' });
  const r = await withTx(req.user!.id, async (c) => {
    const row = (await c.query(
      `UPDATE erp.user_sessions SET revoked_at = coalesce(revoked_at, now()) WHERE id = $1::uuid RETURNING id, user_id, revoked_at`, [sid])).rows[0];
    if (!row) throw notFound('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
    await audit({ userId: req.user!.id, action: 'SESSION_REVOKE', entity: 'user_sessions', entityId: row.user_id, note: `Sesi ${sid} diakhiri paksa oleh Admin`, ip: req.ip }, c);
    return row;
  });
  res.json({ status: 'OK', message: 'Sesi berhasil diakhiri.', session_id: r.id, user_id: r.user_id, revoked_at: r.revoked_at });
}));

// =====================================================================
// Roles & permission matrix (FR-00.3 / FR-ADM-03)
// =====================================================================
const LOCKED: Record<string, string[]> = { COSTING: ['SUPERVISOR', 'STAFF'], PAYROLL: ['SUPERVISOR'] };

async function rolePermissions(role: Role) {
  const rows = await query(
    `SELECT m.module, coalesce(rp.can_create, false) AS can_create, coalesce(rp.can_read, false) AS can_read,
            coalesce(rp.can_update, false) AS can_update, coalesce(rp.can_delete, false) AS can_delete,
            coalesce(rp.can_approve, false) AS can_approve, rp.scope_note, rp.updated_at
     FROM unnest(enum_range(NULL::erp.app_module)) AS m(module)
     LEFT JOIN erp.role_permissions rp ON rp.module = m.module AND rp.role = $1::erp.user_role
     ORDER BY m.module`, [role]);
  return rows.map((r) => ({ ...r, locked: (LOCKED[r.module] ?? []).includes(role) }));
}

// GET /roles — ringkasan per role
adminRouter.get('/roles', allow('ADMIN'), ah(async (_req, res) => {
  const rows = await query(
    `SELECT r.role,
            (SELECT count(*) FROM erp.users u WHERE u.role = r.role AND u.status = 'ACTIVE') AS active_users,
            (SELECT count(*) FROM erp.users u WHERE u.role = r.role) AS total_users,
            coalesce(sp.idle_minutes, 15) AS idle_minutes,
            (SELECT count(*) FROM erp.role_permissions rp WHERE rp.role = r.role
               AND (rp.can_create OR rp.can_read OR rp.can_update OR rp.can_delete OR rp.can_approve)) AS modules_granted
     FROM unnest(enum_range(NULL::erp.user_role)) AS r(role)
     LEFT JOIN erp.session_policies sp ON sp.role = r.role
     ORDER BY array_position(enum_range(NULL::erp.user_role), r.role)`);
  res.json({ data: rows });
}));

// GET /roles/{role}/permissions — Admin semua role; role lain hanya role sendiri (untuk menu)
adminRouter.get('/roles/:role/permissions', ah(async (req, res) => {
  const role = oneOf(String(req.params.role).toUpperCase(), ROLES, 'role');
  const me = req.user!;
  if (me.role !== 'ADMIN' && me.role !== role) {
    await audit({ userId: me.id, action: 'ACCESS_DENIED', entity: req.baseUrl + req.path, note: `GET ditolak untuk ${me.role}`, ip: req.ip });
    throw forbidden();
  }
  res.json({ role, modules: await rolePermissions(role) });
}));

// PUT /roles/{role}/permissions — body { permissions: [{ module, can_create, ... }] } atau array langsung
adminRouter.put('/roles/:role/permissions', allow('ADMIN'), ah(async (req, res) => {
  const role = oneOf(String(req.params.role).toUpperCase(), ROLES, 'role');
  const list = Array.isArray(req.body) ? req.body : req.body?.permissions ?? req.body?.modules;
  if (!Array.isArray(list) || !list.length) throw badRequest('permissions wajib berupa array modul.', { field: 'permissions' });
  const items = list.map((p: any) => {
    const module = oneOf(String(p?.module ?? '').toUpperCase(), MODULES, 'module');
    const flags = Object.fromEntries(PERM_FLAGS.map((f) => [f, p[f] === undefined ? undefined : isTrue(p[f])]));
    const short = p.c ?? p.C; // dukung format singkat { module, c, r, u, d, a }
    if (short !== undefined || p.r !== undefined) {
      (['c', 'r', 'u', 'd', 'a'] as const).forEach((k, i) => { if (p[k] !== undefined) flags[PERM_FLAGS[i]] = isTrue(p[k]); });
    }
    return { module, flags, scope_note: p.scope_note };
  });
  // Validasi kunci sistem di API (trigger DB juga menolak)
  for (const it of items) {
    if ((LOCKED[it.module] ?? []).includes(role) && PERM_FLAGS.some((f) => it.flags[f])) {
      if (it.module === 'COSTING') throw new AppError(422, 'COSTING_LOCKED', 'Modul Costing hanya untuk Founder & Finance.');
      throw new AppError(422, 'PAYROLL_LOCKED', 'Modul Payroll tidak tersedia untuk Supervisor.');
    }
  }
  await withTx(req.user!.id, async (c) => {
    for (const it of items) {
      const f = it.flags;
      await c.query(
        `INSERT INTO erp.role_permissions (role, module, can_create, can_read, can_update, can_delete, can_approve, scope_note)
         VALUES ($1, $2, coalesce($3, false), coalesce($4, false), coalesce($5, false), coalesce($6, false), coalesce($7, false), $8)
         ON CONFLICT (role, module) DO UPDATE SET
           can_create = coalesce($3, erp.role_permissions.can_create), can_read = coalesce($4, erp.role_permissions.can_read),
           can_update = coalesce($5, erp.role_permissions.can_update), can_delete = coalesce($6, erp.role_permissions.can_delete),
           can_approve = coalesce($7, erp.role_permissions.can_approve),
           scope_note = CASE WHEN $9 THEN $8 ELSE erp.role_permissions.scope_note END`,
        [role, it.module, f.can_create ?? null, f.can_read ?? null, f.can_update ?? null, f.can_delete ?? null, f.can_approve ?? null,
          str(it.scope_note), it.scope_note !== undefined]);
    }
  });
  res.json({ role, modules: await rolePermissions(role) });
}));

// =====================================================================
// Audit trail & log login (FR-ADM-09)
// =====================================================================
function dateRange(q: Record<string, any>, col: string, where: string[], p: unknown[]) {
  if (q.from) { p.push(String(q.from)); where.push(`${col} >= ($${p.length}::date::timestamp AT TIME ZONE 'Asia/Jakarta')`); }
  if (q.to) { p.push(String(q.to)); where.push(`${col} < (($${p.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')`); }
}
function userFilter(v: unknown, col: string, where: string[], p: unknown[]) {
  const s = str(v);
  if (!s) return;
  const m = s.match(/^(?:USR-)?(\d+)$/i);
  if (m) { p.push(Number(m[1])); where.push(`${col} = $${p.length}`); return; }
  p.push(s);
  where.push(`${col} IN (SELECT u.id FROM erp.users u LEFT JOIN erp.user_logins l ON l.user_id = u.id
    WHERE lower(l.username) = lower($${p.length}) OR lower(u.email) = lower($${p.length}) OR u.operator_code = upper($${p.length})
       OR u.full_name ILIKE '%' || $${p.length} || '%')`);
}

// GET /audit-logs?entity=&entity_id=&user=&action=&from=&to=&q= — Admin & Founder
adminRouter.get('/audit-logs', allow('ADMIN', 'FOUNDER'), ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const { limit, offset, page } = paging(q);
  const where: string[] = [];
  const p: unknown[] = [];
  if (q.entity) { p.push(String(q.entity)); where.push(`a.entity ILIKE $${p.length}`); }
  if (q.entity_id) { p.push(String(q.entity_id)); where.push(`a.entity_id = $${p.length}`); }
  if (q.action) { p.push(String(q.action).split(',').map((s) => s.trim().toUpperCase())); where.push(`a.action = ANY($${p.length}::text[])`); }
  userFilter(q.user ?? q.user_id, 'a.user_id', where, p);
  dateRange(q, 'a.occurred_at', where, p);
  if (q.q) { p.push(`%${q.q}%`); where.push(`(a.note ILIKE $${p.length} OR a.entity ILIKE $${p.length} OR a.entity_id ILIKE $${p.length})`); }
  p.push(limit, offset);
  const rows = await query(
    `SELECT a.id, a.occurred_at, a.user_id, u.full_name AS user_name, u.role AS user_role, a.action, a.entity, a.entity_id,
            a.old_value, a.new_value, host(a.ip_address) AS ip_address, a.note, count(*) OVER () AS _total
     FROM erp.audit_logs a LEFT JOIN erp.users u ON u.id = a.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY a.occurred_at DESC, a.id DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0 });
}));

// GET /login-attempts?user=&success=&method=&from=&to=&q= — Admin
adminRouter.get('/login-attempts', allow('ADMIN'), ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  const { limit, offset, page } = paging(q);
  const where: string[] = [];
  const p: unknown[] = [];
  userFilter(q.user ?? q.user_id, 'la.user_id', where, p);
  if (q.success !== undefined && q.success !== '') { p.push(isTrue(q.success)); where.push(`la.success = $${p.length}`); }
  if (q.method) { p.push(oneOf(String(q.method).toUpperCase(), ['PASSWORD', 'GOOGLE', 'PIN'] as const, 'method')); where.push(`la.method = $${p.length}::erp.login_method`); }
  if (q.reason) { p.push(String(q.reason).toUpperCase()); where.push(`la.failure_reason = $${p.length}`); }
  dateRange(q, 'la.attempted_at', where, p);
  if (q.q) { p.push(`%${q.q}%`); where.push(`(la.login_input ILIKE $${p.length} OR host(la.ip_address) ILIKE $${p.length})`); }
  p.push(limit, offset);
  const rows = await query(
    `SELECT la.id, la.attempted_at, la.method, la.login_input, la.user_id, u.full_name AS user_name, u.role AS user_role,
            la.success, la.failure_reason, host(la.ip_address) AS ip_address, la.user_agent, count(*) OVER () AS _total
     FROM erp.login_attempts la LEFT JOIN erp.users u ON u.id = la.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY la.attempted_at DESC, la.id DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0 });
}));

// =====================================================================
// Setting sistem & kebijakan sesi (FR-00.2 / FR-ADM-08)
// =====================================================================
// Batas nilai per key (key lain yang tidak terdaftar: angka ≥ 0)
const SETTING_RULES: Record<string, { min: number; max: number; int?: boolean }> = {
  receiving_tolerance_pct: { min: 0, max: 100 },
  allocation_overuse_tolerance_pct: { min: 0, max: 100 },
  overcut_tolerance_pct: { min: 0, max: 100 },
  cutting_variance_pct: { min: 0, max: 100 },
  bundle_size_default: { min: 1, max: 1000, int: true },
  scan_anomaly_ratio: { min: 0, max: 1 },
  downtime_escalation_minutes: { min: 1, max: 1440, int: true },
  defect_rate_threshold_pct: { min: 0, max: 100 },
  defect_alert_min_sample: { min: 1, max: 100000, int: true },
  cost_variance_threshold_pct: { min: 0, max: 100 },
  est_overhead_per_smv_minute: { min: 0, max: 1e9 },
  machine_planned_minutes_per_day: { min: 1, max: 1440, int: true },
  password_min_length: { min: 6, max: 64, int: true },
  login_max_failed: { min: 1, max: 20, int: true },
  login_lock_minutes: { min: 1, max: 1440, int: true },
};

async function settingsPayload() {
  const [settings, policies] = await Promise.all([
    query(`SELECT s.key, s.value, s.description, s.updated_at, s.updated_by, u.full_name AS updated_by_name
           FROM erp.system_settings s LEFT JOIN erp.users u ON u.id = s.updated_by ORDER BY s.key`),
    sessionPolicies(),
  ]);
  return { thresholds: settings.map((s) => ({ ...s, ...(SETTING_RULES[s.key] ?? {}) })), session_policies: policies };
}

function sessionPolicies() {
  return query(
    `SELECT r.role, coalesce(sp.idle_minutes, 15) AS idle_minutes, sp.updated_at, 5 AS min, 480 AS max
     FROM unnest(enum_range(NULL::erp.user_role)) AS r(role) LEFT JOIN erp.session_policies sp ON sp.role = r.role
     ORDER BY array_position(enum_range(NULL::erp.user_role), r.role)`);
}

// GET /settings — threshold + kebijakan sesi (baca: Admin, Founder, Finance, Supervisor)
adminRouter.get('/settings', allow('ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'), ah(async (_req, res) => {
  res.json(await settingsPayload());
}));

// PUT /settings/thresholds — body { key: value, ... } atau { settings: {...} } / [{ key, value }]. Admin.
adminRouter.put('/settings/thresholds', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const src = Array.isArray(b) ? Object.fromEntries(b.map((x: any) => [x?.key, x?.value]))
    : Array.isArray(b.settings) ? Object.fromEntries(b.settings.map((x: any) => [x?.key, x?.value]))
    : b.settings ?? b.thresholds ?? b;
  const entries = Object.entries(src ?? {});
  if (!entries.length) throw badRequest('Tidak ada setting yang diubah.');
  const known = new Set((await query(`SELECT key FROM erp.system_settings`)).map((r) => r.key));
  const vals = entries.map(([key, v]) => {
    if (!known.has(key)) throw badRequest(`Setting ${key} tidak dikenal.`, { field: key });
    const rule = SETTING_RULES[key] ?? { min: 0, max: 1e12 };
    return [key, num(v, key, rule)] as const;
  });
  await withTx(req.user!.id, async (c) => {
    for (const [key, v] of vals) {
      await c.query(`UPDATE erp.system_settings SET value = to_jsonb($2::numeric), updated_by = $3, updated_at = now() WHERE key = $1`, [key, v, req.user!.id]);
    }
  });
  res.json(await settingsPayload());
}));

// GET /settings/session-policy
adminRouter.get('/settings/session-policy', allow('ADMIN'), ah(async (_req, res) => {
  res.json({ data: await sessionPolicies() });
}));

// PUT /settings/session-policy — { role, idle_minutes } | { policies: [...] } | { ADMIN: 15, ... }. Batas 5–480 menit.
adminRouter.put('/settings/session-policy', allow('ADMIN'), ah(async (req, res) => {
  const b = req.body ?? {};
  const list: { role: unknown; idle_minutes: unknown }[] = Array.isArray(b) ? b
    : Array.isArray(b.policies) ? b.policies
    : b.role !== undefined ? [b]
    : Object.entries(b).map(([role, idle_minutes]) => ({ role, idle_minutes }));
  if (!list.length) throw badRequest('Kebijakan sesi wajib diisi.');
  const items = list.map((x) => ({
    role: oneOf(String(x?.role ?? '').toUpperCase(), ROLES, 'role'),
    idle: num(x?.idle_minutes, 'Batas idle (menit)', { int: true, min: 5, max: 480 }),
  }));
  await withTx(req.user!.id, async (c) => {
    for (const it of items) {
      await c.query(
        `INSERT INTO erp.session_policies (role, idle_minutes) VALUES ($1, $2)
         ON CONFLICT (role) DO UPDATE SET idle_minutes = EXCLUDED.idle_minutes`, [it.role, it.idle]);
    }
  });
  res.json({ data: await sessionPolicies() });
}));

// =====================================================================
// Notifikasi (FR-07.4)
// Notifikasi milik user (user_id) ATAU berbasis role (user_id NULL, target_role = role user).
// read_at bersifat per baris: notifikasi role diperlakukan sebagai "inbox bersama" — begitu salah
// satu anggota role menandai dibaca, notifikasi itu terbaca untuk seluruh anggota role tsb.
// =====================================================================
const NOTIF_SCOPE = `(n.user_id = $1 OR (n.user_id IS NULL AND n.target_role = $2::erp.user_role))`;
const NOTIF_COLS = `n.id, n.type, n.title, n.body, n.entity, n.entity_id, n.created_at, n.read_at,
                    (n.read_at IS NOT NULL) AS is_read, (n.user_id IS NULL) AS is_shared, n.target_role`;

const unreadCount = async (u: AuthUser) =>
  Number((await queryOne(`SELECT count(*) AS c FROM erp.notifications n WHERE ${NOTIF_SCOPE} AND n.read_at IS NULL`, [u.id, u.role]))!.c);

// GET /notifications?unread=1&type=&page=&limit=
adminRouter.get('/notifications', ah(async (req, res) => {
  const u = req.user!;
  const q = req.query as Record<string, string>;
  const { limit, offset, page } = paging(q);
  const p: unknown[] = [u.id, u.role];
  const where = [NOTIF_SCOPE];
  if (isTrue(q.unread)) where.push(`n.read_at IS NULL`);
  if (q.type) { p.push(String(q.type).split(',').map((s) => s.trim().toUpperCase())); where.push(`n.type::text = ANY($${p.length}::text[])`); }
  p.push(limit, offset);
  const rows = await query(
    `SELECT ${NOTIF_COLS}, count(*) OVER () AS _total FROM erp.notifications n
     WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  res.json({ data: rows.map(({ _total, ...r }) => r), page, limit, total: rows[0]?._total ?? 0, unread_count: await unreadCount(u) });
}));

// GET /notifications/unread-count
adminRouter.get('/notifications/unread-count', ah(async (req, res) => {
  res.json({ unread_count: await unreadCount(req.user!) });
}));

// POST /notifications/read-all
adminRouter.post('/notifications/read-all', ah(async (req, res) => {
  const u = req.user!;
  const n = await withTx(u.id, async (c) =>
    (await c.query(`UPDATE erp.notifications n SET read_at = now() WHERE ${NOTIF_SCOPE} AND n.read_at IS NULL`, [u.id, u.role])).rowCount ?? 0);
  res.json({ status: 'OK', updated: n, unread_count: 0 });
}));

// GET /notifications/stream — Server-Sent Events (?access_token=…)
// Polling DB tiap 5 dtk; event `notification` (id = id notifikasi, mendukung Last-Event-ID),
// `unread_count`, `session_end` (sesi dicabut/idle/nonaktif → stream ditutup). Heartbeat 25 dtk.
// Polling TIDAK memperbarui last_activity_at, jadi stream tidak menahan sesi tetap hidup.
const STREAM_POLL_MS = 5000;
const STREAM_HEARTBEAT_MS = 25000;
adminRouter.get('/notifications/stream', ah(async (req, res) => {
  const u = req.user!;
  const lastHeader = req.get('last-event-id') ?? (req.query.last_id as string | undefined);
  let lastId = lastHeader && /^\d+$/.test(lastHeader)
    ? Number(lastHeader)
    : Number((await queryOne(`SELECT coalesce(max(n.id), 0) AS m FROM erp.notifications n WHERE ${NOTIF_SCOPE}`, [u.id, u.role]))!.m);
  let lastCount = await unreadCount(u);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  req.socket.setTimeout(0);
  const send = (event: string, data: unknown, id?: number) => {
    if (res.writableEnded) return;
    res.write(`${id !== undefined ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  res.write(`retry: ${STREAM_POLL_MS}\n\n`);
  send('ready', { unread_count: lastCount, last_id: lastId, poll_ms: STREAM_POLL_MS });

  let busy = false;
  let closed = false;
  const stop = () => {
    if (closed) return;
    closed = true;
    clearInterval(poll);
    clearInterval(beat);
    if (!res.writableEnded) res.end();
  };

  const tick = async () => {
    if (busy || closed) return;
    busy = true;
    try {
      // Cek sesi tanpa memperpanjang idle
      const s = await queryOne(
        `SELECT (s.last_activity_at + make_interval(mins => coalesce(sp.idle_minutes, 15)) > now()) AS within_idle
         FROM erp.user_sessions s JOIN erp.users u ON u.id = s.user_id LEFT JOIN erp.session_policies sp ON sp.role = u.role
         WHERE s.id = $1::uuid AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'ACTIVE'`, [u.sessionId]);
      if (!s || !s.within_idle) {
        send('session_end', { code: s ? 'SESSION_IDLE_TIMEOUT' : 'SESSION_INVALID', message: 'Sesi berakhir. Silakan login kembali.' });
        return stop();
      }
      const rows = await query(
        `SELECT ${NOTIF_COLS} FROM erp.notifications n WHERE ${NOTIF_SCOPE} AND n.id > $3 ORDER BY n.id LIMIT 50`,
        [u.id, u.role, lastId]);
      for (const r of rows) { send('notification', r, r.id); lastId = r.id; }
      const count = await unreadCount(u);
      if (rows.length || count !== lastCount) { lastCount = count; send('unread_count', { unread_count: count }); }
    } catch (e: any) {
      console.error('[notifications/stream]', e?.message ?? e);
    } finally {
      busy = false;
    }
  };
  const poll = setInterval(tick, STREAM_POLL_MS);
  const beat = setInterval(() => { if (!res.writableEnded) res.write(`: ping ${Date.now()}\n\n`); }, STREAM_HEARTBEAT_MS);
  req.on('close', stop);
  res.on('error', stop);
}));

// PATCH /notifications/{id}/read
adminRouter.patch('/notifications/:id/read', ah(async (req, res) => {
  const u = req.user!;
  const m = String(req.params.id).match(/^(?:NTF-)?(\d+)$/i);
  if (!m) throw badRequest('id tidak valid.', { field: 'id' });
  const row = await withTx(u.id, async (c) =>
    (await c.query(
      `UPDATE erp.notifications n SET read_at = coalesce(n.read_at, now()) WHERE n.id = $3 AND ${NOTIF_SCOPE} RETURNING ${NOTIF_COLS}`,
      [u.id, u.role, Number(m[1])])).rows[0]);
  if (!row) throw notFound('Notifikasi tidak ditemukan.', 'NOTIFICATION_NOT_FOUND');
  res.json({ ...row, unread_count: await unreadCount(u) });
}));
