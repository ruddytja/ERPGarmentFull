# FR-04.1 WIP Tracking (Barcode Scan)

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-04 Sewing, Seamless & Production Tracking |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Pelacakan posisi dan progres bundel di lini Sewing (jahit konvensional) dan Bonding (seamless heat-seal) melalui UI kios layar sentuh.

**Alur Kerja**
1. Operator di kios memilih lini (Sewing / Bonding) — sekali per shift.
2. Scan ID/PIN operator.
3. Scan QR bundel → sistem menampilkan operasi berikutnya sesuai routing → tombol besar **MULAI**.
4. Setelah selesai, scan QR bundel lagi → tombol **SELESAI**.
5. Sistem mencatat operator, operasi, mesin, waktu mulai/selesai, dan qty.
6. Progres SPK diperbarui real-time di dasbor Supervisor.

**Proses Validasi**
- Bundel harus mengikuti urutan routing (tidak bisa loncat operasi).
- Satu bundel-operasi hanya dapat dimulai oleh satu operator.
- Operator tidak dapat menyelesaikan bundel yang dimulai operator lain.
- Durasi < 50% dari (SMV × qty) → ditandai anomali untuk ditinjau Supervisor.
- Bundel dengan status Rework hanya bisa discan ke operasi rework terkait.

**Penanganan Error**
| Kondisi | Pesan di Kios (besar, berwarna) |
|---|---|
| Bundel sudah dikerjakan operator lain | 🔴 "Bundel sedang dikerjakan oleh {nama}." |
| Operasi tidak sesuai urutan | 🔴 "Bundel belum melewati proses {operasi sebelumnya}." |
| Scan ganda | 🟡 "Sudah tercatat. Tidak perlu scan ulang." |
| Koneksi terputus | 🟡 "Tersimpan offline. Akan disinkronkan otomatis." (offline queue) |
| QR tidak terbaca | Opsi input manual nomor bundel |

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff (Operator) |
|---|---|---|---|---|
| R | R (agregat) | R | R, U (koreksi scan) | C (scan) |

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/kiosk/operator-login` | Login operator via ID/PIN |
| POST | `/wip/scan` | Mulai / selesai operasi |
| POST | `/wip/sync` | Sinkronisasi batch scan offline |
| GET | `/wip/status?wo=&line=` | Status WIP real-time |

```json
// POST /wip/scan — Request
{ "operator_id": "OP-0231", "bundle_id": "BDL-0101-012", "action": "COMPLETE", "machine_id": "MC-SRB-F007-03", "scanned_at": "2026-10-01T10:15:22+07:00" }

// Response 200
{ "status": "OK", "operation": "Coverstitch Pinggang", "qty": 24, "duration_min": 31.5, "next_operation": "Obras Samping" }
```
