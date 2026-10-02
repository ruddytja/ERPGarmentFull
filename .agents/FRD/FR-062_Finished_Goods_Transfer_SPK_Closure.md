# FR-06.2 Finished Goods Transfer & SPK Closure

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-06 Packaging & Finished Goods |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Perpindahan otomatis hasil packing ke stok Finished Goods dan penutupan SPK saat target tercapai.

**Alur Kerja**
1. Pack terkonfirmasi → status FG → stok gudang FG bertambah.
2. Saat total qty FG ≥ target SPK (memperhitungkan reject yang disetujui), SPK otomatis **Closed**.
3. Penutupan memicu perhitungan HPP aktual (FR-07.2).

**Proses Validasi**
- SPK dengan bundel rework terbuka tidak dapat Closed otomatis; Supervisor diberi notifikasi.

**Penanganan Error**
- "SPK belum dapat ditutup: masih ada {n} bundel rework."

**Hak Akses**
Otomatis oleh sistem; Supervisor dapat menutup manual (lihat FR-03.1).

**API**
`GET /stock?category=fg`, `GET /work-orders/{id}/closure-check`
