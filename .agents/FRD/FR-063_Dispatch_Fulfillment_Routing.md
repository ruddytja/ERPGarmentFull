# FR-06.3 Dispatch & Fulfillment Routing

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-06 Packaging & Finished Goods |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pengeluaran barang jadi untuk klien B2B (partai besar) maupun pesanan e-commerce/B2C (satuan).

**Alur Kerja**
- **B2B Dispatch:** buat Delivery Order (klien, SKU, qty) → picking dari stok FG → cetak surat jalan/faktur pengiriman → status Dikirim.
- **B2C Fulfillment:** input/impor pesanan (nomor pesanan, kanal: Shopee, TikTok Shop, Lazada, Blibli, dll.) → cetak packing list & resi → scan item saat packing → status Dikirim.

**Proses Validasi**
- Qty ≤ stok FG tersedia.
- Scan item harus sesuai pesanan.
- Nomor pesanan marketplace tidak duplikat.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Stok FG kurang | "Stok {SKU} kurang {n} pcs." (pesanan ditahan / partial) |
| Pesanan duplikat | "Nomor pesanan sudah diproses." |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Gudang FG) |
|---|---|---|---|---|
| R | R | R | R, A (B2B) | C |

**API**
`POST /dispatch/b2b`, `POST /fulfillment/orders`, `POST /fulfillment/orders/import` (CSV), `GET /dispatch/{id}/delivery-note.pdf`
