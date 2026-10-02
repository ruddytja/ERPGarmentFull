# FR-05.2 Defect Log & Traceability

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-05 Quality Control & Traceability |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pelacakan riwayat cacat hingga ke operator jahit, mesin, operasi, dan lot kain.

**Alur Kerja**
1. Pengguna mencari berdasarkan No SPK, bundel, operator, lot kain, atau jenis defect.
2. Sistem menampilkan rantai lengkap: lot kain → cutting → operator & mesin per operasi → hasil QC.
3. Analisis Pareto jenis cacat per periode.

**Proses Validasi**
- Data read-only (tidak dapat diubah dari layar ini).

**Penanganan Error**
- Data tidak ditemukan → "Tidak ada riwayat untuk kriteria ini."

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| R | R | R | R | — |

**API**
`GET /traceability/bundles/{id}`, `GET /traceability/lots/{lot}`, `GET /reports/defect-pareto`
