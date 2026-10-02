export interface Operator {
  id: string;
  code: string;
  name: string;
  badgeId: string;
  role: 'operator' | 'supervisor' | 'mechanic';
  initials: string;
  shift: string;
}

export interface BundleItem {
  id: string; // e.g. "BDL-0101-012"
  barcode: string;
  sku: string;
  productName: string;
  operationStep: string;
  operationSubtext: string;
  quantity: number;
  isStdBundle: boolean;
  targetPaceSecPerPc: number; // e.g. 45 sec
  targetMinutesPerBundle: number; // e.g. 18m
  passCount: number;
  reworkCount: number;
  rejectCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  startedAt?: string;
  completedAt?: string;
  elapsedSeconds: number;
  defects?: { reason: string; count: number }[];
}

export interface CompletedBundleLog {
  id: string;
  completedTimeStr: string; // e.g. "14:15 WIB"
  operationStep: string;
  quantity: number;
  passCount: number;
  operatorCode: string;
  operatorName: string;
  cycleTimeMinutes: number;
  efficiency: number;
}

export interface DowntimeEvent {
  id: string;
  reason: string;
  reportedAt: string;
  resolvedAt?: string;
  durationMinutes?: number;
  notes?: string;
  reportedBy: string;
}
