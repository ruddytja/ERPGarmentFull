// FR-05.1 Multiple Status QC Routing · FR-05.2 Defect Log & Traceability · FR-05.3 Customer Return & B-Grade
import express from 'express';
import { PoolClient } from 'pg';
import { audit, query, queryOne, withTx } from '../lib/db.ts';
import { AppError, ah, badRequest, forbidden, notFound, num, oneOf, paging, required } from '../lib/http.ts';
import { allow } from '../lib/auth.ts';

export const qualityRouter = express.Router();

const READERS = ['ADMIN', 'FOUNDER', 'FINANCE', 'SUPERVISOR'] as const;
const NO_HISTORY = 'Tidak ada riwayat untuk kriteria ini.';

// ---------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------
const run = async (c: PoolClient | null, sql: string, params: unknown[] = []) => (c ? (await c.query(sql, params)).rows : query(sql, params));

const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function dateParam(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`${field} harus berformat YYYY-MM-DD.`, { field });
  return v;
}

// Periode laporan: ?date= (satu hari) atau ?from=&to= (default hari ini, WIB)
function period(q: Record<string, any>) {
  const date = dateParam(q.date, 'date');
  const from = date ?? dateParam(q.from, 'from') ?? dateParam(q.to, 'to') ?? todayWib();
  const to = date ?? dateParam(q.to, 'to') ?? from;
  if (from > to) throw badRequest('Tanggal awal tidak boleh setelah tanggal akhir.');
  return { from, to };
}

// Kategori cacat: terima kode (KARET_MELINTIR), id numerik, atau nama ("Karet Melintir")
async function defectMap(c: PoolClient | null) {
  const rows = await run(c, `SELECT id, code, name, status FROM erp.defect_categories`);
  return (v: unknown): { id: number; code: string } | null => {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const s = String(v).trim();
    const norm = s.toUpperCase().replace(/[\s/-]+/g, '_');
    const d = rows.find((r: any) => (/^\d+$/.test(s) && r.id === Number(s)) || r.code === norm || r.name.toUpperCase() === s.toUpperCase());
    if (!d || d.status !== 'ACTIVE') throw new AppError(422, 'DEFECT_UNKNOWN', `Kategori cacat tidak dikenal: ${s}.`);
    return { id: d.id, code: d.code };
  };
}

// Normalisasi daftar rework/reject: [{qty, defect, operation_code?}] → defect = kode kategori
async function normDefects(list: unknown, field: string, resolve: Awaited<ReturnType<typeof defectMap>>) {
  if (list === undefined || list === null) return [] as { qty: number; defect: string; operation_code?: string }[];
  if (typeof list === 'number' || (typeof list === 'string' && /^\d+$/.test(list))) {
    if (Number(list) > 0) throw new AppError(422, 'DEFECT_REQUIRED', 'Pilih jenis cacat.');
    return [];
  }
  if (!Array.isArray(list)) throw badRequest(`${field} harus berupa array [{ qty, defect }].`, { field });
  const out: { qty: number; defect: string; operation_code?: string }[] = [];
  for (const e of list) {
    const qty = num(e?.qty, `${field}.qty`, { int: true, min: 0 });
    if (qty === 0) continue;
    const d = resolve(e?.defect ?? e?.defect_code ?? e?.category ?? e?.defect_category_id);
    if (!d) throw new AppError(422, 'DEFECT_REQUIRED', 'Pilih jenis cacat.');
    out.push({ qty, defect: d.code, ...(e?.operation_code ? { operation_code: String(e.operation_code).toUpperCase() } : {}) });
  }
  return out;
}

const sumQty = (l: { qty: number }[]) => l.reduce((a, b) => a + b.qty, 0);

// Bundel: id numerik, kode BDL-…, atau isi QR "BDL-…:2"
async function resolveBundle(v: string, c: PoolClient | null = null) {
  const s = String(v).trim();
  const code = s.split(':')[0].toUpperCase();
  const rows = await run(c, `SELECT * FROM erp.bundles WHERE bundle_code = $1 OR ($2::bigint IS NOT NULL AND id = $2::bigint) LIMIT 1`,
    [code, /^\d+$/.test(s) ? Number(s) : null]);
  return rows[0] ?? null;
}

async function resolveWo(v: string, c: PoolClient | null = null) {
  const s = String(v).trim();
  const rows = await run(c, `SELECT * FROM erp.work_orders WHERE upper(wo_no) = upper($1) OR ($2::bigint IS NOT NULL AND id = $2::bigint) LIMIT 1`,
    [s, /^\d+$/.test(s) ? Number(s) : null]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------
// FR-05.1  QC Inspection
// ---------------------------------------------------------------------

// GET /qc/defect-categories — chip jenis cacat di kios QC
qualityRouter.get('/qc/defect-categories', allow(...READERS, { staff: ['QC'] }), ah(async (req, res) => {
  const all = req.query.include_inactive === 'true';
  const rows = await query(
    `SELECT d.id, d.code, d.name, d.status, o.code AS default_operation_code, o.name AS default_operation_name
     FROM erp.defect_categories d LEFT JOIN erp.operations o ON o.id = d.default_operation_id
     WHERE $1 OR d.status = 'ACTIVE' ORDER BY d.id`, [all]);
  res.json({ data: rows, page: 1, limit: rows.length, total: rows.length });
}));

// POST /qc/inspections — simpan hasil QC (fn_record_qc)
qualityRouter.post('/qc/inspections', allow('SUPERVISOR', { staff: ['QC'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  const u = req.user!;
  const qr = b.bundle_id ?? b.bundle_code ?? b.qr;
  required({ bundle_id: qr, pass: b.pass }, ['bundle_id', 'pass']);
  const pass = num(b.pass, 'pass', { int: true, min: 0 });
  const inspector = String(b.inspector_id ?? b.inspector_code ?? u.operatorCode ?? '').trim().toUpperCase();
  if (!inspector) throw badRequest('inspector_id (kode inspektur) wajib diisi.', { field: 'inspector_id' });
  if (u.role === 'STAFF' && inspector !== (u.operatorCode ?? '').toUpperCase()) {
    throw forbidden('Staff QC hanya dapat menginput QC atas nama sendiri.');
  }
  const resolve = await defectMap(null);
  const rework = await normDefects(b.rework, 'rework', resolve);
  const reject = await normDefects(b.reject, 'reject', resolve);

  // Nomor id numerik → kode bundel (fn_record_qc menerima isi QR)
  let ticket = String(qr).trim();
  if (/^\d+$/.test(ticket)) {
    const bd = await resolveBundle(ticket);
    if (!bd) throw notFound('Bundel tidak ditemukan.', 'BUNDLE_NOT_FOUND');
    ticket = bd.bundle_code;
  }
  const r = await withTx(u.id, async (c) =>
    (await c.query(`SELECT erp.fn_record_qc($1, $2, $3, $4::jsonb, $5::jsonb) AS r`,
      [ticket, inspector, pass, JSON.stringify(rework), JSON.stringify(reject)])).rows[0].r);

  res.status(201).json({
    status: 'OK',
    inspection_id: r.inspection_id,
    bundle_id: r.bundle,
    pass: r.pass,
    rework: r.rework,
    reject: r.reject,
    rework_bundle_id: r.rework_bundle ?? null,
    payroll_credited_pcs: r.payroll_credited_pcs,
  });
}));

const INSPECTION_SELECT = `
  SELECT q.id, b.bundle_code AS bundle_id, b.id AS bundle_raw_id, w.wo_no, w.id AS work_order_id, k.code AS sku_code,
         v.size, v.color, b.qty AS bundle_qty, b.is_rework,
         q.inspected_at, erp.fn_wib_date(q.inspected_at)::text AS inspected_date,
         iu.operator_code AS inspector_code, iu.full_name AS inspector_name,
         q.qty_pass, q.qty_rework, q.qty_reject,
         round((q.qty_rework + q.qty_reject)::numeric / nullif(q.qty_pass + q.qty_rework + q.qty_reject, 0) * 100, 2) AS defect_rate_pct,
         rb.bundle_code AS rework_bundle_id,
         cu.full_name AS corrected_by, q.correction_reason,
         coalesce((SELECT jsonb_agg(jsonb_build_object('outcome', d.outcome, 'defect', dc.code, 'defect_name', dc.name, 'qty', d.qty,
                                                       'operation_code', o.code, 'operation_name', o.name) ORDER BY d.outcome, d.qty DESC)
                   FROM erp.qc_inspection_defects d JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
                   LEFT JOIN erp.operations o ON o.id = d.responsible_operation_id
                   WHERE d.inspection_id = q.id), '[]') AS defects
  FROM erp.qc_inspections q
  JOIN erp.bundles b ON b.id = q.bundle_id
  JOIN erp.work_orders w ON w.id = b.work_order_id
  JOIN erp.skus k ON k.id = w.sku_id
  JOIN erp.sku_variants v ON v.id = b.sku_variant_id
  JOIN erp.users iu ON iu.id = q.inspector_id
  LEFT JOIN erp.bundles rb ON rb.id = q.rework_bundle_id
  LEFT JOIN erp.users cu ON cu.id = q.corrected_by`;

// GET /qc/inspections?wo=&bundle=&from=&to=&inspector=&defect=
qualityRouter.get('/qc/inspections', allow(...READERS), ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const { limit, offset, page } = paging(q);
  const from = dateParam(q.from, 'from');
  const to = dateParam(q.to, 'to');
  const rows = await query(
    `SELECT x.*, count(*) OVER()::int AS total_count FROM (${INSPECTION_SELECT}
       WHERE ($1::text IS NULL OR upper(w.wo_no) = upper($1) OR w.id::text = $1)
         AND ($2::text IS NULL OR b.bundle_code ILIKE $2 || '%')
         AND ($3::date IS NULL OR erp.fn_wib_date(q.inspected_at) >= $3)
         AND ($4::date IS NULL OR erp.fn_wib_date(q.inspected_at) <= $4)
         AND ($5::text IS NULL OR iu.operator_code = upper($5))
         AND ($6::text IS NULL OR EXISTS (SELECT 1 FROM erp.qc_inspection_defects d JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
                                          WHERE d.inspection_id = q.id AND dc.code = upper($6)))
     ) x ORDER BY x.inspected_at DESC, x.id DESC LIMIT $7 OFFSET $8`,
    [q.wo || null, q.bundle ? String(q.bundle).split(':')[0].toUpperCase() : null, from, to, q.inspector || null, q.defect || null, limit, offset]);
  const total = rows[0]?.total_count ?? 0;
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total });
}));

// GET /qc/inspections/{id} — id inspeksi atau kode bundel
qualityRouter.get('/qc/inspections/:id', allow(...READERS), ah(async (req, res) => {
  const s = String(req.params.id).split(':')[0].toUpperCase();
  const row = await queryOne(`${INSPECTION_SELECT} WHERE (${/^\d+$/.test(s) ? 'q.id = $1::bigint' : 'b.bundle_code = $1'})`, [s]);
  if (!row) throw notFound('Data QC tidak ditemukan.', 'INSPECTION_NOT_FOUND');
  res.json(row);
}));

// PATCH /qc/inspections/{id} — koreksi Supervisor (wajib alasan; ditolak bila periode payroll sudah di-approve)
qualityRouter.patch('/qc/inspections/:id', allow('SUPERVISOR'), ah(async (req, res) => {
  const b = req.body ?? {};
  const u = req.user!;
  const reason = String(b.reason ?? b.correction_reason ?? '').trim();
  if (!reason) throw new AppError(422, 'CORRECTION_REQUIRED', 'Koreksi hasil QC hanya oleh Supervisor dengan alasan.');
  const resolve = await defectMap(null);

  const result = await withTx(u.id, async (c) => {
    const s = String(req.params.id).split(':')[0].toUpperCase();
    const ins = (await c.query(
      `SELECT q.* FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id
       WHERE ${/^\d+$/.test(s) ? 'q.id = $1::bigint' : 'b.bundle_code = $1'} FOR UPDATE OF q`, [s])).rows[0];
    if (!ins) throw notFound('Data QC tidak ditemukan.', 'INSPECTION_NOT_FOUND');
    const bundle = (await c.query(`SELECT * FROM erp.bundles WHERE id = $1 FOR UPDATE`, [ins.bundle_id])).rows[0];
    const oldDefects = (await c.query(
      `SELECT d.outcome, dc.code AS defect, d.qty, o.code AS operation_code FROM erp.qc_inspection_defects d
       JOIN erp.defect_categories dc ON dc.id = d.defect_category_id LEFT JOIN erp.operations o ON o.id = d.responsible_operation_id
       WHERE d.inspection_id = $1`, [ins.id])).rows;

    const pass = b.pass !== undefined ? num(b.pass, 'pass', { int: true, min: 0 }) : ins.qty_pass;
    const rework = b.rework !== undefined ? await normDefects(b.rework, 'rework', resolve)
      : oldDefects.filter((d) => d.outcome === 'REWORK').map((d) => ({ qty: d.qty, defect: d.defect, operation_code: d.operation_code ?? undefined }));
    const reject = b.reject !== undefined ? await normDefects(b.reject, 'reject', resolve)
      : oldDefects.filter((d) => d.outcome === 'REJECT').map((d) => ({ qty: d.qty, defect: d.defect, operation_code: d.operation_code ?? undefined }));
    const rw = sumQty(rework);
    const rj = sumQty(reject);
    if (pass + rw + rj !== bundle.qty) {
      throw new AppError(422, 'QC_TOTAL_MISMATCH', `Total ${pass + rw + rj} tidak sesuai isi bundel ${bundle.qty}.`);
    }
    const openPacked = Number((await c.query(
      `SELECT coalesce(sum(i.qty), 0) AS n FROM erp.pack_unit_items i JOIN erp.pack_units p ON p.id = i.pack_unit_id
       WHERE i.bundle_id = $1 AND p.status = 'OPEN'`, [bundle.id])).rows[0].n);
    if (pass < bundle.qty_packed + openPacked) {
      throw new AppError(422, 'ALREADY_PACKED', `Qty Pass tidak boleh kurang dari yang sudah dipacking (${bundle.qty_packed + openPacked} pcs).`);
    }

    // Bundel rework mengikuti qty rework hasil koreksi
    let reworkBundleId: number | null = ins.rework_bundle_id;
    if (rw !== ins.qty_rework) {
      if (ins.rework_bundle_id) {
        const rb = (await c.query(`SELECT * FROM erp.bundles WHERE id = $1 FOR UPDATE`, [ins.rework_bundle_id])).rows[0];
        const started = (await c.query(`SELECT 1 FROM erp.wip_tasks WHERE bundle_id = $1 LIMIT 1`, [rb.id])).rowCount;
        if (rb.status !== 'CREATED' || started) {
          throw new AppError(422, 'REWORK_IN_PROGRESS', `Bundel rework ${rb.bundle_code} sudah diproses; qty rework tidak dapat dikoreksi.`);
        }
        if (rw > 0) await c.query(`UPDATE erp.bundles SET qty = $2 WHERE id = $1`, [rb.id, rw]);
        else { await c.query(`UPDATE erp.bundles SET status = 'VOID' WHERE id = $1`, [rb.id]); reworkBundleId = null; }
      } else if (rw > 0) {
        // Sama seperti fn_record_qc: operasi penyebab = defect rework terbanyak → default kategori → operasi terakhir routing
        const top = [...rework].sort((a, x) => x.qty - a.qty)[0];
        const op = (await c.query(
          `SELECT coalesce((SELECT id FROM erp.operations WHERE code = $1), d.default_operation_id, $3::bigint,
                  (SELECT r.operation_id FROM erp.sku_routings r JOIN erp.work_orders w ON w.sku_id = r.sku_id
                    WHERE w.id = $4 ORDER BY r.seq DESC LIMIT 1)) AS op
           FROM erp.defect_categories d WHERE d.code = $2`,
          [top.operation_code ?? null, top.defect, bundle.rework_operation_id, bundle.work_order_id])).rows[0].op;
        const rootId = bundle.root_bundle_id ?? bundle.id;
        const root = (await c.query(`SELECT bundle_code FROM erp.bundles WHERE id = $1`, [rootId])).rows[0];
        const n = Number((await c.query(`SELECT count(*) + 1 AS n FROM erp.bundles WHERE root_bundle_id = $1`, [rootId])).rows[0].n);
        reworkBundleId = (await c.query(
          `INSERT INTO erp.bundles (bundle_code, work_order_id, cutting_record_id, sku_variant_id, lot_id, seq_no, seq_total, qty,
                                    is_rework, parent_bundle_id, root_bundle_id, rework_operation_id)
           VALUES ($1, $2, $3, $4, $5, 1, 1, $6, true, $7, $8, $9) RETURNING id`,
          [`${root.bundle_code}-R${n}`, bundle.work_order_id, bundle.cutting_record_id, bundle.sku_variant_id, bundle.lot_id, rw,
            bundle.id, rootId, op])).rows[0].id;
        await c.query(`INSERT INTO erp.bundle_prints (bundle_id, version, printed_by) VALUES ($1, 1, $2)`, [reworkBundleId, u.id]);
      }
    }

    // Ganti rincian cacat (dicek ulang deferred oleh fn_qc_defects_check saat COMMIT)
    await c.query(`DELETE FROM erp.qc_inspection_defects WHERE inspection_id = $1`, [ins.id]);
    await c.query(
      `INSERT INTO erp.qc_inspection_defects (inspection_id, outcome, defect_category_id, qty, responsible_operation_id)
       SELECT $1, x.outcome::erp.qc_outcome, d.id, sum(x.qty), coalesce(max(o.id), d.default_operation_id)
       FROM jsonb_to_recordset($2::jsonb) AS x(outcome text, defect text, qty int, operation_code text)
       JOIN erp.defect_categories d ON d.code = x.defect
       LEFT JOIN erp.operations o ON o.code = x.operation_code
       GROUP BY x.outcome, d.id, d.default_operation_id`,
      [ins.id, JSON.stringify([...rework.map((d) => ({ ...d, outcome: 'REWORK' })), ...reject.map((d) => ({ ...d, outcome: 'REJECT' }))])]);
    await c.query(
      `UPDATE erp.qc_inspections SET qty_pass = $2, qty_rework = $3, qty_reject = $4, rework_bundle_id = $5,
              corrected_by = $6, correction_reason = $7 WHERE id = $1`,
      [ins.id, pass, rw, rj, reworkBundleId, u.id, reason]);
    return ins.id as number;
  });
  const row = await queryOne(`${INSPECTION_SELECT} WHERE q.id = $1`, [result]);
  res.json({ status: 'OK', message: 'Hasil QC berhasil dikoreksi.', inspection: row });
}));

// GET /reports/defect-rate?group_by=operator|line|defect&date= (atau from/to)
qualityRouter.get('/reports/defect-rate', allow(...READERS), ah(async (req, res) => {
  const groupBy = oneOf(req.query.group_by ?? 'defect', ['operator', 'line', 'defect'] as const, 'group_by');
  const { from, to } = period(req.query as any);
  const p = [from, to];
  const INS = `ins AS (SELECT q.id, q.bundle_id, q.qty_pass, q.qty_rework, q.qty_reject, q.qty_pass + q.qty_rework + q.qty_reject AS inspected
                       FROM erp.qc_inspections q WHERE erp.fn_wib_date(q.inspected_at) BETWEEN $1::date AND $2::date)`;
  const summary = await queryOne(
    `WITH ${INS} SELECT count(*)::int AS inspections, coalesce(sum(inspected), 0)::int AS inspected_pcs,
            coalesce(sum(qty_pass), 0)::int AS pass_pcs, coalesce(sum(qty_rework), 0)::int AS rework_pcs, coalesce(sum(qty_reject), 0)::int AS reject_pcs,
            round(coalesce(sum(qty_rework + qty_reject), 0)::numeric / nullif(sum(inspected), 0) * 100, 2) AS defect_rate_pct,
            erp.fn_setting_num('defect_rate_threshold_pct', 5) AS threshold_pct FROM ins`, p);
  let rows: any[];
  if (groupBy === 'defect') {
    rows = await query(
      `WITH ${INS}
       SELECT dc.code AS defect, dc.name AS defect_name,
              coalesce(sum(d.qty) FILTER (WHERE d.outcome = 'REWORK'), 0)::int AS rework_pcs,
              coalesce(sum(d.qty) FILTER (WHERE d.outcome = 'REJECT'), 0)::int AS reject_pcs,
              coalesce(sum(d.qty), 0)::int AS defect_pcs,
              round(coalesce(sum(d.qty), 0)::numeric / nullif((SELECT sum(inspected) FROM ins), 0) * 100, 2) AS defect_rate_pct
       FROM ins JOIN erp.qc_inspection_defects d ON d.inspection_id = ins.id
       JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
       GROUP BY dc.code, dc.name ORDER BY defect_pcs DESC, dc.code`, p);
  } else {
    // Cacat diatribusikan ke operator/lini yang mengerjakan operasi penyebab pada bundel tsb.
    // Kategori tanpa operasi penyebab (mis. noda, lubang kain) tidak diatribusikan.
    const key = groupBy === 'operator' ? 'operator_id' : 'line_id';
    rows = await query(
      `WITH ${INS},
       worked AS (SELECT DISTINCT t.bundle_id, t.${key} AS k FROM erp.wip_tasks t JOIN ins ON ins.bundle_id = t.bundle_id WHERE t.${key} IS NOT NULL),
       insp AS (SELECT w.k, sum(ins.inspected) AS inspected FROM worked w JOIN ins ON ins.bundle_id = w.bundle_id GROUP BY w.k),
       dfx AS (SELECT t.${key} AS k,
                      sum(d.qty) FILTER (WHERE d.outcome = 'REWORK') AS rework, sum(d.qty) FILTER (WHERE d.outcome = 'REJECT') AS reject
               FROM ins JOIN erp.qc_inspection_defects d ON d.inspection_id = ins.id
               JOIN erp.wip_tasks t ON t.bundle_id = ins.bundle_id AND t.operation_id = d.responsible_operation_id
               WHERE t.${key} IS NOT NULL GROUP BY t.${key})
       SELECT ${groupBy === 'operator'
         ? `u.operator_code, u.full_name AS operator_name, pl.code AS line_code`
         : `pl.code AS line_code, pl.name AS line_name`},
              insp.inspected::int AS inspected_pcs, coalesce(dfx.rework, 0)::int AS rework_pcs, coalesce(dfx.reject, 0)::int AS reject_pcs,
              (coalesce(dfx.rework, 0) + coalesce(dfx.reject, 0))::int AS defect_pcs,
              round((coalesce(dfx.rework, 0) + coalesce(dfx.reject, 0))::numeric / nullif(insp.inspected, 0) * 100, 2) AS defect_rate_pct
       FROM insp LEFT JOIN dfx ON dfx.k = insp.k
       ${groupBy === 'operator'
         ? `JOIN erp.users u ON u.id = insp.k LEFT JOIN erp.production_lines pl ON pl.id = u.line_id`
         : `JOIN erp.production_lines pl ON pl.id = insp.k`}
       ORDER BY defect_rate_pct DESC NULLS LAST, defect_pcs DESC`, p);
  }
  const thr = Number(summary?.threshold_pct ?? 5);
  res.json({
    group_by: groupBy, from, to, threshold_pct: thr,
    summary: { ...summary, threshold_pct: undefined, above_threshold: summary?.defect_rate_pct != null && Number(summary.defect_rate_pct) > thr },
    data: rows.map((r) => ({ ...r, above_threshold: r.defect_rate_pct != null && Number(r.defect_rate_pct) > thr })),
  });
}));

// GET /reports/defect-pareto?from=&to= — Pareto jenis cacat (QC)
qualityRouter.get('/reports/defect-pareto', allow(...READERS), ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const to = dateParam(q.to, 'to') ?? todayWib();
  const from = dateParam(q.from, 'from') ?? new Date(Date.parse(to) - 29 * 86400_000).toISOString().slice(0, 10);
  if (from > to) throw badRequest('Tanggal awal tidak boleh setelah tanggal akhir.');
  const rows = await query(
    `WITH x AS (
       SELECT dc.code AS defect, dc.name AS defect_name,
              coalesce(sum(d.qty) FILTER (WHERE d.outcome = 'REWORK'), 0)::int AS rework_pcs,
              coalesce(sum(d.qty) FILTER (WHERE d.outcome = 'REJECT'), 0)::int AS reject_pcs,
              sum(d.qty)::int AS qty
       FROM erp.qc_inspections q JOIN erp.qc_inspection_defects d ON d.inspection_id = q.id
       JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
       WHERE erp.fn_wib_date(q.inspected_at) BETWEEN $1::date AND $2::date
       GROUP BY dc.code, dc.name)
     SELECT x.*, round(qty::numeric / sum(qty) OVER () * 100, 2) AS pct,
            round(sum(qty) OVER (ORDER BY qty DESC, defect ROWS UNBOUNDED PRECEDING)::numeric / sum(qty) OVER () * 100, 2) AS cumulative_pct
     FROM x ORDER BY qty DESC, defect`, [from, to]);
  const total = rows.reduce((a, r) => a + r.qty, 0);
  res.json({ from, to, total_defect_pcs: total, data: rows.map((r) => ({ ...r, vital_few: Number(r.cumulative_pct) - Number(r.pct) < 80 })) });
}));

// ---------------------------------------------------------------------
// FR-05.2  Traceability (read-only; Staff tidak punya akses)
// ---------------------------------------------------------------------
const noHistory = () => notFound(NO_HISTORY, 'NO_HISTORY');

async function bundleOps(bundleId: number) {
  return query(
    `WITH b AS (SELECT b.*, w.sku_id FROM erp.bundles b JOIN erp.work_orders w ON w.id = b.work_order_id WHERE b.id = $1),
     ops AS (SELECT r.seq, r.operation_id FROM b JOIN erp.sku_routings r ON r.sku_id = b.sku_id WHERE NOT b.is_rework
             UNION ALL SELECT 1, b.rework_operation_id FROM b WHERE b.is_rework)
     SELECT ops.seq, o.code AS operation_code, o.name AS operation_name, o.line_type,
            u.operator_code, u.full_name AS operator_name, m.asset_code AS machine_code, m.brand_model AS machine_model,
            pl.code AS line_code, t.qty, t.started_at, t.completed_at, t.duration_min, t.is_anomaly, t.source,
            CASE WHEN t.completed_at IS NOT NULL THEN 'COMPLETE' WHEN t.id IS NOT NULL THEN 'IN_PROGRESS' ELSE 'PENDING' END AS status
     FROM ops JOIN erp.operations o ON o.id = ops.operation_id
     LEFT JOIN erp.wip_tasks t ON t.bundle_id = $1 AND t.operation_id = ops.operation_id
     LEFT JOIN erp.users u ON u.id = t.operator_id
     LEFT JOIN erp.machines m ON m.id = t.machine_id
     LEFT JOIN erp.production_lines pl ON pl.id = t.line_id
     ORDER BY ops.seq`, [bundleId]);
}

// GET /traceability/bundles/{id} — rantai lengkap: lot kain → cutting → operator & mesin per operasi → QC → packing
qualityRouter.get('/traceability/bundles/:id', allow(...READERS), ah(async (req, res) => {
  const bd = await resolveBundle(req.params.id);
  if (!bd) throw noHistory();
  const bundle = await queryOne(
    `SELECT b.id AS raw_id, b.bundle_code, b.status, b.qty, b.qty_pass, b.qty_packed, b.is_rework, b.seq_no, b.seq_total,
            b.ticket_version, b.created_at, pb.bundle_code AS parent_bundle, rb.bundle_code AS root_bundle,
            ro.code AS rework_operation_code, ro.name AS rework_operation_name,
            w.wo_no, w.status AS wo_status, w.destination, k.code AS sku_code, k.name AS sku_name, v.size, v.color
     FROM erp.bundles b JOIN erp.work_orders w ON w.id = b.work_order_id JOIN erp.skus k ON k.id = w.sku_id
     JOIN erp.sku_variants v ON v.id = b.sku_variant_id
     LEFT JOIN erp.bundles pb ON pb.id = b.parent_bundle_id LEFT JOIN erp.bundles rb ON rb.id = b.root_bundle_id
     LEFT JOIN erp.operations ro ON ro.id = b.rework_operation_id
     WHERE b.id = $1`, [bd.id]);
  const lot = bd.lot_id ? await queryOne(
    `SELECT l.lot_no, m.code AS material_code, m.name AS material_name, s.name AS supplier_name, l.received_at, l.qc_status,
            gr.receipt_no, gr.delivery_note_no
     FROM erp.material_lots l JOIN erp.materials m ON m.id = l.material_id LEFT JOIN erp.suppliers s ON s.id = l.supplier_id
     LEFT JOIN erp.goods_receipt_items gi ON gi.id = l.receipt_item_id LEFT JOIN erp.goods_receipts gr ON gr.id = gi.receipt_id
     WHERE l.id = $1`, [bd.lot_id]) : null;
  const cutting = bd.cutting_record_id ? await queryOne(
    `SELECT c.cut_no, c.cut_at, c.spread_kg, c.cut_pcs, c.scrap_kg, c.yield_pcs_per_kg, c.net_gram_per_pcs, c.scrap_rate_pct,
            c.variance_pct, c.variance_note, u.operator_code AS cut_by_code, u.full_name AS cut_by_name
     FROM erp.cutting_records c JOIN erp.users u ON u.id = c.cut_by WHERE c.id = $1`, [bd.cutting_record_id]) : null;
  const operations = await bundleOps(bd.id);
  const originOperations = bd.is_rework && bd.root_bundle_id ? await bundleOps(bd.root_bundle_id) : undefined;
  const qc = await queryOne(
    `SELECT q.id, q.inspected_at, iu.operator_code AS inspector_code, iu.full_name AS inspector_name,
            q.qty_pass, q.qty_rework, q.qty_reject, rb.bundle_code AS rework_bundle, cu.full_name AS corrected_by, q.correction_reason,
            coalesce((SELECT jsonb_agg(jsonb_build_object('outcome', d.outcome, 'defect', dc.code, 'defect_name', dc.name, 'qty', d.qty,
                       'operation_code', o.code, 'operation_name', o.name,
                       'operator_code', ou.operator_code, 'operator_name', ou.full_name, 'machine_code', m.asset_code))
                      FROM erp.qc_inspection_defects d JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
                      LEFT JOIN erp.operations o ON o.id = d.responsible_operation_id
                      LEFT JOIN LATERAL (SELECT t.* FROM erp.wip_tasks t
                                         WHERE t.operation_id = d.responsible_operation_id AND t.bundle_id IN (q.bundle_id, $2)
                                         ORDER BY (t.bundle_id = q.bundle_id) DESC LIMIT 1) t ON true
                      LEFT JOIN erp.users ou ON ou.id = t.operator_id LEFT JOIN erp.machines m ON m.id = t.machine_id
                      WHERE d.inspection_id = q.id), '[]') AS defects
     FROM erp.qc_inspections q JOIN erp.users iu ON iu.id = q.inspector_id
     LEFT JOIN erp.bundles rb ON rb.id = q.rework_bundle_id LEFT JOIN erp.users cu ON cu.id = q.corrected_by
     WHERE q.bundle_id = $1`, [bd.id, bd.root_bundle_id ?? bd.id]);
  const lineage = await query(
    `SELECT b.bundle_code, b.is_rework, b.status, b.qty, b.qty_pass, b.qty_packed, pb.bundle_code AS parent_bundle,
            o.name AS rework_operation, q.qty_pass AS qc_pass, q.qty_rework AS qc_rework, q.qty_reject AS qc_reject, q.inspected_at
     FROM erp.bundles b LEFT JOIN erp.bundles pb ON pb.id = b.parent_bundle_id
     LEFT JOIN erp.operations o ON o.id = b.rework_operation_id LEFT JOIN erp.qc_inspections q ON q.bundle_id = b.id
     WHERE b.id = $1 OR b.root_bundle_id = $1 ORDER BY b.id`, [bd.root_bundle_id ?? bd.id]);
  const packing = await query(
    `SELECT p.pack_code, p.status, p.confirmed_at, i.qty, k.code AS fg_sku_code, fv.size AS fg_size, fv.color AS fg_color,
            u.full_name AS packed_by
     FROM erp.pack_unit_items i JOIN erp.pack_units p ON p.id = i.pack_unit_id
     JOIN erp.sku_variants fv ON fv.id = p.fg_variant_id JOIN erp.skus k ON k.id = fv.sku_id JOIN erp.users u ON u.id = p.packed_by
     WHERE i.bundle_id = $1 ORDER BY i.scanned_at`, [bd.id]);
  res.json({ bundle, lot, cutting, operations, ...(originOperations ? { origin_operations: originOperations } : {}), qc, lineage, packing });
}));

// GET /traceability/lots/{lot} — lot_no (atau id lot) → cutting, SPK, bundel, ringkasan QC & cacat
qualityRouter.get('/traceability/lots/:lot', allow(...READERS), ah(async (req, res) => {
  const s = String(req.params.lot).trim();
  const lots = await query(
    `SELECT l.id, l.lot_no, m.code AS material_code, m.name AS material_name, m.category, s.name AS supplier_name,
            l.received_at, l.qc_status, l.qty_on_hand, gr.receipt_no
     FROM erp.material_lots l JOIN erp.materials m ON m.id = l.material_id LEFT JOIN erp.suppliers s ON s.id = l.supplier_id
     LEFT JOIN erp.goods_receipt_items gi ON gi.id = l.receipt_item_id LEFT JOIN erp.goods_receipts gr ON gr.id = gi.receipt_id
     WHERE upper(l.lot_no) = upper($1) OR ($2::bigint IS NOT NULL AND l.id = $2::bigint) ORDER BY l.id`,
    [s, /^\d+$/.test(s) ? Number(s) : null]);
  if (!lots.length) throw noHistory();
  const ids = lots.map((l) => l.id);
  const cuttings = await query(
    `SELECT c.cut_no, l.lot_no, w.wo_no, k.code AS sku_code, c.cut_at, c.spread_kg, c.cut_pcs, c.scrap_kg, c.yield_pcs_per_kg, c.variance_pct,
            u.full_name AS cut_by_name
     FROM erp.cutting_records c JOIN erp.material_lots l ON l.id = c.lot_id JOIN erp.work_orders w ON w.id = c.work_order_id
     JOIN erp.skus k ON k.id = w.sku_id JOIN erp.users u ON u.id = c.cut_by
     WHERE c.lot_id = ANY($1::bigint[]) ORDER BY c.cut_at`, [ids]);
  if (!cuttings.length) throw noHistory();
  const bundles = await query(
    `SELECT b.bundle_code, w.wo_no, v.size, v.color, b.qty, b.status, b.is_rework,
            q.qty_pass, q.qty_rework, q.qty_reject, b.qty_packed
     FROM erp.bundles b JOIN erp.work_orders w ON w.id = b.work_order_id JOIN erp.sku_variants v ON v.id = b.sku_variant_id
     LEFT JOIN erp.qc_inspections q ON q.bundle_id = b.id
     WHERE b.lot_id = ANY($1::bigint[]) ORDER BY b.id`, [ids]);
  const defects = await query(
    `SELECT dc.code AS defect, dc.name AS defect_name, sum(d.qty)::int AS qty
     FROM erp.bundles b JOIN erp.qc_inspections q ON q.bundle_id = b.id JOIN erp.qc_inspection_defects d ON d.inspection_id = q.id
     JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
     WHERE b.lot_id = ANY($1::bigint[]) GROUP BY 1, 2 ORDER BY qty DESC`, [ids]);
  const qc = bundles.reduce((a, b) => ({ pass: a.pass + (b.qty_pass ?? 0), rework: a.rework + (b.qty_rework ?? 0), reject: a.reject + (b.qty_reject ?? 0) }),
    { pass: 0, rework: 0, reject: 0 });
  const inspected = qc.pass + qc.rework + qc.reject;
  res.json({
    lots: lots.map(({ id, ...l }) => l),
    cutting_records: cuttings,
    work_orders: [...new Set(cuttings.map((c) => c.wo_no))],
    qc_summary: { inspected_pcs: inspected, pass_pcs: qc.pass, rework_pcs: qc.rework, reject_pcs: qc.reject,
      defect_rate_pct: inspected ? Math.round(((qc.rework + qc.reject) / inspected) * 10000) / 100 : null },
    defects,
    bundles,
  });
}));

// GET /traceability/work-orders/{id} — id atau nomor SPK
qualityRouter.get('/traceability/work-orders/:id', allow(...READERS), ah(async (req, res) => {
  const w = await resolveWo(req.params.id);
  if (!w) throw noHistory();
  const header = await queryOne(
    `SELECT w.wo_no, w.status, w.destination, w.target_qty, w.due_date::text AS due_date, w.activated_at, w.closed_at, w.close_type,
            k.code AS sku_code, k.name AS sku_name, c.name AS customer_name
     FROM erp.work_orders w JOIN erp.skus k ON k.id = w.sku_id LEFT JOIN erp.customers c ON c.id = w.customer_id WHERE w.id = $1`, [w.id]);
  const cuttings = await query(
    `SELECT c.cut_no, l.lot_no, m.code AS material_code, s.name AS supplier_name, c.cut_at, c.spread_kg, c.cut_pcs, c.scrap_kg,
            c.yield_pcs_per_kg, c.variance_pct, u.full_name AS cut_by_name
     FROM erp.cutting_records c JOIN erp.material_lots l ON l.id = c.lot_id JOIN erp.materials m ON m.id = l.material_id
     LEFT JOIN erp.suppliers s ON s.id = l.supplier_id JOIN erp.users u ON u.id = c.cut_by
     WHERE c.work_order_id = $1 ORDER BY c.cut_at`, [w.id]);
  const bundles = await query(
    `SELECT b.bundle_code, v.size, v.color, l.lot_no, b.qty, b.status, b.is_rework, pb.bundle_code AS parent_bundle,
            q.qty_pass, q.qty_rework, q.qty_reject, b.qty_packed,
            (SELECT string_agg(DISTINCT u.operator_code, ', ') FROM erp.wip_tasks t JOIN erp.users u ON u.id = t.operator_id WHERE t.bundle_id = b.id) AS operators
     FROM erp.bundles b JOIN erp.sku_variants v ON v.id = b.sku_variant_id LEFT JOIN erp.material_lots l ON l.id = b.lot_id
     LEFT JOIN erp.bundles pb ON pb.id = b.parent_bundle_id LEFT JOIN erp.qc_inspections q ON q.bundle_id = b.id
     WHERE b.work_order_id = $1 ORDER BY b.id`, [w.id]);
  const defects = await query(
    `SELECT dc.code AS defect, dc.name AS defect_name, o.name AS operation_name, sum(d.qty)::int AS qty
     FROM erp.bundles b JOIN erp.qc_inspections q ON q.bundle_id = b.id JOIN erp.qc_inspection_defects d ON d.inspection_id = q.id
     JOIN erp.defect_categories dc ON dc.id = d.defect_category_id LEFT JOIN erp.operations o ON o.id = d.responsible_operation_id
     WHERE b.work_order_id = $1 GROUP BY 1, 2, 3 ORDER BY qty DESC`, [w.id]);
  const returns = await query(
    `SELECT r.return_no, r.source, r.qty, r.reason, r.received_at,
            coalesce((SELECT jsonb_agg(jsonb_build_object('grade', g.grade, 'qty', g.qty, 'defect', dc.code))
                      FROM erp.return_gradings g LEFT JOIN erp.defect_categories dc ON dc.id = g.defect_category_id
                      WHERE g.return_id = r.id), '[]') AS gradings
     FROM erp.customer_returns r WHERE r.work_order_id = $1 ORDER BY r.received_at`, [w.id]);
  const packing = await queryOne(
    `SELECT count(*) FILTER (WHERE p.status = 'CONFIRMED')::int AS confirmed_sessions,
            coalesce(sum(p.pack_count) FILTER (WHERE p.status = 'CONFIRMED'), 0)::int AS packs,
            coalesce((SELECT sum(i.qty) FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
                      WHERE u.work_order_id = $1 AND u.status = 'CONFIRMED'), 0)::int AS packed_pcs
     FROM erp.pack_units p WHERE p.work_order_id = $1`, [w.id]);
  if (!cuttings.length && !bundles.length) throw noHistory();
  res.json({ work_order: header, cutting_records: cuttings, bundles, defects, returns, packing });
}));

// GET /traceability/search?wo=&operator=&lot=&defect=&bundle=
qualityRouter.get('/traceability/search', allow(...READERS), ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const crit = { wo: q.wo || null, operator: q.operator || null, lot: q.lot || null, defect: q.defect || null, bundle: q.bundle || null };
  if (!Object.values(crit).some(Boolean)) throw badRequest('Isi minimal satu kriteria: wo, bundle, operator, lot, atau defect.');
  const { limit, offset, page } = paging(q);
  const rows = await query(
    `SELECT b.bundle_code, w.wo_no, k.code AS sku_code, v.size, v.color, l.lot_no, b.qty, b.status, b.is_rework,
            q.qty_pass, q.qty_rework, q.qty_reject, q.inspected_at,
            (SELECT string_agg(DISTINCT dc.code, ', ') FROM erp.qc_inspection_defects d JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
              WHERE d.inspection_id = q.id) AS defects,
            (SELECT string_agg(DISTINCT u.operator_code, ', ') FROM erp.wip_tasks t JOIN erp.users u ON u.id = t.operator_id WHERE t.bundle_id = b.id) AS operators,
            count(*) OVER()::int AS total_count
     FROM erp.bundles b JOIN erp.work_orders w ON w.id = b.work_order_id JOIN erp.skus k ON k.id = w.sku_id
     JOIN erp.sku_variants v ON v.id = b.sku_variant_id LEFT JOIN erp.material_lots l ON l.id = b.lot_id
     LEFT JOIN erp.qc_inspections q ON q.bundle_id = b.id
     WHERE ($1::text IS NULL OR upper(w.wo_no) = upper($1) OR w.id::text = $1)
       AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM erp.wip_tasks t JOIN erp.users u ON u.id = t.operator_id
                                        WHERE t.bundle_id = b.id AND (u.operator_code = upper($2) OR u.full_name ILIKE '%' || $2 || '%')))
       AND ($3::text IS NULL OR upper(l.lot_no) = upper($3))
       AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM erp.qc_inspection_defects d JOIN erp.defect_categories dc ON dc.id = d.defect_category_id
                                        WHERE d.inspection_id = q.id AND (dc.code = upper($4) OR dc.name ILIKE $4)))
       AND ($5::text IS NULL OR b.bundle_code ILIKE $5 || '%')
     ORDER BY b.id DESC LIMIT $6 OFFSET $7`,
    [crit.wo, crit.operator, crit.lot, crit.defect, crit.bundle ? String(crit.bundle).split(':')[0].toUpperCase() : null, limit, offset]);
  if (!rows.length) throw noHistory();
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total: rows[0].total_count });
}));

// ---------------------------------------------------------------------
// FR-05.3  Customer Return & B-Grade
// ---------------------------------------------------------------------
const RETURN_GRADES = ['RESTOCK_A', 'B_GRADE', 'REWORK', 'DESTROY'] as const;

async function resolveVariant(c: PoolClient, it: Record<string, any>) {
  let row: any;
  if (it.sku_variant_id !== undefined && it.sku_variant_id !== null && it.sku_variant_id !== '') {
    row = (await c.query(`SELECT id FROM erp.sku_variants WHERE id = $1`, [num(it.sku_variant_id, 'sku_variant_id', { int: true })])).rows[0];
  } else if (it.barcode || it.variant) {
    row = (await c.query(`SELECT id FROM erp.sku_variants WHERE upper(barcode) = upper($1)`, [String(it.barcode ?? it.variant).trim()])).rows[0];
  } else if (it.sku && it.size && it.color) {
    row = (await c.query(
      `SELECT v.id FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id
       WHERE upper(k.code) = upper($1) AND upper(v.size) = upper($2) AND upper(v.color) = upper($3)`,
      [String(it.sku).trim(), String(it.size).trim(), String(it.color).trim()])).rows[0];
  } else {
    throw badRequest('Varian wajib diisi: sku_variant_id, barcode, atau sku + size + color.', { field: 'sku_variant_id' });
  }
  if (!row) throw notFound('Varian SKU tidak ditemukan.', 'VARIANT_NOT_FOUND');
  return row.id as number;
}

const RETURN_SELECT = `
  SELECT r.id, r.return_no, r.source, cu.code AS customer_code, cu.name AS customer_name, ch.code AS channel, st.code AS store,
         r.external_ref, k.code AS sku_code, k.name AS sku_name, v.size, v.color, v.barcode, r.qty, r.reason,
         w.wo_no, r.received_at, ru.full_name AS recorded_by,
         CASE WHEN EXISTS (SELECT 1 FROM erp.return_gradings g WHERE g.return_id = r.id) THEN 'GRADED' ELSE 'PENDING' END AS status,
         coalesce((SELECT jsonb_agg(jsonb_build_object('grade', g.grade, 'qty', g.qty, 'defect', dc.code, 'defect_name', dc.name,
                                                       'graded_by', gu.full_name, 'graded_at', g.graded_at) ORDER BY g.id)
                   FROM erp.return_gradings g LEFT JOIN erp.defect_categories dc ON dc.id = g.defect_category_id
                   JOIN erp.users gu ON gu.id = g.graded_by WHERE g.return_id = r.id), '[]') AS gradings
  FROM erp.customer_returns r
  JOIN erp.sku_variants v ON v.id = r.sku_variant_id JOIN erp.skus k ON k.id = v.sku_id
  LEFT JOIN erp.customers cu ON cu.id = r.customer_id LEFT JOIN erp.sales_channels ch ON ch.id = r.channel_id
  LEFT JOIN erp.online_stores st ON st.id = r.store_id LEFT JOIN erp.work_orders w ON w.id = r.work_order_id
  JOIN erp.users ru ON ru.id = r.recorded_by`;

async function findReturn(v: string) {
  const s = String(v).trim();
  return queryOne(`${RETURN_SELECT} WHERE ${/^\d+$/.test(s) ? 'r.id = $1::bigint' : 'upper(r.return_no) = upper($1)'}`, [s]);
}

// POST /returns — catat retur (sumber B2B / e-commerce)
qualityRouter.post('/returns', allow('SUPERVISOR', { staff: ['QC'] }), ah(async (req, res) => {
  const b = req.body ?? {};
  required(b, ['source', 'qty', 'reason']);
  const source = oneOf(String(b.source).toUpperCase(), ['B2B', 'ECOMMERCE'] as const, 'source');
  const qty = num(b.qty, 'qty', { int: true, gt: 0 });
  const reason = String(b.reason).trim();
  if (!reason) throw badRequest('Alasan retur wajib diisi.', { field: 'reason' });

  const id = await withTx(req.user!.id, async (c) => {
    const variantId = await resolveVariant(c, b);
    let customerId: number | null = null, channelId: number | null = null, storeId: number | null = null, woId: number | null = null;
    if (b.customer ?? b.customer_id ?? b.customer_code) {
      const v = String(b.customer ?? b.customer_id ?? b.customer_code).trim();
      customerId = (await c.query(`SELECT id FROM erp.customers WHERE upper(code) = upper($1) OR id::text = $1`, [v])).rows[0]?.id;
      if (!customerId) throw notFound('Klien tidak ditemukan.', 'CUSTOMER_NOT_FOUND');
    }
    if (b.channel ?? b.channel_id) {
      const v = String(b.channel ?? b.channel_id).trim();
      channelId = (await c.query(`SELECT id FROM erp.sales_channels WHERE upper(code) = upper($1) OR id::text = $1 OR upper(name) = upper($1)`, [v])).rows[0]?.id;
      if (!channelId) throw notFound('Kanal penjualan tidak ditemukan.', 'CHANNEL_NOT_FOUND');
    }
    if (b.store ?? b.store_id) {
      const v = String(b.store ?? b.store_id).trim();
      storeId = (await c.query(`SELECT id FROM erp.online_stores WHERE upper(code) = upper($1) OR id::text = $1`, [v])).rows[0]?.id;
      if (!storeId) throw notFound('Toko online tidak ditemukan.', 'STORE_NOT_FOUND');
    }
    if (source === 'B2B' && !customerId) throw badRequest('Klien wajib diisi untuk retur B2B.', { field: 'customer' });
    if (source === 'ECOMMERCE' && !channelId) throw badRequest('Kanal wajib diisi untuk retur e-commerce.', { field: 'channel' });
    if (b.work_order ?? b.work_order_id ?? b.wo_no) {
      const w = await resolveWo(String(b.work_order ?? b.work_order_id ?? b.wo_no), c);
      if (!w) throw notFound('SPK tidak ditemukan.', 'WORK_ORDER_NOT_FOUND');
      woId = w.id;
    }
    const r = (await c.query(
      `INSERT INTO erp.customer_returns (return_no, source, customer_id, channel_id, store_id, external_ref, sku_variant_id, qty, reason,
                                         work_order_id, received_at, recorded_by)
       VALUES (erp.fn_next_doc_no('RTN'), $1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10::timestamptz, now()), $11) RETURNING id`,
      [source, customerId, channelId, storeId, b.external_ref ?? null, variantId, qty, reason, woId, b.received_at ?? null, req.user!.id])).rows[0];
    await audit({ userId: req.user!.id, action: 'INSERT', entity: 'customer_returns', entityId: r.id, note: 'Retur dicatat', ip: req.ip }, c);
    return r.id;
  });
  res.status(201).json(await findReturn(String(id)));
}));

// GET /returns?status=PENDING|GRADED&source=&from=&to=&q=
qualityRouter.get('/returns', allow(...READERS, { staff: ['QC'] }), ah(async (req, res) => {
  const q = req.query as Record<string, any>;
  const { limit, offset, page } = paging(q);
  const status = q.status ? oneOf(String(q.status).toUpperCase(), ['PENDING', 'GRADED'] as const, 'status') : null;
  const source = q.source ? oneOf(String(q.source).toUpperCase(), ['B2B', 'ECOMMERCE'] as const, 'source') : null;
  const rows = await query(
    `SELECT x.*, count(*) OVER()::int AS total_count FROM (${RETURN_SELECT}) x
     WHERE ($1::text IS NULL OR x.status = $1) AND ($2::text IS NULL OR x.source::text = $2)
       AND ($3::date IS NULL OR erp.fn_wib_date(x.received_at) >= $3) AND ($4::date IS NULL OR erp.fn_wib_date(x.received_at) <= $4)
       AND ($5::text IS NULL OR x.return_no ILIKE '%' || $5 || '%' OR x.sku_code ILIKE '%' || $5 || '%' OR x.external_ref ILIKE '%' || $5 || '%')
     ORDER BY x.received_at DESC, x.id DESC LIMIT $6 OFFSET $7`,
    [status, source, dateParam(q.from, 'from'), dateParam(q.to, 'to'), q.q || null, limit, offset]);
  res.json({ data: rows.map(({ total_count, ...r }) => r), page, limit, total: rows[0]?.total_count ?? 0 });
}));

// GET /returns/{id} — id atau nomor retur (RTN-2026-0001)
qualityRouter.get('/returns/:id', allow(...READERS, { staff: ['QC'] }), ah(async (req, res) => {
  const r = await findReturn(req.params.id);
  if (!r) throw notFound('Retur tidak ditemukan.', 'RETURN_NOT_FOUND');
  res.json(r);
}));

// POST /returns/{id}/grading — klasifikasi: total = qty retur (fn_grade_return)
qualityRouter.post('/returns/:id/grading', allow('SUPERVISOR', { staff: ['QC'] }), ah(async (req, res) => {
  const ret = await findReturn(req.params.id);
  if (!ret) throw notFound('Retur tidak ditemukan.', 'RETURN_NOT_FOUND');
  const list = req.body?.grades ?? req.body?.gradings;
  if (!Array.isArray(list) || !list.length) throw badRequest('grades wajib diisi: [{ grade, qty, defect? }].', { field: 'grades' });
  const resolve = await defectMap(null);
  const grades = list.map((g: any) => {
    const grade = oneOf(String(g?.grade ?? '').toUpperCase(), RETURN_GRADES, 'grade');
    const qty = num(g?.qty, 'qty', { int: true, gt: 0 });
    const d = resolve(g?.defect ?? g?.defect_code);
    return { grade, qty, ...(d ? { defect: d.code } : {}) };
  });
  const keys = grades.map((g) => `${g.grade}|${g.defect ?? ''}`);
  if (new Set(keys).size !== keys.length) throw badRequest('Kombinasi grade dan jenis cacat tidak boleh ganda.');
  const total = sumQty(grades);
  if (total !== ret.qty) throw new AppError(422, 'QTY_MISMATCH', `Total klasifikasi ${total} tidak sama dengan qty retur ${ret.qty}.`);
  await withTx(req.user!.id, (c) => c.query(`SELECT erp.fn_grade_return($1, $2::jsonb, $3)`, [ret.id, JSON.stringify(grades), req.user!.id]));
  res.status(201).json({ status: 'OK', message: 'Retur berhasil diklasifikasi.', return: await findReturn(String(ret.id)) });
}));
