# Functional Requirement Document (FRD) — Index
## Underwear Manufacturing ERP — THEUNDERWEARSUPPLY

| Atribut | Keterangan |
|---|---|
| **Versi** | 1.0 |
| **Status** | Final Draft |
| **Dokumen Terkait** | PRD_Garment_ERP.md, IA_Garment_ERP.md |

Setiap fitur didokumentasikan dengan struktur: **Nama & Deskripsi → Alur Kerja → Proses Validasi → Penanganan Error → Hak Akses → API**.

### Legenda Hak Akses
| Kode | Arti |
|---|---|
| **C** | Create | 
| **R** | Read |
| **U** | Update |
| **D** | Delete / Deactivate |
| **A** | Approve |
| **—** | Tidak ada akses |

### Konvensi API
- Base URL: `/api/v1`
- Autentikasi: `Authorization: Bearer <JWT>`
- Format: JSON, satuan berat stok dalam **Kg**, BOM per pcs dalam **gram**, mata uang **IDR**.
- Format error standar:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok Teteron Rayon kurang 12.50 Kg untuk SPK-2026-0101",
    "details": {}
  }
}
```

---

## Daftar File per Fitur

### FR-00 System Security & Access Management

- [FR-00.1 User Authentication & Login](FR-00_System_Security_Access_Management/FR-001_User_Authentication_Login.md)
- [FR-00.2 Session Management & Auto-Logout](FR-00_System_Security_Access_Management/FR-002_Session_Management_Auto-Logout.md)
- [FR-00.3 User & Role Management + Audit Trail](FR-00_System_Security_Access_Management/FR-003_User_Role_Management_Audit_Trail.md)

### FR-01 Master Data Management (Engineering)

- [FR-01.1 Bill of Materials (BOM) Berbasis Berat](FR-01_Master_Data_Management_Engineering/FR-011_Bill_of_Materials_BOM_Berbasis_Berat.md)
- [FR-01.2 Standard Minute Value (SMV) & Tarif Borongan](FR-01_Master_Data_Management_Engineering/FR-012_Standard_Minute_Value_SMV_Tarif_Borongan.md)
- [FR-01.3 Brand & SKU Directory](FR-01_Master_Data_Management_Engineering/FR-013_Brand_SKU_Directory.md)
- [FR-01.4 Sample & Prototyping Room](FR-01_Master_Data_Management_Engineering/FR-014_Sample_Prototyping_Room.md)
- [FR-01.5 Machine Asset Directory](FR-01_Master_Data_Management_Engineering/FR-015_Machine_Asset_Directory.md)

### FR-02 Inventory & Material Receiving

- [FR-02.1 Penerimaan Bahan Baku (Receiving)](FR-02_Inventory_Material_Receiving/FR-021_Penerimaan_Bahan_Baku_Receiving.md)
- [FR-02.2 Automated Material Allocation](FR-02_Inventory_Material_Receiving/FR-022_Automated_Material_Allocation.md)
- [FR-02.3 Stock Management (Packaging, Spare Part, Finished Goods)](FR-02_Inventory_Material_Receiving/FR-023_Stock_Management_Packaging_Spare_Part_Finished_Goods.md)

### FR-03 Cutting & Bundle Barcoding

- [FR-03.1 Work Order (SPK) Generation](FR-03_Cutting_Bundle_Barcoding/FR-031_Work_Order_SPK_Generation.md)
- [FR-03.2 Cutting Yield & Scrap Calculator (Weight-Based)](FR-03_Cutting_Bundle_Barcoding/FR-032_Cutting_Yield_Scrap_Calculator_Weight-Based.md)
- [FR-03.3 Scrap/Waste Disposal Management](FR-03_Cutting_Bundle_Barcoding/FR-033_ScrapWaste_Disposal_Management.md)
- [FR-03.4 Bundle Ticket Generation](FR-03_Cutting_Bundle_Barcoding/FR-034_Bundle_Ticket_Generation.md)

### FR-04 Sewing, Seamless & Production Tracking

- [FR-04.1 WIP Tracking (Barcode Scan)](FR-04_Sewing_Seamless_Production_Tracking/FR-041_WIP_Tracking_Barcode_Scan.md)
- [FR-04.2 Downtime & Machine Ticketing](FR-04_Sewing_Seamless_Production_Tracking/FR-042_Downtime_Machine_Ticketing.md)
- [FR-04.3 Spare Part Consumption](FR-04_Sewing_Seamless_Production_Tracking/FR-043_Spare_Part_Consumption.md)

### FR-05 Quality Control & Traceability

- [FR-05.1 Multiple Status QC Routing](FR-05_Quality_Control_Traceability/FR-051_Multiple_Status_QC_Routing.md)
- [FR-05.2 Defect Log & Traceability](FR-05_Quality_Control_Traceability/FR-052_Defect_Log_Traceability.md)
- [FR-05.3 Customer Return & B-Grade Management](FR-05_Quality_Control_Traceability/FR-053_Customer_Return_B-Grade_Management.md)

### FR-06 Packaging & Finished Goods

- [FR-06.1 Packing Verification](FR-06_Packaging_Finished_Goods/FR-061_Packing_Verification.md)
- [FR-06.2 Finished Goods Transfer & SPK Closure](FR-06_Packaging_Finished_Goods/FR-062_Finished_Goods_Transfer_SPK_Closure.md)
- [FR-06.3 Dispatch & Fulfillment Routing](FR-06_Packaging_Finished_Goods/FR-063_Dispatch_Fulfillment_Routing.md)

### FR-07 Financial & Productivity Analytics

- [FR-07.1 Piece-Rate Payroll Automation](FR-07_Financial_Productivity_Analytics/FR-071_Piece-Rate_Payroll_Automation.md)
- [FR-07.2 Actual vs Estimated Costing (HPP per Batch)](FR-07_Financial_Productivity_Analytics/FR-072_Actual_vs_Estimated_Costing_HPP_per_Batch.md)
- [FR-07.3 Employee Efficiency & OEE](FR-07_Financial_Productivity_Analytics/FR-073_Employee_Efficiency_OEE.md)
- [FR-07.4 Notifications & Alerts](FR-07_Financial_Productivity_Analytics/FR-074_Notifications_Alerts.md)

---

## Lampiran: Matriks Hak Akses

| Modul / Fitur | Admin | Founder | Finance | Supervisor | Staff |
|---|---|---|---|---|---|
| User & Role Management | CRUD | R (audit) | — | — | — |
| BOM | CRUD | R | R | R (tanpa harga) | — |
| SMV & Tarif | CRUD | R | R | R (tanpa tarif) | — |
| Brand & SKU | CRUD | R | R | R | R |
| Sample & Prototyping | R A | R | R | CRU | C |
| Mesin | CRUD | R | R | R | R |
| Receiving | R | R | R | R A | C R |
| Stok & Alokasi | R | R | R | R U A | C R |
| SPK | R | R | R | CRU | R |
| Cutting & Scrap | R | R | R | R U A | C |
| Bundle Ticket | R | R | — | CR + reprint | C |
| WIP Scan (Kios) | R | R | R | R U | C |
| Downtime Ticket | R | R | R | CRU | C / RU (teknisi) |
| QC & Rework | R | R | R | R U | C |
| Traceability | R | R | R | R | — |
| Return & B-Grade | R | R | R | R A | C |
| Packing & FG | R | R | R | R U | C |
| Dispatch & Fulfillment | R | R | R | R A | C |
| Payroll Borongan | — | R | CRUA | — | R (sendiri, opsional) |
| Costing / HPP / Overhead | — | R | CRU | **— (dikunci)** | **— (dikunci)** |
| Efficiency & OEE | R | R | R | R | R (sendiri, opsional) |
