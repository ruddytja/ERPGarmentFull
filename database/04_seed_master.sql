-- =====================================================================
--  Garment ERP — THEUNDERWEARSUPPLY
--  04_seed_master.sql  ·  master data awal (siap dipakai & diubah)
-- ---------------------------------------------------------------------
--  Isi: lini, setting, kebijakan sesi, matriks hak akses, user awal,
--       brand, kanal & toko online, supplier, material, SKU & varian,
--       operasi + SMV + tarif, routing, BOM v1, kemasan, mesin, kategori cacat.
--
--  ⚠ Nilai CONTOH (wajib divalidasi sebelum go-live, lihat PRD Risiko R-3):
--     harga material, SMV, tarif borongan, gramasi BOM, nama operator,
--     supplier & klien B2B. PIN kios awal semua operator = 1234.
-- =====================================================================

BEGIN;
SET search_path = erp, public;

-- ---------------------------------------------------------------------
-- Lini produksi
-- ---------------------------------------------------------------------
INSERT INTO erp.production_lines (code, name, line_type) VALUES
  ('CUT-1', 'Cutting',        'CUTTING'),
  ('SEW-1', 'Sewing Line 1',  'SEWING'),
  ('SEW-2', 'Sewing Line 2',  'SEWING'),
  ('BND-1', 'Bonding Line 1', 'BONDING'),
  ('QC-1',  'QC Station',     'QC'),
  ('PCK-1', 'Packing',        'PACKING');

-- ---------------------------------------------------------------------
-- Setting & threshold (PRD/FRD)
-- ---------------------------------------------------------------------
INSERT INTO erp.system_settings (key, value, description) VALUES
  ('receiving_tolerance_pct',          '2',   'FR-02.1 Toleransi selisih timbang vs surat jalan (%)'),
  ('allocation_overuse_tolerance_pct', '2',   'FR-03.2 Toleransi pemakaian kain di atas alokasi (%)'),
  ('overcut_tolerance_pct',            '3',   'FR-03.2 Toleransi over-cut terhadap target SPK (%)'),
  ('cutting_variance_pct',             '5',   'FR-03.2 Variance berat bersih vs BOM yang wajib catatan (%)'),
  ('bundle_size_default',              '24',  'FR-03.4 Isi bundel default (pcs)'),
  ('scan_anomaly_ratio',               '0.5', 'FR-04.1 Durasi < rasio × (SMV × qty) ditandai anomali'),
  ('downtime_escalation_minutes',      '15',  'FR-04.2 Eskalasi tiket tanpa respons (menit)'),
  ('defect_rate_threshold_pct',        '5',   'FR-05.1 Batas defect rate harian (%)'),
  ('defect_alert_min_sample',          '48',  'FR-05.1 Minimal pcs diinspeksi sebelum alert defect'),
  ('cost_variance_threshold_pct',      '5',   'FR-07.2 Batas cost variance HPP (%)'),
  ('est_overhead_per_smv_minute',      '60',  'FR-07.2 Estimasi overhead per menit SMV (Rp) untuk HPP estimasi'),
  ('machine_planned_minutes_per_day',  '480', 'FR-07.3 Waktu rencana mesin per hari (menit)'),
  ('password_min_length',              '8',   'FR-00.1 Panjang minimal password'),
  ('login_max_failed',                 '5',   'FR-00.1 Gagal login berturut-turut sebelum dikunci'),
  ('login_lock_minutes',               '15',  'FR-00.1 Lama kunci akun (menit)');

INSERT INTO erp.session_policies (role, idle_minutes) VALUES
  ('ADMIN', 15), ('FOUNDER', 15), ('FINANCE', 15), ('SUPERVISOR', 30), ('STAFF', 60);

-- ---------------------------------------------------------------------
-- Matriks hak akses (Lampiran FRD). Kolom: C R U D A
-- ---------------------------------------------------------------------
INSERT INTO erp.role_permissions (role, module, can_create, can_read, can_update, can_delete, can_approve, scope_note)
SELECT r::erp.user_role, m::erp.app_module, c, rd, u, d, a, note FROM (VALUES
  ('ADMIN','USER_MGMT',   true, true, true, true, false, NULL),
  ('ADMIN','BOM',         true, true, true, true, false, NULL),
  ('ADMIN','SMV_RATE',    true, true, true, true, false, NULL),
  ('ADMIN','BRAND_SKU',   true, true, true, true, false, NULL),
  ('ADMIN','SAMPLE',      false,true, false,false,true,  'Approve konversi sampel → BOM'),
  ('ADMIN','MACHINE',     true, true, true, true, false, NULL),
  ('ADMIN','RECEIVING',   false,true, false,false,false, NULL),
  ('ADMIN','STOCK',       false,true, false,false,false, NULL),
  ('ADMIN','WORK_ORDER',  false,true, false,false,false, NULL),
  ('ADMIN','CUTTING',     false,true, false,false,false, NULL),
  ('ADMIN','BUNDLE',      false,true, false,false,false, NULL),
  ('ADMIN','WIP_SCAN',    false,true, false,false,false, NULL),
  ('ADMIN','DOWNTIME',    false,true, false,false,false, NULL),
  ('ADMIN','QC',          false,true, false,false,false, NULL),
  ('ADMIN','TRACEABILITY',false,true, false,false,false, NULL),
  ('ADMIN','RETURN',      false,true, false,false,false, NULL),
  ('ADMIN','PACKING',     false,true, false,false,false, NULL),
  ('ADMIN','DISPATCH',    false,true, false,false,false, NULL),
  ('ADMIN','ANALYTICS',   false,true, false,false,false, NULL),
  ('ADMIN','AUDIT',       false,true, false,false,false, NULL),

  ('FOUNDER','USER_MGMT', false,false,false,false,false, NULL),
  ('FOUNDER','BOM',       false,true, false,false,false, NULL),
  ('FOUNDER','SMV_RATE',  false,true, false,false,false, NULL),
  ('FOUNDER','BRAND_SKU', false,true, false,false,false, NULL),
  ('FOUNDER','SAMPLE',    false,true, false,false,false, NULL),
  ('FOUNDER','MACHINE',   false,true, false,false,false, NULL),
  ('FOUNDER','RECEIVING', false,true, false,false,false, NULL),
  ('FOUNDER','STOCK',     false,true, false,false,false, NULL),
  ('FOUNDER','WORK_ORDER',false,true, false,false,false, NULL),
  ('FOUNDER','CUTTING',   false,true, false,false,false, NULL),
  ('FOUNDER','BUNDLE',    false,true, false,false,false, NULL),
  ('FOUNDER','WIP_SCAN',  false,true, false,false,false, 'Agregat'),
  ('FOUNDER','DOWNTIME',  false,true, false,false,false, NULL),
  ('FOUNDER','QC',        false,true, false,false,false, NULL),
  ('FOUNDER','TRACEABILITY',false,true,false,false,false, NULL),
  ('FOUNDER','RETURN',    false,true, false,false,false, NULL),
  ('FOUNDER','PACKING',   false,true, false,false,false, NULL),
  ('FOUNDER','DISPATCH',  false,true, false,false,false, NULL),
  ('FOUNDER','PAYROLL',   false,true, false,false,false, NULL),
  ('FOUNDER','COSTING',   false,true, false,false,false, NULL),
  ('FOUNDER','ANALYTICS', false,true, false,false,false, NULL),
  ('FOUNDER','AUDIT',     false,true, false,false,false, NULL),

  ('FINANCE','BOM',       false,true, false,false,false, 'Termasuk harga'),
  ('FINANCE','SMV_RATE',  false,true, false,false,false, NULL),
  ('FINANCE','BRAND_SKU', false,true, false,false,false, NULL),
  ('FINANCE','SAMPLE',    false,true, false,false,false, NULL),
  ('FINANCE','MACHINE',   false,true, false,false,false, NULL),
  ('FINANCE','RECEIVING', false,true, false,false,false, 'Termasuk harga'),
  ('FINANCE','STOCK',     false,true, false,false,false, NULL),
  ('FINANCE','WORK_ORDER',false,true, false,false,false, NULL),
  ('FINANCE','CUTTING',   false,true, true, false,false, 'Update nilai jual limbah'),
  ('FINANCE','WIP_SCAN',  false,true, false,false,false, NULL),
  ('FINANCE','DOWNTIME',  false,true, false,false,false, 'Biaya'),
  ('FINANCE','QC',        false,true, false,false,false, NULL),
  ('FINANCE','TRACEABILITY',false,true,false,false,false, NULL),
  ('FINANCE','RETURN',    false,true, false,false,false, NULL),
  ('FINANCE','PACKING',   false,true, false,false,false, NULL),
  ('FINANCE','DISPATCH',  false,true, false,false,false, NULL),
  ('FINANCE','PAYROLL',   true, true, true, false,true,  NULL),
  ('FINANCE','COSTING',   true, true, true, false,false, NULL),
  ('FINANCE','ANALYTICS', false,true, false,false,false, NULL),

  ('SUPERVISOR','BOM',       false,true, false,false,false, 'Tanpa harga'),
  ('SUPERVISOR','SMV_RATE',  false,true, false,false,false, 'SMV saja, tanpa tarif'),
  ('SUPERVISOR','BRAND_SKU', false,true, false,false,false, NULL),
  ('SUPERVISOR','SAMPLE',    true, true, true, false,false, NULL),
  ('SUPERVISOR','MACHINE',   false,true, false,false,false, NULL),
  ('SUPERVISOR','RECEIVING', false,true, false,false,true,  'Approve selisih timbang'),
  ('SUPERVISOR','STOCK',     false,true, true, false,true,  'Approve adjustment'),
  ('SUPERVISOR','WORK_ORDER',true, true, true, false,false, 'Aktivasi & tutup SPK'),
  ('SUPERVISOR','CUTTING',   false,true, true, false,true,  'Koreksi'),
  ('SUPERVISOR','BUNDLE',    true, true, false,false,false, 'Termasuk cetak ulang'),
  ('SUPERVISOR','WIP_SCAN',  false,true, true, false,false, 'Koreksi scan'),
  ('SUPERVISOR','DOWNTIME',  true, true, true, false,false, NULL),
  ('SUPERVISOR','QC',        false,true, true, false,false, 'Koreksi dengan alasan'),
  ('SUPERVISOR','TRACEABILITY',false,true,false,false,false, NULL),
  ('SUPERVISOR','RETURN',    false,true, false,false,true,  NULL),
  ('SUPERVISOR','PACKING',   false,true, true, false,false, NULL),
  ('SUPERVISOR','DISPATCH',  false,true, false,false,true,  'Approve B2B'),
  ('SUPERVISOR','PAYROLL',   false,false,false,false,false, 'Dikunci'),
  ('SUPERVISOR','COSTING',   false,false,false,false,false, 'Dikunci'),
  ('SUPERVISOR','ANALYTICS', false,true, false,false,false, 'Tanpa biaya'),

  ('STAFF','BRAND_SKU',  false,true, false,false,false, 'Nama & varian'),
  ('STAFF','SAMPLE',     true, false,false,false,false, 'Input konsumsi'),
  ('STAFF','MACHINE',    false,true, false,false,false, 'Kode mesin'),
  ('STAFF','RECEIVING',  true, true, false,false,false, 'Gudang'),
  ('STAFF','STOCK',      true, true, false,false,false, 'Gudang'),
  ('STAFF','WORK_ORDER', false,true, false,false,false, 'SPK aktif di stasiunnya'),
  ('STAFF','CUTTING',    true, false,false,false,false, 'Cutting'),
  ('STAFF','BUNDLE',     true, false,false,false,false, 'Cetak pertama'),
  ('STAFF','WIP_SCAN',   true, false,false,false,false, 'Operator'),
  ('STAFF','DOWNTIME',   true, true, true, false,false, 'Operator: lapor; Teknisi: update'),
  ('STAFF','QC',         true, false,false,false,false, 'QC'),
  ('STAFF','RETURN',     true, false,false,false,false, 'QC'),
  ('STAFF','PACKING',    true, false,false,false,false, 'Packing'),
  ('STAFF','DISPATCH',   true, false,false,false,false, 'Gudang FG'),
  ('STAFF','PAYROLL',    false,true, false,false,false, 'Slip milik sendiri (opsional)'),
  ('STAFF','COSTING',    false,false,false,false,false, 'Dikunci'),
  ('STAFF','ANALYTICS',  false,true, false,false,false, 'Skor sendiri (opsional)')
) AS t(r, m, c, rd, u, d, a, note);

-- ---------------------------------------------------------------------
-- User awal  (nama operator = contoh; Hendra Ari Wardani = teknisi dari PRD)
-- ---------------------------------------------------------------------
INSERT INTO erp.users (full_name, email, role, staff_function, operator_code, pin_hash, line_id) VALUES
  ('Andi Saputra',        'admin@theunderwearsupply.id',      'ADMIN',      NULL,      NULL, NULL, NULL),
  ('Founder TUS',         'founder@theunderwearsupply.id',    'FOUNDER',    NULL,      NULL, NULL, NULL),
  ('Maya Pratiwi',        'finance@theunderwearsupply.id',    'FINANCE',    NULL,      NULL, NULL, NULL),
  ('Rudi Hartono',        'supervisor@theunderwearsupply.id', 'SUPERVISOR', NULL,      'SPV-001', crypt('1234', gen_salt('bf')), NULL),
  ('Hendra Ari Wardani',  'teknisi@theunderwearsupply.id',    'STAFF',      'TEKNISI', 'TK-001',  crypt('1234', gen_salt('bf')), NULL),
  ('Budi Gudang',         'gudang@theunderwearsupply.id',     'STAFF',      'GUDANG',  'GD-001',  crypt('1234', gen_salt('bf')), NULL),
  ('Agus Setiawan',       NULL, 'STAFF', 'CUTTING',  'OP-0118', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='CUT-1')),
  ('Siti Aminah',         NULL, 'STAFF', 'OPERATOR', 'OP-0231', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='SEW-2')),
  ('Rina Wulandari',      NULL, 'STAFF', 'OPERATOR', 'OP-0187', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='SEW-2')),
  ('Nur Halimah',         NULL, 'STAFF', 'OPERATOR', 'OP-0152', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='SEW-1')),
  ('Yuni Kartika',        NULL, 'STAFF', 'OPERATOR', 'OP-0209', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='SEW-1')),
  ('Dewi Lestari',        NULL, 'STAFF', 'OPERATOR', 'OP-0244', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='BND-1')),
  ('Lia Marlina',         NULL, 'STAFF', 'OPERATOR', 'OP-0273', crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='SEW-2')),
  ('Wati Rahayu',         NULL, 'STAFF', 'QC',       'QC-004',  crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='QC-1')),
  ('Sari Puspita',        NULL, 'STAFF', 'PACKING',  'PK-011',  crypt('1234', gen_salt('bf')), (SELECT id FROM erp.production_lines WHERE code='PCK-1'));

-- ---------------------------------------------------------------------
-- Tabel login: username + password (disimpan sebagai hash bcrypt)
-- Operator lantai produksi login di kios memakai kode operator + PIN.
-- ⚠ Password awal di bawah HANYA untuk inisiasi. Semua akun ditandai
--   must_change_password = true → wajib ganti saat login pertama.
-- ---------------------------------------------------------------------
INSERT INTO erp.user_logins (user_id, username, password_hash, must_change_password, password_changed_at)
SELECT u.id, x.username, crypt(x.pwd, gen_salt('bf', 10)), true, now()
FROM (VALUES
  ('admin@theunderwearsupply.id',      'admin',      'Admin#2026'),
  ('founder@theunderwearsupply.id',    'founder',    'Founder#2026'),
  ('finance@theunderwearsupply.id',    'finance',    'Finance#2026'),
  ('supervisor@theunderwearsupply.id', 'supervisor', 'Supervisor#2026'),
  ('teknisi@theunderwearsupply.id',    'hendra',     'Teknisi#2026'),
  ('gudang@theunderwearsupply.id',     'gudang',     'Gudang#2026')
) AS x(email, username, pwd)
JOIN erp.users u ON u.email = x.email;

-- Aktor untuk audit trail selama seed
DO $$ BEGIN PERFORM set_config('app.user_id', (SELECT user_id::text FROM erp.user_logins WHERE username = 'admin'), true); END $$;

-- ---------------------------------------------------------------------
-- Brand, klien, kanal, toko online
-- ---------------------------------------------------------------------
INSERT INTO erp.brands (code, name, brand_type) VALUES
  ('NQL', 'NAQALA WEAR', 'INTERNAL'),
  ('PUN', 'Pierre UNO',  'INTERNAL'),
  ('FNG', 'Finy Girls',  'INTERNAL'),
  ('BYS', 'Beyond Skin', 'INTERNAL');

INSERT INTO erp.customers (code, name, phone, address) VALUES
  ('CUS-001', 'Klien B2B Contoh', NULL, 'Ganti dengan data klien B2B riil');

INSERT INTO erp.sales_channels (code, name) VALUES
  ('SHOPEE', 'Shopee'), ('TIKTOK', 'TikTok Shop'), ('LAZADA', 'Lazada'), ('BLIBLI', 'Blibli');

INSERT INTO erp.online_stores (code, name) VALUES
  ('JIO', 'Toko JIO'), ('TUJ', 'Toko TUJ'), ('KRE', 'Toko KRE'), ('TUM', 'Toko TUM');

INSERT INTO erp.suppliers (code, name) VALUES
  ('SUP-001', 'Supplier Kain (contoh)'),
  ('SUP-002', 'Supplier Aksesoris (contoh)'),
  ('SUP-003', 'Supplier Spare Part (contoh)');

-- ---------------------------------------------------------------------
-- Material  (avg_cost = 0, terisi otomatis saat receiving POSTED)
-- ---------------------------------------------------------------------
INSERT INTO erp.materials (code, name, category, uom, is_lot_tracked, shrinkage_pct, min_stock) VALUES
  ('FAB-TR-01',   'Teteron Rayon',              'FABRIC',       'KG',  true,  3, 150),
  ('FAB-PSK-02',  'Polyester Single Knit',      'FABRIC',       'KG',  true,  2, 120),
  ('FAB-TS-30',   'TR Spandex 30s',             'FABRIC',       'KG',  true,  4, 200),
  ('ELS-WB-02',   'Karet Waistband 3 cm',       'ELASTIC',      'KG',  true,  0, 40),
  ('THR-OB-01',   'Benang Obras 40/2',          'THREAD',       'KG',  true,  0, 10),
  ('TPE-SB-01',   'Seamless Bonding Tape',      'BONDING_TAPE', 'KG',  true,  0, 8),
  ('ACC-LBL-01',  'Label Size & Care',          'ACCESSORY',    'PCS', false, 0, 3000),
  ('PKG-PB-2030', 'Polybag 20×30',              'PACKAGING',    'PCS', false, 0, 5000),
  ('PKG-BX-3IN1', 'Box Multipack 3-in-1',       'PACKAGING',    'PCS', false, 0, 2000),
  ('PKG-HT-NQL',  'Hang Tag NAQALA WEAR',       'PACKAGING',    'PCS', false, 0, 3000),
  ('SP-JRM-DB11', 'Jarum DBx1 #11',             'SPAREPART',    'PCS', false, 0, 200),
  ('SP-LPR-F007', 'Looper Siruba F007',         'SPAREPART',    'PCS', false, 0, 4),
  ('SP-OIL-01',   'Pelumas Mesin Jahit',        'SPAREPART',    'L',   false, 0, 10);

-- ---------------------------------------------------------------------
-- SKU & varian
-- ---------------------------------------------------------------------
INSERT INTO erp.skus (brand_id, code, name, category, pack_config, pack_qty, selling_price) VALUES
  ((SELECT id FROM erp.brands WHERE code='NQL'), 'NQL-BRF-001',    'Brief Wanita Basic',            'brief',    'SINGLE',    1, 12900),
  ((SELECT id FROM erp.brands WHERE code='NQL'), 'NQL-BRF-001-3P', 'Brief Wanita Basic 3-in-1',     'brief',    'MULTIPACK', 3, 34900),
  ((SELECT id FROM erp.brands WHERE code='PUN'), 'PUN-BXR-012',    'Boxer Pria Stretch',            'boxer',    'SINGLE',    1, 15900),
  ((SELECT id FROM erp.brands WHERE code='FNG'), 'FNG-KDS-007',    'Celana Dalam Anak Motif',       'kids',     'SINGLE',    1,  9900),
  ((SELECT id FROM erp.brands WHERE code='BYS'), 'BYS-SML-003',    'Seamless Brief Bonding',        'seamless', 'SINGLE',    1, 24900);

INSERT INTO erp.sku_variants (sku_id, size, size_order, color, barcode)
SELECT s.id, v.size, v.ord, v.color, s.code || '-' || v.size || '-' || v.ccode
FROM erp.skus s
JOIN (VALUES
  ('NQL-BRF-001','S',1,'Hitam','HTM'),('NQL-BRF-001','S',1,'Putih','PTH'),('NQL-BRF-001','S',1,'Nude','NUD'),
  ('NQL-BRF-001','M',2,'Hitam','HTM'),('NQL-BRF-001','M',2,'Putih','PTH'),('NQL-BRF-001','M',2,'Nude','NUD'),
  ('NQL-BRF-001','L',3,'Hitam','HTM'),('NQL-BRF-001','L',3,'Putih','PTH'),('NQL-BRF-001','L',3,'Nude','NUD'),
  ('NQL-BRF-001','XL',4,'Hitam','HTM'),('NQL-BRF-001','XL',4,'Putih','PTH'),('NQL-BRF-001','XL',4,'Nude','NUD'),
  ('NQL-BRF-001','XXL',5,'Hitam','HTM'),('NQL-BRF-001','XXL',5,'Putih','PTH'),('NQL-BRF-001','XXL',5,'Nude','NUD'),
  ('NQL-BRF-001-3P','M',2,'Mix Hitam/Putih/Nude','MIX'),('NQL-BRF-001-3P','L',3,'Mix Hitam/Putih/Nude','MIX'),
  ('PUN-BXR-012','M',2,'Navy','NVY'),('PUN-BXR-012','L',3,'Navy','NVY'),('PUN-BXR-012','XL',4,'Navy','NVY'),
  ('PUN-BXR-012','M',2,'Abu','ABU'),('PUN-BXR-012','L',3,'Abu','ABU'),('PUN-BXR-012','XL',4,'Abu','ABU'),
  ('FNG-KDS-007','4-6 th',1,'Pink Motif','PNK'),('FNG-KDS-007','6-8 th',2,'Pink Motif','PNK'),('FNG-KDS-007','8-10 th',3,'Pink Motif','PNK'),
  ('BYS-SML-003','S',1,'Nude','NUD'),('BYS-SML-003','M',2,'Nude','NUD'),('BYS-SML-003','L',3,'Nude','NUD'),
  ('BYS-SML-003','S',1,'Hitam','HTM'),('BYS-SML-003','M',2,'Hitam','HTM'),('BYS-SML-003','L',3,'Hitam','HTM')
) AS v(sku, size, ord, color, ccode) ON v.sku = s.code;

-- Komposisi multipack 3-in-1 (size M & L: Hitam + Putih + Nude)
INSERT INTO erp.pack_components (pack_variant_id, component_variant_id, qty)
SELECT pv.id, cv.id, 1
FROM erp.sku_variants pv JOIN erp.skus ps ON ps.id = pv.sku_id AND ps.code = 'NQL-BRF-001-3P'
JOIN erp.sku_variants cv ON cv.size = pv.size
JOIN erp.skus cs ON cs.id = cv.sku_id AND cs.code = 'NQL-BRF-001';

-- Material kemasan per pack FG
INSERT INTO erp.sku_packaging (sku_id, material_id, qty_per_pack)
SELECT s.id, m.id, x.qty FROM (VALUES
  ('NQL-BRF-001','PKG-PB-2030',1), ('NQL-BRF-001','PKG-HT-NQL',1),
  ('NQL-BRF-001-3P','PKG-BX-3IN1',1), ('NQL-BRF-001-3P','PKG-HT-NQL',1),
  ('PUN-BXR-012','PKG-PB-2030',1), ('FNG-KDS-007','PKG-PB-2030',1), ('BYS-SML-003','PKG-PB-2030',1)
) AS x(sku, mat, qty)
JOIN erp.skus s ON s.code = x.sku JOIN erp.materials m ON m.code = x.mat;

-- ---------------------------------------------------------------------
-- Operasi, SMV (menit/pcs), tarif borongan (Rp/pcs, efektif 1 Jan 2026)
-- ---------------------------------------------------------------------
INSERT INTO erp.operations (code, name, line_type, machine_type, smv_minutes) VALUES
  ('OP-OBR-SMP', 'Obras Samping',          'SEWING',  'Obras 4 benang',         0.60),
  ('OP-PSG-KRT', 'Pasang Karet',           'SEWING',  'Overdeck / flatlock',    0.90),
  ('OP-COV-PGG', 'Coverstitch Pinggang',   'SEWING',  'Coverstitch',            1.20),
  ('OP-COV-KAK', 'Coverstitch Kaki',       'SEWING',  'Coverstitch',            0.80),
  ('OP-JHT-KMP', 'Jahit Kampuh',           'SEWING',  'Jahit lurus',            0.70),
  ('OP-PSG-LBL', 'Pasang Label',           'SEWING',  'Jahit lurus',            0.25),
  ('OP-BND-HSL', 'Heat-Seal Bonding',      'BONDING', 'Heat-seal bonding',      1.50),
  ('OP-BND-TRM', 'Trimming Seamless',      'BONDING', 'Manual',                 0.40);

INSERT INTO erp.piece_rates (operation_id, rate_idr, effective_from)
SELECT o.id, r.rate, DATE '2026-01-01' FROM erp.operations o JOIN (VALUES
  ('OP-OBR-SMP', 400), ('OP-PSG-KRT', 450), ('OP-COV-PGG', 520), ('OP-COV-KAK', 380),
  ('OP-JHT-KMP', 380), ('OP-PSG-LBL', 120), ('OP-BND-HSL', 650), ('OP-BND-TRM', 200)
) AS r(code, rate) ON r.code = o.code;

INSERT INTO erp.sku_routings (sku_id, seq, operation_id)
SELECT s.id, x.seq, o.id FROM (VALUES
  ('NQL-BRF-001',1,'OP-OBR-SMP'), ('NQL-BRF-001',2,'OP-PSG-KRT'), ('NQL-BRF-001',3,'OP-COV-PGG'), ('NQL-BRF-001',4,'OP-COV-KAK'), ('NQL-BRF-001',5,'OP-PSG-LBL'),
  ('PUN-BXR-012',1,'OP-JHT-KMP'), ('PUN-BXR-012',2,'OP-OBR-SMP'), ('PUN-BXR-012',3,'OP-PSG-KRT'), ('PUN-BXR-012',4,'OP-COV-KAK'), ('PUN-BXR-012',5,'OP-PSG-LBL'),
  ('FNG-KDS-007',1,'OP-OBR-SMP'), ('FNG-KDS-007',2,'OP-PSG-KRT'), ('FNG-KDS-007',3,'OP-COV-KAK'), ('FNG-KDS-007',4,'OP-PSG-LBL'),
  ('BYS-SML-003',1,'OP-BND-HSL'), ('BYS-SML-003',2,'OP-BND-TRM')
) AS x(sku, seq, op)
JOIN erp.skus s ON s.code = x.sku JOIN erp.operations o ON o.code = x.op;

-- ---------------------------------------------------------------------
-- BOM v1 (gram/pcs) — dibuat Draft lalu diaktifkan lewat fn_activate_bom
-- ---------------------------------------------------------------------
INSERT INTO erp.boms (sku_id, version, status, notes, created_by)
SELECT id, 1, 'DRAFT', 'BOM awal (contoh, validasi dengan time study & uji potong)', (SELECT user_id FROM erp.user_logins WHERE username = 'admin')
FROM erp.skus WHERE pack_config = 'SINGLE';

INSERT INTO erp.bom_lines (bom_id, size, material_id, qty_per_pcs, qty_unit, is_main_fabric)
SELECT b.id, x.size, m.id, x.qty, x.unit::erp.bom_qty_unit, x.main
FROM (VALUES
  -- NAQALA WEAR Brief: Teteron Rayon + karet + benang + label
  ('NQL-BRF-001','S','FAB-TR-01',72,'GRAM',true), ('NQL-BRF-001','S','ELS-WB-02',13,'GRAM',false), ('NQL-BRF-001','S','THR-OB-01',2.3,'GRAM',false), ('NQL-BRF-001','S','ACC-LBL-01',1,'PCS',false),
  ('NQL-BRF-001','M','FAB-TR-01',80,'GRAM',true), ('NQL-BRF-001','M','ELS-WB-02',15,'GRAM',false), ('NQL-BRF-001','M','THR-OB-01',2.5,'GRAM',false), ('NQL-BRF-001','M','ACC-LBL-01',1,'PCS',false),
  ('NQL-BRF-001','L','FAB-TR-01',88,'GRAM',true), ('NQL-BRF-001','L','ELS-WB-02',16,'GRAM',false), ('NQL-BRF-001','L','THR-OB-01',2.7,'GRAM',false), ('NQL-BRF-001','L','ACC-LBL-01',1,'PCS',false),
  ('NQL-BRF-001','XL','FAB-TR-01',96,'GRAM',true), ('NQL-BRF-001','XL','ELS-WB-02',17,'GRAM',false), ('NQL-BRF-001','XL','THR-OB-01',2.9,'GRAM',false), ('NQL-BRF-001','XL','ACC-LBL-01',1,'PCS',false),
  ('NQL-BRF-001','XXL','FAB-TR-01',104,'GRAM',true), ('NQL-BRF-001','XXL','ELS-WB-02',18,'GRAM',false), ('NQL-BRF-001','XXL','THR-OB-01',3.1,'GRAM',false), ('NQL-BRF-001','XXL','ACC-LBL-01',1,'PCS',false),
  -- Pierre UNO Boxer: TR Spandex 30s
  ('PUN-BXR-012','M','FAB-TS-30',92,'GRAM',true), ('PUN-BXR-012','M','ELS-WB-02',18,'GRAM',false), ('PUN-BXR-012','M','THR-OB-01',3.0,'GRAM',false), ('PUN-BXR-012','M','ACC-LBL-01',1,'PCS',false),
  ('PUN-BXR-012','L','FAB-TS-30',98,'GRAM',true), ('PUN-BXR-012','L','ELS-WB-02',19,'GRAM',false), ('PUN-BXR-012','L','THR-OB-01',3.2,'GRAM',false), ('PUN-BXR-012','L','ACC-LBL-01',1,'PCS',false),
  ('PUN-BXR-012','XL','FAB-TS-30',105,'GRAM',true), ('PUN-BXR-012','XL','ELS-WB-02',20,'GRAM',false), ('PUN-BXR-012','XL','THR-OB-01',3.4,'GRAM',false), ('PUN-BXR-012','XL','ACC-LBL-01',1,'PCS',false),
  -- Finy Girls Kids: Polyester Single Knit
  ('FNG-KDS-007','4-6 th','FAB-PSK-02',38,'GRAM',true), ('FNG-KDS-007','4-6 th','ELS-WB-02',8,'GRAM',false), ('FNG-KDS-007','4-6 th','THR-OB-01',1.5,'GRAM',false), ('FNG-KDS-007','4-6 th','ACC-LBL-01',1,'PCS',false),
  ('FNG-KDS-007','6-8 th','FAB-PSK-02',42,'GRAM',true), ('FNG-KDS-007','6-8 th','ELS-WB-02',9,'GRAM',false), ('FNG-KDS-007','6-8 th','THR-OB-01',1.6,'GRAM',false), ('FNG-KDS-007','6-8 th','ACC-LBL-01',1,'PCS',false),
  ('FNG-KDS-007','8-10 th','FAB-PSK-02',46,'GRAM',true), ('FNG-KDS-007','8-10 th','ELS-WB-02',10,'GRAM',false), ('FNG-KDS-007','8-10 th','THR-OB-01',1.7,'GRAM',false), ('FNG-KDS-007','8-10 th','ACC-LBL-01',1,'PCS',false),
  -- Beyond Skin Seamless: TR Spandex + bonding tape (tanpa benang)
  ('BYS-SML-003','S','FAB-TS-30',64,'GRAM',true), ('BYS-SML-003','S','TPE-SB-01',6,'GRAM',false), ('BYS-SML-003','S','ACC-LBL-01',1,'PCS',false),
  ('BYS-SML-003','M','FAB-TS-30',70,'GRAM',true), ('BYS-SML-003','M','TPE-SB-01',6.5,'GRAM',false), ('BYS-SML-003','M','ACC-LBL-01',1,'PCS',false),
  ('BYS-SML-003','L','FAB-TS-30',76,'GRAM',true), ('BYS-SML-003','L','TPE-SB-01',7,'GRAM',false), ('BYS-SML-003','L','ACC-LBL-01',1,'PCS',false)
) AS x(sku, size, mat, qty, unit, main)
JOIN erp.skus s ON s.code = x.sku
JOIN erp.boms b ON b.sku_id = s.id AND b.version = 1
JOIN erp.materials m ON m.code = x.mat;

DO $$
DECLARE b record;
BEGIN
  FOR b IN SELECT id FROM erp.boms WHERE status = 'DRAFT' AND version = 1 LOOP
    PERFORM erp.fn_activate_bom(b.id, (SELECT user_id FROM erp.user_logins WHERE username = 'admin'));
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Mesin (teknisi penanggung jawab: Hendra Ari Wardani)
-- ---------------------------------------------------------------------
INSERT INTO erp.machines (asset_code, brand_model, machine_type, line_id, technician_id, purchase_date)
SELECT x.code, x.model, x.type, (SELECT id FROM erp.production_lines WHERE code = x.line),
       (SELECT id FROM erp.users WHERE operator_code = 'TK-001'), x.bought::date
FROM (VALUES
  ('MC-SRB-F007-01', 'Siruba F007',    'Overdeck / coverstitch', 'SEW-1', '2023-03-01'),
  ('MC-SRB-F007-03', 'Siruba F007',    'Overdeck / coverstitch', 'SEW-2', '2023-03-01'),
  ('MC-LR356-01',    'Lingrai LR-356', 'Coverstitch',            'SEW-2', '2024-06-15'),
  ('MC-OBR-04',      'Obras 4 Benang', 'Obras',                  'SEW-1', '2022-11-10'),
  ('MC-JHT-02',      'Jahit Lurus',    'Lockstitch',             'SEW-1', '2022-11-10'),
  ('MC-BND-01',      'Heat-Seal Bonding', 'Seamless bonding',    'BND-1', '2025-01-20'),
  ('MC-BND-02',      'Heat-Seal Bonding', 'Seamless bonding',    'BND-1', '2025-01-20')
) AS x(code, model, type, line, bought);

-- ---------------------------------------------------------------------
-- Kategori cacat (FR-05.1) + operasi tujuan rework default
-- ---------------------------------------------------------------------
INSERT INTO erp.defect_categories (code, name, default_operation_id) VALUES
  ('JAHITAN_LOMPAT',     'Jahitan Lompat',      (SELECT id FROM erp.operations WHERE code='OP-COV-PGG')),
  ('BONDING_TAPE_LEPAS', 'Bonding Tape Lepas',  (SELECT id FROM erp.operations WHERE code='OP-BND-HSL')),
  ('KARET_MELINTIR',     'Karet Melintir',      (SELECT id FROM erp.operations WHERE code='OP-PSG-KRT')),
  ('UKURAN_ASIMETRIS',   'Ukuran Asimetris',    (SELECT id FROM erp.operations WHERE code='OP-OBR-SMP')),
  ('NODA',               'Noda',                NULL),
  ('LUBANG_KAIN',        'Lubang Kain',         NULL),
  ('LABEL_SALAH',        'Label Salah/Miring',  (SELECT id FROM erp.operations WHERE code='OP-PSG-LBL'));

-- Penomoran SPK lanjut dari SPK-2026-0100 (menyamakan dengan prototipe)
INSERT INTO erp.doc_counters (prefix, year, last_no) VALUES ('SPK', 2026, 100)
ON CONFLICT (prefix, year) DO UPDATE SET last_no = EXCLUDED.last_no;

COMMIT;
