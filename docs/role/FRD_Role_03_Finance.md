# FRD Role — Finance

| Atribut | Keterangan |
|---|---|
| **Role** | `FINANCE` |
| **Tujuan** | Mengendalikan HPP aktual, mencatat overhead, dan menyusun payroll borongan yang akurat dari hasil Pass QC |
| **Pengguna** | Staf keuangan / akuntan |
| **Surface** | Web desktop |
| **Login** | Username/password atau Google SSO |
| **Batas idle** | **15 menit** (data sensitif) |
| **Landing page** | `/dashboard/finance` |

---

## 1. Ringkasan Hak Akses

| Modul | Akses | Catatan |
|---|---|---|
| Payroll borongan | **C R U A** | Generate, adjustment, approve & kunci |
| Costing / HPP | **C R U** | Hitung ulang HPP |
| Overhead | **C R U** | Input biaya & kunci periode |
| Limbah perca | R, **U** nilai jual | |
| BOM (termasuk harga), Receiving (termasuk harga), SMV & Tarif | R | |
| SPK, Stok, Cutting, WIP, Downtime (biaya), QC, Packing, Dispatch | R | |
| Efisiensi & OEE | R | |
| User Management, master data | — | |

## 2. Navigasi

```
Dashboard Finance
├── HPP & Costing ── Daftar HPP per SPK · Profitabilitas · Nilai Persediaan
├── Overhead ─────── Input Biaya · Ringkasan Periode · Kunci Periode
├── Payroll ──────── Periode · Draf & Review · Slip · Ekspor
├── Limbah Perca ─── Penjualan limbah (nilai)
└── Laporan ──────── Efisiensi · OEE · Defect   (read-only)
```

---

## 3. Fitur

### FR-FIN-01 Dashboard Finance
**Isi:** KPI draf payroll periode berjalan, jumlah SPK dengan variance > ±5%, status overhead bulan berjalan (Open/Locked), nilai penjualan limbah, daftar notifikasi HPP, dan kartu ringkasan payroll (operator, pcs Pass, scan anomali, total upah).

**API:** `GET /dashboard/finance`.

---

### FR-FIN-02 Generate Draf Payroll Borongan
**Deskripsi.** Menghitung upah per operator dari unit **Pass QC × tarif operasi** pada tanggal operasi selesai.

**Alur kerja**
1. **Payroll → Periode Baru**: isi tanggal mulai/akhir dan frekuensi (mingguan/2 mingguan/bulanan).
2. Klik **Generate Draf**.
3. Sistem menampilkan: jumlah baris, total Rp, **bundel belum di-QC** (tidak masuk periode ini), dan **scan anomali dikecualikan**.
4. Review per operator. Baris bisa di-expand: SPK × operasi × qty × tarif.
5. Generate ulang boleh selama status masih Draft. Draf lama diganti.

**Aturan perhitungan**
- Kredit diberikan saat **QC Pass**, ke semua operator yang menyelesaikan operasi pada bundel asal.
- Unit **rework** dibayar sekali setelah lolos QC ulang. Unit **reject** tidak dibayar.
- Scan anomali (durasi < 50% standar SMV) tidak dibayar sampai **diterima Supervisor**.
- Tarif yang dipakai: tarif efektif pada tanggal operasi selesai.

**Validasi**
- Periode tidak boleh tumpang-tindih dengan periode lain (exclusion constraint).
- Hanya role Finance yang boleh generate.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Periode overlap | `DUPLICATE` / exclusion | "Data sudah ada (duplikat)." → tampilkan "Periode bertumpuk dengan periode lain." |
| Periode sudah approved | `PAYROLL_LOCKED` | "Periode payroll sudah di-approve." |
| Bukan Finance | `ACCESS_DENIED` | "Peran {role} tidak berwenang untuk tindakan ini." |

**API & DB**

| Method | Endpoint | DB |
|---|---|---|
| POST | `/payroll/periods` | `INSERT erp.payroll_periods` |
| POST | `/payroll/runs` | `fn_generate_payroll(period_id, finance_id)` → `{lines, total_idr, uninspected_bundles, anomaly_scans_excluded}` |
| GET | `/payroll/runs/{id}` | `v_payroll_slip`, `v_payroll_detail` |

**Acceptance criteria**
- **Given** 1 bundel berisi 24 pcs dengan hasil QC 21 Pass / 2 Rework / 1 Reject, **When** draf dibuat sebelum rework lolos, **Then** operator dikredit 21 pcs. Setelah rework lolos QC ulang, periode berikutnya mengkredit +2 pcs.
- **Given** ada scan anomali belum direviu, **Then** muncul banner "1 scan anomali dikecualikan."

---

### FR-FIN-03 Adjustment & Approve Payroll
**Alur kerja**
1. Di draf, klik **Tambah Adjustment** pada operator → isi nominal (±) dan alasan (wajib).
2. Klik **Approve & Kunci** → modal konfirmasi menampilkan total dan peringatan "Periode akan terkunci."
3. Setelah approve, semua tombol edit hilang dan **Ekspor Excel/PDF** aktif.

**Validasi**
- Approve ditolak bila ada operasi tanpa tarif atau draf belum pernah di-generate.
- Setelah approved: baris payroll, adjustment, dan koreksi QC di periode tersebut terkunci. Tarif baru tidak boleh berlaku mundur ke periode ini.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Operasi tanpa tarif | `RATE_MISSING` | "Operasi {nama} tanpa tarif. Draf tidak dapat di-approve." |
| Belum generate | `NOT_GENERATED` | "Generate draf payroll terlebih dahulu." |
| Ubah setelah approve | `PAYROLL_LOCKED` | "Periode payroll sudah di-approve dan terkunci. Gunakan adjustment di periode berikutnya." |

**API & DB:** `POST /payroll/runs/{id}/adjustments` → `INSERT erp.payroll_adjustments`. `PATCH /payroll/runs/{id}/approve` → `fn_approve_payroll(period, finance_id)`. `GET /payroll/runs/{id}/export?format=xlsx`.

---

### FR-FIN-04 Input Overhead & Kunci Periode
**Deskripsi.** Mencatat biaya tidak langsung per bulan untuk dialokasikan ke HPP.

**Kategori:** Listrik, Maintenance, Spare part (otomatis dari tiket downtime), Operasional, Sewa, Lainnya, dan **Kredit penjualan limbah** (otomatis, nilai negatif).

**Alur kerja**
1. **Overhead → bulan** → **Tambah Biaya** → kategori, nominal, deskripsi.
2. Tinjau ringkasan per kategori, termasuk entri otomatis dari spare part dan limbah.
3. Akhir bulan: **Kunci Periode**. Sistem menghitung ulang HPP semua SPK yang ditutup di bulan itu, dan statusnya berubah dari `PROVISIONAL` menjadi `FINAL`.

**Aturan alokasi:** overhead bulan ÷ total menit SMV produksi bulan itu × menit SMV SPK.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Ubah biaya di periode terkunci | `PERIOD_LOCKED` | "Periode overhead sudah dikunci." |
| Kunci periode yang sudah terkunci | `INVALID_STATUS` | "Periode tidak ditemukan atau sudah dikunci." |

**API & DB:** `POST /overhead` → `INSERT erp.overhead_entries`. `PATCH /overhead/periods/{id}/lock` → `fn_lock_overhead_period(period, finance_id)` (mengembalikan jumlah SPK yang menjadi Final). `GET /overhead/summary` → `v_overhead_summary`.

---

### FR-FIN-05 HPP Aktual vs Estimasi per SPK
**Deskripsi.** Laporan HPP per pcs untuk SPK Closed.

| Komponen | Estimasi (snapshot saat aktivasi SPK) | Aktual |
|---|---|---|
| Material | BOM × (1 + shrinkage) × harga rata-rata + kemasan | Σ pemakaian riil (cutting, aksesoris, kemasan) ÷ pcs FG |
| Tenaga kerja | Σ tarif routing | Σ kredit Pass QC × tarif ÷ pcs FG |
| Overhead | Σ SMV × estimasi Rp/menit | Alokasi overhead bulan penutupan |

**Alur kerja.** Daftar SPK → klik → lihat rincian. Tombol **Hitung Ulang** tersedia untuk SPK yang belum Final (mis. setelah koreksi).

**Validasi**
- SPK tanpa barang jadi tidak bisa dihitung (`NO_FG`).
- Variance total > ±5% memicu notifikasi ke Finance dan Founder.

**API & DB:** `GET /costing/work-orders/{id}` → `v_wo_costing`. `POST /costing/work-orders/{id}/recalculate` → `fn_calculate_wo_costing(wo)`. `GET /costing/summary` → `v_brand_profitability`. `GET /inventory/valuation` → `v_inventory_valuation`.

**Acceptance:** status `PROVISIONAL` berubah otomatis menjadi `FINAL` setelah FR-FIN-04 dikunci.

---

### FR-FIN-06 Nilai Penjualan Limbah Perca
**Deskripsi.** Memverifikasi harga/Kg penjualan limbah. Setiap penjualan otomatis menjadi kredit overhead.

**API:** `GET /scrap/stock` → `v_scrap_stock`. `GET /scrap/disposals`.

---

## 4. Notifikasi yang Diterima

| Tipe | Pemicu |
|---|---|
| `PAYROLL_READY` | Draf payroll selesai dibuat |
| `COST_VARIANCE` | HPP SPK menyimpang > ±5% |
| `WO_CLOSED` | SPK ditutup (otomatis/manual), HPP siap ditinjau |

## 5. Batasan
- Tidak mengubah tarif borongan, BOM, atau master data (wewenang Admin).
- Tidak mengoreksi data scan/QC (wewenang Supervisor).
- Tidak mengelola user.

## 6. Traceability

| FR Role | FRD utama |
|---|---|
| FR-FIN-02, 03 | FR-07.1 |
| FR-FIN-04, 05 | FR-07.2 |
| FR-FIN-06 | FR-03.3 |
