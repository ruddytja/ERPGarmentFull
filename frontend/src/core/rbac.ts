import type { StaffFunction, UserAccount, UserRole } from '../modules/admin/types';

/**
 * Peta modul & hak akses ERP — diturunkan dari PRD, FRD per fitur (Lampiran Matriks
 * Hak Akses) dan FRD per role (Role/00_INDEX_FRD_ROLE.md). Kalau ada perbedaan,
 * yang berlaku adalah FRD utama dan tabel erp.role_permissions di database.
 */

export type ModuleId = 'admin' | 'founder' | 'finance' | 'supervisor' | 'kiosk' | 'qc' | 'packing';

export interface ModuleMeta {
  id: ModuleId;
  path: string;
  title: string;
  subtitle: string;
  icon: string;
}

// Path mengikuti landing page di FRD per role.
export const MODULES: Record<ModuleId, ModuleMeta> = {
  admin: { id: 'admin', path: '/settings/users', title: 'Admin Console', subtitle: 'User, RBAC, Master Data & Audit', icon: 'admin_panel_settings' },
  founder: { id: 'founder', path: '/dashboard/founder', title: 'Founder Suite', subtitle: 'Executive overview (read-only)', icon: 'monitoring' },
  finance: { id: 'finance', path: '/dashboard/finance', title: 'Finance & Costing', subtitle: 'HPP, overhead & payroll borongan', icon: 'payments' },
  supervisor: { id: 'supervisor', path: '/dashboard/supervisor', title: 'Supervisor Ops', subtitle: 'WIP, downtime, bundle & QC lantai', icon: 'engineering' },
  kiosk: { id: 'kiosk', path: '/kiosk', title: 'Kios Operator', subtitle: 'Scan bundel, cycle time & downtime', icon: 'touch_app' },
  qc: { id: 'qc', path: '/kiosk/qc', title: 'Stasiun QC', subtitle: 'Inspeksi, defect log & rework', icon: 'fact_check' },
  packing: { id: 'packing', path: '/kiosk/packing', title: 'Packing & Dispatch', subtitle: 'Verifikasi packing, FG & pengiriman', icon: 'inventory_2' },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'System Admin',
  FOUNDER: 'Founder',
  FINANCE: 'Finance',
  SUPERVISOR: 'Supervisor',
  STAFF: 'Staff',
};

// Stasiun kios untuk tiap fungsi Staff (FRD_Role_05_Staff).
const STAFF_STATION: Record<StaffFunction, ModuleId> = {
  OPERATOR: 'kiosk',
  CUTTING: 'kiosk',
  TEKNISI: 'kiosk',
  QC: 'qc',
  PACKING: 'packing',
  GUDANG: 'packing',
};

/** Fungsi Staff dari DB; untuk akun demo yang belum punya, ditebak dari badge/departemen. */
export function resolveStaffFunction(user: UserAccount): StaffFunction | undefined {
  if (user.role !== 'STAFF') return undefined;
  if (user.staffFunction) return user.staffFunction;
  const badge = (user.stationBadge || '').toUpperCase();
  const dept = user.department.toLowerCase();
  if (badge.startsWith('QC') || /\bqc\b|quality|inspeksi/.test(dept)) return 'QC';
  if (/packag|packing|carton|palletiz|dispatch/.test(dept)) return 'PACKING';
  if (/gudang|warehouse/.test(dept)) return 'GUDANG';
  if (/teknisi|maintenance|mekanik/.test(dept)) return 'TEKNISI';
  if (/cutting/.test(dept)) return 'CUTTING';
  return 'OPERATOR';
}

/** Modul yang boleh dibuka oleh user. Elemen pertama = landing page. */
export function allowedModules(user: UserAccount): ModuleId[] {
  switch (user.role) {
    case 'ADMIN':
      return ['admin'];
    case 'FOUNDER':
      return ['founder'];
    case 'FINANCE':
      return ['finance'];
    case 'SUPERVISOR':
      return ['supervisor'];
    case 'STAFF': {
      const fn = resolveStaffFunction(user);
      return [STAFF_STATION[fn ?? 'OPERATOR']];
    }
    default:
      return [];
  }
}

export function landingPath(user: UserAccount): string {
  const [first] = allowedModules(user);
  return first ? MODULES[first].path : '/';
}

export function moduleForPath(pathname: string): ModuleId | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  // Cocokkan path terpanjang lebih dulu (/kiosk/qc sebelum /kiosk).
  const sorted = Object.values(MODULES).sort((a, b) => b.path.length - a.path.length);
  const hit = sorted.find((m) => clean === m.path || clean.startsWith(m.path + '/'));
  return hit ? hit.id : null;
}

/**
 * Kapabilitas lintas modul yang dikunci FRD. Data biaya (harga material, tarif,
 * HPP, payroll, overhead) hanya untuk Founder & Finance.
 */
export type Capability =
  | 'COST_VIEW' // Costing / HPP / Overhead (R)
  | 'COST_EDIT' // Input overhead, jurnal HPP (C/U) — Finance
  | 'PAYROLL_MANAGE' // Payroll borongan CRUA — Finance
  | 'SPK_CREATE' // SPK C — Supervisor
  | 'USER_MANAGE'; // User & Role CRUD — Admin

const CAPABILITIES: Record<UserRole, Capability[]> = {
  ADMIN: ['USER_MANAGE'],
  FOUNDER: ['COST_VIEW'],
  FINANCE: ['COST_VIEW', 'COST_EDIT', 'PAYROLL_MANAGE'],
  SUPERVISOR: ['SPK_CREATE'],
  STAFF: [],
};

export function hasCapability(user: UserAccount | null | undefined, cap: Capability): boolean {
  return !!user && CAPABILITIES[user.role].includes(cap);
}

// Batas idle default per role (FR-00.2 / erp.session_policies).
export const DEFAULT_IDLE_MINUTES: Record<UserRole, number> = {
  ADMIN: 15,
  FOUNDER: 15,
  FINANCE: 15,
  SUPERVISOR: 30,
  STAFF: 60,
};
