export type StationView = 'TELEMETRY' | 'WIP_FLOW' | 'BUNDLE_QC' | 'PACKAGING_DISPATCH' | 'INVENTORY_OUT';

export interface MultipackSlot {
  slotNumber: string;
  pieceLabel: string;
  sizeColor: string;
  specNote: string;
  tagBarcode: string;
  verified: boolean;
}

export interface PackedItemRecord {
  packNumber: string;
  subBundleSku: string;
  operator: string;
  timestamp: string;
  status: 'PACKED' | 'FLAGGED' | 'REPLACED';
}

export interface MasterCartonUnit {
  cartonId: string;
  targetMultipacks: number;
  currentMultipacks: number;
  totalPcs: number;
  skuCode: string;
  skuDescription: string;
  packedItems: PackedItemRecord[];
  sealed: boolean;
  sealId?: string;
}

export interface B2BManifest {
  poNumber: string;
  clientName: string;
  spkReference: string;
  aggregationVolume: string;
  totalCartons: number;
  logisticsCarrier: string;
  vehiclePlateId: string;
  driverName: string;
  status: 'READY FOR LOADING' | 'INSPECTION' | 'DISPATCHED';
  qcCleared: boolean;
  sealApplied: boolean;
  destinationAddress: string;
}

export interface B2CManifest {
  poolingName: string;
  consolidationUnits: string;
  courierPickup: string;
  dispatchWindow: string;
  remainingMinutes: number;
  progressPercent: number;
  remainingLabelsCount: number;
  totalOrders: number;
}

export interface IncidentReport {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'MAINTENANCE';
  title: string;
  description: string;
  station: string;
  reportedBy: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
}
