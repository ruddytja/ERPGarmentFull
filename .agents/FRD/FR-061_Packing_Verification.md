# FR-06.1 Packing Verification

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-06 Packaging & Finished Goods |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Verifikasi isi kemasan melalui scan untuk mencegah salah packing dan kuantitas fiktif.

**Alur Kerja**
1. Staff Packing scan bundel/item berstatus Pass QC.
2. Sistem menampilkan konfigurasi pack SKU (mis. multipack 3-in-1: kombinasi warna & size).
3. Staff scan item sesuai konfigurasi; layar menampilkan checklist hijau per item.
4. Setelah lengkap → konfirmasi pack; packaging material (polybag/box/label) berkurang otomatis.
5. Cetak label kemasan/karton bila diperlukan.

**Proses Validasi**
- Hanya item Pass QC yang dapat dipacking.
- Size, warna, dan qty harus sesuai konfigurasi pack.
- Item tidak dapat dipacking dua kali.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Item belum Pass QC | 🔴 "Item belum lolos QC." |
| Size/warna tidak sesuai | 🔴 "Tidak sesuai komposisi pack. Dibutuhkan: {detail}." |
| Stok packaging habis | 🔴 "Stok polybag/box habis." + notifikasi Gudang |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Packing) |
|---|---|---|---|---|
| R | R | R | R, U | C |

**API**
`POST /packing/sessions`, `POST /packing/sessions/{id}/scan`, `POST /packing/sessions/{id}/confirm`
