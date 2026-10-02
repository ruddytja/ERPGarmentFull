# FR-01.2 Standard Minute Value (SMV) & Tarif Borongan

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-01 Master Data Management (Engineering) |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Database operasi produksi (routing), durasi standar (SMV) per operasi, dan tarif upah borongan per pcs. Dasar perhitungan efisiensi, OEE, dan payroll.

**Alur Kerja**
1. Admin membuat daftar operasi (mis. obras sisi, pasang karet, coverstitch, seamless heat-seal bonding).
2. Mengisi SMV (menit/detik), lini (Sewing/Bonding), tipe mesin, dan tarif Rp/pcs.
3. Menyusun **routing** per SKU (urutan operasi).
4. Perubahan tarif berlaku mulai tanggal efektif tertentu.

**Proses Validasi**
- SMV > 0; tarif ≥ 0.
- Tanggal efektif tarif tidak boleh mundur ke periode payroll yang sudah di-approve.
- Routing minimal 1 operasi; urutan tidak duplikat.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Tanggal efektif di periode payroll terkunci | "Periode payroll sudah di-approve. Pilih tanggal setelah {tanggal}." |
| Operasi dipakai routing aktif dihapus | Ditolak; hanya bisa dinonaktifkan |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| CRUD | R | R | R (SMV saja, tanpa tarif) | — |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/operations` | Daftar / buat operasi |
| PUT | `/operations/{id}` | Ubah SMV/tarif (dengan `effective_date`) |
| GET/PUT | `/skus/{id}/routing` | Routing per SKU |
