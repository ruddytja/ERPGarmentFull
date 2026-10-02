const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Kredensial dibaca dari environment. Default: memakai ../backend/.env yang sama
// dengan API, atau database/.env bila ada. Jangan di-hardcode di sini.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

for (const key of ['PGHOST', 'PGUSER', 'PGPASSWORD']) {
  if (!process.env[key]) {
    console.error(`[ERROR] ${key} belum diisi. Isi backend/.env (lihat backend/.env.example).`);
    process.exit(1);
  }
}

const config = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'defaultdb',
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
};

const sqlFiles = [
  '01_schema.sql',
  '02_functions_triggers.sql',
  '03_views.sql',
  '04_seed_master.sql',
];

async function main() {
  console.log('====================================================');
  console.log('Connecting to Aiven PostgreSQL:');
  console.log(`Host: ${config.host}:${config.port}`);
  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log('====================================================\n');

  const client = new Client(config);

  try {
    const connectStartTime = Date.now();
    await client.connect();
    console.log(`Connected successfully in ${Date.now() - connectStartTime} ms.`);

    // Check version
    const verRes = await client.query('SELECT version();');
    console.log(`PostgreSQL Version: ${verRes.rows[0].version}\n`);

    // Capture notices and warnings
    client.on('notice', (msg) => {
      console.log(`[NOTICE] ${msg.message}`);
    });

    // Reset / clean schema erp if exists to allow fresh re-run
    console.log('Menyiapkan database bersih (membersihkan schema "erp" lama jika ada)...');
    await client.query('DROP SCHEMA IF EXISTS erp CASCADE;');
    console.log('Schema "erp" siap untuk import bersih.\n');

    // Execute each SQL file sequentially
    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, file);
      if (!fs.existsSync(filePath)) {
        console.error(`[ERROR] File not found: ${filePath}`);
        process.exit(1);
      }

      console.log(`----------------------------------------------------`);
      console.log(`Reading ${file} (${fs.statSync(filePath).size} bytes)...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      console.log(`Executing ${file}...`);
      const fileStartTime = Date.now();
      await client.query(sqlContent);
      const elapsed = ((Date.now() - fileStartTime) / 1000).toFixed(2);
      console.log(`SUCCESS: ${file} executed in ${elapsed}s.\n`);
    }

    // Verify imported schema and tables
    console.log('====================================================');
    console.log('Verifying imported schema "erp":');
    console.log('====================================================');

    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'erp'
      ORDER BY table_name;
    `);

    console.log(`Found ${tablesRes.rows.length} tables in schema "erp":`);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(tableNames.join(', '));
    console.log('');

    // Sample row counts from seeded tables
    const sampleTables = [
      'production_lines',
      'system_settings',
      'session_policies',
      'role_permissions',
      'users',
      'brands',
      'materials',
      'skus',
      'operations',
      'machines',
      'defect_categories'
    ];

    console.log('Seeded row counts:');
    for (const tbl of sampleTables) {
      if (tableNames.includes(tbl)) {
        const countRes = await client.query(`SELECT count(*) FROM erp.${tbl};`);
        console.log(` - erp.${tbl.padEnd(20)} : ${countRes.rows[0].count} rows`);
      }
    }

    console.log('\n====================================================');
    console.log('ALL SQL FILES IMPORTED SUCCESSFULLY TO AIVEN CLOUD!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n[FATAL ERROR during SQL execution]:');
    console.error(err.message);
    if (err.position) {
      console.error(`Error position in query: ${err.position}`);
    }
    if (err.hint) {
      console.error(`Hint: ${err.hint}`);
    }
    if (err.detail) {
      console.error(`Detail: ${err.detail}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
