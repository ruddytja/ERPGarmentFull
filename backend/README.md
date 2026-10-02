# Garment ERP — Backend

REST API Express + PostgreSQL (Aiven) untuk frontend di `../frontend`. Logika bisnis inti ada di
database (`../database/02_functions_triggers.sql`, fungsi `erp.fn_*`); API menambahkan autentikasi,
RBAC per role (matriks FRD), validasi input, dan format respons.

```bash
npm install
cp .env.example .env   # isi koneksi PostgreSQL + JWT_SECRET
npm run dev            # http://localhost:4000/api/v1 (auto-reload)
```

## Struktur

| Path | Isi |
|---|---|
| `src/index.ts` | Entry point: `/api/v1` (API FRD), `/api` (endpoint lama untuk frontend), error handler, job |
| `src/lib/db.ts` | Pool PostgreSQL, `query`, `withTx(userId, fn)` (set `app.user_id` untuk audit trail), `audit()` |
| `src/lib/auth.ts` | JWT + sesi (`erp.user_sessions`), idle timeout per role, `allow()` RBAC (403 tercatat di audit log) |
| `src/lib/http.ts` | Format error standar `{ error: { code, message, details } }`, pemetaan error DB, validator |
| `src/lib/scheduler.ts` | Job latar belakang (`JOBS_ENABLED=false` untuk mematikan) |
| `src/routes/auth.ts` | FR-00.1/00.2 — login, refresh, logout, session, keepalive, change/forgot/reset password, Google SSO, login kios PIN |
| `src/routes/admin.ts` | FR-00.2/00.3, FR-07.4 — users, roles/permissions, audit-logs, settings, notifikasi (+ SSE) |
| `src/routes/master/` | FR-01 — material, supplier, customer, brand, SKU, routing, BOM, operasi/tarif, sampel, mesin |
| `src/routes/inventory.ts` | FR-02, FR-03.3 — goods receipt, stok & kartu stok, alokasi, adjustment/opname, limbah |
| `src/routes/production/` | FR-03.1/03.2/03.4, FR-04 — SPK, cutting, bundle + label PDF, scan WIP kios, downtime |
| `src/routes/quality.ts` | FR-05 — QC, defect report/pareto, traceability, retur & grading |
| `src/routes/fulfillment.ts` | FR-06 — packing, closure-check SPK, dispatch B2B, fulfillment e-commerce (+ impor CSV) |
| `src/routes/finance.ts` | FR-07.1/07.2 — payroll borongan (+ ekspor xlsx/pdf), overhead, costing HPP |
| `src/routes/reports.ts` | FR-07.3 — efisiensi, OEE, leaderboard, dasbor Founder/Supervisor/Finance |
| `src/jobs/` | Eskalasi tiket downtime (tiap 60 dtk) |
| `src/scripts/dev-token.ts` | DEV: buat token untuk user tanpa password (`npx tsx src/scripts/dev-token.ts supervisor`) |
| `src/scripts/apply-views.ts` | Menerapkan `../database/03_views.sql` ke database yang sudah ada |

## Konvensi API

- Header `Authorization: Bearer <access_token>`; perbarui dengan `POST /api/v1/auth/refresh`.
- Request dengan header `X-Passive: 1` tidak memperpanjang sesi idle (untuk polling).
- Parameter `{id}` menerima id numerik atau nomor dokumen/kode (`SPK-2026-0101`, `BDL-…`, kode SKU, dst.).
- List: `{ data, page, limit, total }`. Error: `{ error: { code, message, details } }`.

Tanpa konfigurasi database, semua endpoint menjawab `503 DB_NOT_CONFIGURED` dan frontend beralih ke mode demo.
