# FR-03.2 Cutting Yield & Scrap Calculator (Weight-Based)

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-03 Cutting & Bundle Barcoding |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Menghitung efisiensi pemotongan kain berdasarkan berat gelar, hasil potong, dan scrap.

**Alur Kerja**
1. Staff Cutting memilih SPK dan lot kain.
2. Input: total berat kain digelar (Kg), total panel siap jahit (pcs), berat scrap/perca (Kg).
3. Sistem menghitung:
   - **Fabric Yield** = Total Pcs / Berat Digelar (pcs/Kg)
   - **Berat Bersih per Pcs** = (Berat Digelar − Berat Scrap) / Total Pcs × 1000 (gram)
   - **Scrap Rate** = Berat Scrap / Berat Digelar × 100%
   - **Variance** = Berat Bersih Aktual per Pcs − Gram BOM
4. Stok kain berkurang sesuai berat digelar; scrap masuk ke Scrap/Waste Management.

> Contoh: 100 Kg gelar, 1.200 pcs, 4 Kg scrap → Yield 12 pcs/Kg; berat bersih 80 gr/pcs; scrap rate 4%.

**Proses Validasi**
- Berat scrap < berat digelar.
- Berat digelar ≤ material yang di-reserve untuk SPK (+ toleransi).
- Total pcs tidak melebihi target SPK + toleransi over-cut (default 3%).
- Variance > ±5% dari BOM → wajib catatan penyebab.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Scrap ≥ berat gelar | "Berat scrap tidak valid." |
| Melebihi reserve | "Pemakaian melebihi alokasi. Minta tambahan alokasi ke Supervisor." |
| Variance tinggi | Flag merah di dasbor Supervisor & laporan Finance |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Cutting) |
|---|---|---|---|---|
| R | R | R | R, U (koreksi) | C |

**API**
`POST /cutting-records`, `GET /cutting-records?wo=`, `GET /reports/cutting-yield?from=&to=`

```json
// POST /cutting-records — Request
{ "work_order": "SPK-2026-0101", "lot": "LOT-TR-2609-A", "spread_kg": 100.0, "cut_pcs": 1200, "scrap_kg": 4.0 }

// Response 201
{ "yield_pcs_per_kg": 12.0, "net_gram_per_pcs": 80.0, "scrap_rate_pct": 4.0, "bom_gram_per_pcs": 80.0, "variance_pct": 0.0 }
```
