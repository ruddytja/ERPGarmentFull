# FR-04.2 Downtime & Machine Ticketing

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-04 Sewing, Seamless & Production Tracking |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pencatatan kendala mesin yang otomatis membuat tiket perbaikan bagi Teknisi dan menghitung downtime.

**Alur Kerja**
1. Supervisor (atau operator via kios) menekan tombol **DOWNTIME**.
2. Memilih kode mesin (mis. Siruba F007, Lingrai LR-356) dan jenis kendala (jarum patah, benang putus berulang, looper, listrik, dll.).
3. Sistem:
   - Mengubah status mesin menjadi **Down**,
   - Menghentikan perhitungan SMV/efisiensi operator di mesin tersebut,
   - Mengirim alert & tiket ke Teknisi penanggung jawab (mis. Hendra Ari Wardani).
4. Teknisi menerima tiket → **In Progress**.
5. Teknisi mencatat tindakan & spare part yang dipakai (stok spare part berkurang otomatis — FR-04.3).
6. Teknisi menandai **Resolved** → timer downtime berhenti; Supervisor konfirmasi mesin berjalan.

**Proses Validasi**
- Satu mesin hanya boleh punya satu tiket terbuka.
- Resolved wajib mengisi tindakan perbaikan.
- Tiket tidak direspons dalam 15 menit → eskalasi ke Supervisor.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Tiket ganda untuk mesin yang sama | "Mesin ini sudah memiliki tiket terbuka #{id}." |
| Notifikasi teknisi gagal terkirim | Retry otomatis + tampil di dasbor Supervisor |
| Spare part tidak cukup | Tiket tetap bisa Resolved, spare part dicatat sebagai "Kekurangan Stok" |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Operator/Teknisi) |
|---|---|---|---|---|
| R | R | R (biaya) | C R U | Operator: C; Teknisi: R U |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/downtime-tickets` | Buat tiket |
| PATCH | `/downtime-tickets/{id}` | Update status (In Progress / Resolved) |
| GET | `/downtime-tickets?status=open` | Tiket terbuka |
| GET | `/reports/downtime?machine=&from=&to=` | Rekap downtime |
