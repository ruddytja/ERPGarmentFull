# FR-03.1 Work Order (SPK) Generation

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-03 Cutting & Bundle Barcoding |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Rilis Surat Perintah Kerja oleh Supervisor sebagai dasar seluruh aktivitas produksi.

**Alur Kerja**
1. Supervisor membuat SPK: SKU, BOM versi, qty per size & warna, tanggal target selesai, tujuan (B2B klien / stok internal / e-commerce).
2. Status **Draft** → dapat diedit.
3. Aktivasi → status **Active** (memicu FR-02.2).
4. Proses produksi berjalan.
5. Status **Closed** otomatis saat qty packing mencapai target (FR-06.2) atau ditutup manual dengan alasan.

**Proses Validasi**
- Qty > 0; tanggal target ≥ hari ini.
- SKU wajib punya BOM & routing aktif.
- SPK Active tidak dapat diubah qty-nya tanpa revisi tercatat.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| BOM tidak aktif | "SKU belum memiliki BOM aktif." |
| Stok tidak cukup saat aktivasi | Lihat FR-02.2 |
| Penutupan manual sebelum target | Wajib alasan; tercatat di audit log |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| R | R | R | C R U (aktivasi/tutup) | R (SPK aktif di stasiunnya) |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/work-orders` | Daftar / buat SPK |
| PATCH | `/work-orders/{id}/activate` | Aktivasi |
| PATCH | `/work-orders/{id}/close` | Tutup |
| GET | `/work-orders/{id}/progress` | Progres per tahap |
