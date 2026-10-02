-- =====================================================================
--  Garment ERP — THEUNDERWEARSUPPLY (Pabrik Tangerang)
--  01_schema.sql  ·  extension, enum, tabel, constraint, index
-- ---------------------------------------------------------------------
--  Target   : PostgreSQL 15+ (diuji di PostgreSQL 16). Kompatibel Supabase.
--  Schema   : erp   (Supabase: tambahkan "erp" di Settings → API → Exposed schemas)
--  Urutan   : 01_schema → 02_functions_triggers → 03_views → 04_seed_master
--             → 05_demo_flow (opsional, data transaksi contoh)
--  Sumber   : PRD_Garment_ERP.md, FRD_Garment_ERP (FR-00 s/d FR-07), IA_Garment_ERP.md
--
--  Konvensi :
--   • Stok bahan baku dalam Kg (numeric 12,3); BOM per pcs dalam gram (numeric 10,2).
--   • Uang dalam IDR numeric(14,2). Waktu disimpan timestamptz (UTC),
--     laporan dikonversi ke WIB (Asia/Jakarta).
--   • Nama tabel/kolom bahasa Inggris, komentar & pesan error bahasa Indonesia.
--   • Aktor perubahan dibaca dari setting sesi:  SET LOCAL app.user_id = '<id>';
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- hash PIN/password, gen_random_uuid
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- exclusion constraint periode payroll

CREATE SCHEMA IF NOT EXISTS erp;
SET search_path = erp, public;

-- =====================================================================
-- ENUM
-- =====================================================================
CREATE TYPE erp.user_role          AS ENUM ('ADMIN','FOUNDER','FINANCE','SUPERVISOR','STAFF');
CREATE TYPE erp.staff_function     AS ENUM ('GUDANG','CUTTING','OPERATOR','QC','PACKING','TEKNISI');
CREATE TYPE erp.record_status      AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE erp.app_module         AS ENUM ('USER_MGMT','BOM','SMV_RATE','BRAND_SKU','SAMPLE','MACHINE',
                                            'RECEIVING','STOCK','WORK_ORDER','CUTTING','BUNDLE','WIP_SCAN',
                                            'DOWNTIME','QC','TRACEABILITY','RETURN','PACKING','DISPATCH',
                                            'PAYROLL','COSTING','ANALYTICS','AUDIT');
CREATE TYPE erp.notification_type  AS ENUM ('STOCK_CRITICAL','DEFECT_THRESHOLD','DOWNTIME_NEW','DOWNTIME_ESCALATION',
                                            'RECEIVING_VARIANCE','COST_VARIANCE','PAYROLL_READY','SCAN_ANOMALY',
                                            'WO_CLOSED');

CREATE TYPE erp.brand_type         AS ENUM ('INTERNAL','B2B_CLIENT');
CREATE TYPE erp.pack_config        AS ENUM ('SINGLE','MULTIPACK');
CREATE TYPE erp.material_category  AS ENUM ('FABRIC','ELASTIC','THREAD','BONDING_TAPE','ACCESSORY','PACKAGING','SPAREPART');
CREATE TYPE erp.uom                AS ENUM ('KG','PCS','M','L');
CREATE TYPE erp.bom_qty_unit       AS ENUM ('GRAM','PCS','CM');
CREATE TYPE erp.bom_status         AS ENUM ('DRAFT','ACTIVE','ARCHIVED');
CREATE TYPE erp.line_type          AS ENUM ('CUTTING','SEWING','BONDING','QC','PACKING');
CREATE TYPE erp.machine_status     AS ENUM ('RUNNING','MAINTENANCE','DOWN','INACTIVE');
CREATE TYPE erp.sample_status      AS ENUM ('REQUESTED','IN_PROGRESS','APPROVED','REVISION','REJECTED');

CREATE TYPE erp.receipt_status     AS ENUM ('DRAFT','PENDING_APPROVAL','POSTED','CANCELLED');
CREATE TYPE erp.material_qc_status AS ENUM ('PASS','HOLD','REJECT');
CREATE TYPE erp.stock_movement_type AS ENUM ('RECEIPT','ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_SAMPLE',
                                             'ISSUE_PACKING','ISSUE_MAINTENANCE','ADJUSTMENT','RETURN_TO_SUPPLIER');
CREATE TYPE erp.allocation_status  AS ENUM ('RESERVED','CONSUMED','RELEASED');
CREATE TYPE erp.approval_status    AS ENUM ('PENDING','APPROVED','REJECTED');

CREATE TYPE erp.wo_status          AS ENUM ('DRAFT','ACTIVE','CLOSED','CANCELLED');
CREATE TYPE erp.wo_destination     AS ENUM ('B2B','INTERNAL_STOCK','ECOMMERCE');
CREATE TYPE erp.close_type         AS ENUM ('AUTO','MANUAL');
CREATE TYPE erp.bundle_status      AS ENUM ('CREATED','IN_PROGRESS','SEWN','INSPECTED','VOID');
CREATE TYPE erp.scan_source        AS ENUM ('ONLINE','OFFLINE_SYNC','MANUAL_CORRECTION');
CREATE TYPE erp.ticket_status      AS ENUM ('OPEN','IN_PROGRESS','RESOLVED');
CREATE TYPE erp.scrap_method       AS ENUM ('SOLD','DISCARDED');

CREATE TYPE erp.qc_outcome         AS ENUM ('REWORK','REJECT');
CREATE TYPE erp.fg_grade           AS ENUM ('A','B');
CREATE TYPE erp.return_source      AS ENUM ('B2B','ECOMMERCE');
CREATE TYPE erp.return_grade       AS ENUM ('RESTOCK_A','B_GRADE','REWORK','DESTROY');

CREATE TYPE erp.pack_status        AS ENUM ('OPEN','CONFIRMED','CANCELLED');
CREATE TYPE erp.fg_movement_type   AS ENUM ('PACKING_IN','RETURN_IN','DISPATCH_B2B','DISPATCH_ECOM','ADJUSTMENT');
CREATE TYPE erp.dispatch_status    AS ENUM ('DRAFT','APPROVED','SHIPPED','CANCELLED');
CREATE TYPE erp.ecom_status        AS ENUM ('IMPORTED','ON_HOLD','PACKED','SHIPPED','CANCELLED');

CREATE TYPE erp.payroll_frequency  AS ENUM ('WEEKLY','BIWEEKLY','MONTHLY');
CREATE TYPE erp.payroll_status     AS ENUM ('DRAFT','APPROVED');
CREATE TYPE erp.overhead_category  AS ENUM ('ELECTRICITY','MAINTENANCE','SPAREPART','OPERATIONAL','RENT','SCRAP_SALE_CREDIT','OTHER');
CREATE TYPE erp.period_status      AS ENUM ('OPEN','LOCKED');
CREATE TYPE erp.costing_status     AS ENUM ('PROVISIONAL','FINAL');

-- =====================================================================
-- FR-00  SECURITY, SETTINGS, AUDIT, NOTIFIKASI
-- =====================================================================
CREATE TABLE erp.production_lines (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,                 -- SEW-1, BND-1, CUT-1
  name        text NOT NULL,                        -- "Sewing Line 1"
  line_type   erp.line_type NOT NULL,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.users (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name           text NOT NULL,
  email               text,                          -- dipakai juga untuk SSO Google
  google_sub          text UNIQUE,                   -- subject ID OAuth Google
  role                erp.user_role NOT NULL,
  staff_function      erp.staff_function,            -- wajib untuk role STAFF
  operator_code       text UNIQUE,                   -- OP-0231, QC-004 (login kios)
  pin_hash            text,                          -- PIN kios (bcrypt)
  line_id             smallint REFERENCES erp.production_lines(id),
  status              erp.record_status NOT NULL DEFAULT 'ACTIVE',
  failed_login_count  smallint NOT NULL DEFAULT 0,  -- percobaan PIN kios gagal
  locked_until        timestamptz,                   -- kunci PIN kios
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deactivated_at      timestamptz,
  CONSTRAINT users_login_ck    CHECK (email IS NOT NULL OR operator_code IS NOT NULL),
  CONSTRAINT users_staff_fn_ck CHECK ((role = 'STAFF') = (staff_function IS NOT NULL)),
  CONSTRAINT users_inactive_ck CHECK (status = 'ACTIVE' OR deactivated_at IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_uq    ON erp.users (lower(email))    WHERE email IS NOT NULL;
COMMENT ON TABLE erp.users IS 'FR-00.1/00.3 — profil & role. Akun tidak dihapus permanen, hanya dinonaktifkan (histori payroll & traceability). Kredensial web ada di user_logins, PIN kios di pin_hash.';

-- Tabel login (FR-00.1): username + password (bcrypt). Satu baris per user yang boleh login web/mobile.
CREATE TABLE erp.user_logins (
  user_id               bigint PRIMARY KEY REFERENCES erp.users(id),
  username              text NOT NULL,
  password_hash         text NOT NULL,                 -- bcrypt (pgcrypto crypt/gen_salt('bf')); tidak pernah plaintext
  must_change_password  boolean NOT NULL DEFAULT true, -- wajib ganti saat login pertama / setelah reset Admin
  password_changed_at   timestamptz,
  failed_count          smallint NOT NULL DEFAULT 0,
  locked_until          timestamptz,                   -- dikunci 15 menit setelah 5x gagal
  last_login_at         timestamptz,
  last_login_ip         inet,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_logins_username_ck CHECK (username ~ '^[a-z0-9._-]{3,50}$'),
  CONSTRAINT user_logins_hash_ck     CHECK (password_hash LIKE '$2%')   -- harus hash bcrypt
);
CREATE UNIQUE INDEX user_logins_username_uq ON erp.user_logins (lower(username));
COMMENT ON TABLE erp.user_logins IS 'Kredensial login standar (username/email + password). Ubah password hanya lewat fn_set_password.';

CREATE TYPE erp.login_method AS ENUM ('PASSWORD','GOOGLE','PIN');

CREATE TABLE erp.login_attempts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  method          erp.login_method NOT NULL,
  login_input     text NOT NULL,                       -- username/email/kode operator yang diketik
  user_id         bigint REFERENCES erp.users(id),     -- NULL bila akun tidak dikenal
  success         boolean NOT NULL,
  failure_reason  text,                                -- BAD_CREDENTIALS, LOCKED, INACTIVE, UNKNOWN_USER
  ip_address      inet,
  user_agent      text
);
CREATE INDEX login_attempts_user_idx ON erp.login_attempts (user_id, attempted_at DESC);
CREATE INDEX login_attempts_time_idx ON erp.login_attempts (attempted_at DESC);
COMMENT ON TABLE erp.login_attempts IS 'FR-00.1 — semua percobaan login (berhasil/gagal) dicatat.';

CREATE TABLE erp.session_policies (
  role          erp.user_role PRIMARY KEY,
  idle_minutes  smallint NOT NULL CHECK (idle_minutes BETWEEN 5 AND 480),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE erp.session_policies IS 'FR-00.2 — batas idle auto-logout per role.';

CREATE TABLE erp.user_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             bigint NOT NULL REFERENCES erp.users(id),
  refresh_token_hash  text NOT NULL,
  device_label        text,                           -- "Kios Sewing 2", "Chrome Desktop"
  ip_address          inet,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_activity_at    timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz
);
CREATE INDEX user_sessions_user_idx ON erp.user_sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE erp.role_permissions (
  role         erp.user_role NOT NULL,
  module       erp.app_module NOT NULL,
  can_create   boolean NOT NULL DEFAULT false,
  can_read     boolean NOT NULL DEFAULT false,
  can_update   boolean NOT NULL DEFAULT false,
  can_delete   boolean NOT NULL DEFAULT false,
  can_approve  boolean NOT NULL DEFAULT false,
  scope_note   text,                                 -- "tanpa harga", "slip milik sendiri"
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module),
  -- Aturan mutlak PRD: Costing/HPP terkunci untuk Supervisor & Staff; Payroll terkunci untuk Supervisor.
  CONSTRAINT costing_lock_ck CHECK (NOT (
        module = 'COSTING' AND role IN ('SUPERVISOR','STAFF')
        AND (can_create OR can_read OR can_update OR can_delete OR can_approve))),
  CONSTRAINT payroll_lock_ck CHECK (NOT (
        module = 'PAYROLL' AND role = 'SUPERVISOR'
        AND (can_create OR can_read OR can_update OR can_delete OR can_approve)))
);

CREATE TABLE erp.system_settings (
  key          text PRIMARY KEY,
  value        jsonb NOT NULL,
  description  text,
  updated_by   bigint REFERENCES erp.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE erp.system_settings IS 'Threshold & default: toleransi receiving, over-cut, variance, defect rate, ukuran bundel, dll.';

CREATE TABLE erp.doc_counters (
  prefix   text NOT NULL,                            -- SPK, GR, CUT, DT, DO, ADJ, SCR, RTN
  year     smallint NOT NULL,
  last_no  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);
COMMENT ON TABLE erp.doc_counters IS 'Penomoran dokumen per tahun: SPK-2026-0101, GR-2026-0001, dst.';

CREATE TABLE erp.audit_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  user_id      bigint REFERENCES erp.users(id),
  action       text NOT NULL,                        -- INSERT/UPDATE/DELETE/LOGIN/ACCESS_DENIED/REPRINT
  entity       text NOT NULL,                        -- nama tabel / modul
  entity_id    text,
  old_value    jsonb,
  new_value    jsonb,
  ip_address   inet,
  note         text
);
CREATE INDEX audit_logs_entity_idx ON erp.audit_logs (entity, entity_id);
CREATE INDEX audit_logs_time_idx   ON erp.audit_logs (occurred_at DESC);

CREATE TABLE erp.notifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint REFERENCES erp.users(id),      -- penerima spesifik, atau
  target_role  erp.user_role,                        -- semua user dengan role ini
  type         erp.notification_type NOT NULL,
  title        text NOT NULL,
  body         text,
  entity       text,
  entity_id    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  CONSTRAINT notif_target_ck CHECK (user_id IS NOT NULL OR target_role IS NOT NULL)
);
CREATE INDEX notifications_user_unread_idx ON erp.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX notifications_role_unread_idx ON erp.notifications (target_role) WHERE read_at IS NULL;

-- =====================================================================
-- FR-01  MASTER DATA (ENGINEERING)
-- =====================================================================
CREATE TABLE erp.brands (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,                  -- NQL, PUN, FNG, BYS
  name        text NOT NULL,
  brand_type  erp.brand_type NOT NULL,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.customers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  brand_id    bigint REFERENCES erp.brands(id),     -- brand milik klien B2B (jika ada)
  phone       text,
  address     text,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.sales_channels (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,                  -- SHOPEE, TIKTOK, LAZADA, BLIBLI
  name        text NOT NULL
);

CREATE TABLE erp.online_stores (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,                  -- JIO, TUJ, KRE, TUM
  name        text NOT NULL,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE erp.skus (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_id      bigint NOT NULL REFERENCES erp.brands(id),
  code          text NOT NULL UNIQUE,                -- NQL-BRF-001
  name          text NOT NULL,
  category      text NOT NULL,                       -- brief, boxer, bra, kids, seamless
  pack_config   erp.pack_config NOT NULL DEFAULT 'SINGLE',
  pack_qty      smallint NOT NULL DEFAULT 1 CHECK (pack_qty BETWEEN 1 AND 12),
  selling_price numeric(14,2) CHECK (selling_price >= 0),  -- untuk margin (opsional)
  status        erp.record_status NOT NULL DEFAULT 'ACTIVE',
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_pack_ck CHECK ((pack_config = 'SINGLE') = (pack_qty = 1))
);

CREATE TABLE erp.sku_variants (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku_id      bigint NOT NULL REFERENCES erp.skus(id),
  size        text NOT NULL,                         -- S, M, L, XL, XXL, "6-8 th"
  size_order  smallint NOT NULL DEFAULT 0,
  color       text NOT NULL,
  barcode     text UNIQUE,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (sku_id, size, color)
);

-- Komposisi multipack: varian FG multipack = beberapa varian komponen (mis. 3-in-1 Hitam/Putih/Nude).
CREATE TABLE erp.pack_components (
  pack_variant_id       bigint NOT NULL REFERENCES erp.sku_variants(id),
  component_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty                   smallint NOT NULL CHECK (qty > 0),
  PRIMARY KEY (pack_variant_id, component_variant_id),
  CHECK (pack_variant_id <> component_variant_id)
);

CREATE TABLE erp.suppliers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  phone       text,
  address     text,
  status      erp.record_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE erp.materials (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code             text NOT NULL UNIQUE,             -- FAB-TR-01
  name             text NOT NULL,
  category         erp.material_category NOT NULL,
  uom              erp.uom NOT NULL,
  is_lot_tracked   boolean NOT NULL DEFAULT true,    -- wajib lot: kain, karet, benang
  shrinkage_pct    numeric(5,2) NOT NULL DEFAULT 0 CHECK (shrinkage_pct BETWEEN 0 AND 20),
  min_stock        numeric(12,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  avg_cost         numeric(14,2) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),  -- moving average per uom
  status           erp.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_uom_ck CHECK (
      (category IN ('FABRIC','ELASTIC','THREAD','BONDING_TAPE') AND uom = 'KG')
   OR (category NOT IN ('FABRIC','ELASTIC','THREAD','BONDING_TAPE')))
);
COMMENT ON COLUMN erp.materials.avg_cost IS 'Harga rata-rata bergerak (moving average) per Kg/pcs/L — diperbarui saat receiving POSTED.';

CREATE TABLE erp.boms (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku_id          bigint NOT NULL REFERENCES erp.skus(id),
  version         smallint NOT NULL CHECK (version > 0),
  status          erp.bom_status NOT NULL DEFAULT 'DRAFT',
  source_sample_id bigint,                           -- FK ditambahkan setelah tabel samples
  notes           text,
  created_by      bigint REFERENCES erp.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  UNIQUE (sku_id, version)
);
CREATE UNIQUE INDEX boms_one_active_uq ON erp.boms (sku_id) WHERE status = 'ACTIVE';

CREATE TABLE erp.bom_lines (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bom_id          bigint NOT NULL REFERENCES erp.boms(id) ON DELETE CASCADE,
  size            text NOT NULL,                     -- BOM per size (warna tidak mengubah gramasi)
  material_id     bigint NOT NULL REFERENCES erp.materials(id),
  qty_per_pcs     numeric(10,2) NOT NULL CHECK (qty_per_pcs > 0),
  qty_unit        erp.bom_qty_unit NOT NULL DEFAULT 'GRAM',
  is_main_fabric  boolean NOT NULL DEFAULT false,
  shrinkage_pct   numeric(5,2) CHECK (shrinkage_pct BETWEEN 0 AND 20),  -- NULL = pakai default material
  UNIQUE (bom_id, size, material_id)
);
COMMENT ON TABLE erp.bom_lines IS 'FR-01.1 — resep material berbasis berat. GRAM untuk kain/karet/benang/tape; PCS untuk label/aksesoris.';

CREATE TABLE erp.operations (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          text NOT NULL UNIQUE,                -- OP-COV-PGG
  name          text NOT NULL,                       -- "Coverstitch Pinggang"
  line_type     erp.line_type NOT NULL,
  machine_type  text,                                -- overdeck, obras 4 benang, heat-seal
  smv_minutes   numeric(7,3) NOT NULL CHECK (smv_minutes > 0),
  status        erp.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.piece_rates (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id    bigint NOT NULL REFERENCES erp.operations(id),
  rate_idr        numeric(12,2) NOT NULL CHECK (rate_idr >= 0),
  effective_from  date NOT NULL,
  created_by      bigint REFERENCES erp.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id, effective_from)
);
COMMENT ON TABLE erp.piece_rates IS 'FR-01.2 — tarif borongan per pcs dengan tanggal efektif (tidak boleh mundur ke periode payroll yang sudah di-approve).';

CREATE TABLE erp.sku_routings (
  sku_id        bigint NOT NULL REFERENCES erp.skus(id),
  seq           smallint NOT NULL CHECK (seq > 0),
  operation_id  bigint NOT NULL REFERENCES erp.operations(id),
  PRIMARY KEY (sku_id, seq),
  UNIQUE (sku_id, operation_id)
);

CREATE TABLE erp.sku_packaging (
  sku_id        bigint NOT NULL REFERENCES erp.skus(id),
  material_id   bigint NOT NULL REFERENCES erp.materials(id),
  qty_per_pack  numeric(8,2) NOT NULL CHECK (qty_per_pack > 0),
  PRIMARY KEY (sku_id, material_id)
);
COMMENT ON TABLE erp.sku_packaging IS 'Material kemasan per pack FG (polybag, box, hang tag) — dipotong otomatis saat pack dikonfirmasi.';

CREATE TABLE erp.machines (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_code     text NOT NULL UNIQUE,              -- MC-SRB-F007-03
  brand_model    text NOT NULL,                     -- Siruba F007, Lingrai LR-356
  machine_type   text NOT NULL,
  line_id        smallint REFERENCES erp.production_lines(id),
  technician_id  bigint REFERENCES erp.users(id),
  purchase_date  date,
  status         erp.machine_status NOT NULL DEFAULT 'RUNNING',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.samples (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sample_no     text NOT NULL UNIQUE,
  sku_id        bigint REFERENCES erp.skus(id),     -- NULL = SKU baru belum terdaftar
  proposed_name text,
  size          text NOT NULL,
  color         text NOT NULL,
  status        erp.sample_status NOT NULL DEFAULT 'REQUESTED',
  requested_by  bigint NOT NULL REFERENCES erp.users(id),
  decided_by    bigint REFERENCES erp.users(id),
  decided_at    timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (sku_id IS NOT NULL OR proposed_name IS NOT NULL)
);
ALTER TABLE erp.boms ADD CONSTRAINT boms_sample_fk FOREIGN KEY (source_sample_id) REFERENCES erp.samples(id);

CREATE TABLE erp.sample_operation_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sample_id     bigint NOT NULL REFERENCES erp.samples(id) ON DELETE CASCADE,
  operation_id  bigint NOT NULL REFERENCES erp.operations(id),
  minutes       numeric(7,2) NOT NULL CHECK (minutes > 0),
  operator_id   bigint REFERENCES erp.users(id)
);

-- =====================================================================
-- FR-02  INVENTORY & RECEIVING
-- =====================================================================
CREATE TABLE erp.goods_receipts (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_no         text NOT NULL UNIQUE,           -- GR-2026-0001
  delivery_note_no   text NOT NULL,                  -- SJ/2026/09/0045
  supplier_id        bigint NOT NULL REFERENCES erp.suppliers(id),
  received_at        timestamptz NOT NULL DEFAULT now(),
  status             erp.receipt_status NOT NULL DEFAULT 'DRAFT',
  received_by        bigint NOT NULL REFERENCES erp.users(id),
  approved_by        bigint REFERENCES erp.users(id),
  approved_at        timestamptz,
  posted_at          timestamptz,
  notes              text,
  UNIQUE (supplier_id, delivery_note_no)
);

CREATE TABLE erp.goods_receipt_items (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id       bigint NOT NULL REFERENCES erp.goods_receipts(id) ON DELETE CASCADE,
  material_id      bigint NOT NULL REFERENCES erp.materials(id),
  lot_no           text,
  rolls            smallint CHECK (rolls >= 0),
  doc_qty          numeric(12,3) NOT NULL CHECK (doc_qty > 0),     -- berat/qty di surat jalan
  actual_qty       numeric(12,3) NOT NULL CHECK (actual_qty > 0),  -- hasil timbang re-roll
  variance_pct     numeric(7,2) GENERATED ALWAYS AS (round((actual_qty - doc_qty) / doc_qty * 100, 2)) STORED,
  price_per_uom    numeric(14,2) NOT NULL CHECK (price_per_uom >= 0),
  qc_status        erp.material_qc_status NOT NULL DEFAULT 'PASS',
  shrinkage_test_pct numeric(5,2),
  is_manual_entry  boolean NOT NULL DEFAULT false,   -- timbangan offline → input manual
  notes            text
);

CREATE TABLE erp.material_lots (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_id     bigint NOT NULL REFERENCES erp.materials(id),
  lot_no          text NOT NULL,                     -- 'NO-LOT' untuk material non-lot
  supplier_id     bigint REFERENCES erp.suppliers(id),
  receipt_item_id bigint REFERENCES erp.goods_receipt_items(id),
  received_at     timestamptz NOT NULL DEFAULT now(),
  unit_cost       numeric(14,2) NOT NULL DEFAULT 0,
  qc_status       erp.material_qc_status NOT NULL DEFAULT 'PASS',
  qty_on_hand     numeric(12,3) NOT NULL DEFAULT 0,
  qty_reserved    numeric(12,3) NOT NULL DEFAULT 0,
  UNIQUE (material_id, lot_no),
  CONSTRAINT lot_no_negative_ck CHECK (qty_on_hand >= 0),
  CONSTRAINT lot_reserve_ck     CHECK (qty_reserved >= 0 AND qty_reserved <= qty_on_hand)
);
COMMENT ON TABLE erp.material_lots IS 'Saldo per lot. Diubah HANYA lewat trigger dari stock_movements (on_hand) dan material_allocations (reserved).';

CREATE TABLE erp.stock_movements (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  moved_at       timestamptz NOT NULL DEFAULT now(),
  movement_type  erp.stock_movement_type NOT NULL,
  lot_id         bigint NOT NULL REFERENCES erp.material_lots(id),
  material_id    bigint NOT NULL REFERENCES erp.materials(id),
  qty            numeric(12,3) NOT NULL CHECK (qty <> 0),   -- + masuk, − keluar
  unit_cost      numeric(14,2) NOT NULL DEFAULT 0,
  work_order_id  bigint,                              -- FK ditambahkan setelah work_orders
  ref_table      text,                                -- goods_receipt_items, cutting_records, ...
  ref_id         bigint,
  user_id        bigint REFERENCES erp.users(id),
  reason         text,
  CONSTRAINT movement_sign_ck CHECK (
      (movement_type IN ('RECEIPT') AND qty > 0)
   OR (movement_type IN ('ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_SAMPLE','ISSUE_PACKING','ISSUE_MAINTENANCE','RETURN_TO_SUPPLIER') AND qty < 0)
   OR (movement_type = 'ADJUSTMENT'))
);
CREATE INDEX stock_movements_lot_idx ON erp.stock_movements (lot_id, moved_at);
CREATE INDEX stock_movements_wo_idx  ON erp.stock_movements (work_order_id) WHERE work_order_id IS NOT NULL;
COMMENT ON TABLE erp.stock_movements IS 'Kartu stok (ledger) — immutable. Koreksi lewat ADJUSTMENT, bukan UPDATE/DELETE.';

CREATE TABLE erp.stock_adjustments (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adj_no        text NOT NULL UNIQUE,
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  is_opname     boolean NOT NULL DEFAULT false,
  status        erp.approval_status NOT NULL DEFAULT 'PENDING',
  requested_by  bigint NOT NULL REFERENCES erp.users(id),
  approved_by   bigint REFERENCES erp.users(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.stock_adjustment_items (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adjustment_id  bigint NOT NULL REFERENCES erp.stock_adjustments(id) ON DELETE CASCADE,
  lot_id         bigint NOT NULL REFERENCES erp.material_lots(id),
  system_qty     numeric(12,3) NOT NULL,
  counted_qty    numeric(12,3) NOT NULL CHECK (counted_qty >= 0),
  diff_qty       numeric(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED
);

-- =====================================================================
-- FR-03  WORK ORDER (SPK), CUTTING, LIMBAH, BUNDEL
-- =====================================================================
CREATE TABLE erp.work_orders (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wo_no                text NOT NULL UNIQUE,          -- SPK-2026-0101
  sku_id               bigint NOT NULL REFERENCES erp.skus(id),
  bom_id               bigint NOT NULL REFERENCES erp.boms(id),
  target_qty           integer NOT NULL DEFAULT 0 CHECK (target_qty >= 0),  -- = Σ work_order_lines (trigger)
  due_date             date NOT NULL,
  destination          erp.wo_destination NOT NULL,
  customer_id          bigint REFERENCES erp.customers(id),
  status               erp.wo_status NOT NULL DEFAULT 'DRAFT',
  -- snapshot estimasi saat aktivasi (dasar Actual vs Estimated)
  est_material_per_pcs numeric(14,2),
  est_labor_per_pcs    numeric(14,2),
  est_overhead_per_pcs numeric(14,2),
  created_by           bigint NOT NULL REFERENCES erp.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  activated_by         bigint REFERENCES erp.users(id),
  activated_at         timestamptz,
  closed_by            bigint REFERENCES erp.users(id),
  closed_at            timestamptz,
  close_type           erp.close_type,
  close_reason         text,
  notes                text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wo_b2b_customer_ck CHECK (destination <> 'B2B' OR customer_id IS NOT NULL),
  CONSTRAINT wo_close_ck CHECK (
      (status IN ('CLOSED','CANCELLED')) = (closed_at IS NOT NULL)),
  CONSTRAINT wo_manual_reason_ck CHECK (
      close_type IS DISTINCT FROM 'MANUAL' OR length(trim(coalesce(close_reason,''))) > 0)
);
CREATE INDEX work_orders_status_idx ON erp.work_orders (status);
ALTER TABLE erp.stock_movements ADD CONSTRAINT stock_movements_wo_fk FOREIGN KEY (work_order_id) REFERENCES erp.work_orders(id);

CREATE TABLE erp.work_order_lines (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_order_id  bigint NOT NULL REFERENCES erp.work_orders(id) ON DELETE CASCADE,
  sku_variant_id bigint NOT NULL REFERENCES erp.sku_variants(id),
  target_qty     integer NOT NULL CHECK (target_qty > 0),
  UNIQUE (work_order_id, sku_variant_id)
);

CREATE TABLE erp.material_allocations (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_order_id  bigint NOT NULL REFERENCES erp.work_orders(id),
  lot_id         bigint NOT NULL REFERENCES erp.material_lots(id),
  material_id    bigint NOT NULL REFERENCES erp.materials(id),
  qty_reserved   numeric(12,3) NOT NULL CHECK (qty_reserved > 0),
  qty_consumed   numeric(12,3) NOT NULL DEFAULT 0 CHECK (qty_consumed >= 0),
  status         erp.allocation_status NOT NULL DEFAULT 'RESERVED',
  created_at     timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  UNIQUE (work_order_id, lot_id)
);
COMMENT ON TABLE erp.material_allocations IS 'FR-02.2 — reservasi FIFO per lot saat SPK Active. Sisa reserve dilepas saat SPK Closed/Cancelled.';

CREATE TABLE erp.cutting_records (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cut_no           text NOT NULL UNIQUE,              -- CUT-2026-0001
  work_order_id    bigint NOT NULL REFERENCES erp.work_orders(id),
  lot_id           bigint NOT NULL REFERENCES erp.material_lots(id),   -- lot kain utama
  spread_kg        numeric(10,3) NOT NULL CHECK (spread_kg > 0),
  cut_pcs          integer NOT NULL CHECK (cut_pcs > 0),
  scrap_kg         numeric(10,3) NOT NULL CHECK (scrap_kg >= 0),
  bom_gram_per_pcs numeric(10,2) NOT NULL CHECK (bom_gram_per_pcs > 0), -- snapshot BOM (rata-rata tertimbang size)
  yield_pcs_per_kg numeric(10,3) GENERATED ALWAYS AS (round(cut_pcs / spread_kg, 3)) STORED,
  net_gram_per_pcs numeric(10,2) GENERATED ALWAYS AS (round((spread_kg - scrap_kg) / cut_pcs * 1000, 2)) STORED,
  scrap_rate_pct   numeric(6,2)  GENERATED ALWAYS AS (round(scrap_kg / spread_kg * 100, 2)) STORED,
  variance_pct     numeric(7,2)  GENERATED ALWAYS AS (
                     round(((spread_kg - scrap_kg) / cut_pcs * 1000 - bom_gram_per_pcs) / bom_gram_per_pcs * 100, 2)) STORED,
  variance_note    text,
  cut_by           bigint NOT NULL REFERENCES erp.users(id),
  cut_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cutting_scrap_ck CHECK (scrap_kg < spread_kg)
);
COMMENT ON TABLE erp.cutting_records IS 'FR-03.2 — yield = pcs/Kg; berat bersih = (gelar − scrap)/pcs ×1000; variance > ±5% wajib catatan (trigger).';

CREATE TABLE erp.cutting_record_lines (
  cutting_record_id bigint NOT NULL REFERENCES erp.cutting_records(id) ON DELETE CASCADE,
  sku_variant_id    bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty               integer NOT NULL CHECK (qty > 0),
  PRIMARY KEY (cutting_record_id, sku_variant_id)
);

CREATE TABLE erp.scrap_disposals (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  disposal_no   text NOT NULL UNIQUE,
  disposed_at   timestamptz NOT NULL DEFAULT now(),
  method        erp.scrap_method NOT NULL,
  buyer_name    text,
  qty_kg        numeric(10,3) NOT NULL CHECK (qty_kg > 0),
  price_per_kg  numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_per_kg >= 0),
  total_amount  numeric(14,2) GENERATED ALWAYS AS (round(qty_kg * price_per_kg, 2)) STORED,
  recorded_by   bigint NOT NULL REFERENCES erp.users(id),
  approved_by   bigint REFERENCES erp.users(id),
  CONSTRAINT scrap_sold_ck CHECK (method = 'DISCARDED' OR (buyer_name IS NOT NULL AND price_per_kg > 0))
);

CREATE TABLE erp.bundles (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bundle_code         text NOT NULL UNIQUE,           -- BDL-0101-012, BDL-0101-012-R1
  work_order_id       bigint NOT NULL REFERENCES erp.work_orders(id),
  cutting_record_id   bigint REFERENCES erp.cutting_records(id),
  sku_variant_id      bigint NOT NULL REFERENCES erp.sku_variants(id),
  lot_id              bigint REFERENCES erp.material_lots(id),
  seq_no              smallint NOT NULL,
  seq_total           smallint NOT NULL,
  qty                 smallint NOT NULL CHECK (qty BETWEEN 1 AND 100),
  is_rework           boolean NOT NULL DEFAULT false,
  parent_bundle_id    bigint REFERENCES erp.bundles(id),
  root_bundle_id      bigint REFERENCES erp.bundles(id),  -- bundel asal (untuk payroll & traceability)
  rework_operation_id bigint REFERENCES erp.operations(id),
  status              erp.bundle_status NOT NULL DEFAULT 'CREATED',
  qty_pass            smallint NOT NULL DEFAULT 0,    -- diisi saat QC
  qty_packed          smallint NOT NULL DEFAULT 0,
  ticket_version      smallint NOT NULL DEFAULT 1,    -- naik saat cetak ulang; QR versi lama invalid
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_rework_ck CHECK (is_rework = (parent_bundle_id IS NOT NULL)
                                     AND is_rework = (rework_operation_id IS NOT NULL)),
  CONSTRAINT bundle_packed_ck CHECK (qty_packed BETWEEN 0 AND qty_pass AND qty_pass <= qty)
);
CREATE INDEX bundles_wo_idx ON erp.bundles (work_order_id, status);
COMMENT ON COLUMN erp.bundles.ticket_version IS 'Isi QR = bundle_code + ":" + ticket_version. Scan dengan versi lama ditolak.';

CREATE TABLE erp.bundle_prints (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bundle_id    bigint NOT NULL REFERENCES erp.bundles(id),
  version      smallint NOT NULL,
  printed_by   bigint NOT NULL REFERENCES erp.users(id),
  printed_at   timestamptz NOT NULL DEFAULT now(),
  reason       text,                                  -- wajib untuk cetak ulang
  UNIQUE (bundle_id, version),
  CHECK (version = 1 OR length(trim(coalesce(reason,''))) > 0)
);

-- =====================================================================
-- FR-04  SHOP FLOOR: WIP, SHIFT, DOWNTIME, SPARE PART
-- =====================================================================
CREATE TABLE erp.work_shifts (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id      bigint NOT NULL REFERENCES erp.users(id),
  work_date        date NOT NULL,
  line_id          smallint REFERENCES erp.production_lines(id),
  planned_minutes  smallint NOT NULL CHECK (planned_minutes BETWEEN 0 AND 960),
  break_minutes    smallint NOT NULL DEFAULT 60 CHECK (break_minutes >= 0),
  UNIQUE (operator_id, work_date),
  CHECK (break_minutes <= planned_minutes)
);
COMMENT ON TABLE erp.work_shifts IS 'Dasar waktu kerja aktual untuk Efficiency Rate (FR-07.3).';

CREATE TABLE erp.wip_tasks (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bundle_id            bigint NOT NULL REFERENCES erp.bundles(id),
  operation_id         bigint NOT NULL REFERENCES erp.operations(id),
  operator_id          bigint NOT NULL REFERENCES erp.users(id),
  machine_id           bigint REFERENCES erp.machines(id),
  line_id              smallint REFERENCES erp.production_lines(id),
  qty                  smallint NOT NULL CHECK (qty > 0),
  started_at           timestamptz NOT NULL,
  completed_at         timestamptz,
  duration_min         numeric(8,2) GENERATED ALWAYS AS (
                         round((extract(epoch FROM (completed_at - started_at)) / 60)::numeric, 2)) STORED,
  is_anomaly           boolean NOT NULL DEFAULT false,  -- durasi < 50% (SMV × qty)
  anomaly_reviewed_by  bigint REFERENCES erp.users(id),
  anomaly_reviewed_at  timestamptz,
  anomaly_accepted     boolean,                         -- true = tetap dibayar
  source               erp.scan_source NOT NULL DEFAULT 'ONLINE',
  client_start_id      uuid UNIQUE,                     -- idempotensi sinkron offline kios
  client_complete_id   uuid UNIQUE,
  corrected_by         bigint REFERENCES erp.users(id),
  correction_reason    text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, operation_id),                     -- 1 bundel-operasi = 1 operator
  CONSTRAINT wip_time_ck CHECK (completed_at IS NULL OR completed_at > started_at)
);
CREATE INDEX wip_tasks_operator_idx ON erp.wip_tasks (operator_id, completed_at);
CREATE INDEX wip_tasks_machine_idx  ON erp.wip_tasks (machine_id, completed_at);
CREATE INDEX wip_tasks_open_idx     ON erp.wip_tasks (bundle_id) WHERE completed_at IS NULL;
COMMENT ON TABLE erp.wip_tasks IS 'FR-04.1 — scan MULAI = INSERT, scan SELESAI = UPDATE completed_at. Validasi urutan routing via trigger.';

CREATE TABLE erp.downtime_tickets (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_no        text NOT NULL UNIQUE,              -- DT-0417
  machine_id       bigint NOT NULL REFERENCES erp.machines(id),
  line_id          smallint REFERENCES erp.production_lines(id),
  issue_type       text NOT NULL,                     -- Jarum patah, Looper bermasalah, Listrik
  description      text,
  reported_by      bigint NOT NULL REFERENCES erp.users(id),
  reported_at      timestamptz NOT NULL DEFAULT now(),
  assigned_to      bigint REFERENCES erp.users(id),   -- teknisi
  acknowledged_at  timestamptz,
  escalated_at     timestamptz,
  status           erp.ticket_status NOT NULL DEFAULT 'OPEN',
  resolved_at      timestamptz,
  resolution_note  text,
  confirmed_by     bigint REFERENCES erp.users(id),   -- supervisor konfirmasi mesin jalan
  confirmed_at     timestamptz,
  downtime_min     numeric(8,2) GENERATED ALWAYS AS (
                     round((extract(epoch FROM (resolved_at - reported_at)) / 60)::numeric, 2)) STORED,
  CONSTRAINT dt_resolved_ck CHECK (
      (status = 'RESOLVED') = (resolved_at IS NOT NULL)
      AND (status <> 'RESOLVED' OR length(trim(coalesce(resolution_note,''))) > 0))
);
CREATE UNIQUE INDEX downtime_one_open_per_machine_uq ON erp.downtime_tickets (machine_id) WHERE status <> 'RESOLVED';

CREATE TABLE erp.downtime_spareparts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id    bigint NOT NULL REFERENCES erp.downtime_tickets(id),
  material_id  bigint NOT NULL REFERENCES erp.materials(id),
  qty          numeric(10,3) NOT NULL CHECK (qty > 0),
  unit_cost    numeric(14,2) NOT NULL DEFAULT 0,
  is_shortage  boolean NOT NULL DEFAULT false,         -- stok kurang, tetap dicatat
  recorded_by  bigint NOT NULL REFERENCES erp.users(id),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- FR-05  QUALITY CONTROL & RETUR
-- =====================================================================
CREATE TABLE erp.defect_categories (
  id                    smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                  text NOT NULL UNIQUE,        -- KARET_MELINTIR
  name                  text NOT NULL,               -- "Karet Melintir"
  default_operation_id  bigint REFERENCES erp.operations(id),  -- operasi tujuan rework default
  status                erp.record_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE erp.qc_inspections (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bundle_id          bigint NOT NULL UNIQUE REFERENCES erp.bundles(id),
  inspector_id       bigint NOT NULL REFERENCES erp.users(id),
  inspected_at       timestamptz NOT NULL DEFAULT now(),
  qty_pass           smallint NOT NULL CHECK (qty_pass >= 0),
  qty_rework         smallint NOT NULL CHECK (qty_rework >= 0),
  qty_reject         smallint NOT NULL CHECK (qty_reject >= 0),
  rework_bundle_id   bigint REFERENCES erp.bundles(id),
  corrected_by       bigint REFERENCES erp.users(id),
  correction_reason  text,
  CONSTRAINT qc_rework_bundle_ck CHECK (rework_bundle_id IS NULL OR qty_rework > 0)
);
CREATE INDEX qc_inspections_time_idx ON erp.qc_inspections (inspected_at);

CREATE TABLE erp.qc_inspection_defects (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id             bigint NOT NULL REFERENCES erp.qc_inspections(id) ON DELETE CASCADE,
  outcome                   erp.qc_outcome NOT NULL,
  defect_category_id        smallint NOT NULL REFERENCES erp.defect_categories(id),
  qty                       smallint NOT NULL CHECK (qty > 0),
  responsible_operation_id  bigint REFERENCES erp.operations(id),
  UNIQUE (inspection_id, outcome, defect_category_id)
);

CREATE TABLE erp.customer_returns (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  return_no       text NOT NULL UNIQUE,
  source          erp.return_source NOT NULL,
  customer_id     bigint REFERENCES erp.customers(id),
  channel_id      smallint REFERENCES erp.sales_channels(id),
  store_id        smallint REFERENCES erp.online_stores(id),
  external_ref    text,                                -- no pesanan marketplace / DO
  sku_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty             integer NOT NULL CHECK (qty > 0),
  reason          text NOT NULL,
  work_order_id   bigint REFERENCES erp.work_orders(id),  -- jika bisa ditelusuri
  received_at     timestamptz NOT NULL DEFAULT now(),
  recorded_by     bigint NOT NULL REFERENCES erp.users(id),
  CHECK (source <> 'B2B' OR customer_id IS NOT NULL),
  CHECK (source <> 'ECOMMERCE' OR channel_id IS NOT NULL)
);

CREATE TABLE erp.return_gradings (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  return_id           bigint NOT NULL REFERENCES erp.customer_returns(id) ON DELETE CASCADE,
  grade               erp.return_grade NOT NULL,
  qty                 integer NOT NULL CHECK (qty > 0),
  defect_category_id  smallint REFERENCES erp.defect_categories(id),
  graded_by           bigint NOT NULL REFERENCES erp.users(id),
  graded_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_id, grade, defect_category_id)
);

-- =====================================================================
-- FR-06  PACKING, FINISHED GOODS, DISPATCH
-- =====================================================================
CREATE TABLE erp.pack_units (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pack_code        text NOT NULL UNIQUE,               -- PCK-0101-00001
  work_order_id    bigint NOT NULL REFERENCES erp.work_orders(id),
  fg_variant_id    bigint NOT NULL REFERENCES erp.sku_variants(id),  -- varian FG (single atau multipack)
  pack_count       integer NOT NULL DEFAULT 1 CHECK (pack_count BETWEEN 1 AND 1000),  -- jumlah pack identik dalam sesi ini
  status           erp.pack_status NOT NULL DEFAULT 'OPEN',
  packed_by        bigint NOT NULL REFERENCES erp.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz,
  CHECK ((status = 'CONFIRMED') = (confirmed_at IS NOT NULL))
);

CREATE TABLE erp.pack_unit_items (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pack_unit_id          bigint NOT NULL REFERENCES erp.pack_units(id) ON DELETE CASCADE,
  bundle_id             bigint NOT NULL REFERENCES erp.bundles(id),
  component_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty                   smallint NOT NULL DEFAULT 1 CHECK (qty > 0),
  scanned_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.fg_stock (
  sku_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  grade           erp.fg_grade NOT NULL DEFAULT 'A',
  qty_on_hand     integer NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved    integer NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  PRIMARY KEY (sku_variant_id, grade),
  CHECK (qty_reserved <= qty_on_hand)
);

CREATE TABLE erp.fg_movements (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  moved_at        timestamptz NOT NULL DEFAULT now(),
  movement_type   erp.fg_movement_type NOT NULL,
  sku_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  grade           erp.fg_grade NOT NULL DEFAULT 'A',
  qty             integer NOT NULL CHECK (qty <> 0),
  work_order_id   bigint REFERENCES erp.work_orders(id),
  ref_table       text,
  ref_id          bigint,
  user_id         bigint REFERENCES erp.users(id),
  reason          text
);
CREATE INDEX fg_movements_variant_idx ON erp.fg_movements (sku_variant_id, moved_at);

CREATE TABLE erp.delivery_orders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  do_no         text NOT NULL UNIQUE,                 -- DO-2026-0001 (surat jalan B2B)
  customer_id   bigint NOT NULL REFERENCES erp.customers(id),
  status        erp.dispatch_status NOT NULL DEFAULT 'DRAFT',
  ship_date     date,
  created_by    bigint NOT NULL REFERENCES erp.users(id),
  approved_by   bigint REFERENCES erp.users(id),
  shipped_at    timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.delivery_order_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_order_id bigint NOT NULL REFERENCES erp.delivery_orders(id) ON DELETE CASCADE,
  sku_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty             integer NOT NULL CHECK (qty > 0),
  UNIQUE (delivery_order_id, sku_variant_id)
);

CREATE TABLE erp.ecommerce_orders (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id         smallint NOT NULL REFERENCES erp.sales_channels(id),
  store_id           smallint NOT NULL REFERENCES erp.online_stores(id),
  external_order_no  text NOT NULL,
  buyer_name         text,
  awb_no             text,                             -- nomor resi
  status             erp.ecom_status NOT NULL DEFAULT 'IMPORTED',
  imported_at        timestamptz NOT NULL DEFAULT now(),
  packed_by          bigint REFERENCES erp.users(id),
  shipped_at         timestamptz,
  UNIQUE (channel_id, external_order_no)
);

CREATE TABLE erp.ecommerce_order_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id        bigint NOT NULL REFERENCES erp.ecommerce_orders(id) ON DELETE CASCADE,
  sku_variant_id  bigint NOT NULL REFERENCES erp.sku_variants(id),
  qty             integer NOT NULL CHECK (qty > 0),
  qty_scanned     integer NOT NULL DEFAULT 0 CHECK (qty_scanned >= 0),
  CHECK (qty_scanned <= qty)
);

-- =====================================================================
-- FR-07  FINANCE: OVERHEAD, PAYROLL, COSTING
-- =====================================================================
CREATE TABLE erp.overhead_periods (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_month  date NOT NULL UNIQUE CHECK (extract(day FROM period_month) = 1),  -- 2026-09-01
  status        erp.period_status NOT NULL DEFAULT 'OPEN',
  locked_by     bigint REFERENCES erp.users(id),
  locked_at     timestamptz
);

CREATE TABLE erp.overhead_entries (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id    bigint NOT NULL REFERENCES erp.overhead_periods(id),
  category     erp.overhead_category NOT NULL,
  amount       numeric(14,2) NOT NULL,                -- SCRAP_SALE_CREDIT bernilai negatif
  description  text NOT NULL,
  ref_table    text,
  ref_id       bigint,
  created_by   bigint REFERENCES erp.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((category = 'SCRAP_SALE_CREDIT') = (amount < 0) OR amount = 0)
);

CREATE TABLE erp.payroll_periods (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  frequency     erp.payroll_frequency NOT NULL,
  status        erp.payroll_status NOT NULL DEFAULT 'DRAFT',
  generated_by  bigint REFERENCES erp.users(id),
  generated_at  timestamptz,
  approved_by   bigint REFERENCES erp.users(id),
  approved_at   timestamptz,
  CHECK (period_end >= period_start),
  CHECK ((status = 'APPROVED') = (approved_at IS NOT NULL)),
  CONSTRAINT payroll_no_overlap EXCLUDE USING gist (daterange(period_start, period_end, '[]') WITH &&)
);

CREATE TABLE erp.payroll_lines (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id      bigint NOT NULL REFERENCES erp.payroll_periods(id) ON DELETE CASCADE,
  operator_id    bigint NOT NULL REFERENCES erp.users(id),
  work_order_id  bigint NOT NULL REFERENCES erp.work_orders(id),
  operation_id   bigint NOT NULL REFERENCES erp.operations(id),
  qty_pass       integer NOT NULL CHECK (qty_pass > 0),
  rate_idr       numeric(12,2),                        -- NULL = tarif belum diset → blokir approve
  amount         numeric(14,2) GENERATED ALWAYS AS (round(qty_pass * coalesce(rate_idr,0), 2)) STORED,
  UNIQUE (period_id, operator_id, work_order_id, operation_id, rate_idr)
);
CREATE INDEX payroll_lines_operator_idx ON erp.payroll_lines (period_id, operator_id);

CREATE TABLE erp.payroll_adjustments (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id    bigint NOT NULL REFERENCES erp.payroll_periods(id) ON DELETE CASCADE,
  operator_id  bigint NOT NULL REFERENCES erp.users(id),
  amount       numeric(14,2) NOT NULL CHECK (amount <> 0),
  reason       text NOT NULL CHECK (length(trim(reason)) > 0),
  created_by   bigint NOT NULL REFERENCES erp.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE erp.work_order_costings (
  work_order_id        bigint PRIMARY KEY REFERENCES erp.work_orders(id),
  status               erp.costing_status NOT NULL,
  fg_qty               integer NOT NULL CHECK (fg_qty >= 0),
  reject_qty           integer NOT NULL DEFAULT 0,
  est_material         numeric(14,2) NOT NULL,         -- semua nilai per pcs FG
  est_labor            numeric(14,2) NOT NULL,
  est_overhead         numeric(14,2) NOT NULL,
  act_material         numeric(14,2) NOT NULL,
  act_labor            numeric(14,2) NOT NULL,
  act_overhead         numeric(14,2) NOT NULL,
  est_total            numeric(14,2) GENERATED ALWAYS AS (est_material + est_labor + est_overhead) STORED,
  act_total            numeric(14,2) GENERATED ALWAYS AS (act_material + act_labor + act_overhead) STORED,
  variance_pct         numeric(7,2)  GENERATED ALWAYS AS (
                         CASE WHEN est_material + est_labor + est_overhead = 0 THEN NULL
                              ELSE round(((act_material + act_labor + act_overhead)
                                        - (est_material + est_labor + est_overhead))
                                        / (est_material + est_labor + est_overhead) * 100, 2) END) STORED,
  overhead_period_id   bigint REFERENCES erp.overhead_periods(id),
  calculated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE erp.work_order_costings IS 'FR-07.2 — HPP per SPK. PROVISIONAL bila periode overhead belum LOCKED. Akses hanya Founder & Finance.';

COMMIT;
