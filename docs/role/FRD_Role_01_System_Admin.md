# FRD Role — System Admin

| Atribut | Keterangan |
|---|---|
| **Role** | `ADMIN` |
| **Tujuan** | Menjaga akun, hak akses, master data engineering, dan keamanan sistem |
| **Pengguna** | 1–2 orang (IT internal / admin operasional) |
| **Surface** | Web desktop (≥ 1280 px) |
| **Login** | Username/email + password, atau Google SSO |
| **Batas idle** | 15 menit (`session_policies`) |
| **Landing page** | `/settings/users` |

---

## 1. Ringkasan Hak Akses

| Modul | Akses | Catatan |
|---|---|---|
| User Management, Role & Permission | **CRUD** | Tidak bisa menonaktifkan Admin aktif terakhir |
| Password & kunci akun | **C U** | Buat/reset password, buka kunci |
| Brand & SKU, BOM, SMV & Routing, Tarif borongan, Mesin | **CRUD** | BOM aktif tidak bisa diedit, harus lewat versi baru |
| Sample & Prototyping | R, **A** | Approve konversi sampel menjadi BOM |
| Setting & threshold sistem | **U** | `system_settings`, `session_policies` |
| Audit trail & log login | **R** | Immutable |
| Operasional (stok, SPK, cutting, WIP, QC, packing, dispatch) | R | Tidak bisa transaksi operasional |
| Payroll, Costing/HPP, Overhead | — | Tidak tampil di menu |

## 2. Navigasi

```
Settings Home
├── User & Hak Akses ─ Pengguna · Matriks Hak Akses · Log Login · Audit Trail
├── Master Data ────── Brand & SKU · BOM · SMV & Routing · Tarif Borongan · Mesin · Kategori Cacat
├── Setting Sistem ─── Threshold & Notifikasi · Kebijakan Sesi
└── Monitor (read-only) ─ SPK · Inventory · QC · Efisiensi & OEE
```

---

## 3. Fitur

### FR-ADM-01 Kelola Pengguna
**Deskripsi.** Membuat, mengubah, dan menonaktifkan akun. Akun tidak pernah dihapus permanen karena histori payroll dan traceability harus tetap utuh.

**Alur kerja**
1. Buka **Pengguna**, klik **Tambah User**.
2. Isi nama, email (opsional untuk operator), role, fungsi staff (wajib bila role Staff), kode operator dan PIN untuk kios, serta lini.
3. Untuk user web/mobile: isi **username** dan **password awal**. Akun otomatis ditandai *wajib ganti password*.
4. Simpan. Sistem mencatat aksi di audit trail.
5. Untuk menonaktifkan: buka detail user → **Nonaktifkan** → konfirmasi.

**Validasi**
- Email dan kode operator unik. Role `STAFF` wajib punya `staff_function`.
- Username 3–50 karakter (`a-z 0-9 . _ -`), unik.
- Password minimal 8 karakter, kombinasi huruf dan angka.
- Hapus permanen ditolak. Menonaktifkan Admin aktif terakhir juga ditolak.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Username dipakai | `USERNAME_TAKEN` | "Username {x} sudah digunakan." |
| Password lemah | `WEAK_PASSWORD` | "Password minimal 8 karakter, kombinasi huruf dan angka." |
| Email/kode operator duplikat | `DUPLICATE` | "Data sudah ada (duplikat)." |
| Admin terakhir dinonaktifkan | `LAST_ADMIN` | "Minimal harus ada satu Admin aktif." |
| Hapus user | `NO_DELETE` | "Akun tidak dapat dihapus, hanya dinonaktifkan." |

**API & DB**

| Method | Endpoint | DB |
|---|---|---|
| GET/POST | `/users` | `erp.users` |
| PUT | `/users/{id}` | `erp.users` |
| PATCH | `/users/{id}/deactivate` | `UPDATE users SET status='INACTIVE'` (trigger mengisi `deactivated_at`) |
| POST | `/users/{id}/login` | `erp.fn_set_password(user_id, password, admin_id, NULL, username)` |

**Acceptance criteria**
- **Given** Admin membuat user Supervisor dengan username dan password awal, **When** user itu login pertama kali, **Then** diarahkan ke `/account/change-password`.
- **Given** user Staff tanpa fungsi staff, **When** disimpan, **Then** ditolak dengan pesan validasi.

---

### FR-ADM-02 Reset Password & Buka Kunci Akun
**Deskripsi.** Mereset password user yang lupa, dan membuka akun yang terkunci setelah 5 kali gagal login.

**Alur kerja**
1. Detail user → **Reset Password** → isi password sementara → simpan. User wajib mengganti password saat login berikutnya.
2. Bila status **Terkunci** → **Buka Kunci**. Penghitung gagal (web dan PIN) di-reset.

**Validasi.** Hanya Admin yang boleh mereset password orang lain. Supervisor hanya boleh membuka kunci.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Bukan Admin | `ACCESS_DENIED` | "Hanya Admin yang dapat membuat atau mereset password pengguna lain." |
| Password lemah | `WEAK_PASSWORD` | lihat FR-ADM-01 |

**API & DB:** `POST /users/{id}/reset-password` → `fn_set_password(user_id, pwd, admin_id)`. `POST /users/{id}/unlock` → `fn_unlock_login(user_id, admin_id)`. Tercatat di audit (`PASSWORD_RESET`, `UNLOCK`).

---

### FR-ADM-03 Matriks Hak Akses
**Deskripsi.** Mengatur izin C/R/U/D/A per role × modul (`erp.role_permissions`).

**Alur kerja.** Buka **Matriks Hak Akses** → centang/hapus izin → **Simpan**. Perubahan tercatat di audit trail.

**Validasi (dikunci sistem)**
- Modul **Costing** tidak bisa diberikan ke Supervisor/Staff.
- Modul **Payroll** tidak bisa diberikan ke Supervisor.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Beri Costing ke Supervisor/Staff | `COSTING_LOCKED` | "Modul Costing hanya untuk Founder & Finance." |
| Beri Payroll ke Supervisor | `PAYROLL_LOCKED` | "Modul Payroll tidak tersedia untuk Supervisor." |

**API:** `GET/PUT /roles/{role}/permissions`.

**Acceptance:** sel Costing untuk Supervisor/Staff tampil terkunci (🔒) dan tidak bisa dicentang.

---

### FR-ADM-04 Brand & SKU
**Deskripsi.** Katalog brand (internal/B2B) dan SKU dengan varian size × warna, konfigurasi pack (single/multipack), barcode, dan harga jual.

**Alur kerja**
1. Tambah Brand (NAQALA WEAR, Pierre UNO, Finy Girls, Beyond Skin, atau klien B2B).
2. Tambah SKU → isi kategori, konfigurasi pack, harga jual.
3. Tambah varian (size, urutan size, warna, barcode).
4. Untuk multipack: isi **komposisi pack**, misalnya 3-in-1 = M Hitam + M Putih + M Nude.
5. Isi **material kemasan per pack** (polybag, box, hang tag).

**Validasi**
- Kode SKU dan barcode unik. `SINGLE` ⇔ `pack_qty = 1`.
- SKU dengan histori produksi tidak dihapus, hanya diarsipkan.
- SKU baru belum bisa dipakai di SPK sebelum punya BOM aktif dan routing.

**API:** `GET/POST /brands`, `GET/POST /skus`, `PUT /skus/{id}`, `PATCH /skus/{id}/archive`.

> Harga jual tampil untuk Admin, Founder, dan Finance. Untuk Supervisor/Staff, field ini di-strip API.

---

### FR-ADM-05 BOM Berbasis Berat (Versi)
**Deskripsi.** Menyusun resep material per size dalam gram/pcs (kain, karet, benang, bonding tape) dan pcs (label), plus shrinkage.

**Alur kerja**
1. Pilih SKU → **Buat Versi Baru**. Sistem menyalin BOM aktif menjadi Draft dengan nomor versi berikutnya.
2. Edit matriks size × material. Tandai satu baris per size sebagai **kain utama**.
3. Klik **Aktifkan**. Versi lama otomatis jadi Arsip.

**Validasi**
- Setiap size varian aktif wajib punya kain utama.
- Qty > 0, shrinkage 0–20%.
- BOM Active/Archived tidak bisa diedit (trigger `BOM_LOCKED`).

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Kain utama kosong | `BOM_INCOMPLETE` | "Kain utama wajib diisi untuk size {size}." |
| Edit BOM aktif | `BOM_LOCKED` | "BOM sudah aktif/arsip dan mungkin dipakai SPK. Buat versi baru." |
| Aktifkan non-Draft | `INVALID_STATUS` | "Hanya BOM berstatus Draft yang dapat diaktifkan." |

**API & DB:** `POST /boms/{sku}/versions` → `fn_new_bom_version(sku, admin)`. `PATCH /boms/{id}/activate` → `fn_activate_bom(bom, admin)`. `GET /boms/{id}/requirement` → hitung kebutuhan Kg.

**Acceptance:** kolom *Estimasi HPP material/pcs* tampil untuk Admin (harga rata-rata × gram).

---

### FR-ADM-06 Operasi, SMV, Routing & Tarif Borongan
**Deskripsi.** Database operasi (jahit, obras, coverstitch, heat-seal bonding), SMV menit/pcs, urutan routing per SKU, dan tarif borongan dengan tanggal efektif.

**Alur kerja**
1. Tambah/ubah operasi: nama, lini, tipe mesin, SMV.
2. Susun routing SKU dengan drag-and-drop urutan.
3. Tambah tarif baru → isi Rp/pcs dan **tanggal efektif**. Tarif lama tetap tersimpan sebagai histori.

**Validasi**
- SMV > 0, tarif ≥ 0, urutan routing unik.
- Tanggal efektif tarif **harus setelah** periode payroll terakhir yang sudah di-approve.
- Operasi yang dipakai routing hanya bisa dinonaktifkan.

**Penanganan error**

| Kondisi | Kode | Pesan |
|---|---|---|
| Tarif mundur ke periode terkunci | `PAYROLL_LOCKED` | "Periode payroll sudah di-approve. Pilih tanggal efektif setelah {tgl}." |

**API:** `GET/POST /operations`, `PUT /operations/{id}`, `GET/PUT /skus/{id}/routing`, `POST /operations/{id}/rates`.

---

### FR-ADM-07 Direktori Mesin & Kategori Cacat
**Deskripsi.** Mendaftarkan mesin (kode aset, model seperti Siruba F007 / Lingrai LR-356, lini, teknisi penanggung jawab) dan kategori cacat QC beserta operasi tujuan rework default.

**Validasi**
- Kode aset unik.
- Mesin dengan tiket downtime terbuka tidak bisa dinonaktifkan (`OPEN_TICKET`).

**API:** `GET/POST /machines`, `PUT /machines/{id}`, `GET/POST /qc/defect-categories`.

---

### FR-ADM-08 Setting Sistem & Kebijakan Sesi
**Deskripsi.** Mengubah threshold yang dipakai validasi dan notifikasi.

| Key | Default | Dipakai di |
|---|---|---|
| `receiving_tolerance_pct` | 2 | Selisih timbang receiving |
| `overcut_tolerance_pct` | 3 | Batas over-cut |
| `cutting_variance_pct` | 5 | Variance cutting wajib catatan |
| `bundle_size_default` | 24 | Isi bundel |
| `scan_anomaly_ratio` | 0,5 | Deteksi scan terlalu cepat |
| `downtime_escalation_minutes` | 15 | Eskalasi tiket |
| `defect_rate_threshold_pct` | 5 | Alert defect harian |
| `cost_variance_threshold_pct` | 5 | Alert HPP |
| `password_min_length` / `login_max_failed` / `login_lock_minutes` | 8 / 5 / 15 | Login |

Kebijakan idle per role: Admin/Founder/Finance 15 menit, Supervisor 30, Staff 60.

**API:** `PUT /settings/thresholds`, `PUT /settings/session-policy`. Semua perubahan tercatat di audit trail.

---

### FR-ADM-09 Audit Trail & Log Login
**Deskripsi.** Menelusuri siapa mengubah apa (nilai lama → baru) dan semua percobaan login.

**Alur kerja.** Filter berdasarkan entitas, user, aksi, dan periode. Klik baris untuk melihat diff JSON.

**Validasi.** Data immutable: update/hapus ditolak (`IMMUTABLE`). Password/PIN hash tidak pernah muncul di log.

**API:** `GET /audit-logs?entity=&user=&from=&to=` (`erp.audit_logs`), `GET /login-attempts` (`erp.login_attempts`).

**Acceptance:** percobaan Supervisor membuka `/costing` muncul sebagai `ACCESS_DENIED`.

---

### FR-ADM-10 Approve Konversi Sampel → BOM
**Deskripsi.** Sampel berstatus *Approved* dari Supervisor dikonversi menjadi BOM Draft berdasarkan konsumsi material aktual sampel.

**Validasi:** sampel `APPROVED` dan sudah terhubung ke SKU.

**API & DB:** `POST /samples/{id}/convert-to-bom` → `fn_convert_sample_to_bom(sample, admin)`. Hasilnya Draft yang perlu ditinjau lalu diaktifkan (FR-ADM-05).

---

## 4. Notifikasi yang Diterima

| Tipe | Pemicu |
|---|---|
| `STOCK_CRITICAL` | Stok material di bawah minimum |

## 5. Batasan
- Tidak bisa melakukan transaksi operasional: receiving, aktivasi SPK, cutting, scan, QC, packing.
- Tidak bisa melihat atau mengubah Payroll, HPP, Overhead.
- Tidak bisa menghapus user, audit log, log login, atau kartu stok.

## 6. Traceability

| FR Role | FRD utama |
|---|---|
| FR-ADM-01..03, 08, 09 | FR-00.1, FR-00.2, FR-00.3 |
| FR-ADM-04 | FR-01.3 |
| FR-ADM-05 | FR-01.1 |
| FR-ADM-06 | FR-01.2 |
| FR-ADM-07 | FR-01.5, FR-05.1 |
| FR-ADM-10 | FR-01.4 |
