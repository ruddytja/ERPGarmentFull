# FR-07.1 Piece-Rate Payroll Automation

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-07 Financial & Productivity Analytics |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Perhitungan upah borongan otomatis dari unit Pass QC × tarif per proses.

**Alur Kerja**
1. Finance memilih periode (mingguan/dua mingguan/bulanan).
2. Sistem mengambil seluruh scan Complete yang bundelnya sudah Pass QC dalam periode.
3. Perhitungan per operator: **Σ (Qty Pass × Tarif Operasi)**.
4. Draf slip gaji tampil per operator (rincian per SPK & operasi).
5. Finance mereviu, menyesuaikan (dengan alasan), lalu **Approve** → periode terkunci.
6. Ekspor ke Excel/PDF untuk pencairan.

**Proses Validasi**
- Hanya qty Pass yang dihitung; Rework dihitung setelah lolos QC ulang (tidak dibayar ganda); Reject tidak dibayar.
- Tarif menggunakan tarif yang berlaku pada tanggal scan (effective date).
- Periode yang sudah di-approve tidak dapat diubah (hanya via adjustment periode berikutnya).
- Scan beranomali (FR-04.1) ditampilkan terpisah untuk direviu.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Masih ada bundel belum di-QC | Peringatan: "{n} bundel belum di-QC dan tidak masuk periode ini." |
| Tarif operasi belum diset | "Operasi {nama} tanpa tarif." — draf tidak dapat di-approve |
| Approve ulang periode terkunci | Ditolak |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| — | R | C R U A | — | R (slip milik sendiri, opsional) |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/payroll/runs` | Generate draf periode |
| GET | `/payroll/runs/{id}` | Detail draf |
| POST | `/payroll/runs/{id}/adjustments` | Penyesuaian |
| PATCH | `/payroll/runs/{id}/approve` | Approve & kunci |
| GET | `/payroll/runs/{id}/export?format=xlsx` | Ekspor |
