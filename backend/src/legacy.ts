// Endpoint lama (/api/*) yang masih dipakai frontend. API baru ada di /api/v1.
import express, { Request, Response } from 'express';
import { cleanIp, pool, queryOne } from './lib/db.ts';
import { ah } from './lib/http.ts';
import { createSession } from './lib/auth.ts';

export const legacyRouter = express.Router();

// Health & cluster status
legacyRouter.get('/db/status', async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    const row = (await pool.query(`
      SELECT version(), now() AS current_time, current_database() AS database_name,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'erp') AS table_count,
        (SELECT count(*) FROM erp.users) AS user_count,
        (SELECT count(*) FROM erp.work_orders) AS wo_count`)).rows[0];
    res.json({
      status: 'connected', host: process.env.PGHOST, port: process.env.PGPORT, database: row.database_name,
      version: row.version.split(' on ')[0], tableCount: Number(row.table_count), userCount: Number(row.user_count),
      woCount: Number(row.wo_count), latencyMs: Date.now() - start, serverTime: row.current_time, ssl: process.env.PGSSL !== 'false',
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, latencyMs: Date.now() - start });
  }
});

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-[#191c1e]', FOUNDER: 'bg-[#004ac6]', FINANCE: 'bg-[#735005]', SUPERVISOR: 'bg-[#007f36]', STAFF: 'bg-[#545f73]',
};

// Bentuk UserAccount yang diharapkan frontend (modules/admin/types)
function mapUserRow(row: any) {
  const isFinanceSide = ['ADMIN', 'FOUNDER', 'FINANCE'].includes(row.role);
  return {
    id: `USR-${String(row.id).padStart(3, '0')}`,
    rawId: row.id,
    name: row.full_name,
    email: row.email || `${String(row.operator_code || `op-${row.id}`).toLowerCase()}@theunderwearsupply.id`,
    role: row.role,
    staffFunction: row.staff_function || undefined,
    department: row.staff_function ? `Divisi ${row.staff_function}` : row.role === 'ADMIN' ? 'IT Infrastructure' : 'Operations',
    subLocation: row.line_name || (row.role === 'FOUNDER' ? 'HQ Executive Room' : 'Floor Plant A1'),
    stationBadge: row.operator_code || undefined,
    authMethod: row.role === 'STAFF' ? '4-Digit Kiosk PIN' : 'Password & Session Token',
    authMethodIcon: row.role === 'STAFF' ? 'dialpad' : 'lock',
    permissions: {
      costingView: isFinanceSide,
      spkActivate: ['ADMIN', 'FOUNDER', 'SUPERVISOR'].includes(row.role),
      kioskScan: true,
      payrollDraft: isFinanceSide,
    },
    status: row.status === 'ACTIVE' ? 'active' : 'deactivated',
    statusText: row.status === 'ACTIVE' ? 'Active in DB' : 'Deactivated',
    idleTimeoutMinutes: Number(row.idle_minutes || 15),
    lastActive: row.last_login_at ? new Date(row.last_login_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-',
    avatarBg: ROLE_COLORS[row.role] || ROLE_COLORS.STAFF,
    avatarColor: 'text-white',
  };
}

// Login — diverifikasi ke hash bcrypt lewat erp.fn_login (bukan lagi daftar password statis)
legacyRouter.post('/auth/login', ah(async (req: Request, res: Response) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) return res.status(400).json({ success: false, message: 'Email/Username dan Password wajib diisi.' });
  const ip = cleanIp(req.ip);
  const r = (await queryOne(`SELECT erp.fn_login($1, $2, $3::inet, $4) AS r`, [String(identifier), String(password), ip, req.get('user-agent') ?? null]))!.r;
  if (!r.ok) {
    const status = r.code === 'ACCOUNT_LOCKED' ? 429 : r.code === 'ACCOUNT_INACTIVE' ? 403 : 401;
    return res.status(status).json({ success: false, code: r.code, message: r.message });
  }
  const row = await queryOne(
    `SELECT u.*, coalesce(sp.idle_minutes, 15) AS idle_minutes, pl.name AS line_name
     FROM erp.users u LEFT JOIN erp.session_policies sp ON sp.role = u.role
     LEFT JOIN erp.production_lines pl ON pl.id = u.line_id WHERE u.id = $1`, [r.user_id]);
  const tokens = await createSession({ id: r.user_id, role: r.role }, { device: req.get('user-agent')?.slice(0, 120), ip, mustChangePassword: r.must_change_password });
  await pool.query(`INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, note, ip_address) VALUES ($1, 'LOGIN', 'auth', $1::text, 'Login web berhasil', $2::inet)`, [r.user_id, ip]).catch(() => {});
  res.json({ success: true, message: 'Login berhasil.', user: mapUserRow(row), ...tokens, must_change_password: r.must_change_password, redirect: r.redirect });
}));
