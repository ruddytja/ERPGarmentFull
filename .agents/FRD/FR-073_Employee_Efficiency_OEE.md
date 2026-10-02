# FR-07.3 Employee Efficiency & OEE

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-07 Financial & Productivity Analytics |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Penilaian performa operator dan mesin.

**Alur Kerja**
1. **Efficiency Rate operator** = (Total Output Pass QC × SMV) / Total Waktu Kerja Aktual × 100%.
2. **Leaderboard** efisiensi per operator, per lini, per periode.
3. **OEE Mesin** = Availability × Performance × Quality:
   - Availability = (Waktu Rencana − Downtime) / Waktu Rencana
   - Performance = (Output Total × SMV) / Waktu Operasi Aktual
   - Quality = Output Pass / Output Total
4. Dasbor Supervisor (efisiensi lini, tanpa biaya) dan Founder (ringkasan pabrik).

**Proses Validasi**
- Waktu kerja aktual dari shift terjadwal dikurangi istirahat & downtime yang bukan kesalahan operator.
- Data anomali dikecualikan sampai direviu.

**Penanganan Error**
- Data shift tidak ada → efisiensi ditampilkan "N/A" untuk operator tersebut.

**Hak Akses**
| Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|
| R | R | R | R | R (skor diri sendiri, opsional) |

**API**
`GET /reports/efficiency?group_by=operator|line&from=&to=`, `GET /reports/oee?machine=&from=&to=`, `GET /reports/leaderboard`
