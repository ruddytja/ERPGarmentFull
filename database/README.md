# Garment ERP — Database

Skrip PostgreSQL untuk schema `erp`.

| File | Isi |
|---|---|
| `01_schema.sql` | Tabel, enum, index |
| `02_functions_triggers.sql` | Fungsi & trigger |
| `03_views.sql` | View (kredit upah borongan) |
| `04_seed_master.sql` | Data master awal (user, brand, SKU, mesin, dll.) |
| `import_to_aiven.js` | Menjalankan ketiga file di atas ke database |

```bash
npm install
npm run import
```

Kredensial dibaca dari `database/.env` bila ada, kalau tidak dari `../backend/.env`.

> ⚠️ `npm run import` menjalankan `DROP SCHEMA erp CASCADE` terlebih dahulu — **semua data
> di schema `erp` akan terhapus**. Jangan jalankan ke database produksi yang sudah berisi data.
