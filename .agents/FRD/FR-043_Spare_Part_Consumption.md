# FR-04.3 Spare Part Consumption

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-04 Sewing, Seamless & Production Tracking |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pemotongan stok spare part otomatis saat perbaikan, dan pencatatan biaya ke overhead.

**Alur Kerja**
1. Saat menutup tiket, Teknisi memilih spare part & qty.
2. Stok spare part berkurang; nilai biaya masuk ke Overhead (kategori Maintenance).

**Proses Validasi**
- Qty ≤ stok tersedia (atau ditandai kekurangan).

**Penanganan Error**
- Lihat FR-04.2.

**Hak Akses**
Teknisi: C; Supervisor: R; Finance: R (biaya); Admin/Founder: R.

**API**
`POST /downtime-tickets/{id}/spareparts`
