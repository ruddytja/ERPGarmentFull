export type NavigationTab = 
  | 'dashboard' 
  | 'profitability'
  | 'costing_hpp' 
  | 'wip_spk' 
  | 'quality_qc' 
  | 'oee_maintenance' 
  | 'executive_reports'
  | 'system_settings'
  | 'audit_logs';

export type SubTab = 'overview' | 'costing' | 'lines' | 'portfolios';

export interface SPKBatch {
  id: string; // e.g. SPK-2026-10-088
  brand: string; // e.g. NAQALA, Pierre UNO, B2B Client
  skuName: string; // e.g. NAQALA Seamless Brief M-L
  category: 'Intimate & Seamless' | 'Bamboo & Modal' | 'Contract OEM' | 'Sport Active';
  lineDetail: string; // Cutting Line 1 • Fabric: 40D Spandex Italian
  assignedLine: string;
  fabricType: string;
  targetQty: number;
  completedQty: number;
  estimasiHpp: number; // in IDR
  realisasiHpp: number; // in IDR
  deltaHpp: number; // realisasi - estimasi
  marginKontribusi: number; // e.g. 42.1%
  statusEfisiensi: 'efisiensi_tinggi' | 'sesuai_budget' | 'variansi_alert';
  statusLabel: string;
  flagged?: boolean;
  flagReason?: string;
  deliveryDate: string;
  bom: {
    materialCost: number;
    materialPct: number;
    laborCost: number;
    laborPct: number;
    overheadCost: number;
    overheadPct: number;
    items: {
      name: string;
      spec: string;
      costPerPc: number;
      pct: number;
    }[];
  };
  stages: {
    cutting: { status: 'done' | 'in_progress' | 'queued'; progress: number; scrapRate: number };
    sewing: { status: 'done' | 'in_progress' | 'queued'; progress: number; samMinutes: number };
    bonding: { status: 'done' | 'in_progress' | 'queued' | 'n/a'; progress: number; tempC: number };
    packing: { status: 'done' | 'in_progress' | 'queued'; progress: number; defectRate: number };
  };
}

export interface KPIStats {
  monthlyGrossRevenue: number;
  revenueTarget: number;
  revenueGrowthPct: number;
  totalHppActual: number;
  hppBudgeted: number;
  hppEfficiencyPct: number;
  netProfitMargin: number;
  netProfitGrowthMoM: number;
  ebitda: number;
  factoryEfficiencyRate: number;
  factoryEfficiencyTarget: number;
  factoryEfficiencySurplus: number;
  overallOee: number;
  oeeAvailability: number;
  oeePerformance: number;
  oeeQuality: number;
}

export interface BrandVariance {
  id: string;
  name: string;
  subType: string;
  estimasi: number;
  realisasi: number;
  deltaPct: number;
  materialPct: number;
  laborPct: number;
  overheadPct: number;
  note: string;
  isOverrun?: boolean;
  overrunReason?: string;
  bulletColor: string;
  barColor: string;
}

export interface DefectDriver {
  id: string;
  name: string;
  subname: string;
  percentage: number;
  pcsCount: number;
  barColor: string;
  dotColor: string;
}

export interface InspectionTable {
  id: number;
  name: string;
  inspectorName: string;
  shift: string;
  activeBatch: string;
  inspectedPcs: number;
  passedPcs: number;
  defectPcs: number;
  passRate: number;
  status: 'optimal' | 'attention' | 'warning';
}

export interface DefectLogEntry {
  id: string;
  timestamp: string;
  spkId: string;
  tableId: number;
  defectType: string;
  defectQty: number;
  severity: 'minor' | 'major' | 'critical';
  rootCause: string;
  actionTaken: string;
}

export interface MachineLine {
  id: string;
  name: string;
  type: 'Sewing' | 'Bonding' | 'Cutting' | 'Packaging';
  machineModel: string;
  operatorCount: number;
  status: 'running' | 'idle' | 'maintenance';
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  activeSpk: string;
  unitsPerHour: number;
  lastService: string;
}

export interface RawMaterialPrice {
  name: string;
  spec: string;
  unit: string;
  currentPrice: number;
  previousPrice: number;
  changePct: number;
  status: 'spike' | 'stable' | 'down';
  supplier: string;
  leadTimeDays: number;
}
