export interface StageProgress {
  stage: 'CUTTING' | 'SEWING' | 'BONDING' | 'QC INSP' | 'PACKING';
  completedBundles: number;
  totalBundles: number;
  percentage: number;
  status: 'optimal' | 'warning' | 'queued' | 'idle';
}

export interface SPKOrder {
  id: string;
  code: string;
  name: string;
  sku: string;
  targetPcs: number;
  totalBundles: number;
  bundleSize: number;
  progressPercent: number;
  estFinish: string;
  status: 'RUNNING' | 'QUEUED' | 'PAUSED' | 'COMPLETED';
  linePace: string;
  linePaceType: 'optimal' | 'warning' | 'idle';
  note?: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW' | 'RUSH';
  stages: StageProgress[];
}

export interface DowntimeTicket {
  id: string;
  machineId: string;
  machineName: string;
  machineType: string;
  issueDescription: string;
  durationMinutes: number;
  technician: string;
  status: 'DALAM PERBAIKAN' | 'SELESAI / RUNNING' | 'MENUNGGU TEKNISI';
  severity: 'CRITICAL' | 'WARNING' | 'RESOLVED';
  startTime: string;
  rootCause?: string;
}

export interface OperatorTelemetry {
  id: string;
  code: string;
  name: string;
  machine: string;
  machineCode: string;
  operation: string;
  bundlesCompleted: number;
  pcsCompleted: number;
  targetPcs: number;
  variancePercent: number;
  status: 'ON_TARGET' | 'MACHINE_ISSUE' | 'BEHIND';
}

export interface BundleItem {
  bundleId: string;
  bundleNo: number;
  totalBundles: number;
  spkCode: string;
  productName: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  qty: number;
  currentStage: 'CUTTING' | 'SEWING' | 'BONDING' | 'QC INSP' | 'PACKING' | 'FINISHED';
  currentOp: string;
  operatorId: string;
  operatorName: string;
  machine: string;
  status: 'IN_PROCESS' | 'PASSED' | 'REWORK' | 'REJECT';
  timestamp: string;
  barcode: string;
}

export interface DefectItem {
  id: string;
  name: string;
  count: number;
  category: 'STITCHING' | 'MATERIAL' | 'DIMENSION' | 'CONTAMINATION';
}

