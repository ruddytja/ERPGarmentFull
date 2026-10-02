import { B2BManifest, B2CManifest, MasterCartonUnit, MultipackSlot, IncidentReport } from '../types/mes';

export const INITIAL_SLOTS: MultipackSlot[] = [
  {
    slotNumber: '01',
    pieceLabel: 'PIECE #1',
    sizeColor: 'SIZE M - CHARCOAL',
    specNote: 'WAISTBAND: OK',
    tagBarcode: '89972341101',
    verified: true,
  },
  {
    slotNumber: '02',
    pieceLabel: 'PIECE #2',
    sizeColor: 'SIZE M - JET BLACK',
    specNote: 'HANGTAG: SCANNED',
    tagBarcode: '89972341102',
    verified: true,
  },
  {
    slotNumber: '03',
    pieceLabel: 'PIECE #3',
    sizeColor: 'SIZE M - DEEP NAVY',
    specNote: 'POLYBAG: MATCHED',
    tagBarcode: '89972341103',
    verified: true,
  },
];

export const INITIAL_MASTER_CARTON: MasterCartonUnit = {
  cartonId: 'CTN-2026-0891',
  targetMultipacks: 48,
  currentMultipacks: 36,
  totalPcs: 108,
  skuCode: 'NAQALA-3BX-M',
  skuDescription: 'NAQALA SEAMLESS BRIEF - 3-PACK BOX (M, L, XL)',
  sealed: false,
  packedItems: [
    {
      packNumber: '#036',
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: '13:41:59',
      status: 'PACKED',
    },
    {
      packNumber: '#035',
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: '13:41:22',
      status: 'PACKED',
    },
    {
      packNumber: '#034',
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: '13:40:48',
      status: 'PACKED',
    },
    {
      packNumber: '#033',
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: '13:39:15',
      status: 'PACKED',
    },
    {
      packNumber: '#032',
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: '13:38:02',
      status: 'PACKED',
    },
  ],
};

export const INITIAL_B2B_MANIFEST: B2BManifest = {
  poNumber: 'PO-MTR-2026-881',
  clientName: 'MITRA RETAIL NUSANTARA',
  spkReference: 'SPK-2026-10-042',
  aggregationVolume: '1,200 PCS (50 CARTONS)',
  totalCartons: 50,
  logisticsCarrier: 'Indah Cargo Truck',
  vehiclePlateId: 'B 9421 KXT',
  driverName: 'Suryadi Pratama',
  status: 'READY FOR LOADING',
  qcCleared: true,
  sealApplied: true,
  destinationAddress: 'JL. RUNGKUT INDUSTRI NO. 14, SURABAYA, JAWA TIMUR',
};

export const INITIAL_B2C_MANIFEST: B2CManifest = {
  poolingName: 'E-COM TIKTOK SHOP / SHOPEE BULK DISPATCH',
  consolidationUnits: '420 PCS (140 3-PACKS)',
  courierPickup: 'J&T CARGO PICKUP',
  dispatchWindow: 'SCHEDULED 14:00 (18 MIN REMAINING)',
  remainingMinutes: 18,
  progressPercent: 85,
  remainingLabelsCount: 21,
  totalOrders: 140,
};

export const SAMPLE_BARCODES = [
  { code: 'BDL-2026-10-042-012', desc: 'NAQALA SEAMLESS BRIEF M (24 PCS)', size: 'M' },
  { code: 'BDL-2026-10-042-013', desc: 'NAQALA SEAMLESS BRIEF L (24 PCS)', size: 'L' },
  { code: 'BDL-2026-10-042-014', desc: 'NAQALA SEAMLESS BRIEF XL (24 PCS)', size: 'XL' },
  { code: 'BDL-2026-10-043-001', desc: 'AURORA BAMBOO TRUNK M (18 PCS)', size: 'M' },
];

export const INITIAL_INCIDENTS: IncidentReport[] = [
  {
    id: 'INC-7092-01',
    timestamp: '12:15:33',
    severity: 'WARNING',
    title: 'Barcode Scanner Optical Glare',
    description: 'Ambient lighting from skylight C-4 causing occasional matrix read retry on glossy polybags.',
    station: 'DOCK 02 // STATION 1',
    reportedBy: 'OP: Fajar Maulana',
    status: 'INVESTIGATING',
  },
  {
    id: 'INC-7092-02',
    timestamp: '09:40:12',
    severity: 'MAINTENANCE',
    title: 'Thermal Printer ZT411 Ribbon Replaced',
    description: 'Thermal transfer ribbon reached 5% threshold; replaced with 100mm x 150mm resin ribbon.',
    station: 'DOCK 02 PRINTER A',
    reportedBy: 'SPV: Line 01',
    status: 'RESOLVED',
  },
];
