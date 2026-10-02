# FRD Role — Staff (Lantai Produksi)

| Atribut | Keterangan |
|---|---|
| **Role** | `STAFF`, dibedakan per **fungsi**: `GUDANG`, `CUTTING`, `OPERATOR`, `QC`, `PACKING`, `TEKNISI` |
| **Tujuan** | Mencatat pekerjaan harian secepat mungkin lewat scan, tanpa menulis manual |
| **Surface** | **Kios tablet** landscape 1280×800, tema gelap, tombol ≥ 64 px (aksi utama 112 px). Teknisi & Gudang juga punya **mobile** |
| **Login** | Kios: kode operator (`OP-0231`, `QC-004`) + **PIN 4 digit**. Mobile: username + password (Teknisi, Gudang) |
| **Batas idle** | 60 menit |
| **Landing page** | `/kiosk` (pilih stasiun) |

> Staff **tidak pernah** melihat harga, tarif, HPP, atau payroll orang lain. Slip upah milik sendiri dan skor efisiensi sendiri bersifat opsional (bisa diaktifkan Admin).

---

## 0. Fitur Umum Semua Staff

### FR-STF-00.1 Login Kios (PIN)
**Alur kerja.** Pilih stasiun (Sewing / Bonding / Cutting / QC / Packing / Gudang) → scan kartu ID atau ketik kode operator → keypad PIN raksasa → masuk.

**Validasi**
- Kode operator terdaftar dan aktif.
- PIN salah 5 kali → dikunci 15 menit. Supervisor bisa membuka kunci.
- Semua percobaan tercatat di `login_attempts`.

**Pesan di kios**

| Kondisi | Kode | Pesan |
|---|---|---|
| PIN salah | `BAD_PIN` | 🔴 "PIN salah." |
| Kode tidak dikenal/nonaktif | `OPERATOR_INVALID` | 🔴 "ID operator tidak terdaftar atau tidak aktif." |
| Terkunci | `ACCOUNT_LOCKED` | 🔴 "PIN dikunci sementara. Hubungi Supervisor." |

**API & DB:** `POST /kiosk/operator-login` → `fn_kiosk_login(code, pin)`.

### FR-STF-00.2 Status Bar & Mode Offline
- Status bar menampilkan stasiun, nama operator, jam WIB, dan status **Online / Offline · n antre**.
- Saat koneksi putus, scan disimpan di antrean lokal dengan UUID unik. Saat online, data disinkronkan otomatis.
- Kiriman ganda dengan UUID yang sama diabaikan (`DUPLICATE_IGNORED`), jadi tidak ada data dobel.

### FR-STF-00.3 Lapor Downtime (Semua Staff Produksi)
Tombol merah **LAPOR DOWNTIME** → pilih mesin (grid kartu) → pilih kendala (ikon besar) → konfirmasi. Mesin menjadi Down dan teknisi menerima alert.
`fn_report_downtime(machine, issue, user)`. Bila tiket sudah ada: 🟡 "Mesin ini sudah memiliki tiket terbuka {no}."

### FR-STF-00.4 Feedback Layar Penuh
Setiap scan memberi flash 600 ms dengan ikon 64 px dan pesan 36 px:
🟢 sukses · 🔴 ditolak (pesan dari DB) · 🟡 peringatan (scan ganda, offline).

---

## A. Staff GUDANG

| Akses | Receiving C R · Stok C R · Stock opname C · Dispatch & Fulfillment C |
|---|---|

### FR-STF-A1 Penerimaan Bahan Baku (Timbang Re-roll)
**Alur kerja**
1. **Terima Material** → isi no. surat jalan, supplier, tanggal.
2. Per item: material, lot number, jumlah roll, berat di dokumen, **berat timbang aktual (Kg)**, harga per Kg dari dokumen, status QC bahan (Pass/Hold/Reject).
3. **Posting**. Bila semua selisih ≤ ±2%, stok langsung bertambah. Bila ada yang > ±2%, status menjadi *Menunggu Approval* dan Supervisor menerima notifikasi.

**Validasi**
- Surat jalan dan supplier tidak duplikat. Lot wajib untuk kain, karet, dan benang. Berat > 0.
- Material Hold/Reject tidak menambah stok tersedia.

**Pesan**

| Kondisi | Kode | Pesan |
|---|---|---|
| Surat jalan dobel | `DUPLICATE_DELIVERY_NOTE` | "Surat jalan SJ/2026/09/0045 sudah pernah diterima pada 28-09-2026." |
| Lot kosong | `LOT_REQUIRED` | "Lot number wajib untuk kain, karet, dan benang." |
| Lot dobel | `DUPLICATE_LOT` | "Lot {x} sudah pernah diterima." |
| Selisih > toleransi | — | Status "Menunggu Approval Supervisor" |

**API & DB:** `POST /goods-receipts` → `fn_post_goods_receipt(id, user)` → `POSTED` / `PENDING_APPROVAL`.

> Staff Gudang **mengetik** harga dari dokumen, tetapi tidak bisa melihat harga rata-rata atau nilai persediaan.

### FR-STF-A2 Stok & Stock Opname
Melihat stok per material/lot (tanpa harga) → **Ajukan Opname**: isi hitung fisik per lot → menunggu approval Supervisor.
API: `GET /stock` (`v_material_stock`, `v_material_lot_stock`), `POST /stock/adjustments`.

### FR-STF-A3 Dispatch B2B & Fulfillment E-commerce
- **B2B:** buat Delivery Order (klien, SKU, qty) → tunggu approval Supervisor → **Kirim**. Stok FG berkurang. `fn_ship_delivery_order(do, user)`.
- **E-commerce:** impor/input pesanan (kanal Shopee/TikTok Shop/Lazada/Blibli, toko JIO/TUJ/KRE/TUM) → scan barcode setiap item → isi nomor resi → **Kirim**. `fn_ecom_scan(order, barcode)` → `fn_ship_ecom_order(order, user, awb)`.

**Pesan**

| Kondisi | Kode | Pesan |
|---|---|---|
| DO belum approve | `INVALID_STATUS` | "Delivery Order belum di-approve Supervisor." |
| Stok FG kurang | `INSUFFICIENT_FG` | "Stok {SKU} kurang {n} pcs." |
| Item tidak ada di pesanan | `NOT_IN_ORDER` | "Item tidak ada di pesanan ini." |
| Item berlebih | `ITEM_COMPLETE` | "Item ini sudah lengkap untuk pesanan." |
| Belum semua discan | `SCAN_INCOMPLETE` | "Scan semua item pesanan sebelum dikirim." |
| Nomor pesanan dobel | `DUPLICATE_ORDER` | "Nomor pesanan {x} sudah diproses." |
| Resi kosong | `AWB_REQUIRED` | "Nomor resi wajib diisi." |

---

## B. Staff CUTTING

| Akses | Cutting C · Bundel C (generate & cetak pertama) |
|---|---|

### FR-STF-B1 Input Gelar & Potong
**Layar (tablet, input 56 px):** pilih SPK aktif → pilih lot kain → isi qty potong per size × warna → **berat kain digelar (Kg)** → **berat scrap/perca (Kg)**.

**Hasil langsung tampil:**
- Yield (pcs/Kg)
- Berat bersih per pcs (gr) dibanding gram BOM
- Scrap rate (%)
- Variance vs BOM, dengan chip hijau/kuning/merah

**Validasi**
- Lot harus kain utama BOM dan sudah dialokasikan ke SPK.
- Scrap < berat gelar.
- Total potong ≤ target SPK + 3%.
- Pemakaian ≤ sisa alokasi + 2%.
- Variance > ±5% wajib diberi catatan penyebab.

**Pesan**

| Kondisi | Kode | Pesan |
|---|---|---|
| Scrap tidak valid | `INVALID_SCRAP` | "Berat scrap tidak valid." |
| Over-cut | `OVERCUT` | "Total hasil potong 1.300 pcs melebihi target SPK + toleransi 3% (1.236 pcs)." |
| Melebihi alokasi | `OVER_ALLOCATION` | "Pemakaian {x} Kg melebihi alokasi lot {lot} (sisa {y} Kg). Minta tambahan alokasi ke Supervisor." |
| Variance tanpa catatan | `VARIANCE_NOTE_REQUIRED` | "Variance -10,1% melebihi ±5% dari BOM. Isi catatan penyebab." |
| Lot salah | `LOT_MISMATCH` | "Lot {x} bukan kain utama pada BOM SPK ini." |

**API & DB:** `POST /cutting-records` → `fn_record_cutting(wo, lot, spread_kg, scrap_kg, lines, user, note)`. Kain, karet, benang, dan label otomatis keluar dari stok.

### FR-STF-B2 Generate & Cetak Tiket Bundel
Tekan **Simpan & Generate Bundel** → sistem membagi per 24 pcs (sisa menjadi bundel terakhir) → cetak QR di printer thermal. Isi QR: `BDL-0101-012:1` (kode:versi).
Generate dua kali ditolak (`ALREADY_GENERATED`). Cetak ulang hanya oleh Supervisor.
API: `POST /work-orders/{id}/bundles` → `fn_generate_bundles(cutting, user)`.

---

## C. Staff OPERATOR (Sewing & Bonding)

| Akses | Scan kios C · Lapor downtime C · Slip & skor sendiri R (opsional) |
|---|---|

### FR-STF-C1 Scan MULAI / SELESAI
**Alur kerja (3 langkah)**
1. Scan QR bundel → layar menampilkan SPK, SKU, size, warna, **qty (56 px)**, nama operasi berikutnya, dan target SMV.
2. Tekan **MULAI** (hijau). Timer besar berjalan.
3. Setelah selesai, scan lagi → **SELESAI** (biru) → 🟢 "Tercatat: 24 pcs Coverstitch Pinggang". Operasi berikutnya tampil.

Sistem otomatis menentukan operasi berikutnya sesuai routing. Untuk bundel rework (`…-R1`), hanya operasi penyebab cacat yang bisa dikerjakan.

**Validasi**
- Urutan routing tidak boleh dilompati.
- Satu bundel-operasi hanya dikerjakan satu operator. Hanya operator yang memulai yang boleh menyelesaikan.
- Mesin berstatus Down tidak bisa dipakai.
- Durasi < 50% standar ditandai anomali (operator tidak melihat label ini; Supervisor yang meninjau).

**Pesan di kios**

| Kondisi | Kode | Pesan |
|---|---|---|
| Dikerjakan orang lain | `BUNDLE_BUSY` | 🔴 "Bundel sedang dikerjakan oleh Rina Wulandari." |
| Selesaikan milik orang lain | `NOT_OWNER` | 🔴 "Bundel dimulai oleh {nama}. Hanya operator tersebut yang dapat menyelesaikan." |
| Lompat urutan | `ROUTING_ORDER` | 🔴 "Bundel belum melewati proses Obras Samping." |
| Scan ganda | `ALREADY_RECORDED` | 🟡 "Sudah tercatat. Tidak perlu scan ulang." |
| Semua proses selesai | `ALL_DONE` | 🟡 "Semua proses bundel sudah selesai. Kirim ke QC." |
| Rework salah operasi | `REWORK_ONLY` | 🔴 "Bundel rework hanya untuk proses Pasang Karet." |
| Tiket lama | `TICKET_INVALID` | 🔴 "Tiket sudah tidak berlaku. Gunakan tiket cetak ulang." |
| Tiket tidak dikenal | `TICKET_UNKNOWN` | 🔴 "Tiket {x} tidak dikenal. Cek tiket atau minta cetak ulang ke Supervisor." |
| Mesin down | `MACHINE_DOWN` | 🔴 "Mesin {kode} sedang Down. Gunakan mesin lain." |
| Offline | — | 🟡 "Tersimpan offline. Akan disinkronkan otomatis." |

**API & DB:** `POST /wip/scan` → `fn_wip_scan(qr, operator_code, 'START'|'COMPLETE', machine_code, client_uuid, scanned_at)`. `POST /wip/sync` mengirim antrean offline dengan `source = OFFLINE_SYNC`.

**Acceptance criteria**
- **Given** operator scan bundel lalu MULAI dan SELESAI, **Then** respons ≤ 2 detik dan progres SPK di dasbor Supervisor ikut bertambah.
- **Given** kios offline, 3 scan tersimpan, lalu online, **Then** ketiganya tersinkron tanpa duplikat.

### FR-STF-C2 Slip & Skor Sendiri (Opsional)
Bila diaktifkan Admin, operator melihat pcs Pass dan estimasi upah **miliknya sendiri** untuk periode berjalan, serta skor efisiensi pribadi. Tidak ada data operator lain.
API: `GET /me/payroll`, `GET /me/efficiency` (difilter `operator_id = user login`).

---

## D. Staff QC

| Akses | QC Inspection C · Retur & B-Grade C |
|---|---|

### FR-STF-D1 Inspeksi Bundel
**Alur kerja**
1. Scan QR bundel. Bundel hanya bisa di-QC bila semua operasi sudah selesai.
2. Tiga penghitung besar dengan tombol ± 72 px: **PASS** (hijau), **REWORK** (kuning), **REJECT** (merah). Total tampil "Total 24 / 24".
3. Bila Rework/Reject > 0, pilih **jenis cacat** dari grid chip: Jahitan Lompat, Bonding Tape Lepas, Karet Melintir, Ukuran Asimetris, Noda, Lubang Kain, Label Salah.
4. **SIMPAN QC** → 🟢 "Pass 21 dikreditkan ke payroll · tiket rework BDL-0101-012-R1 dicetak · 1 afval".

**Hasil otomatis**
- Unit Pass dikreditkan ke payroll operator bundel.
- Unit Rework menghasilkan bundel baru `…-R1` dengan QR baru, diarahkan ke operasi penyebab (default per jenis cacat).
- Unit Reject dicatat sebagai afval dan masuk perhitungan HPP.
- Bundel rework yang sudah diperbaiki kembali ke QC untuk inspeksi ulang.

**Validasi.** Pass + Rework + Reject = isi bundel. Rework/Reject wajib berkategori cacat. Hanya Staff QC atau Supervisor yang boleh menginput.

**Pesan di kios**

| Kondisi | Kode | Pesan |
|---|---|---|
| Total tidak cocok | `QC_TOTAL_MISMATCH` | 🔴 "Total 23 tidak sesuai isi bundel 24." |
| Belum selesai dijahit | `NOT_READY_FOR_QC` | 🔴 "Bundel masih di proses Obras Samping." |
| Sudah di-QC | `NOT_READY_FOR_QC` | 🟡 "Bundel ini sudah di-QC." |
| Cacat belum dipilih | `DEFECT_REQUIRED` | 🔴 "Pilih jenis cacat." |
| Bukan Staff QC | `ACCESS_DENIED` | 🔴 "Hanya Staff QC atau Supervisor yang dapat menginput hasil QC." |

**API & DB:** `POST /qc/inspections` → `fn_record_qc(qr, inspector_code, pass, rework_json, reject_json)`.

### FR-STF-D2 Grading Retur Pelanggan
Catat retur (sumber B2B/e-commerce, SKU, qty, alasan) → klasifikasi tiap unit: **Restock A** (kembali ke stok FG), **B-Grade** (stok terpisah), **Rework**, atau **Musnah**. Total klasifikasi harus sama dengan qty retur (`QTY_MISMATCH`).
API: `POST /returns` → `POST /returns/{id}/grading` → `fn_grade_return(id, grades, user)`.

---

## E. Staff PACKING

| Akses | Packing C |
|---|---|

### FR-STF-E1 Verifikasi Packing (Single & Multipack)
**Alur kerja**
1. Pilih SPK dan produk FG (mis. *Brief 3-in-1 M*), lalu isi jumlah pack di sesi ini.
2. Layar menampilkan checklist komposisi, mis. M Hitam 0/300 · M Putih 0/300 · M Nude 0/300.
3. Scan bundel Pass QC dan qty yang diambil. Checklist berubah hijau saat komponen lengkap.
4. **Konfirmasi Pack** → stok FG bertambah, polybag/box/hang tag otomatis keluar dari stok, dan sistem mengecek apakah SPK bisa ditutup otomatis.

**Validasi**
- Hanya item Pass QC dari SPK yang sama.
- Size/warna harus sesuai komposisi. Tidak boleh melebihi kebutuhan.
- Item tidak bisa dipacking dua kali (`qty_packed ≤ qty_pass`).

**Pesan di kios**

| Kondisi | Kode | Pesan |
|---|---|---|
| Belum lolos QC | `NOT_PASSED` | 🔴 "Item belum lolos QC." |
| Salah komposisi | `PACK_MISMATCH` | 🔴 "Tidak sesuai komposisi pack. Dibutuhkan: M Hitam ×299." |
| Komponen penuh | `COMPONENT_FULL` | 🟡 "Komponen ini sudah lengkap (300/300)." |
| Sisa Pass habis | `NO_PASS_LEFT` | 🔴 "Sisa item Pass QC di bundel ini tinggal 0 pcs." |
| Belum lengkap | `PACK_INCOMPLETE` | 🔴 "Isi kemasan belum lengkap: M Hitam (0/299)." |
| Kemasan habis | `PACKAGING_OUT` | 🔴 "Stok Polybag 20×30 habis. Hubungi Gudang." |
| Bundel SPK lain | `WO_MISMATCH` | 🔴 "Bundel bukan dari SPK ini." |

**API & DB:** `POST /packing/sessions` → `fn_pack_open(wo, fg_variant, user, pack_count)`. `POST /packing/sessions/{id}/scan` → `fn_pack_scan(pack, qr, qty)`. `POST /packing/sessions/{id}/confirm` → `fn_pack_confirm(pack, user)` → `{ wo_closed: true|false }`.

---

## F. Staff TEKNISI (Mobile)

| Akses | Downtime R U · Spare part C |
|---|---|

**Navigasi mobile:** Tiket Saya · Mesin · Spare Part · Profil

### FR-STF-F1 Tangani Tiket Downtime
**Alur kerja**
1. Terima push notification "Tiket DT-2026-0001 · MC-SRB-F007-03 · Looper bermasalah".
2. Buka tiket → **Mulai Perbaikan**. Status menjadi *In Progress* dan waktu respons tercatat.
3. Catat spare part yang dipakai (mis. Looper ×1, Jarum DBx1 ×2). Stok spare part otomatis berkurang dan biayanya masuk overhead (tidak terlihat oleh teknisi).
4. Isi **tindakan perbaikan** → **Tandai Resolved** (tombol hijau besar). Mesin kembali Running dan timer downtime berhenti.

**Validasi**
- Resolved wajib berisi tindakan perbaikan.
- Tiket Resolved tidak bisa dibuka lagi. Bila mesin rusak lagi, buat tiket baru.
- Bila stok spare part kurang, tiket tetap bisa diselesaikan; spare part ditandai "Kekurangan Stok".

**Pesan**

| Kondisi | Kode | Pesan |
|---|---|---|
| Resolved tanpa catatan | `NOTE_REQUIRED` | "Isi tindakan perbaikan sebelum menandai Resolved." |
| Buka ulang tiket | `INVALID_STATUS` | "Tiket yang sudah Resolved tidak dapat dibuka kembali. Buat tiket baru." |
| Bukan spare part | `NOT_SPAREPART` | "{nama} bukan spare part." |

**API & DB:** `GET /downtime-tickets?assigned=me` (`v_downtime_board`). `PATCH /downtime-tickets/{id}` (status, resolution_note). `POST /downtime-tickets/{id}/spareparts` → `INSERT erp.downtime_spareparts` (trigger memotong stok dan mencatat overhead).

**Acceptance:** tiket yang tidak direspons > 15 menit dieskalasi ke Supervisor.

---

## 1. Notifikasi yang Diterima

| Fungsi | Tipe |
|---|---|
| Teknisi | `DOWNTIME_NEW` (tiket untuk dirinya) |
| Gudang | Info status approval receiving/opname (in-app) |
| Lainnya | Feedback langsung di layar kios (tidak lewat notifikasi) |

## 2. Batasan
- 🔒 Tidak bisa melihat harga, tarif, HPP, payroll orang lain, atau overhead.
- Tidak bisa mengaktifkan/menutup SPK, mencetak ulang tiket, mengoreksi scan/QC, atau meng-approve apa pun.
- Hanya bisa memakai fitur sesuai **fungsi**-nya. Misalnya operator jahit yang mencoba input QC ditolak `ACCESS_DENIED`.

## 3. Traceability

| FR Role | FRD utama |
|---|---|
| FR-STF-00.x | FR-00.1, FR-04.1, FR-04.2 |
| A1–A3 | FR-02.1, FR-02.3, FR-06.3 |
| B1–B2 | FR-03.2, FR-03.4 |
| C1–C2 | FR-04.1, FR-07.1, FR-07.3 |
| D1–D2 | FR-05.1, FR-05.3 |
| E1 | FR-06.1, FR-06.2 |
| F1 | FR-04.2, FR-04.3 |
