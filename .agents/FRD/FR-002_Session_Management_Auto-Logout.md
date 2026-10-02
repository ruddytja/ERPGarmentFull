# FR-00.2 Session Management & Auto-Logout

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-00 System Security & Access Management |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Mengakhiri sesi otomatis ketika perangkat ditinggalkan untuk mencegah akses tidak sah.

**Alur Kerja**
1. Sistem memantau aktivitas (klik, ketik, scan).
2. Jika idle mencapai batas − 1 menit, tampil peringatan "Sesi akan berakhir dalam 60 detik" dengan tombol **Tetap Masuk**.
3. Jika tidak ada respons, sesi diakhiri dan pengguna diarahkan ke Login.

| Role | Batas Idle |
|---|---|
| Finance, Founder, Admin | 15 menit |
| Supervisor | 30 menit |
| Staff (Kios) | 60 menit |

**Proses Validasi**
- Token diverifikasi di setiap request API; token kedaluwarsa ditolak.
- Batas idle dapat dikonfigurasi Admin per role.

**Penanganan Error**
- Data form yang belum tersimpan disimpan sebagai draf lokal sebelum logout.
- Scan kios yang tertunda (offline queue) tetap disinkronkan setelah login ulang.
- Request dengan token kedaluwarsa → HTTP 401, client mencoba refresh, gagal → redirect Login.

**Hak Akses**
Berlaku untuk semua role. Konfigurasi batas idle: Admin.

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/auth/session` | Cek status sesi |
| PUT | `/settings/session-policy` | Ubah batas idle per role (Admin) |
