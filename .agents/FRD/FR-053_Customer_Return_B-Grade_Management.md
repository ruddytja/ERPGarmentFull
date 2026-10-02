# FR-05.3 Customer Return & B-Grade Management

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-05 Quality Control & Traceability |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Penilaian ulang produk retur dari klien/marketplace untuk diklasifikasikan sebagai B-Grade, Rework, atau Dimusnahkan.

**Alur Kerja**
1. Staff mencatat retur: sumber (klien B2B / kanal online), SKU, size, qty, alasan.
2. QC menilai tiap item: **Restock A-Grade**, **B-Grade** (stok terpisah, harga diskon), **Rework**, atau **Musnah**.
3. Stok FG/B-Grade disesuaikan; jika dapat ditelusuri ke SPK, defect tercatat di traceability.

**Proses Validasi**
- Total klasifikasi = qty retur.

**Penanganan Error**
- Ketidaksesuaian qty → ditolak dengan pesan.

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (QC) |
|---|---|---|---|---|
| R | R | R | R, A | C |

**API**
`POST /returns`, `POST /returns/{id}/grading`, `GET /stock?category=b-grade`
