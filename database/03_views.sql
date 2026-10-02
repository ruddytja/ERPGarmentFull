-- =====================================================================
--  Garment ERP — THEUNDERWEARSUPPLY
--  03_views.sql  ·  view yang dipakai fungsi transaksi (02_functions_triggers.sql)
-- =====================================================================
BEGIN;
SET search_path = erp, public;

-- FR-07.1 Kredit tenaga kerja borongan.
--  • Qty Pass QC dikreditkan ke setiap operator yang menyelesaikan operasi pada bundel asal.
--  • Unit rework dibayar sekali saat bundel rework lolos QC ulang (operasi rework tidak dibayar ganda); Reject tidak dibayar.
--  • credit_date = tanggal QC (WIB); tarif = tarif berlaku pada tanggal operasi selesai (effective date).
--  • Scan anomali hanya dibayar bila sudah direviu dan diterima Supervisor.
-- Dipakai oleh: fn_generate_payroll, fn_calculate_wo_costing (→ fn_finalize_work_order, fn_lock_overhead_period).
CREATE OR REPLACE VIEW erp.v_labor_credits AS
SELECT t.id AS task_id, t.operator_id, rb.work_order_id, t.operation_id, q.id AS inspection_id, qb.id AS qc_bundle_id,
       rb.id AS root_bundle_id, q.qty_pass AS credit_qty,
       erp.fn_rate_at(t.operation_id, erp.fn_wib_date(t.completed_at)) AS rate_idr,
       erp.fn_wib_date(q.inspected_at) AS credit_date, erp.fn_wib_date(t.completed_at) AS task_date,
       t.is_anomaly, t.anomaly_reviewed_at, t.anomaly_accepted, t.duration_min,
       (NOT t.is_anomaly OR t.anomaly_accepted IS TRUE) AS is_payable
FROM erp.qc_inspections q
JOIN erp.bundles qb ON qb.id = q.bundle_id
JOIN erp.bundles rb ON rb.id = coalesce(qb.root_bundle_id, qb.id)
JOIN erp.wip_tasks t ON t.bundle_id = rb.id AND t.completed_at IS NOT NULL
WHERE q.qty_pass > 0;

COMMENT ON VIEW erp.v_labor_credits IS 'FR-07.1 — kredit upah borongan per operator × operasi dari unit Pass QC.';

COMMIT;
