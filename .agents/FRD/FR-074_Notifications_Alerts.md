# FR-07.4 Notifications & Alerts

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-07 Financial & Productivity Analytics |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Push notification real-time untuk kejadian kritis.

| Pemicu | Penerima |
|---|---|
| Stok kain/benang/karet di bawah minimum | Supervisor, Admin |
| Defect/Reject harian melewati toleransi | Supervisor, Founder |
| Tiket downtime baru / eskalasi | Teknisi, Supervisor |
| Selisih receiving > toleransi | Supervisor |
| Cost variance SPK > ±5% | Finance, Founder |
| Draf payroll siap direviu | Finance |

**API**
`GET /notifications`, `PATCH /notifications/{id}/read`, `PUT /settings/thresholds`
