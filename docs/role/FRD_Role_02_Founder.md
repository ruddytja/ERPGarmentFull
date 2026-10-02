# FRD Role — Founder

| Atribut | Keterangan |
|---|---|
| **Role** | `FOUNDER` |
| **Tujuan** | Mengambil keputusan strategis dari data riil: profitabilitas per brand, deviasi biaya, produktivitas, dan OEE |
| **Pengguna** | Pemilik usaha |
| **Surface** | Web desktop (≥ 1440 px ideal), tetap responsif di tablet/HP |
| **Login** | Google SSO (disarankan) atau username/password |
| **Batas idle** | 15 menit |
| **Landing page** | `/dashboard/founder` |
| **Sifat akses** | **Read-only penuh.** Tidak ada tombol simpan, approve, atau hapus di seluruh layar Founder |

---

## 1. Ringkasan Hak Akses

| Modul | Akses |
|---|---|
| Dashboard Founder, Profitabilitas, HPP, Cost Variance | **R** |
| Payroll (ringkasan & slip) | **R** |
| Overhead | **R** |
| Efisiensi, Leaderboard, OEE | **R** |
| SPK, Stok, Cutting, WIP (agregat), Downtime, QC, Traceability, Packing, Dispatch | **R** |
| Master data (BOM termasuk harga, SMV, tarif) | **R** |
| Audit trail | **R** |
| Semua aksi tulis | — |

## 2. Navigasi

```
Dashboard Founder
├── Profitabilitas ── per Brand · per SKU · per SPK
├── HPP & Costing ─── Estimasi vs Aktual · Overhead
├── Produktivitas ─── Efisiensi Lini · Leaderboard · OEE Mesin
├── Kualitas ──────── Defect Rate · Pareto Cacat · Traceability
├── Operasional ───── SPK · Inventory · Barang Jadi · Downtime   (read-only)
└── Payroll ───────── Ringkasan periode (read-only)
```

---

## 3. Fitur

### FR-FND-01 Dashboard Founder
**Deskripsi.** Satu layar ringkasan kondisi bisnis pabrik.

**Isi layar**

| Komponen | Sumber data | Keterangan |
|---|---|---|
| KPI *Margin rata-rata* | `v_brand_profitability` | Berbobot qty FG, beserta delta vs bulan lalu |
| KPI *Cost variance* | `v_wo_costing` | Chip warna: ≤ 3% hijau, 3–5% kuning, > 5% merah |
| KPI *Output bulan ini* | `v_work_order_progress` | pcs packed |
| KPI *OEE pabrik* | `v_machine_oee_daily` | Rata-rata, dengan target 65% → 75% |
| Grafik *HPP estimasi vs aktual per brand* | `v_brand_profitability` | Bar estimasi abu, aktual biru |
| Daftar *Margin per brand* | `v_brand_profitability` | Urut tertinggi |
| Tabel *SPK closed terbaru* | `v_wo_costing` | Klik baris → FR-FND-03 |

**Alur kerja.** Pilih periode (bulan/rentang tanggal). Semua komponen ikut ter-filter.

**Validasi.** Data periode berjalan memakai HPP berstatus `PROVISIONAL` dan diberi label "Sementara" sampai Finance mengunci overhead.

**Penanganan error**
- Belum ada SPK closed di periode → empty state "Belum ada SPK selesai di periode ini."
- API gagal → kartu menampilkan "Data belum dapat dimuat" dengan tombol **Muat ulang**.

**API:** `GET /dashboard/founder?from=&to=` (agregasi dari view di atas).

**Acceptance criteria**
- **Given** Founder login, **When** membuka dashboard, **Then** semua KPI tampil tanpa tombol aksi.
- **Given** variance SPK > 5%, **Then** chip berwarna merah dan ada ikon peringatan (tidak hanya warna).

---

### FR-FND-02 Profitabilitas per Brand / SKU
**Deskripsi.** Membandingkan HPP aktual, harga jual, dan margin per brand (NAQALA WEAR, Pierre UNO, Finy Girls, Beyond Skin) dan per SKU.

**Alur kerja.** Pilih level (Brand/SKU) dan periode → urutkan menurut margin, variance, atau volume FG → drill-down ke daftar SPK.

**Rumus**
- Margin % = (harga jual − HPP aktual) ÷ harga jual, berbobot qty FG.
- Variance % = (HPP aktual − HPP estimasi) ÷ HPP estimasi.

**API:** `GET /costing/summary?group_by=brand|sku&from=&to=` → `v_brand_profitability`, `v_wo_costing`.

**Acceptance:** SKU tanpa harga jual tampil "Harga jual belum diisi", bukan margin 0%.

---

### FR-FND-03 Detail HPP per SPK
**Deskripsi.** Rincian HPP per pcs: material, tenaga kerja, overhead, estimasi vs aktual.

**Isi layar**
- Kartu: HPP estimasi, HPP aktual, variance (Rp & %), qty FG, qty reject, status Final/Provisional.
- Tabel komponen: estimasi | aktual | selisih Rp | selisih %, dengan highlight merah bila > ±5%.
- Grafik estimasi vs aktual per komponen.
- Tautan ke **Traceability** SPK (lot kain, operator, cacat).

**API:** `GET /costing/work-orders/{id}` → `v_wo_costing`.

**Acceptance:** status `PROVISIONAL` tampil dengan badge kuning dan catatan "Overhead periode belum dikunci Finance."

---

### FR-FND-04 Produktivitas & OEE
**Deskripsi.** Efisiensi operator/lini dan OEE mesin untuk keputusan investasi mesin, pelatihan, atau insentif.

**Isi**
- Efisiensi = (pcs Pass × SMV) ÷ waktu kerja aktual. Ada leaderboard operator dan grafik per lini.
- OEE = Availability × Performance × Quality per mesin, dengan rincian downtime.

**API:** `GET /reports/efficiency`, `GET /reports/leaderboard`, `GET /reports/oee` → `v_operator_efficiency_daily`, `v_machine_oee_daily`.

**Acceptance:** scan anomali yang belum direviu tidak dihitung, dan ada keterangan "x scan dikecualikan."

---

### FR-FND-05 Kualitas & Traceability
**Deskripsi.** Defect rate harian, Pareto jenis cacat, dan penelusuran cacat sampai ke operator, mesin, dan lot kain.

**API:** `GET /reports/defect-rate`, `GET /reports/defect-pareto`, `GET /traceability/bundles/{code}` → `v_qc_daily`, `v_defect_detail`, `v_bundle_trace`.

---

### FR-FND-06 Monitor Operasional & Payroll (Read-only)
**Deskripsi.** Melihat progres SPK, stok, barang jadi, downtime aktif, dan ringkasan payroll per periode tanpa bisa mengubah apa pun.

**API:** `GET /work-orders`, `GET /stock`, `GET /downtime-tickets`, `GET /payroll/runs` (`v_payroll_slip`, ringkasan saja).

---

## 4. Notifikasi yang Diterima

| Tipe | Pemicu |
|---|---|
| `COST_VARIANCE` | HPP aktual SPK menyimpang > ±5% dari estimasi |
| `DEFECT_THRESHOLD` | Defect rate harian > 5% |

## 5. Batasan
- Tidak ada aksi tulis. Setiap endpoint POST/PUT/PATCH/DELETE menolak dengan `403 ACCESS_DENIED`.
- Tidak mengelola user. Audit trail hanya bisa dibaca.

## 6. Traceability

| FR Role | FRD utama |
|---|---|
| FR-FND-01..03 | FR-07.2 |
| FR-FND-04 | FR-07.3 |
| FR-FND-05 | FR-05.2 |
| FR-FND-06 | FR-03.1, FR-02.3, FR-04.2, FR-07.1 |
