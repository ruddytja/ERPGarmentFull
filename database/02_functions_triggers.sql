-- =====================================================================
--  Garment ERP — THEUNDERWEARSUPPLY
--  02_functions_triggers.sql  ·  logika bisnis di level database
-- ---------------------------------------------------------------------
--  Prinsip:
--   • Validasi kritis (stok tidak negatif, urutan routing, total QC, periode
--     payroll terkunci) dijaga di DB supaya tidak bisa di-bypass dari API.
--   • Semua error bisnis: ERRCODE P0001, MESSAGE = pesan Bahasa Indonesia
--     siap tampil, HINT = kode error untuk API (mis. INSUFFICIENT_STOCK).
--   • Fungsi "fn_*" = endpoint transaksi (dipanggil API). "tg_*" = trigger.
--   • Hak akses role dicek di fungsi transaksi (fn_assert_user) sebagai
--     lapisan kedua setelah RBAC di API.
-- =====================================================================

BEGIN;
SET search_path = erp, public;

-- =====================================================================
-- 0. HELPER
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.fn_err(p_code text, p_msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_msg, HINT = p_code;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_actor() RETURNS bigint
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::bigint $$;

CREATE OR REPLACE FUNCTION erp.fn_wib_date(p_ts timestamptz) RETURNS date
LANGUAGE sql IMMUTABLE AS $$ SELECT (p_ts AT TIME ZONE 'Asia/Jakarta')::date $$;

CREATE OR REPLACE FUNCTION erp.fn_setting_num(p_key text, p_default numeric) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT (value #>> '{}')::numeric FROM erp.system_settings WHERE key = p_key), p_default)
$$;

-- Format angka gaya Indonesia: 1.250.000,50
CREATE OR REPLACE FUNCTION erp.fn_fmt(p_val numeric, p_dec int DEFAULT 0) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(to_char(round(p_val, p_dec),
           'FM999,999,999,990' || CASE WHEN p_dec > 0 THEN '.' || repeat('0', p_dec) ELSE '' END), ',.', '.,')
$$;

CREATE OR REPLACE FUNCTION erp.fn_uom_label(p_uom erp.uom) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE p_uom WHEN 'KG' THEN 'Kg' WHEN 'PCS' THEN 'pcs' WHEN 'M' THEN 'm' WHEN 'L' THEN 'L' END $$;

CREATE OR REPLACE FUNCTION erp.fn_next_doc_no(p_prefix text, p_pad int DEFAULT 4) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_year smallint := extract(year FROM now() AT TIME ZONE 'Asia/Jakarta');
  v_no   int;
BEGIN
  INSERT INTO erp.doc_counters (prefix, year, last_no) VALUES (p_prefix, v_year, 1)
  ON CONFLICT (prefix, year) DO UPDATE SET last_no = erp.doc_counters.last_no + 1
  RETURNING last_no INTO v_no;
  RETURN p_prefix || '-' || v_year || '-' || lpad(v_no::text, p_pad, '0');
END $$;

CREATE OR REPLACE FUNCTION erp.fn_assert_user(p_user_id bigint, p_roles erp.user_role[],
                                              p_functions erp.staff_function[] DEFAULT NULL)
RETURNS erp.users LANGUAGE plpgsql AS $$
DECLARE u erp.users;
BEGIN
  SELECT * INTO u FROM erp.users WHERE id = p_user_id;
  IF NOT FOUND OR u.status <> 'ACTIVE' THEN
    PERFORM erp.fn_err('USER_INVALID', 'Pengguna tidak ditemukan atau tidak aktif.');
  END IF;
  IF NOT (u.role = ANY (p_roles))
     OR (u.role = 'STAFF' AND p_functions IS NOT NULL AND NOT (u.staff_function = ANY (p_functions))) THEN
    PERFORM erp.fn_err('ACCESS_DENIED', format('Peran %s%s tidak berwenang untuk tindakan ini.',
                       u.role, CASE WHEN u.staff_function IS NOT NULL THEN ' (' || u.staff_function || ')' ELSE '' END));
  END IF;
  RETURN u;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_resolve_operator(p_operator_code text) RETURNS erp.users
LANGUAGE plpgsql AS $$
DECLARE u erp.users;
BEGIN
  SELECT * INTO u FROM erp.users WHERE operator_code = upper(trim(p_operator_code));
  IF NOT FOUND OR u.status <> 'ACTIVE' THEN
    PERFORM erp.fn_err('OPERATOR_INVALID', format('ID operator %s tidak terdaftar atau tidak aktif.', p_operator_code));
  END IF;
  RETURN u;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_notify(p_type erp.notification_type, p_title text, p_body text,
                                         p_user_id bigint DEFAULT NULL, p_role erp.user_role DEFAULT NULL,
                                         p_entity text DEFAULT NULL, p_entity_id text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO erp.notifications (user_id, target_role, type, title, body, entity, entity_id)
  VALUES (p_user_id, p_role, p_type, p_title, p_body, p_entity, p_entity_id);
$$;

CREATE OR REPLACE FUNCTION erp.fn_bom_qty_to_uom(p_qty numeric, p_unit erp.bom_qty_unit) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_unit WHEN 'GRAM' THEN p_qty / 1000 WHEN 'CM' THEN p_qty / 100 ELSE p_qty END
$$;

CREATE OR REPLACE FUNCTION erp.fn_rate_at(p_operation_id bigint, p_date date) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT rate_idr FROM erp.piece_rates
  WHERE operation_id = p_operation_id AND effective_from <= p_date
  ORDER BY effective_from DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION erp.fn_ensure_overhead_period(p_date date) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_month date := date_trunc('month', p_date)::date;
BEGIN
  SELECT id INTO v_id FROM erp.overhead_periods WHERE period_month = v_month;
  IF NOT FOUND THEN
    INSERT INTO erp.overhead_periods (period_month) VALUES (v_month) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

-- Konsumsi stok FIFO dari lot PASS yang bebas (tidak di-reserve). Mengembalikan qty yang berhasil dipotong.
CREATE OR REPLACE FUNCTION erp.fn_consume_free_stock(p_material_id bigint, p_qty numeric, p_type erp.stock_movement_type,
                                                     p_wo bigint, p_ref_table text, p_ref_id bigint, p_user bigint)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE l record; v_need numeric := p_qty; v_take numeric; v_cost numeric;
BEGIN
  SELECT avg_cost INTO v_cost FROM erp.materials WHERE id = p_material_id;
  FOR l IN SELECT id, qty_on_hand - qty_reserved AS free FROM erp.material_lots
           WHERE material_id = p_material_id AND qc_status = 'PASS' AND qty_on_hand - qty_reserved > 0
           ORDER BY received_at, id FOR UPDATE
  LOOP
    EXIT WHEN v_need <= 0;
    v_take := least(v_need, l.free);
    INSERT INTO erp.stock_movements (movement_type, lot_id, material_id, qty, unit_cost, work_order_id, ref_table, ref_id, user_id)
    VALUES (p_type, l.id, p_material_id, -v_take, v_cost, p_wo, p_ref_table, p_ref_id, p_user);
    v_need := v_need - v_take;
  END LOOP;
  RETURN p_qty - greatest(v_need, 0);
END $$;

-- =====================================================================
-- 1. TRIGGER GENERIK: updated_at, audit trail, ledger immutable
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
           WHERE table_schema = 'erp' AND column_name = 'updated_at'
             AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='erp' AND table_type='BASE TABLE')
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON erp.%I FOR EACH ROW EXECUTE FUNCTION erp.tg_set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION erp.tg_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE o jsonb; n jsonb; r jsonb; k text;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD) - 'password_hash' - 'pin_hash'; END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW) - 'password_hash' - 'pin_hash'; END IF;
  IF TG_OP = 'UPDATE' AND (o - 'updated_at') = (n - 'updated_at') THEN RETURN NULL; END IF;
  r := coalesce(n, o);
  k := coalesce(r->>'id', r->>'key', r->>'work_order_id',
                concat_ws(':', r->>'role', r->>'module', r->>'sku_id', r->>'seq'));
  INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (erp.fn_actor(), TG_OP, TG_TABLE_NAME, k, o, n);
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','role_permissions','session_policies','system_settings','boms','bom_lines',
                           'operations','piece_rates','sku_routings','work_orders','work_order_lines',
                           'bundle_prints','stock_adjustments','payroll_periods','payroll_adjustments',
                           'overhead_periods','overhead_entries','machines','skus']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON erp.%I FOR EACH ROW EXECUTE FUNCTION erp.tg_audit()', t, t);
  END LOOP;
END $$;

-- Koreksi scan & QC juga diaudit (hanya UPDATE)
CREATE TRIGGER trg_wip_tasks_audit AFTER UPDATE ON erp.wip_tasks
  FOR EACH ROW WHEN (NEW.corrected_by IS NOT NULL) EXECUTE FUNCTION erp.tg_audit();
CREATE TRIGGER trg_qc_inspections_audit AFTER UPDATE ON erp.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION erp.tg_audit();

CREATE OR REPLACE FUNCTION erp.tg_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM erp.fn_err('IMMUTABLE', format('Data %s tidak boleh diubah/dihapus. Gunakan transaksi koreksi (adjustment).', TG_TABLE_NAME));
  RETURN NULL;
END $$;
CREATE TRIGGER trg_stock_movements_immutable BEFORE UPDATE OR DELETE ON erp.stock_movements FOR EACH ROW EXECUTE FUNCTION erp.tg_immutable();
CREATE TRIGGER trg_fg_movements_immutable    BEFORE UPDATE OR DELETE ON erp.fg_movements    FOR EACH ROW EXECUTE FUNCTION erp.tg_immutable();
CREATE TRIGGER trg_audit_logs_immutable      BEFORE UPDATE OR DELETE ON erp.audit_logs      FOR EACH ROW EXECUTE FUNCTION erp.tg_immutable();

-- =====================================================================
-- 2. FR-00  USER
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_users_biu() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := lower(NEW.email);
  NEW.operator_code := upper(NEW.operator_code);
  IF TG_OP = 'UPDATE' AND NEW.status = 'INACTIVE' AND OLD.status = 'ACTIVE' THEN
    NEW.deactivated_at := coalesce(NEW.deactivated_at, now());
    IF OLD.role = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM erp.users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id <> OLD.id) THEN
      PERFORM erp.fn_err('LAST_ADMIN', 'Minimal harus ada satu Admin aktif.');
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'ACTIVE' THEN NEW.deactivated_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_users_biu BEFORE INSERT OR UPDATE ON erp.users FOR EACH ROW EXECUTE FUNCTION erp.tg_users_biu();

CREATE OR REPLACE FUNCTION erp.tg_users_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM erp.fn_err('NO_DELETE', 'Akun tidak dapat dihapus, hanya dinonaktifkan.');
  RETURN NULL;
END $$;
CREATE TRIGGER trg_users_no_delete BEFORE DELETE ON erp.users FOR EACH ROW EXECUTE FUNCTION erp.tg_users_no_delete();

-- ---------------------------------------------------------------------
-- LOGIN (FR-00.1). Fungsi login TIDAK melempar error saat gagal supaya
-- penghitung gagal & log percobaan tetap tersimpan. API cukup membaca "ok".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.fn_role_redirect(p_role erp.user_role) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role WHEN 'ADMIN' THEN '/settings/users' WHEN 'FOUNDER' THEN '/dashboard/founder'
                     WHEN 'FINANCE' THEN '/dashboard/finance' WHEN 'SUPERVISOR' THEN '/dashboard/supervisor'
                     ELSE '/kiosk' END
$$;

CREATE OR REPLACE FUNCTION erp.fn_password_policy_check(p_password text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_min int := erp.fn_setting_num('password_min_length', 8)::int;
BEGIN
  IF p_password IS NULL OR length(p_password) < v_min OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    PERFORM erp.fn_err('WEAK_PASSWORD', format('Password minimal %s karakter, kombinasi huruf dan angka.', v_min));
  END IF;
END $$;

-- Buat/ubah kredensial. Admin reset → wajib ganti saat login berikutnya; user ganti sendiri → wajib isi password lama.
CREATE OR REPLACE FUNCTION erp.fn_set_password(p_user_id bigint, p_new_password text, p_actor bigint,
                                               p_old_password text DEFAULT NULL, p_username text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE l erp.user_logins; a erp.users; v_self boolean := (p_user_id = p_actor);
BEGIN
  SELECT * INTO a FROM erp.users WHERE id = p_actor;
  IF NOT v_self AND (a.role IS DISTINCT FROM 'ADMIN' OR a.status <> 'ACTIVE') THEN
    PERFORM erp.fn_err('ACCESS_DENIED', 'Hanya Admin yang dapat membuat atau mereset password pengguna lain.');
  END IF;
  PERFORM erp.fn_password_policy_check(p_new_password);
  SELECT * INTO l FROM erp.user_logins WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    IF v_self THEN PERFORM erp.fn_err('NO_LOGIN', 'Akun ini belum memiliki login. Hubungi Admin.'); END IF;
    IF coalesce(trim(p_username), '') = '' THEN PERFORM erp.fn_err('USERNAME_REQUIRED', 'Username wajib diisi.'); END IF;
    IF EXISTS (SELECT 1 FROM erp.user_logins WHERE lower(username) = lower(trim(p_username))) THEN
      PERFORM erp.fn_err('USERNAME_TAKEN', format('Username %s sudah digunakan.', p_username));
    END IF;
    INSERT INTO erp.user_logins (user_id, username, password_hash, must_change_password, password_changed_at)
    VALUES (p_user_id, lower(trim(p_username)), crypt(p_new_password, gen_salt('bf', 10)), true, now());
  ELSE
    IF v_self THEN
      IF p_old_password IS NULL OR crypt(p_old_password, l.password_hash) <> l.password_hash THEN
        PERFORM erp.fn_err('BAD_OLD_PASSWORD', 'Password lama salah.');
      END IF;
      IF crypt(p_new_password, l.password_hash) = l.password_hash THEN
        PERFORM erp.fn_err('SAME_PASSWORD', 'Password baru tidak boleh sama dengan password lama.');
      END IF;
    END IF;
    UPDATE erp.user_logins
       SET password_hash = crypt(p_new_password, gen_salt('bf', 10)), password_changed_at = now(),
           must_change_password = NOT v_self, failed_count = 0, locked_until = NULL,
           username = coalesce(lower(nullif(trim(p_username), '')), username)
     WHERE user_id = p_user_id;
  END IF;
  INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, note)
  VALUES (p_actor, CASE WHEN v_self THEN 'PASSWORD_CHANGE' ELSE 'PASSWORD_RESET' END, 'user_logins', p_user_id::text,
          CASE WHEN v_self THEN 'Password diganti oleh pemilik akun' ELSE 'Password dibuat/direset oleh Admin' END);
END $$;

-- Login standar: username ATAU email + password
CREATE OR REPLACE FUNCTION erp.fn_login(p_login text, p_password text, p_ip inet DEFAULT NULL, p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  u erp.users; l erp.user_logins; v_input text := lower(trim(p_login));
  v_max int := erp.fn_setting_num('login_max_failed', 5)::int;
  v_lock int := erp.fn_setting_num('login_lock_minutes', 15)::int;
  v_bad constant text := 'Email atau password salah.';
BEGIN
  SELECT ul.* INTO l FROM erp.user_logins ul JOIN erp.users us ON us.id = ul.user_id
  WHERE lower(ul.username) = v_input OR lower(us.email) = v_input
  LIMIT 1 FOR UPDATE OF ul;

  IF NOT FOUND THEN
    INSERT INTO erp.login_attempts (method, login_input, success, failure_reason, ip_address, user_agent)
    VALUES ('PASSWORD', v_input, false, 'UNKNOWN_USER', p_ip, p_user_agent);
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_CREDENTIALS', 'message', v_bad);
  END IF;
  SELECT * INTO u FROM erp.users WHERE id = l.user_id;

  IF u.status <> 'ACTIVE' THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason, ip_address, user_agent)
    VALUES ('PASSWORD', v_input, u.id, false, 'INACTIVE', p_ip, p_user_agent);
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Akun Anda tidak aktif. Hubungi Admin.');
  END IF;

  IF l.locked_until IS NOT NULL AND l.locked_until > now() THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason, ip_address, user_agent)
    VALUES ('PASSWORD', v_input, u.id, false, 'LOCKED', p_ip, p_user_agent);
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_LOCKED',
      'message', format('Akun dikunci sementara. Coba lagi dalam %s menit.', ceil(extract(epoch FROM (l.locked_until - now())) / 60)));
  END IF;

  IF crypt(p_password, l.password_hash) <> l.password_hash THEN
    UPDATE erp.user_logins
       SET failed_count = CASE WHEN failed_count + 1 >= v_max THEN 0 ELSE failed_count + 1 END,
           locked_until = CASE WHEN failed_count + 1 >= v_max THEN now() + make_interval(mins => v_lock) END
     WHERE user_id = l.user_id;
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason, ip_address, user_agent)
    VALUES ('PASSWORD', v_input, u.id, false, 'BAD_CREDENTIALS', p_ip, p_user_agent);
    IF l.failed_count + 1 >= v_max THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_LOCKED',
        'message', format('Akun dikunci sementara. Coba lagi dalam %s menit.', v_lock));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_CREDENTIALS', 'message', v_bad,
                              'attempts_left', v_max - (l.failed_count + 1));
  END IF;

  UPDATE erp.user_logins SET failed_count = 0, locked_until = NULL, last_login_at = now(), last_login_ip = p_ip
   WHERE user_id = l.user_id;
  UPDATE erp.users SET last_login_at = now() WHERE id = u.id;
  INSERT INTO erp.login_attempts (method, login_input, user_id, success, ip_address, user_agent)
  VALUES ('PASSWORD', v_input, u.id, true, p_ip, p_user_agent);
  RETURN jsonb_build_object('ok', true, 'user_id', u.id, 'name', u.full_name, 'username', l.username,
                            'role', u.role, 'staff_function', u.staff_function,
                            'must_change_password', l.must_change_password,
                            'redirect', CASE WHEN l.must_change_password THEN '/account/change-password'
                                             ELSE erp.fn_role_redirect(u.role) END,
                            'idle_minutes', (SELECT idle_minutes FROM erp.session_policies WHERE role = u.role));
END $$;

-- Login Google SSO: email harus terdaftar & aktif (SSO tidak membuat akun otomatis)
CREATE OR REPLACE FUNCTION erp.fn_login_google(p_email text, p_google_sub text, p_ip inet DEFAULT NULL, p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE u erp.users; v_email text := lower(trim(p_email));
BEGIN
  SELECT * INTO u FROM erp.users WHERE lower(email) = v_email FOR UPDATE;
  IF NOT FOUND OR (u.google_sub IS NOT NULL AND u.google_sub <> p_google_sub) THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason, ip_address, user_agent)
    VALUES ('GOOGLE', v_email, u.id, false, 'UNKNOWN_USER', p_ip, p_user_agent);
    RETURN jsonb_build_object('ok', false, 'code', 'GOOGLE_NOT_REGISTERED', 'message', 'Akun Google ini belum terdaftar. Hubungi Admin.');
  END IF;
  IF u.status <> 'ACTIVE' THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason, ip_address, user_agent)
    VALUES ('GOOGLE', v_email, u.id, false, 'INACTIVE', p_ip, p_user_agent);
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Akun Anda tidak aktif. Hubungi Admin.');
  END IF;
  UPDATE erp.users SET google_sub = coalesce(google_sub, p_google_sub), last_login_at = now() WHERE id = u.id;
  INSERT INTO erp.login_attempts (method, login_input, user_id, success, ip_address, user_agent)
  VALUES ('GOOGLE', v_email, u.id, true, p_ip, p_user_agent);
  RETURN jsonb_build_object('ok', true, 'user_id', u.id, 'name', u.full_name, 'role', u.role,
                            'redirect', erp.fn_role_redirect(u.role),
                            'idle_minutes', (SELECT idle_minutes FROM erp.session_policies WHERE role = u.role));
END $$;

-- Login kios: kode operator + PIN (bcrypt)
CREATE OR REPLACE FUNCTION erp.fn_kiosk_login(p_operator_code text, p_pin text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE u erp.users; v_code text := upper(trim(p_operator_code));
BEGIN
  SELECT * INTO u FROM erp.users WHERE operator_code = v_code FOR UPDATE;
  IF NOT FOUND OR u.status <> 'ACTIVE' THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason)
    VALUES ('PIN', v_code, u.id, false, CASE WHEN u.id IS NULL THEN 'UNKNOWN_USER' ELSE 'INACTIVE' END);
    RETURN jsonb_build_object('ok', false, 'code', 'OPERATOR_INVALID', 'message', 'ID operator tidak terdaftar atau tidak aktif.');
  END IF;
  IF u.locked_until IS NOT NULL AND u.locked_until > now() THEN
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason) VALUES ('PIN', v_code, u.id, false, 'LOCKED');
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_LOCKED', 'message', 'PIN dikunci sementara. Hubungi Supervisor.');
  END IF;
  IF u.pin_hash IS NULL OR crypt(p_pin, u.pin_hash) <> u.pin_hash THEN
    UPDATE erp.users SET failed_login_count = CASE WHEN failed_login_count + 1 >= 5 THEN 0 ELSE failed_login_count + 1 END,
           locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN now() + interval '15 minutes' END
    WHERE id = u.id;
    INSERT INTO erp.login_attempts (method, login_input, user_id, success, failure_reason) VALUES ('PIN', v_code, u.id, false, 'BAD_CREDENTIALS');
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_PIN', 'message', 'PIN salah.');
  END IF;
  UPDATE erp.users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = u.id;
  INSERT INTO erp.login_attempts (method, login_input, user_id, success) VALUES ('PIN', v_code, u.id, true);
  RETURN jsonb_build_object('ok', true, 'user_id', u.id, 'name', u.full_name, 'function', u.staff_function, 'line_id', u.line_id);
END $$;

-- Admin membuka kunci akun lebih awal
CREATE OR REPLACE FUNCTION erp.fn_unlock_login(p_user_id bigint, p_admin bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM erp.fn_assert_user(p_admin, ARRAY['ADMIN','SUPERVISOR']::erp.user_role[]);
  UPDATE erp.user_logins SET failed_count = 0, locked_until = NULL WHERE user_id = p_user_id;
  UPDATE erp.users SET failed_login_count = 0, locked_until = NULL WHERE id = p_user_id;
  INSERT INTO erp.audit_logs (user_id, action, entity, entity_id, note) VALUES (p_admin, 'UNLOCK', 'user_logins', p_user_id::text, 'Kunci login dibuka');
END $$;

CREATE OR REPLACE FUNCTION erp.tg_login_attempts_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN PERFORM erp.fn_err('IMMUTABLE', 'Log percobaan login tidak boleh diubah/dihapus.'); RETURN NULL; END $$;
CREATE TRIGGER trg_login_attempts_immutable BEFORE UPDATE OR DELETE ON erp.login_attempts
  FOR EACH ROW EXECUTE FUNCTION erp.tg_login_attempts_immutable();

-- =====================================================================
-- 3. FR-01  MASTER DATA: BOM, TARIF, MESIN
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_bom_lines_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status erp.bom_status;
BEGIN
  SELECT status INTO v_status FROM erp.boms WHERE id = coalesce(NEW.bom_id, OLD.bom_id);
  IF v_status IS NOT NULL AND v_status <> 'DRAFT' THEN
    PERFORM erp.fn_err('BOM_LOCKED', 'BOM sudah aktif/arsip dan mungkin dipakai SPK. Buat versi baru.');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_bom_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.bom_lines
  FOR EACH ROW EXECUTE FUNCTION erp.tg_bom_lines_guard();

CREATE OR REPLACE FUNCTION erp.fn_new_bom_version(p_sku_id bigint, p_user bigint, p_notes text DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_src bigint; v_ver smallint; v_new bigint;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['ADMIN']::erp.user_role[]);
  SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM erp.boms WHERE sku_id = p_sku_id;
  SELECT id INTO v_src FROM erp.boms WHERE sku_id = p_sku_id ORDER BY (status = 'ACTIVE') DESC, version DESC LIMIT 1;
  INSERT INTO erp.boms (sku_id, version, status, notes, created_by) VALUES (p_sku_id, v_ver, 'DRAFT', p_notes, p_user)
  RETURNING id INTO v_new;
  IF v_src IS NOT NULL THEN
    INSERT INTO erp.bom_lines (bom_id, size, material_id, qty_per_pcs, qty_unit, is_main_fabric, shrinkage_pct)
    SELECT v_new, size, material_id, qty_per_pcs, qty_unit, is_main_fabric, shrinkage_pct FROM erp.bom_lines WHERE bom_id = v_src;
  END IF;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_activate_bom(p_bom_id bigint, p_user bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE b erp.boms; v_missing text;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['ADMIN']::erp.user_role[]);
  SELECT * INTO b FROM erp.boms WHERE id = p_bom_id FOR UPDATE;
  IF NOT FOUND OR b.status <> 'DRAFT' THEN
    PERFORM erp.fn_err('INVALID_STATUS', 'Hanya BOM berstatus Draft yang dapat diaktifkan.');
  END IF;
  SELECT string_agg(DISTINCT v.size, ', ') INTO v_missing
  FROM erp.sku_variants v
  WHERE v.sku_id = b.sku_id AND v.status = 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM erp.bom_lines bl WHERE bl.bom_id = b.id AND bl.size = v.size AND bl.is_main_fabric);
  IF v_missing IS NOT NULL THEN
    PERFORM erp.fn_err('BOM_INCOMPLETE', format('Kain utama wajib diisi untuk size %s.', v_missing));
  END IF;
  UPDATE erp.boms SET status = 'ARCHIVED' WHERE sku_id = b.sku_id AND status = 'ACTIVE';
  UPDATE erp.boms SET status = 'ACTIVE', activated_at = now() WHERE id = b.id;
END $$;

-- Tarif borongan tidak boleh berlaku mundur ke periode payroll yang sudah di-approve
CREATE OR REPLACE FUNCTION erp.tg_piece_rates_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_locked date;
BEGIN
  SELECT max(period_end) INTO v_locked FROM erp.payroll_periods WHERE status = 'APPROVED';
  IF v_locked IS NOT NULL AND coalesce(NEW.effective_from, OLD.effective_from) <= v_locked THEN
    PERFORM erp.fn_err('PAYROLL_LOCKED', format('Periode payroll sudah di-approve. Pilih tanggal efektif setelah %s.',
                                               to_char(v_locked, 'DD-MM-YYYY')));
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_piece_rates_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.piece_rates
  FOR EACH ROW EXECUTE FUNCTION erp.tg_piece_rates_guard();

CREATE OR REPLACE FUNCTION erp.tg_machines_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'INACTIVE' AND OLD.status <> 'INACTIVE'
     AND EXISTS (SELECT 1 FROM erp.downtime_tickets WHERE machine_id = NEW.id AND status <> 'RESOLVED') THEN
    PERFORM erp.fn_err('OPEN_TICKET', 'Mesin dengan tiket downtime terbuka tidak dapat dinonaktifkan.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_machines_guard BEFORE UPDATE ON erp.machines FOR EACH ROW EXECUTE FUNCTION erp.tg_machines_guard();

-- =====================================================================
-- 4. FR-02  STOK: ledger → saldo lot, alokasi → reserved
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_stock_movements_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE l erp.material_lots; m erp.materials;
BEGIN
  SELECT * INTO l FROM erp.material_lots WHERE id = NEW.lot_id FOR UPDATE;
  SELECT * INTO m FROM erp.materials WHERE id = l.material_id;
  NEW.material_id := l.material_id;
  NEW.user_id := coalesce(NEW.user_id, erp.fn_actor());
  IF l.qty_on_hand + NEW.qty < 0 THEN
    PERFORM erp.fn_err('INSUFFICIENT_STOCK', format('Stok %s (lot %s) tidak mencukupi: tersedia %s %s, dibutuhkan %s %s.',
      m.name, l.lot_no, erp.fn_fmt(l.qty_on_hand, 2), erp.fn_uom_label(m.uom), erp.fn_fmt(-NEW.qty, 2), erp.fn_uom_label(m.uom)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stock_movements_bi BEFORE INSERT ON erp.stock_movements FOR EACH ROW EXECUTE FUNCTION erp.tg_stock_movements_bi();

CREATE OR REPLACE FUNCTION erp.tg_stock_movements_ai() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE m erp.materials; v_avail numeric;
BEGIN
  UPDATE erp.material_lots SET qty_on_hand = qty_on_hand + NEW.qty WHERE id = NEW.lot_id;
  IF NEW.qty < 0 THEN
    SELECT * INTO m FROM erp.materials WHERE id = NEW.material_id;
    SELECT coalesce(sum(qty_on_hand - qty_reserved), 0) INTO v_avail
      FROM erp.material_lots WHERE material_id = m.id AND qc_status = 'PASS';
    IF m.min_stock > 0 AND v_avail < m.min_stock
       AND NOT EXISTS (SELECT 1 FROM erp.notifications WHERE type = 'STOCK_CRITICAL' AND entity = 'materials'
                       AND entity_id = m.id::text AND read_at IS NULL) THEN
      PERFORM erp.fn_notify('STOCK_CRITICAL', format('Stok %s di bawah minimum', m.name),
        format('Tersedia %s %s, minimum %s %s.', erp.fn_fmt(v_avail, 2), erp.fn_uom_label(m.uom), erp.fn_fmt(m.min_stock, 2), erp.fn_uom_label(m.uom)),
        NULL, r, 'materials', m.id::text)
      FROM unnest(ARRAY['SUPERVISOR','ADMIN']::erp.user_role[]) AS r;
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_stock_movements_ai AFTER INSERT ON erp.stock_movements FOR EACH ROW EXECUTE FUNCTION erp.tg_stock_movements_ai();

CREATE OR REPLACE FUNCTION erp.tg_allocations_sync() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_delta numeric := 0;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'RESERVED' THEN
    v_delta := v_delta - greatest(OLD.qty_reserved - OLD.qty_consumed, 0);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.status = 'RESERVED' THEN
    v_delta := v_delta + greatest(NEW.qty_reserved - NEW.qty_consumed, 0);
  END IF;
  IF v_delta <> 0 THEN
    UPDATE erp.material_lots SET qty_reserved = qty_reserved + v_delta WHERE id = coalesce(NEW.lot_id, OLD.lot_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_allocations_sync AFTER INSERT OR UPDATE OR DELETE ON erp.material_allocations
  FOR EACH ROW EXECUTE FUNCTION erp.tg_allocations_sync();

-- FR-02.1  Posting penerimaan barang (DRAFT → POSTED, atau PENDING_APPROVAL bila selisih > toleransi)
CREATE OR REPLACE FUNCTION erp.fn_post_goods_receipt(p_receipt_id bigint, p_user bigint) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  r erp.goods_receipts; it record; v_tol numeric; v_over text; v_lot bigint;
  v_avail numeric; v_avg numeric; u erp.users;
BEGIN
  u := erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['GUDANG']::erp.staff_function[]);
  SELECT * INTO r FROM erp.goods_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Penerimaan barang tidak ditemukan.'); END IF;
  IF r.status NOT IN ('DRAFT','PENDING_APPROVAL') THEN
    PERFORM erp.fn_err('INVALID_STATUS', format('Penerimaan %s berstatus %s dan tidak dapat diposting.', r.receipt_no, r.status));
  END IF;
  IF r.status = 'PENDING_APPROVAL' AND r.approved_by IS NULL THEN
    PERFORM erp.fn_err('APPROVAL_REQUIRED', 'Selisih timbang melebihi toleransi. Menunggu approval Supervisor.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM erp.goods_receipt_items WHERE receipt_id = r.id) THEN
    PERFORM erp.fn_err('EMPTY', 'Penerimaan belum memiliki item.');
  END IF;
  IF EXISTS (SELECT 1 FROM erp.goods_receipt_items gi JOIN erp.materials m ON m.id = gi.material_id
             WHERE gi.receipt_id = r.id AND m.is_lot_tracked AND coalesce(trim(gi.lot_no), '') = '') THEN
    PERFORM erp.fn_err('LOT_REQUIRED', 'Lot number wajib untuk kain, karet, dan benang.');
  END IF;

  -- Toleransi selisih dokumen vs timbang aktual
  v_tol := erp.fn_setting_num('receiving_tolerance_pct', 2);
  IF r.status = 'DRAFT' THEN
    SELECT string_agg(format('%s %s%%', m.name, erp.fn_fmt(gi.variance_pct, 2)), ', ') INTO v_over
    FROM erp.goods_receipt_items gi JOIN erp.materials m ON m.id = gi.material_id
    WHERE gi.receipt_id = r.id AND abs(gi.variance_pct) > v_tol;
    IF v_over IS NOT NULL THEN
      UPDATE erp.goods_receipts SET status = 'PENDING_APPROVAL' WHERE id = r.id;
      PERFORM erp.fn_notify('RECEIVING_VARIANCE', format('Selisih timbang %s', r.receipt_no),
        format('Selisih melebihi ±%s%%: %s. Perlu approval.', erp.fn_fmt(v_tol, 0), v_over), NULL, 'SUPERVISOR', 'goods_receipts', r.id::text);
      RETURN 'PENDING_APPROVAL';
    END IF;
  END IF;

  FOR it IN SELECT gi.*, m.is_lot_tracked, m.avg_cost FROM erp.goods_receipt_items gi
            JOIN erp.materials m ON m.id = gi.material_id WHERE gi.receipt_id = r.id ORDER BY gi.id
  LOOP
    -- moving average hanya dari stok PASS
    IF it.qc_status = 'PASS' THEN
      SELECT coalesce(sum(qty_on_hand), 0) INTO v_avail FROM erp.material_lots
        WHERE material_id = it.material_id AND qc_status = 'PASS';
      v_avg := round((v_avail * it.avg_cost + it.actual_qty * it.price_per_uom) / (v_avail + it.actual_qty), 2);
      UPDATE erp.materials SET avg_cost = v_avg WHERE id = it.material_id;
    END IF;

    IF it.is_lot_tracked THEN
      IF EXISTS (SELECT 1 FROM erp.material_lots WHERE material_id = it.material_id AND lot_no = it.lot_no) THEN
        PERFORM erp.fn_err('DUPLICATE_LOT', format('Lot %s sudah pernah diterima.', it.lot_no));
      END IF;
      INSERT INTO erp.material_lots (material_id, lot_no, supplier_id, receipt_item_id, received_at, unit_cost, qc_status)
      VALUES (it.material_id, it.lot_no, r.supplier_id, it.id, r.received_at, it.price_per_uom, it.qc_status)
      RETURNING id INTO v_lot;
    ELSE
      INSERT INTO erp.material_lots (material_id, lot_no, supplier_id, received_at, unit_cost, qc_status)
      VALUES (it.material_id, 'NO-LOT', r.supplier_id, r.received_at, it.price_per_uom, 'PASS')
      ON CONFLICT (material_id, lot_no) DO UPDATE SET unit_cost = EXCLUDED.unit_cost
      RETURNING id INTO v_lot;
    END IF;

    INSERT INTO erp.stock_movements (moved_at, movement_type, lot_id, material_id, qty, unit_cost, ref_table, ref_id, user_id, reason)
    VALUES (r.received_at, 'RECEIPT', v_lot, it.material_id, it.actual_qty, it.price_per_uom, 'goods_receipt_items', it.id, p_user,
            CASE WHEN it.is_manual_entry THEN 'Manual entry (timbangan offline)' END);
  END LOOP;

  UPDATE erp.goods_receipts SET status = 'POSTED', posted_at = now() WHERE id = r.id;
  RETURN 'POSTED';
END $$;

CREATE OR REPLACE FUNCTION erp.tg_goods_receipts_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_prev timestamptz;
BEGIN
  SELECT received_at INTO v_prev FROM erp.goods_receipts
  WHERE supplier_id = NEW.supplier_id AND delivery_note_no = NEW.delivery_note_no AND status <> 'CANCELLED';
  IF FOUND THEN
    PERFORM erp.fn_err('DUPLICATE_DELIVERY_NOTE', format('Surat jalan %s sudah pernah diterima pada %s.',
      NEW.delivery_note_no, to_char(v_prev AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY')));
  END IF;
  NEW.receipt_no := coalesce(NEW.receipt_no, erp.fn_next_doc_no('GR'));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_goods_receipts_bi BEFORE INSERT ON erp.goods_receipts FOR EACH ROW EXECUTE FUNCTION erp.tg_goods_receipts_bi();

CREATE OR REPLACE FUNCTION erp.fn_approve_goods_receipt(p_receipt_id bigint, p_supervisor bigint, p_note text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE r erp.goods_receipts;
BEGIN
  PERFORM erp.fn_assert_user(p_supervisor, ARRAY['SUPERVISOR']::erp.user_role[]);
  SELECT * INTO r FROM erp.goods_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF r.status <> 'PENDING_APPROVAL' THEN
    PERFORM erp.fn_err('INVALID_STATUS', 'Penerimaan ini tidak sedang menunggu approval.');
  END IF;
  IF coalesce(trim(p_note), '') = '' THEN PERFORM erp.fn_err('NOTE_REQUIRED', 'Catatan approval selisih wajib diisi.'); END IF;
  UPDATE erp.goods_receipts SET approved_by = p_supervisor, approved_at = now(),
         notes = concat_ws(' | ', notes, 'Approval: ' || p_note) WHERE id = r.id;
  RETURN erp.fn_post_goods_receipt(p_receipt_id, p_supervisor);
END $$;

-- FR-02.3  Stock opname / adjustment
CREATE OR REPLACE FUNCTION erp.fn_approve_stock_adjustment(p_adj_id bigint, p_supervisor bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE a erp.stock_adjustments; it record;
BEGIN
  PERFORM erp.fn_assert_user(p_supervisor, ARRAY['SUPERVISOR']::erp.user_role[]);
  SELECT * INTO a FROM erp.stock_adjustments WHERE id = p_adj_id FOR UPDATE;
  IF a.status <> 'PENDING' THEN PERFORM erp.fn_err('INVALID_STATUS', 'Adjustment sudah diproses.'); END IF;
  FOR it IN SELECT * FROM erp.stock_adjustment_items WHERE adjustment_id = a.id AND diff_qty <> 0 LOOP
    INSERT INTO erp.stock_movements (movement_type, lot_id, material_id, qty, unit_cost, ref_table, ref_id, user_id, reason)
    SELECT 'ADJUSTMENT', it.lot_id, l.material_id, it.diff_qty, m.avg_cost, 'stock_adjustments', a.id, p_supervisor, a.reason
    FROM erp.material_lots l JOIN erp.materials m ON m.id = l.material_id WHERE l.id = it.lot_id;
  END LOOP;
  UPDATE erp.stock_adjustments SET status = 'APPROVED', approved_by = p_supervisor, approved_at = now() WHERE id = a.id;
END $$;

-- =====================================================================
-- 5. FR-03  WORK ORDER (SPK)
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_work_orders_biu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE b erp.boms;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.wo_no := coalesce(NEW.wo_no, erp.fn_next_doc_no('SPK'));
    IF NEW.status <> 'DRAFT' THEN PERFORM erp.fn_err('INVALID_STATUS', 'SPK baru harus berstatus Draft.'); END IF;
    SELECT * INTO b FROM erp.boms WHERE id = NEW.bom_id;
    IF b.sku_id IS DISTINCT FROM NEW.sku_id OR b.status <> 'ACTIVE' THEN
      PERFORM erp.fn_err('BOM_INACTIVE', 'SKU belum memiliki BOM aktif.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM erp.sku_routings WHERE sku_id = NEW.sku_id) THEN
      PERFORM erp.fn_err('ROUTING_MISSING', 'SKU belum memiliki routing aktif.');
    END IF;
    IF NEW.due_date < erp.fn_wib_date(now()) THEN
      PERFORM erp.fn_err('DUE_DATE_PAST', 'Tanggal target tidak boleh sebelum hari ini.');
    END IF;
  ELSE
    IF OLD.status <> 'DRAFT' AND (NEW.sku_id, NEW.bom_id, NEW.destination) IS DISTINCT FROM (OLD.sku_id, OLD.bom_id, OLD.destination) THEN
      PERFORM erp.fn_err('WO_LOCKED', 'SKU, BOM, dan tujuan SPK hanya dapat diubah saat Draft.');
    END IF;
    IF OLD.status IN ('CLOSED','CANCELLED') AND NEW.status <> OLD.status THEN
      PERFORM erp.fn_err('WO_LOCKED', 'SPK yang sudah ditutup tidak dapat dibuka kembali.');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_work_orders_biu BEFORE INSERT OR UPDATE ON erp.work_orders FOR EACH ROW EXECUTE FUNCTION erp.tg_work_orders_biu();

CREATE OR REPLACE FUNCTION erp.tg_wo_lines_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders;
BEGIN
  SELECT * INTO w FROM erp.work_orders WHERE id = coalesce(NEW.work_order_id, OLD.work_order_id);
  IF w.status <> 'DRAFT' THEN
    PERFORM erp.fn_err('WO_LOCKED', 'Qty SPK yang sudah Active tidak dapat diubah. Tutup dan buat SPK revisi.');
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (SELECT 1 FROM erp.sku_variants WHERE id = NEW.sku_variant_id AND sku_id = w.sku_id) THEN
    PERFORM erp.fn_err('VARIANT_MISMATCH', 'Varian tidak sesuai dengan SKU pada SPK.');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_wo_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.work_order_lines
  FOR EACH ROW EXECUTE FUNCTION erp.tg_wo_lines_guard();

CREATE OR REPLACE FUNCTION erp.tg_wo_lines_sync() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE erp.work_orders w SET target_qty = (SELECT coalesce(sum(target_qty), 0) FROM erp.work_order_lines WHERE work_order_id = w.id)
  WHERE w.id = coalesce(NEW.work_order_id, OLD.work_order_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_wo_lines_sync AFTER INSERT OR UPDATE OR DELETE ON erp.work_order_lines
  FOR EACH ROW EXECUTE FUNCTION erp.tg_wo_lines_sync();

-- Kebutuhan material SPK (Kg/pcs) = Σ qty varian × BOM size × (1 + shrinkage)
CREATE OR REPLACE FUNCTION erp.fn_wo_requirements(p_wo bigint)
RETURNS TABLE (material_id bigint, required_qty numeric, est_cost numeric)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE v_missing text;
BEGIN
  SELECT string_agg(DISTINCT v.size, ', ') INTO v_missing
  FROM erp.work_order_lines wl
  JOIN erp.work_orders w ON w.id = wl.work_order_id
  JOIN erp.sku_variants v ON v.id = wl.sku_variant_id
  WHERE wl.work_order_id = p_wo
    AND NOT EXISTS (SELECT 1 FROM erp.bom_lines bl WHERE bl.bom_id = w.bom_id AND bl.size = v.size AND bl.is_main_fabric);
  IF v_missing IS NOT NULL THEN
    PERFORM erp.fn_err('BOM_INCOMPLETE', format('Kain utama wajib diisi untuk size %s.', v_missing));
  END IF;

  RETURN QUERY
  SELECT bl.material_id,
         round(sum(wl.target_qty * erp.fn_bom_qty_to_uom(bl.qty_per_pcs, bl.qty_unit)
               * (1 + coalesce(bl.shrinkage_pct, CASE WHEN m.category = 'FABRIC' THEN m.shrinkage_pct ELSE 0 END) / 100)), 3),
         round(sum(wl.target_qty * erp.fn_bom_qty_to_uom(bl.qty_per_pcs, bl.qty_unit)
               * (1 + coalesce(bl.shrinkage_pct, CASE WHEN m.category = 'FABRIC' THEN m.shrinkage_pct ELSE 0 END) / 100)) * m.avg_cost, 2)
  FROM erp.work_order_lines wl
  JOIN erp.work_orders w   ON w.id = wl.work_order_id
  JOIN erp.sku_variants v  ON v.id = wl.sku_variant_id
  JOIN erp.bom_lines bl    ON bl.bom_id = w.bom_id AND bl.size = v.size
  JOIN erp.materials m     ON m.id = bl.material_id
  WHERE wl.work_order_id = p_wo
  GROUP BY bl.material_id, m.avg_cost;
END $$;

-- FR-03.1 + FR-02.2  Aktivasi SPK: cek stok, reserve FIFO, snapshot HPP estimasi
CREATE OR REPLACE FUNCTION erp.fn_activate_work_order(p_wo bigint, p_user bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  w erp.work_orders; r record; l record; m erp.materials;
  v_short text := ''; v_avail numeric; v_need numeric; v_take numeric;
  v_mat numeric; v_pack numeric; v_lab numeric; v_ovh numeric; v_cnt int := 0;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['SUPERVISOR']::erp.user_role[]);
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'SPK tidak ditemukan.'); END IF;
  IF w.status <> 'DRAFT' THEN PERFORM erp.fn_err('INVALID_STATUS', format('%s berstatus %s, bukan Draft.', w.wo_no, w.status)); END IF;
  IF w.target_qty <= 0 THEN PERFORM erp.fn_err('EMPTY', 'Qty SPK harus lebih dari 0.'); END IF;

  FOR r IN SELECT * FROM erp.fn_wo_requirements(p_wo) LOOP
    SELECT coalesce(sum(qty_on_hand - qty_reserved), 0) INTO v_avail
      FROM erp.material_lots WHERE material_id = r.material_id AND qc_status = 'PASS';
    IF v_avail < r.required_qty THEN
      SELECT * INTO m FROM erp.materials WHERE id = r.material_id;
      v_short := v_short || format('%s %s %s; ', m.name, erp.fn_fmt(r.required_qty - v_avail, 2), erp.fn_uom_label(m.uom));
    END IF;
  END LOOP;
  IF v_short <> '' THEN
    PERFORM erp.fn_err('INSUFFICIENT_STOCK', format('SPK tetap Draft. Kekurangan: %s', rtrim(v_short, '; ')));
  END IF;

  FOR r IN SELECT * FROM erp.fn_wo_requirements(p_wo) LOOP
    v_need := r.required_qty;
    FOR l IN SELECT id, qty_on_hand - qty_reserved AS free FROM erp.material_lots
             WHERE material_id = r.material_id AND qc_status = 'PASS' AND qty_on_hand - qty_reserved > 0
             ORDER BY received_at, id FOR UPDATE
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := least(v_need, l.free);
      INSERT INTO erp.material_allocations (work_order_id, lot_id, material_id, qty_reserved)
      VALUES (p_wo, l.id, r.material_id, v_take);
      v_need := v_need - v_take; v_cnt := v_cnt + 1;
    END LOOP;
  END LOOP;

  SELECT coalesce(sum(est_cost), 0) / w.target_qty INTO v_mat FROM erp.fn_wo_requirements(p_wo);
  SELECT coalesce(sum(sp.qty_per_pack * mm.avg_cost) / max(s.pack_qty), 0) INTO v_pack
    FROM erp.sku_packaging sp JOIN erp.materials mm ON mm.id = sp.material_id JOIN erp.skus s ON s.id = sp.sku_id
    WHERE sp.sku_id = w.sku_id;
  SELECT coalesce(sum(erp.fn_rate_at(r2.operation_id, erp.fn_wib_date(now()))), 0),
         coalesce(sum(o.smv_minutes), 0) * erp.fn_setting_num('est_overhead_per_smv_minute', 0)
    INTO v_lab, v_ovh
    FROM erp.sku_routings r2 JOIN erp.operations o ON o.id = r2.operation_id WHERE r2.sku_id = w.sku_id;

  UPDATE erp.work_orders SET status = 'ACTIVE', activated_by = p_user, activated_at = now(),
         est_material_per_pcs = round(v_mat + v_pack, 2), est_labor_per_pcs = round(v_lab, 2), est_overhead_per_pcs = round(v_ovh, 2)
  WHERE id = p_wo;

  RETURN jsonb_build_object('wo_no', w.wo_no, 'status', 'ACTIVE', 'allocations', v_cnt,
    'est_per_pcs', jsonb_build_object('material', round(v_mat + v_pack, 2), 'labor', round(v_lab, 2), 'overhead', round(v_ovh, 2)));
END $$;

-- Penutupan SPK (auto/manual) → lepas sisa reserve, hitung HPP
CREATE OR REPLACE FUNCTION erp.fn_finalize_work_order(p_wo bigint, p_type erp.close_type, p_user bigint, p_reason text,
                                                      p_cancel boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders;
BEGIN
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  UPDATE erp.material_allocations
     SET status = CASE WHEN qty_consumed > 0 THEN 'CONSUMED'::erp.allocation_status ELSE 'RELEASED'::erp.allocation_status END,
         closed_at = now()
   WHERE work_order_id = p_wo AND status = 'RESERVED';
  UPDATE erp.pack_units SET status = 'CANCELLED' WHERE work_order_id = p_wo AND status = 'OPEN';
  UPDATE erp.work_orders SET status = CASE WHEN p_cancel THEN 'CANCELLED'::erp.wo_status ELSE 'CLOSED'::erp.wo_status END,
         closed_at = now(), closed_by = p_user, close_type = p_type, close_reason = p_reason
   WHERE id = p_wo;
  UPDATE erp.bundles SET status = 'VOID' WHERE work_order_id = p_wo AND status IN ('CREATED');
  IF NOT p_cancel AND EXISTS (SELECT 1 FROM erp.pack_units WHERE work_order_id = p_wo AND status = 'CONFIRMED') THEN
    PERFORM erp.fn_calculate_wo_costing(p_wo);
  END IF;
  PERFORM erp.fn_notify('WO_CLOSED', format('%s %s', w.wo_no, CASE WHEN p_cancel THEN 'dibatalkan' ELSE 'ditutup' END),
    CASE WHEN p_type = 'MANUAL' THEN 'Ditutup manual: ' || p_reason ELSE 'Target packing tercapai. HPP aktual dihitung.' END,
    NULL, 'FINANCE', 'work_orders', p_wo::text);
END $$;

CREATE OR REPLACE FUNCTION erp.fn_close_work_order(p_wo bigint, p_user bigint, p_reason text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['SUPERVISOR']::erp.user_role[]);
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  IF w.status <> 'ACTIVE' THEN PERFORM erp.fn_err('INVALID_STATUS', 'Hanya SPK Active yang dapat ditutup.'); END IF;
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM erp.fn_err('REASON_REQUIRED', 'Alasan penutupan wajib diisi.'); END IF;
  PERFORM erp.fn_finalize_work_order(p_wo, 'MANUAL', p_user, p_reason);
END $$;

CREATE OR REPLACE FUNCTION erp.fn_cancel_work_order(p_wo bigint, p_user bigint, p_reason text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['SUPERVISOR']::erp.user_role[]);
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  IF w.status NOT IN ('DRAFT','ACTIVE') THEN PERFORM erp.fn_err('INVALID_STATUS', 'SPK sudah ditutup.'); END IF;
  IF EXISTS (SELECT 1 FROM erp.cutting_records WHERE work_order_id = p_wo) THEN
    PERFORM erp.fn_err('HAS_PRODUCTION', 'SPK sudah memiliki hasil cutting. Gunakan tutup manual.');
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM erp.fn_err('REASON_REQUIRED', 'Alasan pembatalan wajib diisi.'); END IF;
  PERFORM erp.fn_finalize_work_order(p_wo, 'MANUAL', p_user, p_reason, true);
END $$;

-- =====================================================================
-- 6. FR-03.2  CUTTING + konsumsi material
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_cutting_records_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_var numeric; v_thr numeric := erp.fn_setting_num('cutting_variance_pct', 5);
BEGIN
  NEW.cut_no := coalesce(NEW.cut_no, erp.fn_next_doc_no('CUT'));
  IF coalesce(NEW.cut_pcs, 0) <= 0 OR coalesce(NEW.spread_kg, 0) <= 0 OR coalesce(NEW.bom_gram_per_pcs, 0) <= 0 THEN
    PERFORM erp.fn_err('INVALID_INPUT', 'Berat gelar, total pcs, dan gram BOM wajib lebih dari 0.');
  END IF;
  IF NEW.scrap_kg >= NEW.spread_kg THEN PERFORM erp.fn_err('INVALID_SCRAP', 'Berat scrap tidak valid.'); END IF;
  v_var := ((NEW.spread_kg - NEW.scrap_kg) / NEW.cut_pcs * 1000 - NEW.bom_gram_per_pcs) / NEW.bom_gram_per_pcs * 100;
  IF abs(v_var) > v_thr AND coalesce(trim(NEW.variance_note), '') = '' THEN
    PERFORM erp.fn_err('VARIANCE_NOTE_REQUIRED',
      format('Variance %s%% melebihi ±%s%% dari BOM. Isi catatan penyebab.', erp.fn_fmt(v_var, 1), erp.fn_fmt(v_thr, 0)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cutting_records_bi BEFORE INSERT ON erp.cutting_records FOR EACH ROW EXECUTE FUNCTION erp.tg_cutting_records_bi();

-- p_lines: [{"sku_variant_id":1,"qty":600}, ...]
CREATE OR REPLACE FUNCTION erp.fn_record_cutting(p_wo bigint, p_lot bigint, p_spread_kg numeric, p_scrap_kg numeric,
                                                 p_lines jsonb, p_user bigint, p_note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  w erp.work_orders; lot erp.material_lots; a erp.material_allocations; r record; al record;
  v_pcs int; v_already int; v_overcut numeric; v_bomg numeric; v_tol numeric; v_remain numeric;
  v_cid bigint; v_need numeric; v_take numeric; v_cost numeric; v_got numeric; mname text;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['CUTTING']::erp.staff_function[]);
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  IF NOT FOUND OR w.status <> 'ACTIVE' THEN PERFORM erp.fn_err('WO_NOT_ACTIVE', 'SPK tidak ditemukan atau belum Active.'); END IF;
  SELECT * INTO lot FROM erp.material_lots WHERE id = p_lot FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Lot kain tidak ditemukan.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM erp.bom_lines WHERE bom_id = w.bom_id AND material_id = lot.material_id AND is_main_fabric) THEN
    PERFORM erp.fn_err('LOT_MISMATCH', format('Lot %s bukan kain utama pada BOM SPK ini.', lot.lot_no));
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    PERFORM erp.fn_err('EMPTY', 'Isi qty hasil potong per size/warna.');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) x
             WHERE NOT EXISTS (SELECT 1 FROM erp.work_order_lines wl
                               WHERE wl.work_order_id = p_wo AND wl.sku_variant_id = (x->>'sku_variant_id')::bigint)
                OR coalesce((x->>'qty')::int, 0) <= 0) THEN
    PERFORM erp.fn_err('VARIANT_MISMATCH', 'Varian atau qty hasil potong tidak sesuai SPK.');
  END IF;
  SELECT sum((x->>'qty')::int) INTO v_pcs FROM jsonb_array_elements(p_lines) x;
  IF p_spread_kg IS NULL OR p_spread_kg <= 0 THEN PERFORM erp.fn_err('INVALID_SPREAD', 'Berat kain digelar wajib lebih dari 0 Kg.'); END IF;
  IF p_scrap_kg IS NULL OR p_scrap_kg < 0 OR p_scrap_kg >= p_spread_kg THEN PERFORM erp.fn_err('INVALID_SCRAP', 'Berat scrap tidak valid.'); END IF;

  -- Over-cut: total potong ≤ target × (1 + toleransi)
  SELECT coalesce(sum(cut_pcs), 0) INTO v_already FROM erp.cutting_records WHERE work_order_id = p_wo;
  v_overcut := erp.fn_setting_num('overcut_tolerance_pct', 3);
  IF v_already + v_pcs > floor(w.target_qty * (1 + v_overcut / 100)) THEN
    PERFORM erp.fn_err('OVERCUT', format('Total hasil potong %s pcs melebihi target SPK + toleransi %s%% (%s pcs).',
      erp.fn_fmt(v_already + v_pcs), erp.fn_fmt(v_overcut, 0), erp.fn_fmt(floor(w.target_qty * (1 + v_overcut / 100)))));
  END IF;

  -- Gram BOM rata-rata tertimbang per size untuk kain ini
  SELECT sum(x.qty * bl.qty_per_pcs) / sum(x.qty) INTO v_bomg
  FROM (SELECT (e->>'sku_variant_id')::bigint AS vid, (e->>'qty')::int AS qty FROM jsonb_array_elements(p_lines) e) x
  JOIN erp.sku_variants v ON v.id = x.vid
  JOIN erp.bom_lines bl ON bl.bom_id = w.bom_id AND bl.size = v.size AND bl.material_id = lot.material_id;

  -- Pemakaian vs alokasi
  SELECT * INTO a FROM erp.material_allocations WHERE work_order_id = p_wo AND lot_id = p_lot AND status = 'RESERVED' FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_ALLOCATED', format('Lot %s belum dialokasikan untuk %s.', lot.lot_no, w.wo_no)); END IF;
  v_remain := a.qty_reserved - a.qty_consumed;
  v_tol := erp.fn_setting_num('allocation_overuse_tolerance_pct', 2);
  IF p_spread_kg > v_remain * (1 + v_tol / 100) THEN
    PERFORM erp.fn_err('OVER_ALLOCATION', format('Pemakaian %s Kg melebihi alokasi lot %s (sisa %s Kg). Minta tambahan alokasi ke Supervisor.',
      erp.fn_fmt(p_spread_kg, 2), lot.lot_no, erp.fn_fmt(v_remain, 2)));
  END IF;

  INSERT INTO erp.cutting_records (work_order_id, lot_id, spread_kg, cut_pcs, scrap_kg, bom_gram_per_pcs, variance_note, cut_by)
  VALUES (p_wo, p_lot, p_spread_kg, v_pcs, p_scrap_kg, round(v_bomg, 2), nullif(trim(p_note), ''), p_user)
  RETURNING id INTO v_cid;
  INSERT INTO erp.cutting_record_lines (cutting_record_id, sku_variant_id, qty)
  SELECT v_cid, (e->>'sku_variant_id')::bigint, (e->>'qty')::int FROM jsonb_array_elements(p_lines) e;

  -- Kain utama: konsumsi reserve dulu, baru stok
  SELECT avg_cost INTO v_cost FROM erp.materials WHERE id = lot.material_id;
  UPDATE erp.material_allocations SET qty_consumed = qty_consumed + p_spread_kg WHERE id = a.id;
  INSERT INTO erp.stock_movements (movement_type, lot_id, material_id, qty, unit_cost, work_order_id, ref_table, ref_id, user_id)
  VALUES ('ISSUE_CUTTING', p_lot, lot.material_id, -p_spread_kg, v_cost, p_wo, 'cutting_records', v_cid, p_user);

  -- Material pendukung (karet, benang, tape, label) sesuai BOM × pcs dipotong
  FOR r IN
    SELECT bl.material_id,
           round(sum(x.qty * erp.fn_bom_qty_to_uom(bl.qty_per_pcs, bl.qty_unit) * (1 + coalesce(bl.shrinkage_pct, 0) / 100)), 3) AS need
    FROM (SELECT (e->>'sku_variant_id')::bigint AS vid, (e->>'qty')::int AS qty FROM jsonb_array_elements(p_lines) e) x
    JOIN erp.sku_variants v ON v.id = x.vid
    JOIN erp.bom_lines bl ON bl.bom_id = w.bom_id AND bl.size = v.size AND NOT bl.is_main_fabric
    GROUP BY bl.material_id
  LOOP
    v_need := r.need;
    SELECT avg_cost, name INTO v_cost, mname FROM erp.materials WHERE id = r.material_id;
    FOR al IN SELECT * FROM erp.material_allocations
              WHERE work_order_id = p_wo AND material_id = r.material_id AND status = 'RESERVED' AND qty_reserved > qty_consumed
              ORDER BY id FOR UPDATE
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := least(v_need, al.qty_reserved - al.qty_consumed);
      UPDATE erp.material_allocations SET qty_consumed = qty_consumed + v_take WHERE id = al.id;
      INSERT INTO erp.stock_movements (movement_type, lot_id, material_id, qty, unit_cost, work_order_id, ref_table, ref_id, user_id)
      VALUES ('ISSUE_ACCESSORY', al.lot_id, r.material_id, -v_take, v_cost, p_wo, 'cutting_records', v_cid, p_user);
      v_need := v_need - v_take;
    END LOOP;
    IF v_need > 0 THEN
      v_got := erp.fn_consume_free_stock(r.material_id, v_need, 'ISSUE_ACCESSORY', p_wo, 'cutting_records', v_cid, p_user);
      IF v_got < v_need THEN
        PERFORM erp.fn_err('INSUFFICIENT_STOCK', format('Stok %s tidak mencukupi untuk hasil potong ini.', mname));
      END IF;
    END IF;
  END LOOP;

  RETURN v_cid;
END $$;

-- FR-03.3  Limbah perca: validasi stok limbah & kredit overhead saat dijual
CREATE OR REPLACE FUNCTION erp.tg_scrap_disposals_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_avail numeric;
BEGIN
  NEW.disposal_no := coalesce(NEW.disposal_no, erp.fn_next_doc_no('SCR'));
  SELECT (SELECT coalesce(sum(scrap_kg), 0) FROM erp.cutting_records)
       - (SELECT coalesce(sum(qty_kg), 0) FROM erp.scrap_disposals) INTO v_avail;
  IF NEW.qty_kg > v_avail THEN
    PERFORM erp.fn_err('INSUFFICIENT_SCRAP', format('Stok limbah tidak mencukupi (tersedia %s Kg).', erp.fn_fmt(v_avail, 2)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_scrap_disposals_bi BEFORE INSERT ON erp.scrap_disposals FOR EACH ROW EXECUTE FUNCTION erp.tg_scrap_disposals_bi();

CREATE OR REPLACE FUNCTION erp.tg_scrap_disposals_ai() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.method = 'SOLD' THEN
    INSERT INTO erp.overhead_entries (period_id, category, amount, description, ref_table, ref_id, created_by)
    VALUES (erp.fn_ensure_overhead_period(erp.fn_wib_date(NEW.disposed_at)), 'SCRAP_SALE_CREDIT', -NEW.total_amount,
            format('Penjualan limbah perca %s Kg (%s)', erp.fn_fmt(NEW.qty_kg, 2), NEW.disposal_no), 'scrap_disposals', NEW.id, NEW.recorded_by);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_scrap_disposals_ai AFTER INSERT ON erp.scrap_disposals FOR EACH ROW EXECUTE FUNCTION erp.tg_scrap_disposals_ai();

-- =====================================================================
-- 7. FR-03.4  BUNDEL & TIKET QR
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.fn_generate_bundles(p_cutting_id bigint, p_user bigint, p_bundle_size int DEFAULT NULL)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  c erp.cutting_records; w erp.work_orders; r record;
  v_size int; v_total int; v_base int; v_n int := 0; v_rem int; v_q int; v_bid bigint;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['CUTTING']::erp.staff_function[]);
  SELECT * INTO c FROM erp.cutting_records WHERE id = p_cutting_id;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Data cutting tidak ditemukan.'); END IF;
  IF EXISTS (SELECT 1 FROM erp.bundles WHERE cutting_record_id = p_cutting_id) THEN
    PERFORM erp.fn_err('ALREADY_GENERATED', 'Bundel untuk hasil cutting ini sudah dibuat. Gunakan cetak ulang.');
  END IF;
  SELECT * INTO w FROM erp.work_orders WHERE id = c.work_order_id;
  v_size := coalesce(p_bundle_size, erp.fn_setting_num('bundle_size_default', 24)::int);
  IF v_size NOT BETWEEN 1 AND 100 THEN PERFORM erp.fn_err('INVALID_SIZE', 'Ukuran bundel harus 1–100 pcs.'); END IF;

  SELECT sum(ceil(qty::numeric / v_size))::int INTO v_total FROM erp.cutting_record_lines WHERE cutting_record_id = p_cutting_id;
  SELECT count(*) INTO v_base FROM erp.bundles WHERE work_order_id = c.work_order_id AND NOT is_rework;

  FOR r IN SELECT crl.sku_variant_id, crl.qty FROM erp.cutting_record_lines crl
           JOIN erp.sku_variants v ON v.id = crl.sku_variant_id
           WHERE crl.cutting_record_id = p_cutting_id ORDER BY v.size_order, v.color
  LOOP
    v_rem := r.qty;
    WHILE v_rem > 0 LOOP
      v_q := least(v_size, v_rem); v_n := v_n + 1;
      INSERT INTO erp.bundles (bundle_code, work_order_id, cutting_record_id, sku_variant_id, lot_id, seq_no, seq_total, qty)
      VALUES ('BDL-' || right(w.wo_no, 4) || '-' || lpad((v_base + v_n)::text, 3, '0'),
              c.work_order_id, c.id, r.sku_variant_id, c.lot_id, v_n, v_total, v_q)
      RETURNING id INTO v_bid;
      INSERT INTO erp.bundle_prints (bundle_id, version, printed_by) VALUES (v_bid, 1, p_user);
      v_rem := v_rem - v_q;
    END LOOP;
  END LOOP;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_reprint_bundle(p_bundle_code text, p_user bigint, p_reason text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE b erp.bundles;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['SUPERVISOR']::erp.user_role[]);
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM erp.fn_err('REASON_REQUIRED', 'Alasan cetak ulang wajib diisi.'); END IF;
  UPDATE erp.bundles SET ticket_version = ticket_version + 1 WHERE bundle_code = upper(p_bundle_code) RETURNING * INTO b;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Bundel tidak ditemukan.'); END IF;
  INSERT INTO erp.bundle_prints (bundle_id, version, printed_by, reason) VALUES (b.id, b.ticket_version, p_user, p_reason);
  RETURN b.bundle_code || ':' || b.ticket_version;   -- isi QR baru
END $$;

-- QR = "BDL-0101-012:2" (kode:versi). Input manual tanpa versi tetap diterima.
CREATE OR REPLACE FUNCTION erp.fn_resolve_ticket(p_qr text) RETURNS erp.bundles
LANGUAGE plpgsql AS $$
DECLARE v_code text := upper(trim(split_part(p_qr, ':', 1))); v_ver text := nullif(trim(split_part(p_qr, ':', 2)), ''); b erp.bundles;
BEGIN
  SELECT * INTO b FROM erp.bundles WHERE bundle_code = v_code;
  IF NOT FOUND THEN
    PERFORM erp.fn_err('TICKET_UNKNOWN', format('Tiket %s tidak dikenal. Cek tiket atau minta cetak ulang ke Supervisor.', v_code));
  END IF;
  IF v_ver IS NOT NULL THEN
    IF v_ver !~ '^\d+$' THEN
      PERFORM erp.fn_err('TICKET_INVALID', 'Format tiket tidak valid.');
    ELSIF v_ver::int <> b.ticket_version THEN
      PERFORM erp.fn_err('TICKET_INVALID', 'Tiket sudah tidak berlaku. Gunakan tiket cetak ulang.');
    END IF;
  END IF;
  IF b.status = 'VOID' THEN PERFORM erp.fn_err('BUNDLE_VOID', 'Bundel ini sudah dibatalkan.'); END IF;
  RETURN b;
END $$;

-- =====================================================================
-- 8. FR-04.1  WIP TRACKING (scan kios)
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_wip_tasks_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  b erp.bundles; w erp.work_orders; u erp.users; mc erp.machines; t erp.wip_tasks;
  v_seq smallint; v_missing text; v_opname text; v_who text;
BEGIN
  SELECT * INTO b FROM erp.bundles WHERE id = NEW.bundle_id FOR UPDATE;
  IF b.status IN ('VOID','INSPECTED') THEN
    PERFORM erp.fn_err('BUNDLE_CLOSED', 'Bundel sudah selesai QC atau tidak berlaku.');
  END IF;
  SELECT * INTO w FROM erp.work_orders WHERE id = b.work_order_id;
  IF w.status <> 'ACTIVE' THEN PERFORM erp.fn_err('WO_NOT_ACTIVE', format('%s tidak aktif.', w.wo_no)); END IF;

  SELECT * INTO u FROM erp.users WHERE id = NEW.operator_id;
  IF u.status <> 'ACTIVE' OR u.role <> 'STAFF' OR u.staff_function NOT IN ('OPERATOR','CUTTING') THEN
    PERFORM erp.fn_err('OPERATOR_INVALID', 'ID ini bukan operator produksi aktif.');
  END IF;

  SELECT * INTO t FROM erp.wip_tasks WHERE bundle_id = NEW.bundle_id AND operation_id = NEW.operation_id;
  IF FOUND THEN
    SELECT full_name INTO v_who FROM erp.users WHERE id = t.operator_id;
    IF t.completed_at IS NOT NULL THEN PERFORM erp.fn_err('ALREADY_RECORDED', 'Sudah tercatat. Tidak perlu scan ulang.');
    ELSIF t.operator_id <> NEW.operator_id THEN PERFORM erp.fn_err('BUNDLE_BUSY', format('Bundel sedang dikerjakan oleh %s.', v_who));
    ELSE PERFORM erp.fn_err('ALREADY_STARTED', 'Bundel ini sudah Anda mulai. Scan lagi untuk SELESAI.');
    END IF;
  END IF;

  SELECT name INTO v_opname FROM erp.operations WHERE id = NEW.operation_id;
  IF b.is_rework THEN
    IF NEW.operation_id <> b.rework_operation_id THEN
      SELECT name INTO v_opname FROM erp.operations WHERE id = b.rework_operation_id;
      PERFORM erp.fn_err('REWORK_ONLY', format('Bundel rework hanya untuk proses %s.', v_opname));
    END IF;
  ELSE
    SELECT seq INTO v_seq FROM erp.sku_routings WHERE sku_id = w.sku_id AND operation_id = NEW.operation_id;
    IF NOT FOUND THEN PERFORM erp.fn_err('NOT_IN_ROUTING', format('Proses %s tidak ada di routing SKU ini.', v_opname)); END IF;
    SELECT string_agg(o.name, ', ' ORDER BY r.seq) INTO v_missing
    FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
    WHERE r.sku_id = w.sku_id AND r.seq < v_seq
      AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id AND x.completed_at IS NOT NULL);
    IF v_missing IS NOT NULL THEN
      PERFORM erp.fn_err('ROUTING_ORDER', format('Bundel belum melewati proses %s.', v_missing));
    END IF;
  END IF;

  IF NEW.machine_id IS NOT NULL THEN
    SELECT * INTO mc FROM erp.machines WHERE id = NEW.machine_id;
    IF mc.status = 'DOWN' THEN PERFORM erp.fn_err('MACHINE_DOWN', format('Mesin %s sedang Down. Gunakan mesin lain.', mc.asset_code)); END IF;
    NEW.line_id := coalesce(NEW.line_id, mc.line_id);
  END IF;
  NEW.line_id := coalesce(NEW.line_id, u.line_id);
  NEW.qty := b.qty;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_wip_tasks_bi BEFORE INSERT ON erp.wip_tasks FOR EACH ROW EXECUTE FUNCTION erp.tg_wip_tasks_bi();

CREATE OR REPLACE FUNCTION erp.tg_wip_tasks_bu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_smv numeric; v_ratio numeric; v_code text;
BEGIN
  IF (NEW.bundle_id, NEW.operation_id, NEW.operator_id, NEW.qty) IS DISTINCT FROM (OLD.bundle_id, OLD.operation_id, OLD.operator_id, OLD.qty)
     AND (NEW.corrected_by IS NULL OR coalesce(trim(NEW.correction_reason), '') = '') THEN
    PERFORM erp.fn_err('CORRECTION_REQUIRED', 'Perubahan data scan hanya lewat koreksi Supervisor dengan alasan.');
  END IF;
  IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at AND NEW.corrected_by IS NULL THEN
    PERFORM erp.fn_err('ALREADY_RECORDED', 'Sudah tercatat. Tidak perlu scan ulang.');
  END IF;
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    SELECT smv_minutes INTO v_smv FROM erp.operations WHERE id = NEW.operation_id;
    v_ratio := erp.fn_setting_num('scan_anomaly_ratio', 0.5);
    IF extract(epoch FROM (NEW.completed_at - NEW.started_at)) / 60 < v_smv * NEW.qty * v_ratio THEN
      NEW.is_anomaly := true;
      SELECT bundle_code INTO v_code FROM erp.bundles WHERE id = NEW.bundle_id;
      PERFORM erp.fn_notify('SCAN_ANOMALY', format('Scan cepat tidak wajar %s', v_code),
        format('Durasi di bawah %s%% standar SMV. Tinjau sebelum payroll.', erp.fn_fmt(v_ratio * 100, 0)),
        NULL, 'SUPERVISOR', 'wip_tasks', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_wip_tasks_bu BEFORE UPDATE ON erp.wip_tasks FOR EACH ROW EXECUTE FUNCTION erp.tg_wip_tasks_bu();

CREATE OR REPLACE FUNCTION erp.tg_wip_tasks_aiu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE b erp.bundles; v_sku bigint; v_done boolean;
BEGIN
  SELECT * INTO b FROM erp.bundles WHERE id = NEW.bundle_id;
  IF TG_OP = 'INSERT' AND b.status = 'CREATED' THEN
    UPDATE erp.bundles SET status = 'IN_PROGRESS' WHERE id = b.id;
  END IF;
  IF NEW.completed_at IS NOT NULL THEN
    IF b.is_rework THEN
      v_done := true;
    ELSE
      SELECT sku_id INTO v_sku FROM erp.work_orders WHERE id = b.work_order_id;
      SELECT NOT EXISTS (SELECT 1 FROM erp.sku_routings r WHERE r.sku_id = v_sku
               AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id AND x.completed_at IS NOT NULL))
        INTO v_done;
    END IF;
    IF v_done THEN UPDATE erp.bundles SET status = 'SEWN' WHERE id = b.id AND status IN ('CREATED','IN_PROGRESS'); END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_wip_tasks_aiu AFTER INSERT OR UPDATE ON erp.wip_tasks FOR EACH ROW EXECUTE FUNCTION erp.tg_wip_tasks_aiu();

-- Endpoint kios. p_action: 'START' | 'COMPLETE'. Idempoten via p_client_id (UUID dari kios, aman untuk sinkron offline).
CREATE OR REPLACE FUNCTION erp.fn_wip_scan(p_qr text, p_operator_code text, p_action text,
                                           p_machine_code text DEFAULT NULL, p_client_id uuid DEFAULT NULL,
                                           p_scanned_at timestamptz DEFAULT now(), p_source erp.scan_source DEFAULT 'ONLINE')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  b erp.bundles; u erp.users; t erp.wip_tasks; w erp.work_orders;
  v_op bigint; v_mc bigint; v_who text; v_next text; v_opname text;
BEGIN
  IF p_client_id IS NOT NULL THEN
    SELECT * INTO t FROM erp.wip_tasks WHERE client_start_id = p_client_id OR client_complete_id = p_client_id;
    IF FOUND THEN RETURN jsonb_build_object('status', 'DUPLICATE_IGNORED', 'task_id', t.id); END IF;
  END IF;
  b := erp.fn_resolve_ticket(p_qr);
  u := erp.fn_resolve_operator(p_operator_code);
  SELECT * INTO w FROM erp.work_orders WHERE id = b.work_order_id;

  IF upper(p_action) = 'START' THEN
    SELECT * INTO t FROM erp.wip_tasks WHERE bundle_id = b.id AND completed_at IS NULL LIMIT 1;
    IF FOUND THEN
      IF t.operator_id = u.id THEN PERFORM erp.fn_err('ALREADY_STARTED', 'Bundel ini sudah Anda mulai. Scan lagi untuk SELESAI.'); END IF;
      SELECT full_name INTO v_who FROM erp.users WHERE id = t.operator_id;
      PERFORM erp.fn_err('BUNDLE_BUSY', format('Bundel sedang dikerjakan oleh %s.', v_who));
    END IF;
    IF b.is_rework THEN
      v_op := b.rework_operation_id;
      IF EXISTS (SELECT 1 FROM erp.wip_tasks WHERE bundle_id = b.id AND operation_id = v_op AND completed_at IS NOT NULL) THEN v_op := NULL; END IF;
    ELSE
      SELECT r.operation_id INTO v_op FROM erp.sku_routings r
      WHERE r.sku_id = w.sku_id AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id)
      ORDER BY r.seq LIMIT 1;
    END IF;
    IF v_op IS NULL THEN
      SELECT * INTO t FROM erp.wip_tasks WHERE bundle_id = b.id AND completed_at IS NULL LIMIT 1;
      IF FOUND THEN
        SELECT full_name INTO v_who FROM erp.users WHERE id = t.operator_id;
        PERFORM erp.fn_err('BUNDLE_BUSY', format('Bundel sedang dikerjakan oleh %s.', v_who));
      END IF;
      PERFORM erp.fn_err('ALL_DONE', 'Semua proses bundel sudah selesai. Kirim ke QC.');
    END IF;
    IF p_machine_code IS NOT NULL THEN
      SELECT id INTO v_mc FROM erp.machines WHERE asset_code = upper(p_machine_code);
      IF NOT FOUND THEN PERFORM erp.fn_err('MACHINE_UNKNOWN', format('Mesin %s tidak terdaftar.', p_machine_code)); END IF;
    END IF;
    INSERT INTO erp.wip_tasks (bundle_id, operation_id, operator_id, machine_id, qty, started_at, source, client_start_id)
    VALUES (b.id, v_op, u.id, v_mc, b.qty, p_scanned_at, p_source, p_client_id) RETURNING * INTO t;
    SELECT name INTO v_opname FROM erp.operations WHERE id = v_op;
    RETURN jsonb_build_object('status', 'STARTED', 'task_id', t.id, 'bundle', b.bundle_code, 'operation', v_opname,
                              'qty', b.qty, 'target_minutes', (SELECT round(smv_minutes * b.qty, 1) FROM erp.operations WHERE id = v_op));

  ELSIF upper(p_action) = 'COMPLETE' THEN
    SELECT * INTO t FROM erp.wip_tasks WHERE bundle_id = b.id AND completed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN PERFORM erp.fn_err('ALREADY_RECORDED', 'Sudah tercatat. Tidak perlu scan ulang.'); END IF;
    IF t.operator_id <> u.id THEN
      SELECT full_name INTO v_who FROM erp.users WHERE id = t.operator_id;
      PERFORM erp.fn_err('NOT_OWNER', format('Bundel dimulai oleh %s. Hanya operator tersebut yang dapat menyelesaikan.', v_who));
    END IF;
    UPDATE erp.wip_tasks SET completed_at = p_scanned_at, client_complete_id = p_client_id,
           source = CASE WHEN p_source = 'OFFLINE_SYNC' THEN p_source ELSE source END
    WHERE id = t.id RETURNING * INTO t;
    SELECT o.name INTO v_opname FROM erp.operations o WHERE o.id = t.operation_id;
    SELECT o.name INTO v_next FROM erp.sku_routings r JOIN erp.operations o ON o.id = r.operation_id
    WHERE NOT b.is_rework AND r.sku_id = w.sku_id
      AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id AND x.completed_at IS NOT NULL)
    ORDER BY r.seq LIMIT 1;
    RETURN jsonb_build_object('status', 'COMPLETED', 'task_id', t.id, 'bundle', b.bundle_code, 'operation', v_opname,
                              'qty', t.qty, 'duration_min', t.duration_min, 'is_anomaly', t.is_anomaly,
                              'next_operation', coalesce(v_next, 'QC'));
  END IF;
  PERFORM erp.fn_err('INVALID_ACTION', 'Aksi harus START atau COMPLETE.');
  RETURN NULL;
END $$;

-- Supervisor meninjau scan anomali (diterima = tetap dibayar)
CREATE OR REPLACE FUNCTION erp.fn_review_anomaly(p_task_id bigint, p_supervisor bigint, p_accept boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM erp.fn_assert_user(p_supervisor, ARRAY['SUPERVISOR']::erp.user_role[]);
  UPDATE erp.wip_tasks SET anomaly_reviewed_by = p_supervisor, anomaly_reviewed_at = now(), anomaly_accepted = p_accept
  WHERE id = p_task_id AND is_anomaly;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Scan anomali tidak ditemukan.'); END IF;
END $$;

-- =====================================================================
-- 9. FR-04.2/04.3  DOWNTIME & SPARE PART
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_downtime_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE mc erp.machines; v_open text;
BEGIN
  SELECT * INTO mc FROM erp.machines WHERE id = NEW.machine_id FOR UPDATE;
  SELECT ticket_no INTO v_open FROM erp.downtime_tickets WHERE machine_id = NEW.machine_id AND status <> 'RESOLVED';
  IF v_open IS NOT NULL THEN
    PERFORM erp.fn_err('TICKET_EXISTS', format('Mesin ini sudah memiliki tiket terbuka %s.', v_open));
  END IF;
  NEW.ticket_no   := coalesce(NEW.ticket_no, erp.fn_next_doc_no('DT'));
  NEW.line_id     := coalesce(NEW.line_id, mc.line_id);
  NEW.assigned_to := coalesce(NEW.assigned_to, mc.technician_id);
  NEW.status      := 'OPEN';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_downtime_bi BEFORE INSERT ON erp.downtime_tickets FOR EACH ROW EXECUTE FUNCTION erp.tg_downtime_bi();

CREATE OR REPLACE FUNCTION erp.tg_downtime_ai() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_asset text;
BEGIN
  UPDATE erp.machines SET status = 'DOWN' WHERE id = NEW.machine_id RETURNING asset_code INTO v_asset;
  IF NEW.assigned_to IS NOT NULL THEN
    PERFORM erp.fn_notify('DOWNTIME_NEW', format('Tiket %s · %s', NEW.ticket_no, v_asset), NEW.issue_type,
                          NEW.assigned_to, NULL, 'downtime_tickets', NEW.id::text);
  END IF;
  PERFORM erp.fn_notify('DOWNTIME_NEW', format('Mesin %s Down', v_asset), NEW.issue_type, NULL, 'SUPERVISOR', 'downtime_tickets', NEW.id::text);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_downtime_ai AFTER INSERT ON erp.downtime_tickets FOR EACH ROW EXECUTE FUNCTION erp.tg_downtime_ai();

CREATE OR REPLACE FUNCTION erp.tg_downtime_bu() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'RESOLVED' AND NEW.status <> 'RESOLVED' THEN
    PERFORM erp.fn_err('INVALID_STATUS', 'Tiket yang sudah Resolved tidak dapat dibuka kembali. Buat tiket baru.');
  END IF;
  IF NEW.status = 'IN_PROGRESS' AND OLD.status = 'OPEN' THEN
    NEW.acknowledged_at := coalesce(NEW.acknowledged_at, now());
  END IF;
  IF NEW.status = 'RESOLVED' AND OLD.status <> 'RESOLVED' THEN
    IF coalesce(trim(NEW.resolution_note), '') = '' THEN
      PERFORM erp.fn_err('NOTE_REQUIRED', 'Isi tindakan perbaikan sebelum menandai Resolved.');
    END IF;
    NEW.resolved_at := coalesce(NEW.resolved_at, now());
    NEW.acknowledged_at := coalesce(NEW.acknowledged_at, OLD.acknowledged_at, NEW.resolved_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_downtime_bu BEFORE UPDATE ON erp.downtime_tickets FOR EACH ROW EXECUTE FUNCTION erp.tg_downtime_bu();

CREATE OR REPLACE FUNCTION erp.tg_downtime_au() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'RESOLVED' AND OLD.status <> 'RESOLVED' THEN
    UPDATE erp.machines SET status = 'RUNNING' WHERE id = NEW.machine_id AND status = 'DOWN';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_downtime_au AFTER UPDATE ON erp.downtime_tickets FOR EACH ROW EXECUTE FUNCTION erp.tg_downtime_au();

CREATE OR REPLACE FUNCTION erp.fn_report_downtime(p_machine_code text, p_issue text, p_user bigint, p_description text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_mc bigint; v_no text;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['SUPERVISOR','STAFF']::erp.user_role[], ARRAY['OPERATOR','CUTTING','QC','PACKING','TEKNISI']::erp.staff_function[]);
  SELECT id INTO v_mc FROM erp.machines WHERE asset_code = upper(p_machine_code);
  IF NOT FOUND THEN PERFORM erp.fn_err('MACHINE_UNKNOWN', format('Mesin %s tidak terdaftar.', p_machine_code)); END IF;
  INSERT INTO erp.downtime_tickets (machine_id, issue_type, description, reported_by)
  VALUES (v_mc, p_issue, p_description, p_user) RETURNING ticket_no INTO v_no;
  RETURN v_no;
END $$;

-- Dipanggil scheduler tiap 5 menit: tiket OPEN tanpa respons > N menit → eskalasi ke Supervisor
CREATE OR REPLACE FUNCTION erp.fn_escalate_downtime() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE t record; v_n int := 0; v_min numeric := erp.fn_setting_num('downtime_escalation_minutes', 15);
BEGIN
  FOR t IN SELECT dt.*, m.asset_code FROM erp.downtime_tickets dt JOIN erp.machines m ON m.id = dt.machine_id
           WHERE dt.status = 'OPEN' AND dt.escalated_at IS NULL AND dt.reported_at < now() - make_interval(mins => v_min::int)
  LOOP
    UPDATE erp.downtime_tickets SET escalated_at = now() WHERE id = t.id;
    PERFORM erp.fn_notify('DOWNTIME_ESCALATION', format('Eskalasi %s · %s', t.ticket_no, t.asset_code),
      format('Belum direspons teknisi lebih dari %s menit.', v_min), NULL, 'SUPERVISOR', 'downtime_tickets', t.id::text);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- FR-04.3  Spare part: potong stok otomatis + biaya ke overhead
CREATE OR REPLACE FUNCTION erp.tg_downtime_spareparts_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE m erp.materials; v_got numeric; dt erp.downtime_tickets;
BEGIN
  SELECT * INTO m FROM erp.materials WHERE id = NEW.material_id;
  IF m.category <> 'SPAREPART' THEN PERFORM erp.fn_err('NOT_SPAREPART', format('%s bukan spare part.', m.name)); END IF;
  SELECT * INTO dt FROM erp.downtime_tickets WHERE id = NEW.ticket_id;
  NEW.unit_cost := m.avg_cost;
  v_got := erp.fn_consume_free_stock(NEW.material_id, NEW.qty, 'ISSUE_MAINTENANCE', NULL, 'downtime_spareparts', NEW.id, NEW.recorded_by);
  NEW.is_shortage := v_got < NEW.qty;
  IF v_got > 0 THEN
    INSERT INTO erp.overhead_entries (period_id, category, amount, description, ref_table, ref_id, created_by)
    VALUES (erp.fn_ensure_overhead_period(erp.fn_wib_date(NEW.recorded_at)), 'SPAREPART', round(v_got * m.avg_cost, 2),
            format('%s × %s untuk %s', m.name, erp.fn_fmt(v_got, 0), dt.ticket_no), 'downtime_spareparts', NEW.id, NEW.recorded_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_downtime_spareparts_bi BEFORE INSERT ON erp.downtime_spareparts FOR EACH ROW EXECUTE FUNCTION erp.tg_downtime_spareparts_bi();

-- =====================================================================
-- 10. FR-05  QUALITY CONTROL
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_qc_inspections_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE b erp.bundles; v_op text;
BEGIN
  SELECT * INTO b FROM erp.bundles WHERE id = NEW.bundle_id FOR UPDATE;
  IF b.status <> 'SEWN' THEN
    SELECT o.name INTO v_op FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
      WHERE t.bundle_id = b.id AND t.completed_at IS NULL LIMIT 1;
    IF v_op IS NULL THEN   -- belum ada yang mengerjakan: tampilkan proses berikutnya
      SELECT o.name INTO v_op FROM erp.operations o
      WHERE o.id = coalesce(b.rework_operation_id,
            (SELECT r.operation_id FROM erp.sku_routings r JOIN erp.work_orders w ON w.sku_id = r.sku_id
              WHERE w.id = b.work_order_id
                AND NOT EXISTS (SELECT 1 FROM erp.wip_tasks x WHERE x.bundle_id = b.id AND x.operation_id = r.operation_id AND x.completed_at IS NOT NULL)
              ORDER BY r.seq LIMIT 1));
    END IF;
    PERFORM erp.fn_err('NOT_READY_FOR_QC', CASE WHEN b.status = 'INSPECTED' THEN 'Bundel ini sudah di-QC.'
                                             ELSE format('Bundel masih di proses %s.', coalesce(v_op, 'jahit')) END);
  END IF;
  IF NEW.qty_pass + NEW.qty_rework + NEW.qty_reject <> b.qty THEN
    PERFORM erp.fn_err('QC_TOTAL_MISMATCH', format('Total %s tidak sesuai isi bundel %s.',
      NEW.qty_pass + NEW.qty_rework + NEW.qty_reject, b.qty));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qc_inspections_bi BEFORE INSERT ON erp.qc_inspections FOR EACH ROW EXECUTE FUNCTION erp.tg_qc_inspections_bi();

CREATE OR REPLACE FUNCTION erp.tg_qc_inspections_bu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_qty smallint;
BEGIN
  IF NEW.corrected_by IS NULL OR coalesce(trim(NEW.correction_reason), '') = '' THEN
    PERFORM erp.fn_err('CORRECTION_REQUIRED', 'Koreksi hasil QC hanya oleh Supervisor dengan alasan.');
  END IF;
  IF EXISTS (SELECT 1 FROM erp.payroll_periods WHERE status = 'APPROVED'
             AND erp.fn_wib_date(OLD.inspected_at) BETWEEN period_start AND period_end) THEN
    PERFORM erp.fn_err('PAYROLL_LOCKED', 'Hasil QC ini sudah masuk periode payroll yang di-approve.');
  END IF;
  SELECT qty INTO v_qty FROM erp.bundles WHERE id = NEW.bundle_id;
  IF NEW.qty_pass + NEW.qty_rework + NEW.qty_reject <> v_qty THEN
    PERFORM erp.fn_err('QC_TOTAL_MISMATCH', format('Total %s tidak sesuai isi bundel %s.', NEW.qty_pass + NEW.qty_rework + NEW.qty_reject, v_qty));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qc_inspections_bu BEFORE UPDATE ON erp.qc_inspections FOR EACH ROW
  WHEN ((NEW.qty_pass, NEW.qty_rework, NEW.qty_reject) IS DISTINCT FROM (OLD.qty_pass, OLD.qty_rework, OLD.qty_reject))
  EXECUTE FUNCTION erp.tg_qc_inspections_bu();

CREATE OR REPLACE FUNCTION erp.tg_qc_inspections_aiu() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE erp.bundles SET status = 'INSPECTED', qty_pass = NEW.qty_pass WHERE id = NEW.bundle_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_qc_inspections_aiu AFTER INSERT OR UPDATE ON erp.qc_inspections FOR EACH ROW EXECUTE FUNCTION erp.tg_qc_inspections_aiu();

-- Deferred: jumlah defect per outcome harus sama dengan qty rework/reject (dicek saat COMMIT)
CREATE OR REPLACE FUNCTION erp.fn_qc_defects_check(p_inspection_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE i erp.qc_inspections; v_rw int; v_rj int;
BEGIN
  SELECT * INTO i FROM erp.qc_inspections WHERE id = p_inspection_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT coalesce(sum(qty) FILTER (WHERE outcome = 'REWORK'), 0), coalesce(sum(qty) FILTER (WHERE outcome = 'REJECT'), 0)
    INTO v_rw, v_rj FROM erp.qc_inspection_defects WHERE inspection_id = i.id;
  IF v_rw <> i.qty_rework OR v_rj <> i.qty_reject THEN
    PERFORM erp.fn_err('DEFECT_REQUIRED', 'Pilih jenis cacat. Jumlah per kategori cacat harus sama dengan qty Rework dan Reject.');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION erp.tg_qc_inspections_defects() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN PERFORM erp.fn_qc_defects_check(NEW.id); RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION erp.tg_qc_defects_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM erp.fn_qc_defects_check(OLD.inspection_id);
  ELSE PERFORM erp.fn_qc_defects_check(NEW.inspection_id); END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_qc_inspections_defects AFTER INSERT OR UPDATE ON erp.qc_inspections
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp.tg_qc_inspections_defects();
CREATE CONSTRAINT TRIGGER trg_qc_defects_check AFTER INSERT OR UPDATE OR DELETE ON erp.qc_inspection_defects
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp.tg_qc_defects_check();

-- Endpoint kios QC. p_rework/p_reject: [{"defect":"KARET_MELINTIR","qty":2,"operation_code":"OP-..."}]
CREATE OR REPLACE FUNCTION erp.fn_record_qc(p_qr text, p_inspector_code text, p_pass int,
                                            p_rework jsonb DEFAULT '[]', p_reject jsonb DEFAULT '[]',
                                            p_inspected_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  b erp.bundles; u erp.users; v_ins bigint; v_rw int; v_rj int; v_op bigint; v_root erp.bundles; v_n int;
  v_rb_code text; v_rb bigint; v_unknown text; v_total numeric; v_bad numeric; v_thr numeric; v_day date;
BEGIN
  b := erp.fn_resolve_ticket(p_qr);
  u := erp.fn_resolve_operator(p_inspector_code);
  IF NOT (u.role = 'SUPERVISOR' OR (u.role = 'STAFF' AND u.staff_function = 'QC')) THEN
    PERFORM erp.fn_err('ACCESS_DENIED', 'Hanya Staff QC atau Supervisor yang dapat menginput hasil QC.');
  END IF;
  SELECT coalesce(sum((e->>'qty')::int), 0) INTO v_rw FROM jsonb_array_elements(coalesce(p_rework, '[]')) e;
  SELECT coalesce(sum((e->>'qty')::int), 0) INTO v_rj FROM jsonb_array_elements(coalesce(p_reject, '[]')) e;
  SELECT string_agg(DISTINCT e->>'defect', ', ') INTO v_unknown
  FROM jsonb_array_elements(coalesce(p_rework, '[]') || coalesce(p_reject, '[]')) e
  WHERE NOT EXISTS (SELECT 1 FROM erp.defect_categories d WHERE d.code = upper(e->>'defect') AND d.status = 'ACTIVE');
  IF v_unknown IS NOT NULL THEN PERFORM erp.fn_err('DEFECT_UNKNOWN', format('Kategori cacat tidak dikenal: %s.', v_unknown)); END IF;

  INSERT INTO erp.qc_inspections (bundle_id, inspector_id, inspected_at, qty_pass, qty_rework, qty_reject)
  VALUES (b.id, u.id, p_inspected_at, p_pass, v_rw, v_rj) RETURNING id INTO v_ins;

  INSERT INTO erp.qc_inspection_defects (inspection_id, outcome, defect_category_id, qty, responsible_operation_id)
  SELECT v_ins, x.outcome, d.id, sum(x.qty), coalesce(max(o.id), d.default_operation_id)
  FROM (SELECT 'REWORK'::erp.qc_outcome AS outcome, upper(e->>'defect') AS code, (e->>'qty')::int AS qty, e->>'operation_code' AS opc
          FROM jsonb_array_elements(coalesce(p_rework, '[]')) e
        UNION ALL
        SELECT 'REJECT', upper(e->>'defect'), (e->>'qty')::int, e->>'operation_code'
          FROM jsonb_array_elements(coalesce(p_reject, '[]')) e) x
  JOIN erp.defect_categories d ON d.code = x.code
  LEFT JOIN erp.operations o ON o.code = x.opc
  GROUP BY x.outcome, d.id, d.default_operation_id;

  IF v_rw > 0 THEN
    SELECT responsible_operation_id INTO v_op FROM erp.qc_inspection_defects
    WHERE inspection_id = v_ins AND outcome = 'REWORK' ORDER BY qty DESC, id LIMIT 1;
    IF v_op IS NULL THEN   -- default: operasi terakhir di routing / operasi rework sebelumnya
      SELECT coalesce(b.rework_operation_id,
             (SELECT r.operation_id FROM erp.sku_routings r JOIN erp.work_orders w ON w.sku_id = r.sku_id
               WHERE w.id = b.work_order_id ORDER BY r.seq DESC LIMIT 1)) INTO v_op;
    END IF;
    SELECT * INTO v_root FROM erp.bundles WHERE id = coalesce(b.root_bundle_id, b.id);
    SELECT count(*) + 1 INTO v_n FROM erp.bundles WHERE root_bundle_id = v_root.id;
    v_rb_code := v_root.bundle_code || '-R' || v_n;
    INSERT INTO erp.bundles (bundle_code, work_order_id, cutting_record_id, sku_variant_id, lot_id, seq_no, seq_total, qty,
                             is_rework, parent_bundle_id, root_bundle_id, rework_operation_id)
    VALUES (v_rb_code, b.work_order_id, b.cutting_record_id, b.sku_variant_id, b.lot_id, 1, 1, v_rw,
            true, b.id, v_root.id, v_op) RETURNING id INTO v_rb;
    INSERT INTO erp.bundle_prints (bundle_id, version, printed_by) VALUES (v_rb, 1, u.id);
    UPDATE erp.qc_inspections SET rework_bundle_id = v_rb WHERE id = v_ins;
  END IF;

  -- Notifikasi defect rate harian melewati toleransi (sekali per hari)
  v_day := erp.fn_wib_date(p_inspected_at);
  v_thr := erp.fn_setting_num('defect_rate_threshold_pct', 5);
  SELECT sum(qty_pass + qty_rework + qty_reject), sum(qty_rework + qty_reject) INTO v_total, v_bad
  FROM erp.qc_inspections WHERE erp.fn_wib_date(inspected_at) = v_day;
  IF v_total >= erp.fn_setting_num('defect_alert_min_sample', 48) AND v_bad / v_total * 100 > v_thr
     AND NOT EXISTS (SELECT 1 FROM erp.notifications WHERE type = 'DEFECT_THRESHOLD' AND entity_id = v_day::text) THEN
    PERFORM erp.fn_notify('DEFECT_THRESHOLD', format('Defect rate %s%% hari ini', erp.fn_fmt(v_bad / v_total * 100, 1)),
      format('Melewati toleransi %s%% (%s dari %s pcs).', erp.fn_fmt(v_thr, 0), erp.fn_fmt(v_bad), erp.fn_fmt(v_total)), NULL, 'SUPERVISOR', 'qc_daily', v_day::text);
    PERFORM erp.fn_notify('DEFECT_THRESHOLD', format('Defect rate %s%% hari ini', erp.fn_fmt(v_bad / v_total * 100, 1)),
      format('Melewati toleransi %s%%.', erp.fn_fmt(v_thr, 0)), NULL, 'FOUNDER', 'qc_daily', v_day::text);
  END IF;

  RETURN jsonb_build_object('inspection_id', v_ins, 'bundle', b.bundle_code, 'pass', p_pass, 'rework', v_rw, 'reject', v_rj,
                            'rework_bundle', v_rb_code, 'payroll_credited_pcs', p_pass);
END $$;

-- FR-05.3  Grading retur: total klasifikasi = qty retur. p_grades: [{"grade":"B_GRADE","qty":3,"defect":"NODA"}]
CREATE OR REPLACE FUNCTION erp.fn_grade_return(p_return_id bigint, p_grades jsonb, p_user bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r erp.customer_returns; v_sum int; g record;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['QC']::erp.staff_function[]);
  SELECT * INTO r FROM erp.customer_returns WHERE id = p_return_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM erp.return_gradings WHERE return_id = r.id) THEN
    PERFORM erp.fn_err('ALREADY_GRADED', 'Retur ini sudah diklasifikasi.');
  END IF;
  SELECT coalesce(sum((e->>'qty')::int), 0) INTO v_sum FROM jsonb_array_elements(p_grades) e;
  IF v_sum <> r.qty THEN
    PERFORM erp.fn_err('QTY_MISMATCH', format('Total klasifikasi %s tidak sama dengan qty retur %s.', v_sum, r.qty));
  END IF;
  FOR g IN SELECT (e->>'grade')::erp.return_grade AS grade, (e->>'qty')::int AS qty, d.id AS defect_id
           FROM jsonb_array_elements(p_grades) e LEFT JOIN erp.defect_categories d ON d.code = upper(e->>'defect')
  LOOP
    INSERT INTO erp.return_gradings (return_id, grade, qty, defect_category_id, graded_by) VALUES (r.id, g.grade, g.qty, g.defect_id, p_user);
    IF g.grade IN ('RESTOCK_A','B_GRADE') THEN
      INSERT INTO erp.fg_movements (movement_type, sku_variant_id, grade, qty, work_order_id, ref_table, ref_id, user_id, reason)
      VALUES ('RETURN_IN', r.sku_variant_id, CASE WHEN g.grade = 'RESTOCK_A' THEN 'A'::erp.fg_grade ELSE 'B'::erp.fg_grade END,
              g.qty, r.work_order_id, 'customer_returns', r.id, p_user, r.reason);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 11. FR-06  PACKING, FINISHED GOODS, DISPATCH
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_fg_movements_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s erp.fg_stock; v_label text;
BEGIN
  NEW.user_id := coalesce(NEW.user_id, erp.fn_actor());
  IF NEW.qty < 0 THEN
    SELECT * INTO s FROM erp.fg_stock WHERE sku_variant_id = NEW.sku_variant_id AND grade = NEW.grade FOR UPDATE;
    IF coalesce(s.qty_on_hand - s.qty_reserved, 0) + NEW.qty < 0 THEN
      SELECT k.code || ' ' || v.size || ' ' || v.color INTO v_label FROM erp.sku_variants v JOIN erp.skus k ON k.id = v.sku_id WHERE v.id = NEW.sku_variant_id;
      PERFORM erp.fn_err('INSUFFICIENT_FG', format('Stok %s kurang %s pcs.', v_label,
        erp.fn_fmt(-NEW.qty - coalesce(s.qty_on_hand - s.qty_reserved, 0))));
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fg_movements_bi BEFORE INSERT ON erp.fg_movements FOR EACH ROW EXECUTE FUNCTION erp.tg_fg_movements_bi();

CREATE OR REPLACE FUNCTION erp.tg_fg_movements_ai() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- UPDATE dulu (INSERT … ON CONFLICT mengecek CHECK pada baris usulan bernilai negatif)
  UPDATE erp.fg_stock SET qty_on_hand = qty_on_hand + NEW.qty
  WHERE sku_variant_id = NEW.sku_variant_id AND grade = NEW.grade;
  IF NOT FOUND THEN
    INSERT INTO erp.fg_stock (sku_variant_id, grade, qty_on_hand) VALUES (NEW.sku_variant_id, NEW.grade, NEW.qty);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_fg_movements_ai AFTER INSERT ON erp.fg_movements FOR EACH ROW EXECUTE FUNCTION erp.tg_fg_movements_ai();

-- Komposisi pack: multipack → pack_components; single → varian itu sendiri × 1
CREATE OR REPLACE FUNCTION erp.fn_pack_composition(p_fg_variant bigint)
RETURNS TABLE (component_variant_id bigint, qty int) LANGUAGE sql STABLE AS $$
  SELECT pc.component_variant_id, pc.qty::int FROM erp.pack_components pc WHERE pc.pack_variant_id = p_fg_variant
  UNION ALL
  SELECT p_fg_variant, 1 WHERE NOT EXISTS (SELECT 1 FROM erp.pack_components WHERE pack_variant_id = p_fg_variant)
$$;

CREATE OR REPLACE FUNCTION erp.fn_pack_open(p_wo bigint, p_fg_variant bigint, p_user bigint, p_pack_count int DEFAULT 1)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders; v_id bigint; v_n int;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['PACKING']::erp.staff_function[]);
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo;
  IF w.status <> 'ACTIVE' THEN PERFORM erp.fn_err('WO_NOT_ACTIVE', format('%s tidak aktif.', w.wo_no)); END IF;
  IF EXISTS (SELECT 1 FROM erp.fn_pack_composition(p_fg_variant) c
             WHERE NOT EXISTS (SELECT 1 FROM erp.work_order_lines wl WHERE wl.work_order_id = p_wo AND wl.sku_variant_id = c.component_variant_id)) THEN
    PERFORM erp.fn_err('PACK_MISMATCH', 'Komposisi pack tidak sesuai varian SPK ini.');
  END IF;
  SELECT count(*) + 1 INTO v_n FROM erp.pack_units WHERE work_order_id = p_wo;
  INSERT INTO erp.pack_units (pack_code, work_order_id, fg_variant_id, pack_count, packed_by)
  VALUES ('PCK-' || right(w.wo_no, 4) || '-' || lpad(v_n::text, 5, '0'), p_wo, p_fg_variant, p_pack_count, p_user)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_pack_scan(p_pack_id bigint, p_qr text, p_qty int DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  p erp.pack_units; b erp.bundles; v_req int; v_have int; v_open int; v_avail int; v_need text; v_remaining jsonb;
BEGIN
  SELECT * INTO p FROM erp.pack_units WHERE id = p_pack_id FOR UPDATE;
  IF p.status <> 'OPEN' THEN PERFORM erp.fn_err('PACK_CLOSED', 'Sesi packing sudah dikonfirmasi/dibatalkan.'); END IF;
  b := erp.fn_resolve_ticket(p_qr);
  IF b.work_order_id <> p.work_order_id THEN PERFORM erp.fn_err('WO_MISMATCH', 'Bundel bukan dari SPK ini.'); END IF;
  IF b.status <> 'INSPECTED' OR b.qty_pass = 0 THEN PERFORM erp.fn_err('NOT_PASSED', 'Item belum lolos QC.'); END IF;


  SELECT c.qty * p.pack_count INTO v_req FROM erp.fn_pack_composition(p.fg_variant_id) c WHERE c.component_variant_id = b.sku_variant_id;
  IF v_req IS NULL THEN
    SELECT string_agg(format('%s %s ×%s', v.size, v.color, c.qty * p.pack_count), ', ') INTO v_need
    FROM erp.fn_pack_composition(p.fg_variant_id) c JOIN erp.sku_variants v ON v.id = c.component_variant_id;
    PERFORM erp.fn_err('PACK_MISMATCH', format('Tidak sesuai komposisi pack. Dibutuhkan: %s.', v_need));
  END IF;
  SELECT coalesce(sum(i.qty), 0) INTO v_open FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
   WHERE i.bundle_id = b.id AND u.status = 'OPEN';
  v_avail := b.qty_pass - b.qty_packed - v_open;
  IF p_qty > v_avail THEN
    PERFORM erp.fn_err('NO_PASS_LEFT', format('Sisa item Pass QC di bundel ini tinggal %s pcs.', greatest(v_avail, 0)));
  END IF;
  SELECT coalesce(sum(qty), 0) INTO v_have FROM erp.pack_unit_items WHERE pack_unit_id = p.id AND component_variant_id = b.sku_variant_id;
  IF v_have + p_qty > v_req THEN
    PERFORM erp.fn_err('COMPONENT_FULL', format('Komponen ini sudah lengkap (%s/%s).', v_have, v_req));
  END IF;
  INSERT INTO erp.pack_unit_items (pack_unit_id, bundle_id, component_variant_id, qty) VALUES (p.id, b.id, b.sku_variant_id, p_qty);

  SELECT jsonb_agg(jsonb_build_object('size', v.size, 'color', v.color, 'required', c.qty * p.pack_count,
           'scanned', (SELECT coalesce(sum(qty), 0) FROM erp.pack_unit_items WHERE pack_unit_id = p.id AND component_variant_id = c.component_variant_id)))
    INTO v_remaining
  FROM erp.fn_pack_composition(p.fg_variant_id) c JOIN erp.sku_variants v ON v.id = c.component_variant_id;
  RETURN jsonb_build_object('pack', p.pack_code, 'components', v_remaining);
END $$;

CREATE OR REPLACE FUNCTION erp.fn_pack_confirm(p_pack_id bigint, p_user bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE p erp.pack_units; v_incomplete text; sp record; v_sku bigint; v_got numeric; v_closed boolean;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['PACKING']::erp.staff_function[]);
  SELECT * INTO p FROM erp.pack_units WHERE id = p_pack_id FOR UPDATE;
  IF p.status <> 'OPEN' THEN PERFORM erp.fn_err('PACK_CLOSED', 'Sesi packing sudah dikonfirmasi/dibatalkan.'); END IF;
  SELECT string_agg(format('%s %s (%s/%s)', v.size, v.color, coalesce(s.qty, 0), c.qty * p.pack_count), ', ') INTO v_incomplete
  FROM erp.fn_pack_composition(p.fg_variant_id) c
  JOIN erp.sku_variants v ON v.id = c.component_variant_id
  LEFT JOIN (SELECT component_variant_id, sum(qty) AS qty FROM erp.pack_unit_items WHERE pack_unit_id = p.id GROUP BY 1) s
         ON s.component_variant_id = c.component_variant_id
  WHERE coalesce(s.qty, 0) <> c.qty * p.pack_count;
  IF v_incomplete IS NOT NULL THEN
    PERFORM erp.fn_err('PACK_INCOMPLETE', format('Isi kemasan belum lengkap: %s.', v_incomplete));
  END IF;

  UPDATE erp.bundles b SET qty_packed = b.qty_packed + s.qty
  FROM (SELECT bundle_id, sum(qty) AS qty FROM erp.pack_unit_items WHERE pack_unit_id = p.id GROUP BY 1) s
  WHERE b.id = s.bundle_id;

  -- Material kemasan (polybag, box, hang tag) sesuai SKU FG
  SELECT sku_id INTO v_sku FROM erp.sku_variants WHERE id = p.fg_variant_id;
  FOR sp IN SELECT s.material_id, s.qty_per_pack * p.pack_count AS need, m.name FROM erp.sku_packaging s
            JOIN erp.materials m ON m.id = s.material_id WHERE s.sku_id = v_sku
  LOOP
    v_got := erp.fn_consume_free_stock(sp.material_id, sp.need, 'ISSUE_PACKING', p.work_order_id, 'pack_units', p.id, p_user);
    IF v_got < sp.need THEN PERFORM erp.fn_err('PACKAGING_OUT', format('Stok %s habis. Hubungi Gudang.', sp.name)); END IF;
  END LOOP;

  INSERT INTO erp.fg_movements (movement_type, sku_variant_id, grade, qty, work_order_id, ref_table, ref_id, user_id)
  VALUES ('PACKING_IN', p.fg_variant_id, 'A', p.pack_count, p.work_order_id, 'pack_units', p.id, p_user);
  UPDATE erp.pack_units SET status = 'CONFIRMED', confirmed_at = now() WHERE id = p.id;

  v_closed := erp.fn_check_wo_closure(p.work_order_id, p_user);
  RETURN jsonb_build_object('pack', p.pack_code, 'packs_added', p.pack_count, 'wo_closed', v_closed);
END $$;

-- FR-06.2  Auto-close: FG (pcs) + reject ≥ target dan tidak ada bundel tertunda
CREATE OR REPLACE FUNCTION erp.fn_check_wo_closure(p_wo bigint, p_user bigint) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE w erp.work_orders; v_packed int; v_reject int; v_open int;
BEGIN
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo FOR UPDATE;
  IF w.status <> 'ACTIVE' THEN RETURN false; END IF;
  SELECT coalesce(sum(i.qty), 0) INTO v_packed FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
   WHERE u.work_order_id = p_wo AND u.status = 'CONFIRMED';
  SELECT coalesce(sum(q.qty_reject), 0) INTO v_reject FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id
   WHERE b.work_order_id = p_wo;
  IF v_packed + v_reject < w.target_qty THEN RETURN false; END IF;
  SELECT count(*) INTO v_open FROM erp.bundles WHERE work_order_id = p_wo AND status IN ('IN_PROGRESS','SEWN')
     OR (work_order_id = p_wo AND status = 'CREATED' AND is_rework);
  IF v_open > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM erp.notifications WHERE type = 'WO_CLOSED' AND entity_id = p_wo::text AND target_role = 'SUPERVISOR' AND read_at IS NULL) THEN
      PERFORM erp.fn_notify('WO_CLOSED', format('%s belum dapat ditutup', w.wo_no),
        format('Target tercapai, tetapi masih ada %s bundel rework/proses.', v_open), NULL, 'SUPERVISOR', 'work_orders', p_wo::text);
    END IF;
    RETURN false;
  END IF;
  PERFORM erp.fn_finalize_work_order(p_wo, 'AUTO', p_user, NULL);
  RETURN true;
END $$;

-- FR-06.3  B2B dispatch
CREATE OR REPLACE FUNCTION erp.fn_approve_delivery_order(p_do bigint, p_supervisor bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM erp.fn_assert_user(p_supervisor, ARRAY['SUPERVISOR']::erp.user_role[]);
  UPDATE erp.delivery_orders SET status = 'APPROVED', approved_by = p_supervisor WHERE id = p_do AND status = 'DRAFT';
  IF NOT FOUND THEN PERFORM erp.fn_err('INVALID_STATUS', 'Delivery Order tidak dalam status Draft.'); END IF;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_ship_delivery_order(p_do bigint, p_user bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE d erp.delivery_orders; it record;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['GUDANG','PACKING']::erp.staff_function[]);
  SELECT * INTO d FROM erp.delivery_orders WHERE id = p_do FOR UPDATE;
  IF d.status <> 'APPROVED' THEN PERFORM erp.fn_err('INVALID_STATUS', 'Delivery Order belum di-approve Supervisor.'); END IF;
  FOR it IN SELECT * FROM erp.delivery_order_items WHERE delivery_order_id = d.id LOOP
    INSERT INTO erp.fg_movements (movement_type, sku_variant_id, grade, qty, ref_table, ref_id, user_id)
    VALUES ('DISPATCH_B2B', it.sku_variant_id, 'A', -it.qty, 'delivery_orders', d.id, p_user);
  END LOOP;
  UPDATE erp.delivery_orders SET status = 'SHIPPED', shipped_at = now() WHERE id = d.id;
END $$;

-- FR-06.3  B2C fulfillment: scan item per pesanan lalu kirim
CREATE OR REPLACE FUNCTION erp.tg_ecommerce_orders_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM erp.ecommerce_orders WHERE channel_id = NEW.channel_id AND external_order_no = NEW.external_order_no) THEN
    PERFORM erp.fn_err('DUPLICATE_ORDER', format('Nomor pesanan %s sudah diproses.', NEW.external_order_no));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ecommerce_orders_bi BEFORE INSERT ON erp.ecommerce_orders FOR EACH ROW EXECUTE FUNCTION erp.tg_ecommerce_orders_bi();

CREATE OR REPLACE FUNCTION erp.tg_role_permissions_bi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.module = 'COSTING' AND NEW.role IN ('SUPERVISOR','STAFF')
     AND (NEW.can_create OR NEW.can_read OR NEW.can_update OR NEW.can_delete OR NEW.can_approve) THEN
    PERFORM erp.fn_err('COSTING_LOCKED', 'Modul Costing hanya untuk Founder & Finance.');
  END IF;
  IF NEW.module = 'PAYROLL' AND NEW.role = 'SUPERVISOR'
     AND (NEW.can_create OR NEW.can_read OR NEW.can_update OR NEW.can_delete OR NEW.can_approve) THEN
    PERFORM erp.fn_err('PAYROLL_LOCKED', 'Modul Payroll tidak tersedia untuk Supervisor.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_role_permissions_bi BEFORE INSERT OR UPDATE ON erp.role_permissions FOR EACH ROW EXECUTE FUNCTION erp.tg_role_permissions_bi();

CREATE OR REPLACE FUNCTION erp.fn_ecom_scan(p_order bigint, p_barcode text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE o erp.ecommerce_orders; v_var bigint; it erp.ecommerce_order_items;
BEGIN
  SELECT * INTO o FROM erp.ecommerce_orders WHERE id = p_order FOR UPDATE;
  IF o.status NOT IN ('IMPORTED','ON_HOLD') THEN PERFORM erp.fn_err('INVALID_STATUS', 'Pesanan sudah diproses.'); END IF;
  SELECT id INTO v_var FROM erp.sku_variants WHERE barcode = p_barcode;
  SELECT * INTO it FROM erp.ecommerce_order_items WHERE order_id = o.id AND sku_variant_id = v_var FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_IN_ORDER', 'Item tidak ada di pesanan ini.'); END IF;
  IF it.qty_scanned >= it.qty THEN PERFORM erp.fn_err('ITEM_COMPLETE', 'Item ini sudah lengkap untuk pesanan.'); END IF;
  UPDATE erp.ecommerce_order_items SET qty_scanned = qty_scanned + 1 WHERE id = it.id;
  RETURN jsonb_build_object('order', o.external_order_no, 'scanned', it.qty_scanned + 1, 'required', it.qty);
END $$;

CREATE OR REPLACE FUNCTION erp.fn_ship_ecom_order(p_order bigint, p_user bigint, p_awb text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE o erp.ecommerce_orders; it record;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[], ARRAY['GUDANG','PACKING']::erp.staff_function[]);
  SELECT * INTO o FROM erp.ecommerce_orders WHERE id = p_order FOR UPDATE;
  IF o.status NOT IN ('IMPORTED','ON_HOLD','PACKED') THEN PERFORM erp.fn_err('INVALID_STATUS', 'Pesanan sudah dikirim/dibatalkan.'); END IF;
  IF EXISTS (SELECT 1 FROM erp.ecommerce_order_items WHERE order_id = o.id AND qty_scanned < qty) THEN
    PERFORM erp.fn_err('SCAN_INCOMPLETE', 'Scan semua item pesanan sebelum dikirim.');
  END IF;
  IF coalesce(trim(p_awb), '') = '' THEN PERFORM erp.fn_err('AWB_REQUIRED', 'Nomor resi wajib diisi.'); END IF;
  FOR it IN SELECT * FROM erp.ecommerce_order_items WHERE order_id = o.id LOOP
    INSERT INTO erp.fg_movements (movement_type, sku_variant_id, grade, qty, ref_table, ref_id, user_id)
    VALUES ('DISPATCH_ECOM', it.sku_variant_id, 'A', -it.qty, 'ecommerce_orders', o.id, p_user);
  END LOOP;
  UPDATE erp.ecommerce_orders SET status = 'SHIPPED', shipped_at = now(), awb_no = p_awb, packed_by = p_user WHERE id = o.id;
END $$;

-- =====================================================================
-- 12. FR-07  FINANCE: overhead, payroll, costing
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.tg_overhead_entries_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM erp.overhead_periods WHERE id = coalesce(NEW.period_id, OLD.period_id) AND status = 'LOCKED') THEN
    PERFORM erp.fn_err('PERIOD_LOCKED', 'Periode overhead sudah dikunci.');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_overhead_entries_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.overhead_entries
  FOR EACH ROW EXECUTE FUNCTION erp.tg_overhead_entries_guard();

CREATE OR REPLACE FUNCTION erp.fn_lock_overhead_period(p_period bigint, p_user bigint) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE per erp.overhead_periods; w record; v_n int := 0;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['FINANCE']::erp.user_role[]);
  UPDATE erp.overhead_periods SET status = 'LOCKED', locked_by = p_user, locked_at = now()
  WHERE id = p_period AND status = 'OPEN' RETURNING * INTO per;
  IF NOT FOUND THEN PERFORM erp.fn_err('INVALID_STATUS', 'Periode tidak ditemukan atau sudah dikunci.'); END IF;
  FOR w IN SELECT c.work_order_id FROM erp.work_order_costings c JOIN erp.work_orders wo ON wo.id = c.work_order_id
           WHERE date_trunc('month', erp.fn_wib_date(wo.closed_at)) = per.period_month
  LOOP
    PERFORM erp.fn_calculate_wo_costing(w.work_order_id); v_n := v_n + 1;
  END LOOP;
  RETURN v_n;   -- jumlah SPK yang HPP-nya menjadi FINAL
END $$;

-- Kredit tenaga kerja: lihat view erp.v_labor_credits (03_views.sql)
CREATE OR REPLACE FUNCTION erp.tg_payroll_child_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM erp.payroll_periods WHERE id = coalesce(NEW.period_id, OLD.period_id) AND status = 'APPROVED') THEN
    PERFORM erp.fn_err('PAYROLL_LOCKED', 'Periode payroll sudah di-approve dan terkunci. Gunakan adjustment di periode berikutnya.');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_payroll_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.payroll_lines
  FOR EACH ROW EXECUTE FUNCTION erp.tg_payroll_child_guard();
CREATE TRIGGER trg_payroll_adjustments_guard BEFORE INSERT OR UPDATE OR DELETE ON erp.payroll_adjustments
  FOR EACH ROW EXECUTE FUNCTION erp.tg_payroll_child_guard();

CREATE OR REPLACE FUNCTION erp.tg_payroll_periods_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'APPROVED' THEN
    PERFORM erp.fn_err('PAYROLL_LOCKED', 'Periode payroll sudah di-approve dan terkunci.');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_payroll_periods_guard BEFORE UPDATE OR DELETE ON erp.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION erp.tg_payroll_periods_guard();

CREATE OR REPLACE FUNCTION erp.fn_generate_payroll(p_period bigint, p_user bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE per erp.payroll_periods; v_lines int; v_total numeric; v_uninspected int; v_anomaly int;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['FINANCE']::erp.user_role[]);
  SELECT * INTO per FROM erp.payroll_periods WHERE id = p_period FOR UPDATE;
  IF NOT FOUND THEN PERFORM erp.fn_err('NOT_FOUND', 'Periode payroll tidak ditemukan.'); END IF;
  IF per.status <> 'DRAFT' THEN PERFORM erp.fn_err('PAYROLL_LOCKED', 'Periode payroll sudah di-approve.'); END IF;

  DELETE FROM erp.payroll_lines WHERE period_id = p_period;
  INSERT INTO erp.payroll_lines (period_id, operator_id, work_order_id, operation_id, qty_pass, rate_idr)
  SELECT p_period, c.operator_id, c.work_order_id, c.operation_id, sum(c.credit_qty), c.rate_idr
  FROM erp.v_labor_credits c
  WHERE c.credit_date BETWEEN per.period_start AND per.period_end AND c.is_payable
  GROUP BY c.operator_id, c.work_order_id, c.operation_id, c.rate_idr;
  GET DIAGNOSTICS v_lines = ROW_COUNT;

  SELECT coalesce(sum(amount), 0) INTO v_total FROM erp.payroll_lines WHERE period_id = p_period;
  SELECT count(DISTINCT b.id) INTO v_uninspected FROM erp.bundles b JOIN erp.wip_tasks t ON t.bundle_id = b.id
   WHERE b.status = 'SEWN' AND erp.fn_wib_date(t.completed_at) <= per.period_end;
  SELECT count(*) INTO v_anomaly FROM erp.v_labor_credits c
   WHERE c.credit_date BETWEEN per.period_start AND per.period_end AND NOT c.is_payable;

  UPDATE erp.payroll_periods SET generated_by = p_user, generated_at = now() WHERE id = p_period;
  PERFORM erp.fn_notify('PAYROLL_READY', format('Draf payroll %s s/d %s siap', to_char(per.period_start, 'DD-MM-YYYY'), to_char(per.period_end, 'DD-MM-YYYY')),
    format('Total Rp %s. %s bundel belum di-QC tidak masuk periode ini.', erp.fn_fmt(v_total), v_uninspected), NULL, 'FINANCE', 'payroll_periods', p_period::text);
  RETURN jsonb_build_object('lines', v_lines, 'total_idr', v_total, 'uninspected_bundles', v_uninspected, 'anomaly_scans_excluded', v_anomaly);
END $$;

CREATE OR REPLACE FUNCTION erp.fn_approve_payroll(p_period bigint, p_user bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE per erp.payroll_periods; v_norate text;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['FINANCE']::erp.user_role[]);
  SELECT * INTO per FROM erp.payroll_periods WHERE id = p_period FOR UPDATE;
  IF per.status <> 'DRAFT' THEN PERFORM erp.fn_err('PAYROLL_LOCKED', 'Periode payroll sudah di-approve.'); END IF;
  IF per.generated_at IS NULL THEN PERFORM erp.fn_err('NOT_GENERATED', 'Generate draf payroll terlebih dahulu.'); END IF;
  SELECT string_agg(DISTINCT o.name, ', ') INTO v_norate FROM erp.payroll_lines l JOIN erp.operations o ON o.id = l.operation_id
   WHERE l.period_id = p_period AND l.rate_idr IS NULL;
  IF v_norate IS NOT NULL THEN
    PERFORM erp.fn_err('RATE_MISSING', format('Operasi %s tanpa tarif. Draf tidak dapat di-approve.', v_norate));
  END IF;
  UPDATE erp.payroll_periods SET status = 'APPROVED', approved_by = p_user, approved_at = now() WHERE id = p_period;
END $$;

-- FR-07.2  HPP aktual vs estimasi per SPK (nilai per pcs FG)
CREATE OR REPLACE FUNCTION erp.fn_calculate_wo_costing(p_wo bigint) RETURNS erp.work_order_costings
LANGUAGE plpgsql AS $$
DECLARE
  w erp.work_orders; per erp.overhead_periods; c erp.work_order_costings;
  v_fg int; v_rej int; v_mat numeric; v_lab numeric; v_ovh_total numeric; v_smv_month numeric; v_smv_wo numeric;
  v_ovh numeric := 0; v_month date; v_thr numeric;
BEGIN
  SELECT * INTO w FROM erp.work_orders WHERE id = p_wo;
  SELECT coalesce(sum(i.qty), 0) INTO v_fg FROM erp.pack_unit_items i JOIN erp.pack_units u ON u.id = i.pack_unit_id
   WHERE u.work_order_id = p_wo AND u.status = 'CONFIRMED';
  IF v_fg = 0 THEN PERFORM erp.fn_err('NO_FG', format('%s belum memiliki barang jadi.', w.wo_no)); END IF;
  SELECT coalesce(sum(q.qty_reject), 0) INTO v_rej FROM erp.qc_inspections q JOIN erp.bundles b ON b.id = q.bundle_id WHERE b.work_order_id = p_wo;

  SELECT coalesce(-sum(qty * unit_cost), 0) INTO v_mat FROM erp.stock_movements
   WHERE work_order_id = p_wo AND movement_type IN ('ISSUE_CUTTING','ISSUE_ACCESSORY','ISSUE_PACKING');
  SELECT coalesce(sum(credit_qty * coalesce(rate_idr, 0)), 0) INTO v_lab FROM erp.v_labor_credits
   WHERE work_order_id = p_wo AND is_payable;

  -- Overhead: tarif per menit SMV bulan penutupan × total menit SMV SPK
  v_month := date_trunc('month', erp.fn_wib_date(coalesce(w.closed_at, now())))::date;
  SELECT * INTO per FROM erp.overhead_periods WHERE period_month = v_month;
  IF FOUND THEN
    SELECT coalesce(sum(amount), 0) INTO v_ovh_total FROM erp.overhead_entries WHERE period_id = per.id;
    SELECT coalesce(sum(t.qty * o.smv_minutes), 0) INTO v_smv_month FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
     WHERE t.completed_at IS NOT NULL AND date_trunc('month', erp.fn_wib_date(t.completed_at)) = v_month;
    SELECT coalesce(sum(t.qty * o.smv_minutes), 0) INTO v_smv_wo FROM erp.wip_tasks t JOIN erp.operations o ON o.id = t.operation_id
     JOIN erp.bundles b ON b.id = t.bundle_id WHERE b.work_order_id = p_wo AND t.completed_at IS NOT NULL;
    IF v_smv_month > 0 THEN v_ovh := v_ovh_total * v_smv_wo / v_smv_month; END IF;
  END IF;

  INSERT INTO erp.work_order_costings (work_order_id, status, fg_qty, reject_qty, est_material, est_labor, est_overhead,
                                       act_material, act_labor, act_overhead, overhead_period_id, calculated_at)
  VALUES (p_wo, CASE WHEN per.status = 'LOCKED' THEN 'FINAL'::erp.costing_status ELSE 'PROVISIONAL'::erp.costing_status END,
          v_fg, v_rej, coalesce(w.est_material_per_pcs, 0), coalesce(w.est_labor_per_pcs, 0), coalesce(w.est_overhead_per_pcs, 0),
          round(v_mat / v_fg, 2), round(v_lab / v_fg, 2), round(v_ovh / v_fg, 2), per.id, now())
  ON CONFLICT (work_order_id) DO UPDATE SET
    status = EXCLUDED.status, fg_qty = EXCLUDED.fg_qty, reject_qty = EXCLUDED.reject_qty,
    act_material = EXCLUDED.act_material, act_labor = EXCLUDED.act_labor, act_overhead = EXCLUDED.act_overhead,
    overhead_period_id = EXCLUDED.overhead_period_id, calculated_at = now()
  RETURNING * INTO c;

  v_thr := erp.fn_setting_num('cost_variance_threshold_pct', 5);
  IF abs(c.variance_pct) > v_thr THEN
    PERFORM erp.fn_notify('COST_VARIANCE', format('Variance HPP %s %s%%', w.wo_no, erp.fn_fmt(c.variance_pct, 1)),
      format('Estimasi Rp %s → aktual Rp %s per pcs.', erp.fn_fmt(c.est_total), erp.fn_fmt(c.act_total)), NULL, 'FINANCE', 'work_orders', p_wo::text);
    PERFORM erp.fn_notify('COST_VARIANCE', format('Variance HPP %s %s%%', w.wo_no, erp.fn_fmt(c.variance_pct, 1)),
      NULL, NULL, 'FOUNDER', 'work_orders', p_wo::text);
  END IF;
  RETURN c;
END $$;

-- =====================================================================
-- 13. FR-01.4  SAMPLE & PROTOTYPING
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.fn_sample_consume(p_sample bigint, p_lot bigint, p_qty numeric, p_user bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE l erp.material_lots;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['STAFF','SUPERVISOR']::erp.user_role[]);
  SELECT * INTO l FROM erp.material_lots WHERE id = p_lot;
  IF l.qty_on_hand - l.qty_reserved < p_qty THEN
    PERFORM erp.fn_err('INSUFFICIENT_STOCK', 'Stok tidak mencukupi untuk sampel.');
  END IF;
  INSERT INTO erp.stock_movements (movement_type, lot_id, material_id, qty, unit_cost, ref_table, ref_id, user_id)
  SELECT 'ISSUE_SAMPLE', l.id, l.material_id, -p_qty, m.avg_cost, 'samples', p_sample, p_user FROM erp.materials m WHERE m.id = l.material_id;
END $$;

CREATE OR REPLACE FUNCTION erp.fn_convert_sample_to_bom(p_sample bigint, p_user bigint) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE s erp.samples; v_ver smallint; v_bom bigint;
BEGIN
  PERFORM erp.fn_assert_user(p_user, ARRAY['ADMIN']::erp.user_role[]);
  SELECT * INTO s FROM erp.samples WHERE id = p_sample;
  IF s.status <> 'APPROVED' THEN PERFORM erp.fn_err('INVALID_STATUS', 'Hanya sampel Approved yang dapat dikonversi ke BOM.'); END IF;
  IF s.sku_id IS NULL THEN PERFORM erp.fn_err('SKU_REQUIRED', 'Daftarkan SKU terlebih dahulu sebelum konversi ke BOM.'); END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM erp.boms WHERE sku_id = s.sku_id;
  INSERT INTO erp.boms (sku_id, version, status, source_sample_id, notes, created_by)
  VALUES (s.sku_id, v_ver, 'DRAFT', s.id, 'Draf dari sampel ' || s.sample_no, p_user) RETURNING id INTO v_bom;
  INSERT INTO erp.bom_lines (bom_id, size, material_id, qty_per_pcs, qty_unit, is_main_fabric)
  SELECT v_bom, s.size, x.material_id,
         round(CASE WHEN m.uom = 'KG' THEN x.qty * 1000 ELSE x.qty END, 2),
         CASE WHEN m.uom = 'KG' THEN 'GRAM'::erp.bom_qty_unit ELSE 'PCS'::erp.bom_qty_unit END,
         m.category = 'FABRIC' AND x.qty = max(x.qty) FILTER (WHERE m.category = 'FABRIC') OVER ()
  FROM (SELECT material_id, -sum(qty) AS qty FROM erp.stock_movements
        WHERE ref_table = 'samples' AND ref_id = s.id AND movement_type = 'ISSUE_SAMPLE' GROUP BY material_id) x
  JOIN erp.materials m ON m.id = x.material_id;
  RETURN v_bom;
END $$;

COMMIT;
