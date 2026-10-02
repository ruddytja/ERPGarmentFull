# FR-02.1 Penerimaan Bahan Baku (Receiving)

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-02 Inventory & Material Receiving |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pencatatan kedatangan material ke gudang berdasarkan surat jalan dan timbang ulang (re-roll) aktual dalam Kg.

**Alur Kerja**
1. Staff Gudang membuat Goods Receipt: nomor surat jalan, supplier, tanggal.
2. Per item: material, lot number, berat di dokumen (Kg), jumlah roll, harga per Kg.
3. Staff menimbang ulang (re-roll) → input berat aktual (Kg).
4. Sistem menghitung selisih dokumen vs aktual.
5. QC bahan (opsional): uji shrinkage, warna, cacat kain → Pass/Hold/Reject.
6. Submit → stok **Stock-on-Hand** bertambah sesuai berat aktual (status Pass); harga rata-rata per Kg diperbarui.

**Proses Validasi**
- Nomor surat jalan + supplier tidak boleh duplikat.
- Lot number wajib untuk kain, karet, dan benang.
- Berat aktual > 0.
- Selisih > toleransi (default ±2%) → wajib catatan dan persetujuan Supervisor.
- Material status Hold/Reject tidak menambah stok tersedia.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Surat jalan duplikat | "Surat jalan sudah pernah diterima pada {tanggal}." |
| Selisih melebihi toleransi | Status "Menunggu Approval", notifikasi ke Supervisor |
| Timbangan offline / input manual | Ditandai "Manual Entry" di audit log |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Gudang) |
|---|---|---|---|---|
| R | R | R (termasuk harga) | R, A | C, R |

> Staff Gudang dapat memasukkan harga dari dokumen, namun tidak dapat melihat laporan harga rata-rata.

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/goods-receipts` | Buat penerimaan |
| PATCH | `/goods-receipts/{id}/approve` | Approval selisih |
| GET | `/stock?category=raw` | Stok bahan baku |
| GET | `/stock/{material}/lots` | Stok per lot |

```json
// POST /goods-receipts — Request
{
  "delivery_note": "SJ/2026/09/0045",
  "supplier_id": "SUP-007",
  "items": [
    { "material": "FAB-TR-01", "lot": "LOT-TR-2609-A", "doc_kg": 250.00, "actual_kg": 247.80, "rolls": 10, "price_per_kg": 42000 }
  ]
}
```
