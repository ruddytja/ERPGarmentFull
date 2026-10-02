# FRD Role — Supervisor

| Atribut | Keterangan |
|---|---|
| **Role** | `SUPERVISOR` |
| **Tujuan** | Mengendalikan lantai produksi: merilis SPK, menjaga alur bundel, menyetujui pengecualian, dan menangani downtime |
| **Pengguna** | Kepala produksi / kepala lini |
| **Surface** | Web desktop + mobile (bottom nav: Beranda · WIP · Downtime · Notifikasi · Profil) |
| **Login** | Username/password atau Google SSO. Bisa juga login kios memakai kode `SPV-xxx` + PIN |
| **Batas idle** | 30 menit |
| **Landing page** | `/dashboard/supervisor` |

> **Aturan mutlak:** Supervisor **tidak pernah** menerima data biaya: harga material, tarif borongan, HPP, payroll, overhead, harga jual. Menu tersebut tidak tampil, dan API mengembalikan `403` bila dipanggil.

---

## 1. Ringkasan Hak Akses

| Modul | Akses | Catatan |
|---|---|---|
| SPK | **C R U** | Buat, aktifkan, tutup manual, batalkan |
| Receiving | R, **A** | Approve selisih timbang |
| Stok & alokasi | R, **U A** | Approve stock opname/adjustment |
| Cutting | R, **U A** | Bisa input cutting sendiri |
| Bundel | **C R**, cetak ulang | Hanya Supervisor yang boleh cetak ulang |
| Scan kios / WIP | R, **U** | Review scan anomali, koreksi scan |
| Downtime | **C R U** | Lapor, konfirmasi mesin jalan |
| QC | R, **U** | Koreksi dengan alasan; bisa input QC |
| Retur & B-Grade | R, **A** | |
| Packing | R, **U** | |
| Dispatch B2B | R, **A** | Approve Delivery Order |
| Sample & Prototyping | **C R U** | |
| BOM / SMV | R | **Tanpa harga dan tanpa tarif** |
| Efisiensi & OEE | R | Tanpa biaya |
| Buka kunci akun | **U** | Untuk operator yang terkunci |
| Payroll, Costing/HPP, Overhead | 🔒 | |

## 2. Navigasi

```
Dashboard Supervisor
├── Produksi ──── SPK (Draft/Active/Closed) · Cutting · Bundel · WIP Live Monitor
├── Inventory ─── Stok · Receiving (approval) · Alokasi · Stock Opname
├── Shop Floor ── Downtime · Review Scan Anomali · Mode Kios
├── QC ────────── Defect Rate · Traceability · Retur & B-Grade
├── Packing ───── FG · Delivery Order B2B (approval)
├── Sampel ────── Sample & Prototyping
└── Analytics ─── Efisiensi Lini · Leaderboard · OEE   (tanpa biaya)
```

---

## 3. Fitur

### FR-SPV-01 Dashboard Supervisor
**Isi:** KPI SPK aktif, output hari ini, efisiensi lini, mesin bermasalah. Juga tabel SPK aktif dengan progress bar (cutting → jahit → QC → packing), kartu tiket downtime dengan timer berjalan, dan grafik efisiensi per lini.

**API:** `GET /dashboard/supervisor` → `v_work_order_progress`, `v_downtime_board`, `v_operator_efficiency_daily`.

**Acceptance:** tidak ada angka Rupiah di layar ini.

---

### FR-SPV-02 Buat & Aktifkan SPK
**Alur kerja**
1. **SPK → Buat SPK**: pilih SKU (BOM aktif dipilih otomatis), isi qty per size × warna, tanggal target, tujuan (B2B/Stok Internal/E-commerce), dan klien bila B2B.
2. Simpan sebagai **Draft**. Qty masih bisa diedit.
3. Klik **Aktifkan**. Sistem mengecek stok material, me-reserve FIFO per lot, dan menyimpan snapshot HPP estimasi (tidak ditampilkan ke Supervisor).

**Validasi**
- SKU wajib punya BOM aktif dan routing. Tanggal target ≥ hari ini. Tujuan B2B wajib ada klien.
- Qty SPK yang sudah Active tidak bisa diubah.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Stok kurang | `INSUFFICIENT_STOCK` | "SPK tetap Draft. Kekurangan: Polyester Single Knit 25,70 Kg" |
| BOM belum aktif | `BOM_INACTIVE` | "SKU belum memiliki BOM aktif." |
| Ubah qty SPK Active | `WO_LOCKED` | "Qty SPK yang sudah Active tidak dapat diubah. Tutup dan buat SPK revisi." |
| Tanggal lampau | `DUE_DATE_PAST` | "Tanggal target tidak boleh sebelum hari ini." |

**API & DB:** `POST /work-orders` (+ lines). `PATCH /work-orders/{id}/activate` → `fn_activate_work_order(wo, spv)`. Respons ke Supervisor **tidak menyertakan** `est_per_pcs`.

**Acceptance:** setelah aktivasi, menu **Alokasi** menampilkan material yang di-reserve per lot dalam Kg.

---

### FR-SPV-03 Tutup / Batalkan SPK
- **Tutup manual** (SPK Active yang belum capai target): alasan wajib diisi. Sisa reserve dilepas, HPP dihitung, Finance diberi notifikasi. Endpoint: `fn_close_work_order(wo, spv, reason)`.
- **Batalkan** (Draft, atau Active tanpa cutting): `fn_cancel_work_order(wo, spv, reason)`. SPK yang sudah ada cutting harus ditutup manual (`HAS_PRODUCTION`).
- **Penutupan otomatis** terjadi saat pcs FG + reject ≥ target dan tidak ada bundel rework terbuka. Bila target tercapai tetapi masih ada rework, Supervisor menerima notifikasi "SPK belum dapat ditutup."

---

### FR-SPV-04 Approve Selisih Receiving
**Alur kerja.** Notifikasi `RECEIVING_VARIANCE` → buka penerimaan → lihat berat dokumen vs timbang aktual per item → isi catatan → **Approve**. Stok bertambah sesuai berat aktual.

**Validasi.** Hanya penerimaan berstatus *Menunggu Approval*. Catatan wajib diisi.

**Error:** `INVALID_STATUS` "Penerimaan ini tidak sedang menunggu approval." · `NOTE_REQUIRED` "Catatan approval selisih wajib diisi."

**API & DB:** `PATCH /goods-receipts/{id}/approve` → `fn_approve_goods_receipt(id, spv, note)`.

---

### FR-SPV-05 Stock Opname & Adjustment
**Alur kerja.** Staff Gudang mengajukan hitung fisik → Supervisor meninjau selisih per lot → **Approve**. Sistem membuat mutasi `ADJUSTMENT` di kartu stok.

**API & DB:** `POST /stock/adjustments/{id}/approve` → `fn_approve_stock_adjustment(id, spv)`.

---

### FR-SPV-06 Cutting & Bundel
**Deskripsi.** Supervisor bisa menginput cutting (sama seperti Staff Cutting, lihat FRD Staff §B) dan memiliki dua wewenang tambahan:
- **Cetak ulang tiket bundel**: alasan wajib. Versi QR naik, sehingga tiket lama otomatis tidak berlaku.
- **Mengisi catatan variance** bila berat bersih menyimpang > ±5% dari BOM.

**Error:** `REASON_REQUIRED` "Alasan cetak ulang wajib diisi." · Scan tiket lama: `TICKET_INVALID` "Tiket sudah tidak berlaku. Gunakan tiket cetak ulang."

**API & DB:** `POST /bundles/{code}/reprint` → `fn_reprint_bundle(code, spv, reason)` → QR baru `BDL-0102-003:2`. Cetak ulang tercatat di audit.

---

### FR-SPV-07 WIP Live Monitor & Review Scan Anomali
**Deskripsi.** Papan status bundel per lini: operasi berjalan, operator, mesin, dan operasi berikutnya. Ada juga antrean scan anomali.

**Alur review anomali**
1. Notifikasi `SCAN_ANOMALY` muncul bila durasi kerja < 50% dari (SMV × qty).
2. Buka detail: operator, bundel, durasi aktual vs standar.
3. Pilih **Terima** (tetap dibayar) atau **Tolak** (tidak dibayar).

**Koreksi scan:** mengubah operator/qty/waktu hanya dengan alasan. Tercatat di audit (`CORRECTION_REQUIRED` bila tanpa alasan).

**API & DB:** `GET /wip/status` → `v_bundle_status`. `POST /wip/tasks/{id}/review` → `fn_review_anomaly(task, spv, accept)`.

**Acceptance:** anomali yang belum direviu tidak masuk payroll dan efisiensi.

---

### FR-SPV-08 Downtime Mesin
**Alur kerja**
1. Tekan **Lapor Downtime** (web/mobile/kios) → pilih mesin → pilih kendala.
2. Mesin menjadi **Down**, teknisi penanggung jawab (mis. Hendra Ari Wardani) menerima alert, dan timer berjalan.
3. Tiket yang tidak direspons > 15 menit dieskalasi ke Supervisor.
4. Setelah teknisi menandai **Resolved**, Supervisor menekan **Konfirmasi Mesin Jalan**.

**Validasi.** Satu mesin hanya boleh punya satu tiket terbuka. Scan kios pada mesin Down ditolak.

**Error:** `TICKET_EXISTS` "Mesin ini sudah memiliki tiket terbuka DT-2026-0001." · `MACHINE_DOWN` "Mesin {kode} sedang Down. Gunakan mesin lain."

**API & DB:** `POST /downtime-tickets` → `fn_report_downtime(machine, issue, spv)`. `PATCH /downtime-tickets/{id}` (confirmed_by). `GET /downtime-tickets` → `v_downtime_board`.

---

### FR-SPV-09 QC: Monitor, Koreksi, Retur
- **Monitor** defect rate harian dan Pareto. Alert bila > 5%.
- **Koreksi hasil QC:** wajib alasan. Ditolak bila tanggal QC masuk periode payroll yang sudah di-approve (`PAYROLL_LOCKED`).
- **Retur & B-Grade:** menyetujui hasil grading Staff QC.
- **Traceability:** cari berdasarkan bundel/lot/operator untuk melihat rantai lengkap.

**API:** `GET /reports/defect-rate`, `GET /traceability/bundles/{code}` (`v_bundle_trace`), `PATCH /qc/inspections/{id}`.

---

### FR-SPV-10 Approve Delivery Order B2B
**Alur kerja.** Staff Gudang membuat DO → Supervisor meninjau SKU dan qty → **Approve** → Gudang mengirim.

**API & DB:** `PATCH /dispatch/{id}/approve` → `fn_approve_delivery_order(do, spv)`.

---

### FR-SPV-11 Sample & Prototyping
**Alur kerja.** Buat Sample Request → Staff mencatat konsumsi material dan waktu → Supervisor set status *Approved / Revisi / Ditolak*. Sampel Approved diteruskan ke Admin untuk konversi ke BOM.

**API & DB:** `POST /samples`, `PATCH /samples/{id}/status`, konsumsi via `fn_sample_consume(sample, lot, qty, user)`.

---

### FR-SPV-12 Buka Kunci Operator
Operator yang salah PIN 5 kali dikunci 15 menit. Supervisor bisa membuka kunci lebih awal: `POST /users/{id}/unlock` → `fn_unlock_login(user, spv)`.

---

## 4. Notifikasi yang Diterima

| Tipe | Pemicu |
|---|---|
| `RECEIVING_VARIANCE` | Selisih timbang > ±2% |
| `STOCK_CRITICAL` | Stok material di bawah minimum |
| `SCAN_ANOMALY` | Scan terlalu cepat |
| `DOWNTIME_NEW`, `DOWNTIME_ESCALATION` | Mesin Down / tiket tidak direspons > 15 menit |
| `DEFECT_THRESHOLD` | Defect harian > 5% |
| `WO_CLOSED` | Target tercapai tetapi masih ada rework terbuka |

## 5. Batasan
- 🔒 Tidak bisa membuka Payroll, HPP, Overhead, atau harga apa pun (UI disembunyikan, API `403`, dan percobaan akses tercatat).
- Tidak bisa mengubah BOM, SMV, tarif, atau user (wewenang Admin).
- Tidak bisa mereset password (hanya buka kunci).

## 6. Traceability

| FR Role | FRD utama |
|---|---|
| FR-SPV-02, 03 | FR-03.1, FR-02.2, FR-06.2 |
| FR-SPV-04, 05 | FR-02.1, FR-02.3 |
| FR-SPV-06 | FR-03.2, FR-03.4 |
| FR-SPV-07 | FR-04.1 |
| FR-SPV-08 | FR-04.2 |
| FR-SPV-09 | FR-05.1–05.3 |
| FR-SPV-10 | FR-06.3 |
| FR-SPV-11 | FR-01.4 |
