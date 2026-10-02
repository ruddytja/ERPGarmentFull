# FR-05.1 Multiple Status QC Routing

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-05 Quality Control & Traceability |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Penilaian hasil produksi per bundel menjadi Pass, Rework, atau Reject (afval), dengan kategori cacat.

**Alur Kerja**
1. Staff QC scan QR bundel di kios QC.
2. Input jumlah:
   - **Pass** — lolos
   - **Rework** — dapat diperbaiki (wajib kategori defect)
   - **Reject** — afval permanen (wajib kategori defect)
3. Kategori defect khusus pakaian dalam: jahitan lompat, bonding tape terlepas, karet melintir, ukuran asimetris, noda, lubang kain, dll.
4. Sistem:
   - Mengkreditkan qty **Pass** ke payroll borongan operator terkait (seluruh operasi pada bundel tersebut),
   - Membuat **bundel rework** baru dengan QR baru untuk qty Rework, diarahkan kembali ke operasi penyebab,
   - Mencatat Reject sebagai afval (masuk kalkulasi HPP).
5. Hasil rework kembali ke QC untuk inspeksi ulang.

**Proses Validasi**
- Pass + Rework + Reject = qty bundel.
- Rework & Reject wajib minimal 1 kategori defect.
- Bundel hanya dapat diinspeksi jika semua operasi routing sudah Complete.
- Defect rate harian > batas toleransi (default 5%) → push notification ke Supervisor.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Total tidak sama dengan qty bundel | 🔴 "Total {x} tidak sesuai isi bundel {y}." |
| Bundel belum selesai dijahit | 🔴 "Bundel masih di proses {operasi}." |
| Defect tanpa kategori | 🔴 "Pilih jenis cacat." |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (QC) |
|---|---|---|---|---|
| R | R | R | R, U (koreksi dengan alasan) | C |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/qc/inspections` | Simpan hasil QC |
| GET | `/qc/defect-categories` | Daftar kategori cacat |
| GET | `/reports/defect-rate?group_by=operator|line|defect&date=` | Laporan defect |

```json
// POST /qc/inspections — Request
{
  "bundle_id": "BDL-0101-012",
  "inspector_id": "QC-004",
  "pass": 21,
  "rework": [{ "qty": 2, "defect": "KARET_MELINTIR" }],
  "reject": [{ "qty": 1, "defect": "LUBANG_KAIN" }]
}

// Response 201
{ "status": "OK", "rework_bundle_id": "BDL-0101-012-R1", "payroll_credited_pcs": 21 }
```
