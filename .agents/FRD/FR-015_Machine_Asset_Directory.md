# FR-01.5 Machine Asset Directory

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-01 Master Data Management (Engineering) |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Daftar inventaris mesin produksi (mis. overdeck/coverstitch Siruba F007, Lingrai LR-356, mesin seamless bonding) beserta lini, status, dan riwayat perawatan.

**Alur Kerja**
1. Admin mendaftarkan mesin: kode aset, merek/model, tipe, lini, tanggal pembelian, teknisi penanggung jawab.
2. Status mesin otomatis berubah (Running / Down / Maintenance) dari modul downtime.

**Proses Validasi**
- Kode aset unik; teknisi penanggung jawab harus user aktif.

**Penanganan Error**
- Mesin dengan tiket downtime terbuka tidak dapat dinonaktifkan.

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| CRUD | R | R | R | R (kode mesin) |

**API**
`GET/POST /machines`, `PUT /machines/{id}`, `GET /machines/{id}/history`
