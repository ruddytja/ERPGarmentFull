import React, { useState } from 'react';
import { SpkBatch } from '../../types/costing';
import { formatNumber } from '../../utils/formatters';

interface WipTrackingScreenProps {
  batches: SpkBatch[];
}

export const WipTrackingScreen: React.FC<WipTrackingScreenProps> = ({ batches }) => {
  const [scanResult, setScanResult] = useState<string | null>(null);

  const stages = [
    { title: '1. CNC Cutting', icon: 'content_cut', count: 4 },
    { title: '2. Seamless Knitting', icon: 'donut_large', count: 5 },
    { title: '3. Sewing Assembly', icon: 'checkroom', count: 4 },
    { title: '4. Ultrasonic Bonding', icon: 'layers', count: 2 },
    { title: '5. QC & Inspection', icon: 'fact_check', count: 2 },
    { title: '6. Finished Packing', icon: 'inventory_2', count: 1 },
  ];

  const handleSimulateScan = () => {
    const randomBatch = batches[Math.floor(Math.random() * batches.length)];
    const ticketNo = Math.floor(1000 + Math.random() * 9000);
    setScanResult(`Bundle Tiket #${ticketNo} [${randomBatch.id} - ${randomBatch.productName}] berhasil diverifikasi QC Lulus.`);
    setTimeout(() => setScanResult(null), 4000);
  };

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[12px] text-[#64748B]">MES Shop-Floor Execution • Sukabumi #01</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">WIP &amp; SPK Tracking</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateScan}
            className="px-4 py-2 bg-[#004ac6] hover:bg-[#0053db] text-white rounded-lg text-[13px] font-semibold flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
            <span>Simulasi Scan Barcode Tiket</span>
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="p-3 bg-[#16A34A]/15 border border-[#16A34A]/30 text-[#16A34A] rounded-xl text-[13px] font-semibold flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px]">verified</span>
          <span>{scanResult}</span>
        </div>
      )}

      {/* Pipeline Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((st, idx) => {
          const stageBatches = batches.slice(idx * 3, idx * 3 + 3);
          return (
            <div key={st.title} className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex flex-col gap-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-1.5 text-[#0F172A] font-bold text-[13px]">
                  <span className="material-symbols-outlined text-[18px] text-[#004ac6]">{st.icon}</span>
                  <span className="truncate">{st.title}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-[#f2f4f6] text-[#545f73]">
                  {stageBatches.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {stageBatches.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#f2f4f6] text-[12px] hover:border-[#004ac6] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-code-metric font-bold text-[#0F172A]">{b.id}</span>
                      <span className="text-[10px] text-[#64748B]">{b.bundles} Bdls</span>
                    </div>
                    <span className="block text-[11px] font-semibold text-[#0F172A] truncate mt-0.5">
                      {b.brand} {b.productName}
                    </span>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
                      <span>{b.productionLine.split(' ')[0]}</span>
                      <span className="text-[#16A34A] font-semibold">{b.qcPassRate}% Pass</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
