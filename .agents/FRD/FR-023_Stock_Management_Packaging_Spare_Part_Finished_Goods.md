# FR-02.3 Stock Management (Packaging, Spare Part, Finished Goods)

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-02 Inventory & Material Receiving |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Kartu stok terpisah untuk: bahan baku, packaging (polybag, box, label), spare part mesin (jarum, looper, pelumas), dan Finished Goods.

**Alur Kerja**
1. Setiap mutasi (masuk, keluar, transfer, adjustment) tercatat pada kartu stok.
2. Stock opname berkala → selisih dicatat sebagai adjustment dengan alasan.
3. Batas stok minimum per item memicu notifikasi.

**Proses Validasi**
- Stok tidak boleh negatif.
- Adjustment wajib alasan dan approval Supervisor.

**Penanganan Error**
- Transaksi yang membuat stok negatif ditolak: "Stok {item} tidak mencukupi."

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Gudang) |
|---|---|---|---|---|
| R | R | R | R, A (adjustment) | C, R |

**API**
`GET /stock?category=packaging|sparepart|fg`, `POST /stock/adjustments`, `POST /stock/opname`
