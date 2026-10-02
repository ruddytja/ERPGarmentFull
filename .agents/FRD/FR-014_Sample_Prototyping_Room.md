# FR-01.4 Sample & Prototyping Room

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-01 Master Data Management (Engineering) |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pencatatan konsumsi bahan dan waktu pembuatan sampel/purwarupa sebelum produksi massal, sebagai referensi penyusunan BOM.

**Alur Kerja**
1. Supervisor membuat Sample Request (SKU baru/eksisting, size, warna).
2. Staff mencatat material terpakai (gram) dan waktu tiap operasi.
3. Hasil sampel diberi status Approved / Revisi / Ditolak.
4. Sampel Approved dapat dikonversi menjadi draf BOM & SMV.

**Proses Validasi**
- Material terpakai memotong stok bahan baku (kategori: sampel).
- Konversi ke BOM hanya untuk sampel Approved.

**Penanganan Error**
- Stok tidak cukup → "Stok {material} tidak mencukupi untuk sampel."

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| R, A (konversi BOM) | R | R | C R U | C (input konsumsi) |

**API**
`GET/POST /samples`, `PATCH /samples/{id}/status`, `POST /samples/{id}/convert-to-bom`
