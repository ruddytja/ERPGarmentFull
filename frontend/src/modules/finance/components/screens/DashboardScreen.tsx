import React from 'react';
import { CurrencyType, SpkBatch } from '../../types/costing';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface DashboardScreenProps {
  batches: SpkBatch[];
  currency: CurrencyType;
  onNavigateToCosting: () => void;
  onNavigateToWip: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  batches,
  currency,
  onNavigateToCosting,
  onNavigateToWip,
}) => {
  const totalQty = batches.reduce((acc, b) => acc + b.targetQty, 0);
  const totalRealHpp = batches.reduce((acc, b) => acc + b.totalRealHppPerPc * b.targetQty, 0);

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[12px] text-[#64748B]">Overview • Plant Sukabumi #01 &amp; #02</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">Executive Plant Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToCosting}
            className="px-4 py-2 bg-[#004ac6] hover:bg-[#0053db] text-white text-[13px] font-semibold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>Buka HPP &amp; Cost Control</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Total Kapasitas Terpasang</span>
          <div className="text-[24px] font-bold text-[#0F172A] font-code-metric mt-1">45.000 pcs/bln</div>
          <span className="text-[12px] text-[#16A34A] font-semibold">91.4% Utilitas Mesin</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Total Output Order Berjalan</span>
          <div className="text-[24px] font-bold text-[#0F172A] font-code-metric mt-1">
            {formatNumber(totalQty)} pcs
          </div>
          <span className="text-[12px] text-[#64748B]">{batches.length} SPK Aktif di Lantai Jahit</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Total Nilai Realisasi Produksi</span>
          <div className="text-[24px] font-bold text-[#004ac6] font-code-metric mt-1">
            {formatCurrency(totalRealHpp, currency)}
          </div>
          <span className="text-[12px] text-[#16A34A] font-semibold">-1.46% Lebih Hemat vs BOM</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">First-Pass Yield (QC)</span>
          <div className="text-[24px] font-bold text-[#16A34A] font-code-metric mt-1">98.6%</div>
          <span className="text-[12px] text-[#64748B]">Toleransi Scrap &lt; 2.0% Terpenuhi</span>
        </div>
      </div>

      {/* Production Lines Status Grid */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[20px]">precision_manufacturing</span>
            <h2 className="text-[18px] font-bold text-[#0F172A]">Status 14 Jalur Produksi Aktif (Real-Time MES)</h2>
          </div>
          <button
            onClick={onNavigateToWip}
            className="text-[12px] text-[#004ac6] hover:underline font-semibold cursor-pointer"
          >
            Lihat Detail WIP →
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {Array.from({ length: 14 }).map((_, i) => {
            const lineNum = i + 1;
            const isAlert = lineNum === 5; // Line 5 has alert
            const isMaintenance = lineNum === 10;
            return (
              <div
                key={lineNum}
                className={`p-3 rounded-lg border flex flex-col justify-between text-[12px] ${
                  isAlert
                    ? 'border-[#ba1a1a]/40 bg-[#ffdad6]/20'
                    : isMaintenance
                    ? 'border-[#D97706]/40 bg-[#fef3c7]/20'
                    : 'border-[#E2E8F0] bg-[#f2f4f6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A]">Line {lineNum < 10 ? `0${lineNum}` : lineNum}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAlert ? 'bg-[#ba1a1a]' : isMaintenance ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                    }`}
                  ></span>
                </div>
                <div className="mt-2 text-[11px] text-[#64748B]">
                  {isAlert ? (
                    <span className="text-[#ba1a1a] font-semibold">Variance +5.7%</span>
                  ) : isMaintenance ? (
                    <span className="text-[#D97706] font-semibold">Tooling Setup</span>
                  ) : (
                    <span>Running • 98.4%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
