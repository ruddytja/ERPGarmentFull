# FR-03.4 Bundle Ticket Generation

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-03 Cutting & Bundle Barcoding |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Memecah hasil potong menjadi bundel dan mencetak tiket QR untuk pelacakan WIP.

**Alur Kerja**
1. Setelah cutting tersimpan, Supervisor/Staff Cutting memilih **Generate Bundle**.
2. Sistem membagi qty per size/warna ke bundel (default 24 pcs; sisa menjadi bundel terakhir).
3. Tiap bundel mendapat ID unik dan QR berisi: No SPK, SKU, Size, Warna, Qty, Lot kain, nomor bundel (mis. 12/50).
4. Tiket dicetak di printer thermal dan diikat ke tumpukan potongan.

**Proses Validasi**
- Total qty bundel = total pcs hasil potong.
- Ukuran bundel 1–100 pcs.
- Cetak ulang hanya oleh Supervisor dan tercatat di audit log; tiket lama otomatis invalid.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Printer tidak terhubung | Simpan bundel, tampil "Printer offline. Cetak ulang dari menu Bundle Management." |
| Scan tiket invalid (versi lama) | "Tiket sudah tidak berlaku. Gunakan tiket cetak ulang." |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Cutting) |
|---|---|---|---|---|
| R | R | — | C R, cetak ulang | C (generate & cetak pertama) |

**API**
`POST /work-orders/{id}/bundles`, `GET /bundles/{id}`, `POST /bundles/{id}/reprint`, `GET /bundles/{id}/label.pdf`
