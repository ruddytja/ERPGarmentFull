# FR-00.3 User & Role Management + Audit Trail

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-00 System Security & Access Management |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pengelolaan akun pengguna, matriks izin per role, dan pencatatan histori aktivitas krusial.

**Alur Kerja**
1. Admin membuat akun (nama, email, role, departemen/stasiun, PIN operator untuk kios).
2. Admin mengatur permission matrix per modul (C/R/U/D/A).
3. Setiap perubahan krusial (BOM, tarif, harga, payroll, status SPK, role) otomatis tercatat di Audit Trail (siapa, kapan, nilai lama → baru).

**Proses Validasi**
- Email & Operator ID unik.
- Role Founder dan Finance tidak dapat diberikan oleh selain Admin.
- Izin modul Costing/HPP tidak dapat diaktifkan untuk role Staff/Supervisor (dikunci sistem).
- Akun tidak dihapus permanen, hanya dinonaktifkan (menjaga histori payroll & traceability).

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Email/ID duplikat | "Email/Operator ID sudah digunakan." |
| Mencoba memberi akses Costing ke Staff/Supervisor | Ditolak: "Modul Costing hanya untuk Founder & Finance." |
| Menonaktifkan Admin terakhir | Ditolak: "Minimal harus ada satu Admin aktif." |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| CRUD | R (audit log) | — | — | — |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/users` | Daftar / buat pengguna |
| PUT | `/users/{id}` | Ubah pengguna |
| PATCH | `/users/{id}/deactivate` | Nonaktifkan |
| GET/PUT | `/roles/{role}/permissions` | Lihat / ubah matriks izin |
| GET | `/audit-logs?entity=&user=&from=&to=` | Riwayat aktivitas |
