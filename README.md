# THEUNDERWEARSUPPLY Garment ERP

```
ERP/
├── frontend/   React + Vite — UI semua role (Admin, Founder, Finance, Supervisor, Staff)
├── backend/    Express + PostgreSQL — REST API /api (port 4000)
├── database/   Skema SQL, fungsi/trigger, seed, skrip import
├── docs/       Dokumen FRD per role
├── .agents/    PRD & FRD per fitur
└── _archive/   Prototipe lama per fungsi (sudah digabung ke frontend/)
```

## Menjalankan

```bash
npm run install:all          # install root + backend + frontend
cp backend/.env.example backend/.env   # isi koneksi PostgreSQL
npm run dev                  # backend :4000 + frontend http://localhost:3000
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Backend + frontend sekaligus |
| `npm run dev:backend` / `dev:frontend` | Salah satu saja |
| `npm run build` | Build produksi frontend |
| `npm run lint` | Type-check backend & frontend |
| `npm run db:import` | Import ulang schema + seed (⚠️ menghapus schema `erp`) |
