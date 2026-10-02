# THEUNDERWEARSUPPLY Garment ERP

Satu aplikasi untuk semua role (Admin, Founder, Finance, Supervisor, Staff), disusun mengikuti
PRD, FRD per fitur (`../.agents/FRD`) dan FRD per role (`../docs/role`). Proyek ini menggabungkan
tujuh aplikasi terpisah sebelumnya (kini di `../_archive`) (`LoginFunction`, `FounderFunction`, `FinanceFunction`,
`SupervisorFunction`, `UserFunction`, `QCFunction`, `PackagingFunction`).

## Menjalankan

Dari root repo (`../`) jalankan `npm run dev` untuk menyalakan backend + frontend sekaligus.
Hanya frontend:

```bash
npm install
npm run dev            # http://localhost:3000, /api di-proxy ke http://localhost:4000
```

Bila backend tidak berjalan atau database belum dikonfigurasi, halaman login otomatis memakai
**akun demo** (tombol 1-click di halaman login). Alamat backend bisa diganti dengan env `API_URL`.

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server Vite (proxy `/api` → backend) |
| `npm run build` | Build produksi ke `dist/` |
| `npm run lint` | Type-check TypeScript |

## Alur

1. Semua user masuk lewat satu halaman login (`/login`). Login dicoba ke database
   (`POST /api/auth/login`); bila API/DB tidak tersedia, dipakai akun demo.
2. Setelah login, user diarahkan ke landing page role-nya. URL modul lain yang tidak
   diizinkan otomatis dialihkan kembali ke landing page.
3. Sesi berakhir otomatis setelah idle sesuai `erp.session_policies`
   (Admin/Founder/Finance 15 menit, Supervisor 30, Staff 60) dengan peringatan 60 detik
   sebelumnya (FR-00.2).

## Peta role → modul

| Role | Modul | URL |
|---|---|---|
| System Admin | Admin Console — user/RBAC, master data, konfigurasi, audit | `/settings/users` |
| Founder | Founder Suite (read-only) | `/dashboard/founder` |
| Finance | Finance & Costing — HPP, overhead, payroll borongan | `/dashboard/finance` |
| Supervisor | Supervisor Ops — telemetri, WIP, downtime, bundle & QC | `/dashboard/supervisor` |
| Staff OPERATOR / CUTTING / TEKNISI | Kios Operator | `/kiosk` |
| Staff QC | Stasiun QC | `/kiosk/qc` |
| Staff PACKING / GUDANG | Packing & Dispatch | `/kiosk/packing` |

Aturan hak akses ada di [`src/core/rbac.ts`](src/core/rbac.ts). Penegakan dari FRD yang
sudah diterapkan di UI:

- Menu **COST HPP dihapus dari Supervisor** (Costing/HPP 🔒 untuk Supervisor & Staff).
- Tombol **Create SPK dihapus dari Founder dan Finance** (SPK: C hanya Supervisor).
- Staff Packing/Gudang hanya melihat menu Packing & Dispatch dan Inventory Out.

## Struktur

```
frontend/
├── src/
│   ├── App.tsx        Shell: gate login → pilih modul per role → lazy-load
│   ├── core/          session (login/logout/idle), rbac, router, LoginPage, ModuleFrame
│   ├── modules/       admin · founder · finance · supervisor · kiosk · qc · packing
│   ├── index.css      Token desain Tailwind gabungan
│   └── styles/modules.css  Gaya per modul, di-scope dengan html[data-module="…"]
```

Setiap modul tetap memakai komponen dan desain aslinya. `ModuleFrame` memasang
`<html data-module="…">` sehingga tema gelap/terang, font, dan aturan global satu modul
(mis. sudut kotak di Supervisor/Packing) tidak bocor ke modul lain. Modul memakai
`useSession()` dari `src/core/session.tsx` untuk data user dan logout.
