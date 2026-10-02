import pg, { PoolClient, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Kredensial hanya dibaca dari environment (.env). Jangan di-hardcode di sini.
export const isDbConfigured = Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD);

export const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'defaultdb',
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

// numeric/bigint dikembalikan pg sebagai string; jadikan number agar JSON API konsisten.
// (Nilai di sistem ini — Kg, gram, IDR, id — aman dalam presisi double.)
pg.types.setTypeParser(20, (v) => Number(v)); // int8
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(1082, (v) => v); // date → 'YYYY-MM-DD' (hindari geser zona waktu)

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  const r = await pool.query<T>(text, params);
  return r.rows;
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const r = await pool.query<T>(text, params);
  return r.rows[0] ?? null;
}

/**
 * Jalankan fn dalam satu transaksi. Bila userId diberikan, `app.user_id` di-set
 * (SET LOCAL) sehingga trigger audit (erp.tg_audit / erp.fn_actor) mencatat aktor.
 * Semua mutasi WAJIB lewat sini.
 */
export async function withTx<T>(userId: number | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('search_path', 'erp, public', true)`);
    if (userId) await client.query(`SELECT set_config('app.user_id', $1, true)`, [String(userId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Catat ke erp.audit_logs (di luar trigger), mis. ACCESS_DENIED, LOGIN, REPRINT.
export async function audit(
  entry: { userId?: number | null; action: string; entity: string; entityId?: string | number | null; note?: string; ip?: string | null; oldValue?: unknown; newValue?: unknown },
  client?: PoolClient,
) {
  const sql = `INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, note, ip_address, old_value, new_value)
               VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8)`;
  const params = [
    entry.userId ?? null, entry.action, entry.entity, entry.entityId != null ? String(entry.entityId) : null,
    entry.note ?? null, cleanIp(entry.ip), entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
    entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
  ];
  await (client ?? pool).query(sql, params).catch((e) => console.error('[audit] gagal mencatat:', e.message));
}

export function cleanIp(ip?: string | null): string | null {
  if (!ip) return null;
  const v = ip.replace(/^::ffff:/, '');
  return /^[0-9a-fA-F:.]+$/.test(v) ? v : null;
}
