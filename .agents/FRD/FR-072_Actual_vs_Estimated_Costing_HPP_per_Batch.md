# FR-07.2 Actual vs Estimated Costing (HPP per Batch)

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-07 Financial & Productivity Analytics |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Laporan HPP aktual vs estimasi per SPK Closed untuk mengukur profitabilitas dan variance biaya.

**Alur Kerja**
1. SPK Closed memicu kalkulasi.
2. **HPP Material Aktual per Pcs** = Σ (Harga Rata-rata per Kg / 1.000 × Berat Aktual per Pcs dalam gram) — dari data cutting & pemakaian aksesoris.
3. **Biaya Tenaga Kerja** = total payroll borongan SPK tersebut (FR-07.1) / qty FG.
4. **Overhead** = alokasi overhead periode (listrik, maintenance, spare part, operasional − hasil jual limbah) berdasarkan basis alokasi (default: proporsi menit SMV).
5. **Biaya Afval** = biaya material & tenaga kerja unit Reject dibebankan ke unit FG.
6. Sistem membandingkan dengan HPP estimasi BOM → variance (Rp & %) per komponen.
7. Jika harga jual diinput → margin per SPK, per SKU, per brand.

**Proses Validasi**
- Overhead periode harus diinput Finance sebelum laporan final; jika belum → status **Provisional**.
- Variance > ±5% → highlight merah.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Overhead belum diinput | Laporan berstatus Provisional |
| Harga material kosong | Komponen ditandai "Data harga tidak lengkap" |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| — | R | C R U | — | — |

> Endpoint costing mengembalikan **HTTP 403** untuk role selain Founder & Finance, dan percobaan akses dicatat di audit log.

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/overhead` | Input overhead periode |
| GET | `/costing/work-orders/{id}` | HPP aktual vs estimasi per SPK |
| GET | `/costing/summary?group_by=brand|sku&from=&to=` | Profitabilitas agregat |

```json
// GET /costing/work-orders/SPK-2026-0101 — Response
{
  "work_order": "SPK-2026-0101",
  "status": "FINAL",
  "fg_qty": 1176,
  "per_pcs": {
    "material": { "estimated": 3460, "actual": 3525, "variance_pct": 1.9 },
    "labor":    { "estimated": 1150, "actual": 1210, "variance_pct": 5.2 },
    "overhead": { "estimated": 600,  "actual": 640,  "variance_pct": 6.7 },
    "total":    { "estimated": 5210, "actual": 5375, "variance_pct": 3.2 }
  },
  "currency": "IDR"
}
```
