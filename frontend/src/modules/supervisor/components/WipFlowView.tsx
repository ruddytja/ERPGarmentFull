import React, { useState } from 'react';
import { SPKOrder } from '../types/mes';
import { soundManager } from '../utils/audio';

interface WipFlowViewProps {
  spks: SPKOrder[];
  onOpenBundleDetail: (spk: SPKOrder) => void;
  onAdvanceWip: (spkId: string, stage: string) => void;
}

export const WipFlowView: React.FC<WipFlowViewProps> = ({
  spks,
  onOpenBundleDetail,
  onAdvanceWip,
}) => {
  const [selectedSpkId, setSelectedSpkId] = useState<string>(spks[0]?.id || '');
  const activeSpk = spks.find((s) => s.id === selectedSpkId) || spks[0];

  const stages = [
    {
      id: 'CUTTING',
      label: '1. CUTTING & SPREADING',
      icon: 'content_cut',
      desc: 'Automatic CNC knife & fabric relaxation',
      capacity: '60 BDL / Shift',
    },
    {
      id: 'SEWING',
      label: '2. SEWING & ASSEMBLY',
      icon: 'precision_manufacturing',
      desc: 'Overlock, coverstitch & waistband attach',
      capacity: '50 BDL / Shift',
      isBottleneck: true,
    },
    {
      id: 'BONDING',
      label: '3. SEAMLESS BONDING',
      icon: 'layers',
      desc: 'Ultrasonic welding & heat pressing',
      capacity: '55 BDL / Shift',
    },
    {
      id: 'QC INSP',
      label: '4. 100% IN-LINE QC',
      icon: 'verified',
      desc: 'Tension, seam strength & optical scan',
      capacity: '65 BDL / Shift',
    },
    {
      id: 'PACKING',
      label: '5. IRONING & PACKING',
      icon: 'inventory',
      desc: 'Individual polybag & master carton barcode',
      capacity: '70 BDL / Shift',
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-[#0B0F17] p-6 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-xl" data-icon="linear_scale">
              linear_scale
            </span>
            <h1 className="font-condensed text-2xl font-bold uppercase text-[#F8FAFC]">
              Garment WIP Flow &amp; Buffer Telemetry
            </h1>
          </div>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            Real-time balance of bundle flow across 5 production workstations · FIFO Sequencing Active
          </p>
        </div>

        {/* SPK Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase text-[#64748B]">Active SPK:</span>
          <select
            value={selectedSpkId}
            onChange={(e) => {
              soundManager.playClick();
              setSelectedSpkId(e.target.value);
            }}
            className="h-10 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#2563EB] uppercase cursor-pointer"
          >
            {spks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenBundleDetail(activeSpk);
            }}
            className="tactile-edge h-10 px-3 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-mono uppercase text-[#F8FAFC] font-bold cursor-pointer"
          >
            Lihat Bundle
          </button>
        </div>
      </div>

      {/* Stage Flow Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {stages.map((stg, idx) => {
          const currentProgress = activeSpk.stages.find((s) => s.stage === stg.id);
          const percent = currentProgress?.percentage || 0;
          const completed = currentProgress?.completedBundles || 0;
          const total = currentProgress?.totalBundles || activeSpk.totalBundles;

          return (
            <div
              key={stg.id}
              className={`bg-[#111827] border p-4 flex flex-col justify-between relative transition-all ${
                stg.isBottleneck
                  ? 'border-2 border-[#D97706]'
                  : 'border-[#334155] hover:border-[#475569]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2">
                  <span className="font-mono text-[10px] text-[#64748B] font-bold uppercase">
                    NODE {idx + 1}
                  </span>
                  {stg.isBottleneck && (
                    <span className="bg-[#2D1D05] border border-[#D97706] text-[#FBBF24] text-[9px] px-1 font-mono font-bold">
                      BOTTLENECK
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#b4c5ff] text-base" data-icon={stg.icon}>
                    {stg.icon}
                  </span>
                  <span className="font-condensed text-base font-bold text-[#F8FAFC] uppercase leading-tight">
                    {stg.label}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#64748B] mb-3">{stg.desc}</p>

                {/* Progress bar */}
                <div className="w-full bg-[#0B0F17] h-2 border border-[#334155] overflow-hidden my-2">
                  <div
                    className={`h-full ${
                      percent === 100
                        ? 'bg-[#16A34A]'
                        : stg.isBottleneck
                        ? 'bg-[#D97706]'
                        : 'bg-[#2563EB]'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-baseline font-mono text-xs mt-2">
                  <span className="text-[#64748B]">OUTPUT:</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {completed} / {total} BDL ({percent}%)
                  </span>
                </div>

                <div className="flex justify-between items-baseline font-mono text-[10px] text-[#64748B] mt-1">
                  <span>MAX CAP:</span>
                  <span>{stg.capacity}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#334155]">
                <button
                  onClick={() => {
                    soundManager.playScanBeep();
                    onAdvanceWip(activeSpk.id, stg.id);
                  }}
                  disabled={completed >= total}
                  className="tactile-edge w-full py-1.5 bg-[#1E293B] hover:bg-[#2563EB] disabled:opacity-40 text-xs font-mono uppercase font-bold text-[#F8FAFC] border border-[#334155] transition-colors cursor-pointer"
                >
                  {completed >= total ? 'STAGE SELESAI' : '+ Scan Bundle Next'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buffer Analytics Table */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#334155] pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-lg" data-icon="troubleshoot">
              troubleshoot
            </span>
            <h2 className="font-condensed text-lg uppercase text-[#F8FAFC] font-bold tracking-wider">
              Buffer Health &amp; Takt Variance Matrix
            </h2>
          </div>
          <span className="text-xs font-mono text-[#16A34A] font-bold">
            TAKT TIME TARGET: 32.5 DETIK / PIECE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0B0F17] border border-[#334155] p-3">
            <span className="font-mono text-[10px] text-[#64748B] uppercase block">
              BUFFER CUTTING -&gt; SEWING
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-condensed text-2xl font-bold text-[#16A34A]">7 BUNDLES</span>
              <span className="text-xs font-mono text-[#16A34A]">STATUS: AMAN (168 pcs)</span>
            </div>
            <p className="text-[10px] font-mono text-[#64748B] mt-1">
              Kapasitas cadangan cukup untuk 2.5 jam operasi sewing tanpa henti.
            </p>
          </div>

          <div className="bg-[#0B0F17] border border-[#D97706] p-3">
            <span className="font-mono text-[10px] text-[#D97706] uppercase block font-bold">
              BUFFER SEWING -&gt; BONDING
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-condensed text-2xl font-bold text-[#D97706]">4 BUNDLES</span>
              <span className="text-xs font-mono text-[#D97706] font-bold">STATUS: CRITICAL</span>
            </div>
            <p className="text-[10px] font-mono text-[#ffb4ab] mt-1">
              Kendala pada Siruba F007-03 menahan pasokan bundle ke station bonding.
            </p>
          </div>

          <div className="bg-[#0B0F17] border border-[#334155] p-3">
            <span className="font-mono text-[10px] text-[#64748B] uppercase block">
              BUFFER BONDING -&gt; QC INSP
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-condensed text-2xl font-bold text-[#16A34A]">5 BUNDLES</span>
              <span className="text-xs font-mono text-[#16A34A]">STATUS: STABIL (120 pcs)</span>
            </div>
            <p className="text-[10px] font-mono text-[#64748B] mt-1">
              Inspection table beroperasi pada 98.2% efisiensi standar waktu.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};
