# FR-03.3 Scrap/Waste Disposal Management

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-03 Cutting & Bundle Barcoding |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pencatatan volume limbah perca harian dan rekap penjualan/pembuangan limbah.

**Alur Kerja**
1. Scrap dari FR-03.2 otomatis terakumulasi di stok limbah (Kg).
2. Staff mencatat pengeluaran limbah: Dijual (pembeli, Kg, harga/Kg) atau Dibuang.
3. Hasil penjualan limbah tercatat sebagai pengurang biaya (credit) di overhead.

**Proses Validasi**
- Kg keluar ≤ stok limbah.

**Penanganan Error**
- "Stok limbah tidak mencukupi."

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| R | R | R, U (nilai jual) | R, A | C |

**API**
`GET /scrap/stock`, `POST /scrap/disposals`
