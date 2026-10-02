# FR-02.2 Automated Material Allocation

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-02 Inventory & Material Receiving |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Reservasi otomatis material (Kg) saat SPK diaktifkan sehingga tidak terpakai SPK lain.

**Alur Kerja**
1. Supervisor mengubah SPK dari Draft → Active.
2. Sistem menghitung kebutuhan dari BOM × qty (+ shrinkage).
3. Sistem memeriksa stok tersedia (Stock-on-Hand − reserved).
4. Jika cukup → material di-reserve (FIFO per lot) dan muncul di daftar Material Allocation.
5. Saat cutting selesai, reserve dikonversi menjadi pemakaian aktual; sisa reserve dilepas.

**Proses Validasi**
- Stok tersedia ≥ kebutuhan untuk semua material utama.
- Reserve dilepas otomatis jika SPK dibatalkan.

**Penanganan Error**
| Kondisi | Aksi |
|---|---|
| Stok kurang | SPK tetap Draft, tampil "Kekurangan: Teteron Rayon 12,50 Kg" |
| Stok di bawah batas minimum setelah reserve | Push notification stok kritis ke Supervisor & Admin |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Gudang) |
|---|---|---|---|---|
| R | R | R | R, U (release manual) | R |

**API**
`GET /allocations?wo=`, `POST /work-orders/{id}/allocate`, `POST /allocations/{id}/release`
