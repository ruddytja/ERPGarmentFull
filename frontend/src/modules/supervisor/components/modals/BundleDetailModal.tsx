import React, { useState } from 'react';
import { SPKOrder, BundleItem } from '../../types/mes';
import { soundManager } from '../../utils/audio';

interface BundleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  spk: SPKOrder | null;
  bundles: BundleItem[];
  onReprintSingleBundle: (bundleId: string) => void;
}

export const BundleDetailModal: React.FC<BundleDetailModalProps> = ({
  isOpen,
  onClose,
  spk,
  bundles,
  onReprintSingleBundle,
}) => {
  const [filterStage, setFilterStage] = useState<string>('ALL');

  if (!isOpen || !spk) return null;

  // Generate 50 simulated bundles if not all present
  const allBundles: BundleItem[] = Array.from({ length: spk.totalBundles }, (_, i) => {
    const num = spk.totalBundles - i;
    const existing = bundles.find((b) => b.bundleNo === num && b.spkCode === spk.code);
    if (existing) return existing;

    // determine stage based on progress
    let stage: BundleItem['currentStage'] = 'CUTTING';
    let status: BundleItem['status'] = 'PASSED';
    let opName = 'CUTTER TEAM 1';
    let opCode = 'OP-0101';
    let machine = 'GERBER-AUTO-01';

    if (num <= 24) {
      stage = 'PACKING';
      opName = 'BAMBANG S.';
      opCode = 'PCK-0312';
      machine = 'PACK-LINE-01';
    } else if (num <= 30) {
      stage = 'QC INSP';
      opName = 'SRI WAHYUNI';
      opCode = 'QC-0881';
      machine = 'INSPECT-TABLE-01';
    } else if (num <= 35) {
      stage = 'BONDING';
      opName = 'RUDI OP-0231';
      opCode = 'OP-0231';
      machine = 'SEAL-TECH-01';
    } else if (num <= 43) {
      stage = 'SEWING';
      opName = 'JOKO OP-0210';
      opCode = 'OP-0210';
      machine = 'SIRUBA F007-03';
      status = num === 43 ? 'IN_PROCESS' : 'PASSED';
    } else {
      stage = 'CUTTING';
      status = 'PASSED';
    }

    const paddedNum = String(num).padStart(3, '0');
    return {
      bundleId: `BDL-0101-${paddedNum}`,
      bundleNo: num,
      totalBundles: spk.totalBundles,
      spkCode: spk.code,
      productName: spk.name,
      size: 'M',
      qty: spk.bundleSize,
      currentStage: stage,
      currentOp:
        stage === 'SEWING'
          ? 'COVERSTITCH PINGGANG'
          : stage === 'BONDING'
          ? 'HEAT SEALING FLY'
          : stage === 'QC INSP'
          ? 'SEAM TENSION CHECK'
          : stage === 'PACKING'
          ? 'POLYBAG BARCODE SCAN'
          : 'FABRIC SPREAD & CUT',
      operatorId: opCode,
      operatorName: opName,
      machine,
      status,
      timestamp: `2026-10-18 08:${String(10 + (num % 45)).padStart(2, '0')}`,
      barcode: `*${spk.code.replace(/-/g, '')}-BDL${paddedNum}*`,
    };
  });

  const filtered = allBundles.filter((b) => {
    if (filterStage === 'ALL') return true;
    return b.currentStage === filterStage;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#111827] border-2 border-[#2563EB] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-12 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#b4c5ff] text-xl" data-icon="inventory_2">
              inventory_2
            </span>
            <div className="flex items-center gap-2">
              <span className="font-condensed text-lg uppercase text-[#F8FAFC] font-bold tracking-wider">
                Detail Tracking Bundle · {spk.code}
              </span>
              <span className="text-xs font-mono text-[#64748B]">({spk.name})</span>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111827] cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-[#0B0F17] border-b border-[#334155] flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#64748B] uppercase">Filter Stage:</span>
            {['ALL', 'CUTTING', 'SEWING', 'BONDING', 'QC INSP', 'PACKING'].map((stage) => (
              <button
                key={stage}
                onClick={() => {
                  soundManager.playClick();
                  setFilterStage(stage);
                }}
                className={`px-2.5 py-1 uppercase font-bold border transition-colors cursor-pointer ${
                  filterStage === stage
                    ? 'bg-[#2563EB] border-[#2563EB] text-[#F8FAFC]'
                    : 'bg-[#1E293B] border-[#334155] text-[#64748B] hover:text-[#F8FAFC]'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-[#64748B]">
            Showing <strong className="text-[#F8FAFC]">{filtered.length}</strong> of{' '}
            <strong className="text-[#F8FAFC]">{spk.totalBundles}</strong> Bundles
          </div>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#1E293B] border-b-2 border-[#334155] text-[#64748B] text-[11px] uppercase">
                <th className="py-2 px-3">BUNDLE ID</th>
                <th className="py-2 px-3">STAGE</th>
                <th className="py-2 px-3">OPERATION</th>
                <th className="py-2 px-3">OPERATOR / MESIN</th>
                <th className="py-2 px-3">STATUS</th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {filtered.map((b) => (
                <tr key={b.bundleId} className="hover:bg-[#1E293B]/70 transition-colors">
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-[#F8FAFC]">{b.bundleId}</span>
                    <span className="text-[10px] text-[#64748B] block">
                      #{b.bundleNo} / {b.totalBundles} ({b.qty} pcs)
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#1E293B] border border-[#334155] text-[#b4c5ff]">
                      {b.currentStage}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#d4e4fa] font-medium">{b.currentOp}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[#F8FAFC] block font-bold">{b.operatorName}</span>
                    <span className="text-[10px] text-[#64748B]">{b.machine}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {b.status === 'PASSED' && (
                      <span className="text-[#16A34A] font-bold text-[11px]">● PASSED</span>
                    )}
                    {b.status === 'IN_PROCESS' && (
                      <span className="text-[#2563EB] font-bold text-[11px]">● IN PROCESS</span>
                    )}
                    {b.status === 'REWORK' && (
                      <span className="text-[#D97706] font-bold text-[11px]">▲ REWORK</span>
                    )}
                    {b.status === 'REJECT' && (
                      <span className="text-[#DC2626] font-bold text-[11px]">✕ REJECT</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => {
                        soundManager.playScanBeep();
                        onReprintSingleBundle(b.bundleId);
                      }}
                      className="tactile-edge bg-[#1E293B] hover:bg-[#2563EB] text-[#F8FAFC] border border-[#334155] px-2 py-1 text-[10px] uppercase font-bold transition-colors cursor-pointer"
                    >
                      Cetak Ulang
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="h-14 bg-[#1E293B] border-t border-[#334155] px-4 flex items-center justify-between shrink-0">
          <div className="text-xs font-mono text-[#64748B]">
            FIFO Sequence Lock: Active · Auto-Verification at RFID/QR Scanner
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="tactile-edge px-4 py-2 bg-[#111827] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs uppercase font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
