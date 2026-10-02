// DEV ONLY: buat sesi + access token untuk user tertentu tanpa password (untuk pengujian API).
// Pemakaian: npx tsx src/scripts/dev-token.ts <username|email|operator_code>
import { pool, queryOne } from '../lib/db.ts';
import { createSession } from '../lib/auth.ts';

const who = (process.argv[2] || 'admin').toLowerCase();
const u = await queryOne(
  `SELECT u.id, u.role, u.full_name FROM erp.users u LEFT JOIN erp.user_logins l ON l.user_id = u.id
   WHERE lower(l.username) = $1 OR lower(u.email) = $1 OR lower(u.operator_code) = $1 LIMIT 1`, [who]);
if (!u) { console.error('User tidak ditemukan:', who); process.exit(1); }
const t = await createSession({ id: u.id, role: u.role }, { device: 'dev-token' });
console.log(t.access_token);
await pool.end();
