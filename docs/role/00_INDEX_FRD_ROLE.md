# FRD per User Role — Garment ERP (THEUNDERWEARSUPPLY)

| Atribut | Keterangan |
|---|---|
| **Versi** | 1.0 |
| **Dokumen induk** | PRD_Garment_ERP.md, FRD_Garment_ERP (per fitur), IA_Garment_ERP.md, DESIGN.md |
| **Referensi teknis** | `sql/01–04` (schema, fungsi `erp.fn_*`, view `erp.v_*`), `src/db/index.ts` |

FRD utama disusun **per fitur**. Dokumen-dokumen di sini menyusun ulang fitur yang sama dari sudut pandang **setiap role**: apa yang dilihat, apa yang boleh dilakukan, alur kerjanya, validasi dan pesan error yang muncul, serta endpoint/fungsi DB yang dipanggil. Kalau ada perbedaan isi, yang berlaku adalah FRD utama dan matriks `erp.role_permissions`.

## Daftar dokumen

| File | Role | Surface utama | Landing page |
|---|---|---|---|
| [FRD_Role_01_System_Admin.md](FRD_Role_01_System_Admin.md) | System Admin | Web desktop | `/settings/users` |
| [FRD_Role_02_Founder.md](FRD_Role_02_Founder.md) | Founder | Web desktop (read-only) | `/dashboard/founder` |
| [FRD_Role_03_Finance.md](FRD_Role_03_Finance.md) | Finance | Web desktop | `/dashboard/finance` |
| [FRD_Role_04_Supervisor.md](FRD_Role_04_Supervisor.md) | Supervisor | Web desktop + mobile | `/dashboard/supervisor` |
| [FRD_Role_05_Staff.md](FRD_Role_05_Staff.md) | Staff (Gudang, Cutting, Operator, QC, Packing, Teknisi) | Kios tablet + mobile | `/kiosk` |

## Struktur setiap dokumen

1. **Profil role**: tujuan, pengguna, perangkat, cara login, batas sesi.
2. **Ringkasan hak akses**: C/R/U/D/A per modul, plus area yang dikunci.
3. **Navigasi**: menu yang tampil.
4. **Fitur** (`FR-<ROLE>-xx`): deskripsi → alur kerja → validasi → penanganan error → API & fungsi DB → acceptance criteria.
5. **Notifikasi** yang diterima.
6. **Batasan**: hal yang tidak boleh dilakukan role ini.
7. **Traceability** ke ID FRD utama.

## Legenda

| Kode | Arti | | Kode | Arti |
|---|---|---|---|---|
| C | Create | | A | Approve |
| R | Read | | 🔒 | Dikunci mutlak (menu disembunyikan, API menolak 403) |
| U | Update | | — | Tidak ada akses |
| D | Delete / Deactivate | | | |

## Aturan lintas role

- **Format error API:** `{ "error": { "code": "<HINT dari DB>", "message": "<pesan siap tampil>" } }`. Pemetaan HTTP status ada di `src/db/index.ts`.
- **Audit trail:** setiap aksi tulis dijalankan dalam transaksi dengan `SET LOCAL app.user_id`. Lewat helper, ini cukup dengan `db.callFn(..., { userId })`.
- **Data biaya** (harga material, tarif borongan, HPP, payroll, overhead) hanya dikirim API ke **Founder** dan **Finance**. Field biaya di-strip dari respons role lain, bukan sekadar disembunyikan di UI.
- **Bahasa & format:** Bahasa Indonesia, `Rp 1.250.000`, `247,80 Kg`, `80,00 gr`, zona waktu WIB.

## Matriks ringkas

| Modul | Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|---|
| User, Role, Password | CRUD | R (audit) | — | Unlock akun | Ganti password sendiri |
| BOM / SMV / Tarif | CRUD | R | R | R tanpa harga/tarif | — |
| Receiving & Stok | R | R | R | R U A | C R (Gudang) |
| SPK | R | R | R | C R U | R |
| Cutting & Bundel | R | R | R | R U A, reprint | C (Cutting) |
| Scan Kios / WIP | R | R | R | R U (koreksi) | C (Operator) |
| Downtime | R | R | R (biaya) | C R U | C (lapor) / R U (Teknisi) |
| QC, Rework, Retur | R | R | R | R U A | C (QC) |
| Packing & Dispatch | R | R | R | R U A | C (Packing/Gudang) |
| Payroll | — | R | C R U A | 🔒 | R (slip sendiri, opsional) |
| Costing / HPP / Overhead | — | R | C R U | 🔒 | 🔒 |
| Efisiensi & OEE | R | R | R | R | R (skor sendiri, opsional) |
