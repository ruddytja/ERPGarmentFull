export type CurrencyType = 'IDR' | 'USD';

export type VarianceCategory = 'Favorable' | 'Unfavorable' | 'On Budget';

export interface SpkBatch {
  id: string;
  brand: string;
  productName: string;
  targetQty: number;
  bundles: number;
  bomHppPerPc: number;
  realMaterialPerPc: number;
  realLaborPerPc: number;
  realOverheadPerPc: number;
  totalRealHppPerPc: number;
  variancePct: number;
  varianceStatus: VarianceCategory;
  isCritical?: boolean;
  isLocked?: boolean;
  fabricType: string;
  productionLine: string;
  colorway: string;
  orderDate: string;
  deadlineDate: string;
  qcPassRate: number;
  supplier: string;
  varianceCause?: string;
}

export interface CostStructure {
  rawMaterial: {
    bomBudget: number;
    realSpend: number;
    variancePct: number;
    varianceStatus: VarianceCategory;
    rootCause: string;
    details: {
      fabricModalCost: number;
      spandexElastaneCost: number;
      threadAccessoriesCost: number;
    };
  };
  directLabor: {
    bomBudget: number;
    realSpend: number;
    variancePct: number;
    varianceStatus: VarianceCategory;
    keyDriver: string;
    details: {
      sewingOperators: number;
      cuttingOperators: number;
      qcInspectors: number;
    };
  };
  overhead: {
    bomBudget: number;
    realSpend: number;
    variancePct: number;
    varianceStatus: VarianceCategory;
    optimization: string;
    details: {
      electricityPln: number;
      boilerFuel: number;
      needleConsumables: number;
      bondingGlue: number;
      buildingLease: number;
    };
  };
}

export interface OperatorPayrollItem {
  id: string;
  nik: string;
  name: string;
  line: string;
  role: 'Sewing' | 'Cutting' | 'Bonding' | 'Ironing & Packing';
  bundlesCompleted: number;
  piecesCompleted: number;
  pieceRatePerPcs: number;
  totalCompensation: number;
  qcPassRate: number;
  status: 'Siap Diverifikasi' | 'Diverifikasi' | 'Pending QC';
  barcodeTicketCount: number;
}

export interface PlantSummary {
  activeBatches: number;
  targetBudgetTotal: number;
  activeLines: number;
  totalActiveMachines: number;
  fpyQualityRate: number;
  averageOee: number;
}
