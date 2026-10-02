import React, { useState } from 'react';

export const WipFlowScreen: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState<string>('BATCH-2026-PKG-09');

  const stages = [
    {
      step: '01',
      title: 'FABRIC SPREADING & CNC CUTTING',
      spk: 'SPK-2026-10-041',
      output: '4,800 PCS',
      target: '4,800 PCS',
      status: '100% COMPLETE',
      state: 'COMPLETE',
      efficiency: '104.2%',
      operator: 'CUT-ROOM 01',
    },
    {
      step: '02',
      title: 'SEWING ASSEMBLY LINE 01 - 04',
      spk: 'SPK-2026-10-042',
      output: '3,840 PCS',
      target: '4,000 PCS',
      status: '96% COMPLETE',
      state: 'IN_PROGRESS',
      efficiency: '98.6%',
      operator: 'SEW-LINE 01-04 (32 OPS)',
    },
    {
      step: '03',
      title: 'INLINE & ENDLINE BUNDLE QC',
      spk: 'SPK-2026-10-042',
      output: '3,600 PCS',
      target: '3,840 PCS',
      status: 'QC CLEARANCE',
      state: 'IN_PROGRESS',
      efficiency: '99.8% ACCURACY',
      operator: 'INSP-HUB C',
    },
    {
      step: '04',
      title: 'MULTIPACK & CARTON PACKAGING',
      spk: 'BATCH-2026-PKG-09',
      output: '3,408 PCS',
      target: '4,800 PCS',
      status: 'STATION ACTIVE',
      state: 'ACTIVE',
      efficiency: '102.4%',
      operator: 'DOCK 02 (FAJAR M.)',
    },
    {
      step: '05',
      title: 'FINISHED GOODS DOCK DISPATCH',
      spk: 'PO-MTR-2026-881',
      output: '50 CARTONS',
      target: '50 CARTONS',
      status: 'LOADING BAY',
      state: 'STAGING',
      efficiency: 'BERTH 02 ACTIVE',
      operator: 'INDAH CARGO TRUCK',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase text-[#64748B] tracking-widest flex items-center gap-2 font-bold">
            <span>PLANT PIPELINE VISUALIZER // WIP REAL-TIME FLOW</span>
            <span>•</span>
            <span className="text-[#16A34A] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block animate-pulse"></span>
              FLOW VELOCITY: 420 PCS/HR
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl text-[#F8FAFC] uppercase tracking-wider font-extrabold mt-0.5">
            GARMENT MANUFACTURING WIP FLOW &amp; LINE BALANCE
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] bg-[#111827] border border-[#334155] px-3 py-1.5">
          <span className="text-[#64748B]">TRACKED BATCH:</span>
          <span className="text-[#b4c5ff] font-bold">{selectedBatch}</span>
          <span className="text-[#334155]">|</span>
          <span className="text-[#64748B]">PLANT BAL:</span>
          <span className="text-[#16A34A] font-bold">OPTIMAL</span>
        </div>
      </div>

      {/* Stage Flow Rail */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {stages.map((stg) => {
          const isActive = stg.state === 'ACTIVE';
          return (
            <div
              key={stg.step}
              className={`p-3 bg-[#111827] border ${
                isActive ? 'border-[#2563EB] ring-1 ring-[#2563EB]' : 'border-[#334155]'
              } flex flex-col justify-between`}
            >
              <div className="flex justify-between items-center pb-1 border-b border-[#334155]">
                <span className="font-headline-md text-base font-bold text-[#b4c5ff]">
                  STEP {stg.step}
                </span>
                <span
                  className={`px-1.5 py-0.5 font-mono text-[10px] font-bold border ${
                    stg.state === 'COMPLETE'
                      ? 'border-[#16A34A] text-[#16A34A] bg-[#0F291E]'
                      : isActive
                      ? 'border-[#2563EB] text-[#b4c5ff] bg-[#1E293B]'
                      : 'border-[#D97706] text-[#D97706] bg-[#2D1D05]'
                  }`}
                >
                  {stg.status}
                </span>
              </div>

              <div className="my-2.5">
                <div className="font-headline-sm text-sm font-bold text-[#F8FAFC] leading-tight">
                  {stg.title}
                </div>
                <div className="font-headline-xl text-2xl font-bold text-[#F8FAFC] mt-1 tabular-nums">
                  {stg.output}
                </div>
                <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                  TARGET: {stg.target}
                </div>
              </div>

              <div className="border-t border-[#334155] pt-1.5 font-mono text-[11px] flex flex-col gap-0.5">
                <div className="text-[#64748B] flex justify-between">
                  <span>METRIC:</span>
                  <span className="text-[#16A34A] font-bold">{stg.efficiency}</span>
                </div>
                <div className="text-[#64748B] truncate">
                  ASSIGN: <span className="text-[#F8FAFC]">{stg.operator}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Batch Table */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
          <span className="font-headline-md text-xl uppercase font-bold text-[#F8FAFC]">
            ACTIVE SPK PRODUCTION RUNS IN PLANT HUB C
          </span>
          <span className="font-mono text-[11px] text-[#64748B]">SHOWING 4 ACTIVE RUNS</span>
        </div>

        <div className="overflow-x-auto border border-[#334155]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#1E293B] border-b border-[#334155] text-[11px] text-[#64748B] font-bold">
              <tr>
                <th className="py-2.5 px-3">SPK REF</th>
                <th className="py-2.5 px-3">PRODUCT DESCRIPTION</th>
                <th className="py-2.5 px-3">STYLE / COLOR</th>
                <th className="py-2.5 px-3 text-right">TARGET PCS</th>
                <th className="py-2.5 px-3 text-right">COMPLETED</th>
                <th className="py-2.5 px-3 text-right">BALANCE</th>
                <th className="py-2.5 px-3 text-right">DISPATCH STAGE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155] tabular-nums">
              {[
                {
                  spk: 'SPK-2026-10-042',
                  desc: 'NAQALA SEAMLESS BRIEF 3-PACK',
                  style: 'M (CHAR/BLK/NVY)',
                  target: 4800,
                  done: 3408,
                  bal: '102.4%',
                  stage: 'DOCK 02 PACKAGING',
                  statusColor: 'text-[#16A34A]',
                },
                {
                  spk: 'SPK-2026-10-043',
                  desc: 'AURORA BAMBOO TRUNK 2-PACK',
                  style: 'L (HEATHER GREY/DEEP NAVY)',
                  target: 3600,
                  done: 2950,
                  bal: '98.2%',
                  stage: 'SEWING LINE 03',
                  statusColor: 'text-[#b4c5ff]',
                },
                {
                  spk: 'SPK-2026-10-044',
                  desc: 'AEROFLEX MICRO-MODAL BOXER BRIEF',
                  style: 'XL (SOLID ONYX/ROYAL BLUE)',
                  target: 2400,
                  done: 1800,
                  bal: '100.0%',
                  stage: 'CUTTING / SPREADING',
                  statusColor: 'text-[#D97706]',
                },
                {
                  spk: 'SPK-2026-10-045',
                  desc: 'SUPIMA COTTON RIB TANK TOP',
                  style: 'M/L (OPTIC WHITE)',
                  target: 1200,
                  done: 1200,
                  bal: '105.1%',
                  stage: 'LOADING BAY BERTH 01',
                  statusColor: 'text-[#16A34A]',
                },
              ].map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedBatch(row.spk)}
                  className="hover:bg-[#1E293B] cursor-pointer"
                >
                  <td className="py-2 px-3 font-bold text-[#b4c5ff]">{row.spk}</td>
                  <td className="py-2 px-3 text-[#F8FAFC]">{row.desc}</td>
                  <td className="py-2 px-3 text-[#64748B]">{row.style}</td>
                  <td className="py-2 px-3 text-right font-bold text-[#F8FAFC]">
                    {row.target.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-[#16A34A]">
                    {row.done.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-[#b4c5ff]">{row.bal}</td>
                  <td className={`py-2 px-3 text-right font-bold ${row.statusColor}`}>
                    {row.stage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
