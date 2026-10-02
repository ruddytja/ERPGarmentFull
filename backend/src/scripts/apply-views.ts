// Menerapkan database/03_views.sql ke database (aditif, CREATE OR REPLACE VIEW).
// Pemakaian: npx tsx src/scripts/apply-views.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.ts';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database/03_views.sql');
await pool.query(fs.readFileSync(file, 'utf8'));
const r = await pool.query(`SELECT to_regclass('erp.v_labor_credits') AS v, (SELECT count(*) FROM erp.v_labor_credits) AS n`);
console.log('view:', r.rows[0].v, 'rows:', r.rows[0].n);
await pool.end();
