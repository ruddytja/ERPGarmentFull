export type UserRole = 'FOUNDER' | 'SUPERVISOR' | 'FINANCE' | 'STAFF' | 'ADMIN';

// Fungsi Staff sesuai enum erp.staff_function
export type StaffFunction = 'GUDANG' | 'CUTTING' | 'OPERATOR' | 'QC' | 'PACKING' | 'TEKNISI';

export type UserStatus = 'active' | 'idle' | 'deactivated';

export interface UserAccount {
  id: string; // e.g. "USR-001"
  name: string;
  email: string;
  stationBadge?: string;
  role: UserRole;
  staffFunction?: StaffFunction;
  isOwner?: boolean;
  department: string;
  subLocation: string;
  authMethod: string;
  authMethodIcon: string;
  permissions: {
    costingView: boolean;
    spkActivate: boolean;
    kioskScan: boolean;
    payrollDraft: boolean;
  };
  status: UserStatus;
  statusText: string;
  idleTimeoutMinutes: number;
  lastActive: string;
  avatarBg?: string;
  avatarColor?: string;
  pinCode?: string;
  rfidCardId?: string;
}

export interface SystemAuditItem {
  id: string;
  action: string;
  user: string;
  timeAgo: string;
  timestamp: string;
  category: 'primary' | 'tertiary' | 'secondary' | 'error';
  targetUserId?: string;
  details?: string;
}

export interface KioskTerminal {
  id: string;
  name: string;
  line: string;
  location: string;
  currentOperator: string;
  operatorId: string;
  status: 'ONLINE' | 'STANDBY' | 'LOCKED' | 'OFFLINE';
  ipAddress: string;
  pingMs: number;
  lastSync: string;
  activeSpk: string;
  piecesProcessed: number;
}

export interface GlobalConfigSettings {
  operatingCurrency: string;
  warehouseStockMass: string;
  bomYieldUnit: string;
  defaultBundleTarget: number;
  bundleTargetUnit: string;
  idleTimeouts: {
    staff: number;
    supervisor: number;
    adminFinance: number;
  };
  emergencyFloorLockout: boolean;
  lockoutReason: string;
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  serverSyncStatus: 'SYNCED' | 'SYNCING' | 'ERROR';
}
