# FR-01.1 Bill of Materials (BOM) Berbasis Berat

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-01 Master Data Management (Engineering) |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Menyimpan resep material per SKU dalam satuan berat (gram/pcs), per brand, ukuran (S–XXL), dan warna. Digunakan untuk menghitung kebutuhan material (Kg) saat SPK diterbitkan dan sebagai dasar HPP estimasi.

**Alur Kerja**
1. Admin memilih Brand (NAQALA WEAR, Pierre UNO, Finy Girls, Beyond Skin, atau klien B2B) dan SKU.
2. Mengisi matriks size (S, M, L, XL, XXL) × warna.
3. Untuk tiap size, mengisi komponen:
   - Kain utama (mis. Teteron Rayon 80 gr/pcs, TR Spandex 30s, Polyester Single Knit)
   - Karet/waistband (mis. 15 gr/pcs)
   - Benang jahit/obras (mis. 2,5 gr/pcs)
   - Seamless heat-seal bonding tape (gram atau cm/pcs)
   - Aksesoris & packaging (label, polybag)
4. Mengisi toleransi shrinkage (%) per jenis kain.
5. Sistem menghitung **HPP material estimasi per pcs** = Σ (gram/1000 × harga rata-rata per Kg).
6. Simpan → BOM versi baru berstatus **Active**; versi lama tersimpan sebagai histori.

**Proses Validasi**
- Setiap SKU-size wajib memiliki minimal 1 kain utama.
- Berat > 0 dengan presisi maksimum 2 desimal.
- Material harus terdaftar di master material.
- Shrinkage 0–20%.
- BOM yang sedang dipakai SPK Active tidak bisa diubah langsung → wajib membuat versi baru.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Kain utama kosong | "Kain utama wajib diisi untuk size {size}." |
| Material tidak ditemukan | "Material belum terdaftar. Tambahkan di Master Material." |
| Edit BOM yang terpakai SPK Active | "BOM digunakan oleh SPK aktif. Buat versi baru." |
| Harga material belum ada | BOM tersimpan, HPP estimasi ditandai "Belum lengkap" |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| CRUD | R | R (termasuk harga) | R (tanpa harga) | — |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/boms` | Daftar / buat BOM |
| GET | `/boms/{id}?version=` | Detail BOM |
| POST | `/boms/{id}/versions` | Buat versi baru |
| GET | `/boms/{id}/requirement?qty=1200&size=M` | Hitung kebutuhan material (Kg) |

```json
// GET /boms/BOM-NQL-001/requirement?qty=1200&size=M — Response
{
  "sku": "NQL-BRF-001",
  "size": "M",
  "qty": 1200,
  "materials": [
    { "code": "FAB-TR-01", "name": "Teteron Rayon", "gram_per_pcs": 80, "shrinkage_pct": 3, "total_kg": 98.88 },
    { "code": "ELS-WB-02", "name": "Karet Waistband", "gram_per_pcs": 15, "total_kg": 18.00 },
    { "code": "THR-OB-01", "name": "Benang Obras", "gram_per_pcs": 2.5, "total_kg": 3.00 }
  ]
}
```
