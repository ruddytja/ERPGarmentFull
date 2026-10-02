# FR-01.3 Brand & SKU Directory

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-01 Master Data Management (Engineering) |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Katalog brand (internal & klien B2B) dan SKU produk dengan atribut size, warna, kategori, dan kanal penjualan.

**Alur Kerja**
1. Admin membuat Brand (tipe: Internal / B2B Client).
2. Menambah SKU di bawah brand: kode, nama, kategori (brief, boxer, bra, kids, dll.), varian size & warna, konfigurasi pack (single / multipack 3-in-1).
3. Menghubungkan SKU ke BOM dan routing.

**Proses Validasi**
- Kode SKU unik.
- SKU tidak dapat masuk SPK jika belum memiliki BOM Active dan routing.

**Penanganan Error**
- "SKU belum memiliki BOM/routing aktif" saat dipilih di SPK.
- SKU yang memiliki histori produksi tidak dapat dihapus, hanya diarsipkan.

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| CRUD | R | R | R | R (nama & varian) |

**API**
`GET/POST /brands`, `GET/POST /skus`, `PUT /skus/{id}`, `PATCH /skus/{id}/archive`
