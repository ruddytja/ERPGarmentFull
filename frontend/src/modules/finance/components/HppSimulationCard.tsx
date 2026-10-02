import React, { useState } from 'react';
import { CurrencyType } from '../types/costing';
import { formatCurrency } from '../utils/formatters';

interface HppSimulationCardProps {
  currency: CurrencyType;
}

export const HppSimulationCard: React.FC<HppSimulationCardProps> = ({ currency }) => {
  const [rawMaterialCost, setRawMaterialCost] = useState<number>(11800);
  const [laborOverheadCost, setLaborOverheadCost] = useState<number>(7170);
  const [targetMargin, setTargetMargin] = useState<number>(38);
  const [showAppliedToast, setShowAppliedToast] = useState(false);

  // Compute recommendation:
  // HPP = rawMaterialCost + laborOverheadCost
  // Rekomendasi = HPP / (1 - margin/100)
  const totalHpp = rawMaterialCost + laborOverheadCost;
  const marginDecimal = Math.min(Math.max(targetMargin, 1), 95) / 100;
  const recommendedPrice = Math.round(totalHpp / (1 - marginDecimal));

  const handleApply = () => {
    setShowAppliedToast(true);
    setTimeout(() => setShowAppliedToast(false), 2500);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col relative">
      <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#004ac6] text-[18px]">tune</span>
          <span className="text-[15px] font-bold text-[#0F172A]">Simulasi HPP Baru / Mark-Up B2B</span>
        </div>
        <span className="text-[12px] text-[#64748B]">Tool Cepat</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-[#64748B] block font-medium">Bahan Baku (IDR/pc)</label>
          <input
            type="number"
            value={rawMaterialCost}
            onChange={(e) => setRawMaterialCost(Number(e.target.value) || 0)}
            className="w-full mt-1 px-2.5 py-1 text-[13px] font-code-metric rounded border border-[#E2E8F0] bg-[#f2f4f6] text-[#0F172A] focus:outline-none focus:border-[#004ac6] transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] text-[#64748B] block font-medium">Labor + Overhead (IDR)</label>
          <input
            type="number"
            value={laborOverheadCost}
            onChange={(e) => setLaborOverheadCost(Number(e.target.value) || 0)}
            className="w-full mt-1 px-2.5 py-1 text-[13px] font-code-metric rounded border border-[#E2E8F0] bg-[#f2f4f6] text-[#0F172A] focus:outline-none focus:border-[#004ac6] transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] text-[#64748B] block font-medium">Target Margin B2B (%)</label>
          <div className="relative mt-1">
            <input
              type="number"
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value) || 0)}
              className="w-full px-2.5 py-1 pr-6 text-[13px] font-code-metric rounded border border-[#E2E8F0] bg-[#f2f4f6] text-[#0F172A] focus:outline-none focus:border-[#004ac6] transition-colors"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748B] pointer-events-none">
              %
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <div className="text-right">
            <span className="text-[10px] text-[#64748B] uppercase tracking-wide">
              Harga Jual Rekomendasi
            </span>
            <div className="text-[20px] font-code-metric font-bold text-[#004ac6] leading-tight">
              {formatCurrency(recommendedPrice, currency)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px]">
        <span className="text-[#64748B]">
          Cost Total: <strong className="text-[#0F172A] font-code-metric">{formatCurrency(totalHpp, currency)}</strong>
        </span>
        <button
          onClick={handleApply}
          className="text-[#004ac6] hover:underline font-semibold cursor-pointer"
        >
          {showAppliedToast ? '✓ Disimpan ke Draft Penawaran' : '+ Simpan ke Kalkulasi Penawaran'}
        </button>
      </div>
    </div>
  );
};
