import React, { useState } from 'react';

export const BundleQcScreen: React.FC = () => {
  const [passCount, setPassCount] = useState<number>(318);
  const [reworkCount, setReworkCount] = useState<number>(6);
  const [rejectCount, setRejectCount] = useState<number>(1);
  const [currentBundle, setCurrentBundle] = useState<string>('BDL-2026-10-042-012');
  const [selectedDefect, setSelectedDefect] = useState<string>('SKIP STITCH');

  const total = passCount + reworkCount + rejectCount;
  const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '100.0';

  const defects = [
    { code: 'D-01', label: 'SKIP STITCH', count: 3 },
    { code: 'D-02', label: 'NEEDLE OIL STAIN', count: 2 },
    { code: 'D-03', label: 'WAISTBAND TENSION VARIANCE', count: 1 },
    { code: 'D-04', label: 'LABEL MISALIGNMENT (>2mm)', count: 1 },
    { code: 'D-05', label: 'SHADE VARIATION', count: 0 },
    { code: 'D-06', label: 'RAW EDGE PULL', count: 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase text-[#64748B] tracking-widest flex items-center gap-2 font-bold">
            <span>PLANT HUB C // BUNDLE QUALITY CONTROL TERMINAL</span>
            <span>•</span>
            <span className="text-[#16A34A] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block animate-pulse"></span>
              AQL 1.5 STANDARD APPLIED
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl text-[#F8FAFC] uppercase tracking-wider font-extrabold mt-0.5">
            BUNDLE QUALITY VERIFICATION &amp; DEFECT AUDIT
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] bg-[#111827] border border-[#334155] px-3 py-1.5">
          <span className="text-[#64748B]">INSPECTED TOTAL:</span>
          <span className="text-[#F8FAFC] font-bold tabular-nums">{total} PCS</span>
          <span className="text-[#334155]">|</span>
          <span className="text-[#64748B]">PASS RATE:</span>
          <span className="text-[#16A34A] font-bold tabular-nums">{passRate}%</span>
        </div>
      </div>

      {/* Triple Segmented Counters for PASS, REWORK, REJECT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PASS Counter */}
        <div className="bg-[#111827] border-2 border-[#16A34A] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-mono text-xs uppercase text-[#16A34A] font-bold tracking-wider">
              INSPECTION STATUS: PASS
            </span>
            <span className="px-2 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-mono text-xs font-bold">
              CLEAR TO PACK
            </span>
          </div>

          <div className="my-4 text-center">
            <div className="font-headline-xl text-5xl sm:text-6xl font-extrabold text-[#F8FAFC] tabular-nums tracking-tight">
              {passCount}
            </div>
            <div className="font-mono text-[11px] text-[#64748B] uppercase mt-1 font-bold">
              PIECES VERIFIED OK
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={() => setPassCount((c) => Math.max(0, c - 1))}
              className="h-12 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              - 1
            </button>
            <button
              onClick={() => setPassCount((c) => c + 1)}
              className="h-12 bg-[#16A34A] hover:bg-green-600 text-white font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              + 1
            </button>
          </div>
        </div>

        {/* REWORK Counter */}
        <div className="bg-[#111827] border-2 border-[#D97706] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-mono text-xs uppercase text-[#D97706] font-bold tracking-wider">
              INSPECTION STATUS: REWORK
            </span>
            <span className="px-2 py-0.5 bg-[#2D1D05] border border-[#D97706] text-[#D97706] font-mono text-xs font-bold">
              RE-STITCH LINE
            </span>
          </div>

          <div className="my-4 text-center">
            <div className="font-headline-xl text-5xl sm:text-6xl font-extrabold text-[#F8FAFC] tabular-nums tracking-tight">
              {reworkCount}
            </div>
            <div className="font-mono text-[11px] text-[#64748B] uppercase mt-1 font-bold">
              RETURN TO SEWING
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={() => setReworkCount((c) => Math.max(0, c - 1))}
              className="h-12 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              - 1
            </button>
            <button
              onClick={() => setReworkCount((c) => c + 1)}
              className="h-12 bg-[#D97706] hover:bg-amber-600 text-white font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              + 1
            </button>
          </div>
        </div>

        {/* REJECT Counter */}
        <div className="bg-[#111827] border-2 border-[#DC2626] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-mono text-xs uppercase text-[#DC2626] font-bold tracking-wider">
              INSPECTION STATUS: REJECT
            </span>
            <span className="px-2 py-0.5 bg-[#300C0C] border border-[#DC2626] text-[#DC2626] font-mono text-xs font-bold">
              SCRAP LOGGED
            </span>
          </div>

          <div className="my-4 text-center">
            <div className="font-headline-xl text-5xl sm:text-6xl font-extrabold text-[#F8FAFC] tabular-nums tracking-tight">
              {rejectCount}
            </div>
            <div className="font-mono text-[11px] text-[#64748B] uppercase mt-1 font-bold">
              MATERIAL LOSS SCRAP
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={() => setRejectCount((c) => Math.max(0, c - 1))}
              className="h-12 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              - 1
            </button>
            <button
              onClick={() => setRejectCount((c) => c + 1)}
              className="h-12 bg-[#DC2626] hover:bg-red-700 text-white font-headline-xl text-2xl font-bold flex items-center justify-center tactile-button cursor-pointer"
            >
              + 1
            </button>
          </div>
        </div>
      </div>

      {/* Defect Code Selector & Active Bundle Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#111827] border border-[#334155] p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-headline-md text-xl uppercase font-bold text-[#F8FAFC]">
              DEFECT CATEGORY CLUSTER (TAP TO RECORD REWORK/REJECT)
            </span>
            <span className="font-mono text-[11px] text-[#64748B]">SELECT ACTIVE REASON</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {defects.map((def) => {
              const isSelected = selectedDefect === def.label;
              return (
                <button
                  key={def.code}
                  onClick={() => {
                    setSelectedDefect(def.label);
                    setReworkCount((c) => c + 1);
                  }}
                  className={`p-3 text-left border font-mono transition-colors cursor-pointer tactile-button ${
                    isSelected
                      ? 'bg-[#1E293B] border-[#2563EB] text-[#F8FAFC]'
                      : 'bg-[#051424] border-[#334155] text-[#d4e4fa] hover:bg-[#1E293B]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] text-[#64748B] font-bold">{def.code}</span>
                    <span className="text-[11px] bg-[#111827] px-1.5 py-0.5 border border-[#334155] text-[#b4c5ff] font-bold">
                      {def.count} INCIDENTS
                    </span>
                  </div>
                  <div className="font-bold text-xs mt-1 text-[#F8FAFC]">{def.label}</div>
                  <div className="text-[10px] text-[#64748B] mt-1">+ LOG REWORK TICKET</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
              <span className="font-headline-md text-xl uppercase font-bold text-[#F8FAFC]">
                ACTIVE BUNDLE AUDIT
              </span>
              <span className="font-mono text-[11px] text-[#16A34A] font-bold">TAG OK</span>
            </div>

            <div className="flex flex-col gap-2.5 mt-3 font-mono text-xs">
              <div className="p-2 bg-[#051424] border border-[#334155] flex justify-between">
                <span className="text-[#64748B]">BUNDLE TAG:</span>
                <span className="text-[#b4c5ff] font-bold">{currentBundle}</span>
              </div>
              <div className="p-2 bg-[#051424] border border-[#334155] flex justify-between">
                <span className="text-[#64748B]">SEWING OPERATOR:</span>
                <span className="text-[#F8FAFC] font-bold">OP-214 (Siti Rahma)</span>
              </div>
              <div className="p-2 bg-[#051424] border border-[#334155] flex justify-between">
                <span className="text-[#64748B]">STYLE REF:</span>
                <span className="text-[#F8FAFC]">NAQALA BRIEF M (JET BLACK)</span>
              </div>
              <div className="p-2 bg-[#051424] border border-[#334155] flex justify-between">
                <span className="text-[#64748B]">BUNDLE QTY:</span>
                <span className="text-[#F8FAFC] font-bold">24 PCS</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPassCount((c) => c + 24);
              setCurrentBundle('BDL-2026-10-042-015');
            }}
            className="w-full h-12 mt-4 bg-[#16A34A] hover:bg-green-600 text-white font-headline-md text-lg font-bold uppercase tracking-wider flex items-center justify-center gap-2 tactile-button cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">verified</span>
            <span>APPROVE ENTIRE BUNDLE (24 PCS)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
