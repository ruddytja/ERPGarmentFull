import React from 'react';
import { CurrencyType } from '../types/costing';
import { formatCurrency } from '../utils/formatters';

interface KpiCardsProps {
  currency: CurrencyType;
  totalBatches: number;
  targetBudgetTotal: number;
  activeLines: number;
  bomEstimatedHpp: number;
  standardTargetPerUnit: number;
  actualHppRealization: number;
  averageUnitCost: number;
  netCostVariance: number;
  baselineCutoff: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  currency,
  totalBatches,
  targetBudgetTotal,
  activeLines,
  bomEstimatedHpp,
  standardTargetPerUnit,
  actualHppRealization,
  averageUnitCost,
  netCostVariance,
  baselineCutoff,
}) => {
  const efficiencyPercent = ((actualHppRealization - bomEstimatedHpp) / bomEstimatedHpp) * 100;
  const isFavorable = netCostVariance <= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total SPK Batch Aktif */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#64748B] font-medium">Total SPK Batch Aktif</span>
          <span className="w-8 h-8 rounded-lg bg-[#f2f4f6] text-[#545f73] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          </span>
        </div>
        <div>
          <div className="text-[24px] font-bold text-[#0F172A] tracking-tight">
            {totalBatches} Batch
          </div>
          <div className="text-[12px] text-[#64748B] mt-1 flex items-center gap-1.5 font-code-metric">
            <span className="w-2 h-2 rounded-full bg-[#004ac6] inline-block shrink-0"></span>
            <span>{formatCurrency(targetBudgetTotal, currency)} Target Biaya</span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-[12px]">
          <span className="text-[#64748B]">Alokasi Mesin:</span>
          <span className="font-code-metric font-semibold text-[#0F172A]">
            {activeLines} Line Aktif
          </span>
        </div>
      </div>

      {/* Card 2: Estimasi HPP (BOM Budget) */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#64748B] font-medium">Estimasi HPP (BOM Budget)</span>
          <span className="w-8 h-8 rounded-lg bg-[#f2f4f6] text-[#004ac6] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          </span>
        </div>
        <div>
          <div className="text-[24px] font-bold text-[#0F172A] tracking-tight font-code-metric">
            {formatCurrency(bomEstimatedHpp, currency)}
          </div>
          <div className="text-[12px] text-[#64748B] mt-1">
            Standar Target Per Unit:{' '}
            <span className="font-code-metric text-[#0F172A] font-semibold">
              {formatCurrency(standardTargetPerUnit, currency)}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-[12px]">
          <span className="text-[#64748B]">Baseline Cut-off:</span>
          <span className="font-code-metric text-[#0F172A] font-medium">{baselineCutoff}</span>
        </div>
      </div>

      {/* Card 3: Realisasi HPP (Actual Spend) */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#64748B] font-medium">Realisasi HPP (Actual Spend)</span>
          <span className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">trending_down</span>
          </span>
        </div>
        <div>
          <div className="text-[24px] font-bold text-[#0F172A] tracking-tight font-code-metric">
            {formatCurrency(actualHppRealization, currency)}
          </div>
          <div className="text-[12px] mt-1 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-[#16A34A]/15 text-[#16A34A] font-code-metric">
              {efficiencyPercent.toFixed(2)}% Efisien
            </span>
            <span className="text-[#64748B] text-[12px]">(Favorable)</span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-[12px]">
          <span className="text-[#64748B]">Unit Cost Rata-rata:</span>
          <span className="font-code-metric font-semibold text-[#16A34A]">
            {formatCurrency(averageUnitCost, currency)} /pc
          </span>
        </div>
      </div>

      {/* Card 4: Net Cost Variance MoM */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#64748B] font-medium">Net Cost Variance MoM</span>
          <span className="w-8 h-8 rounded-lg bg-[#dbe1ff]/50 text-[#004ac6] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">savings</span>
          </span>
        </div>
        <div>
          <div
            className={`text-[24px] font-bold tracking-tight font-code-metric ${
              isFavorable ? 'text-[#16A34A]' : 'text-[#ba1a1a]'
            }`}
          >
            {formatCurrency(netCostVariance, currency)}
          </div>
          <div
            className="text-[12px] text-[#64748B] mt-1 leading-tight line-clamp-1 truncate"
            title="Efisiensi Material vs Lonjakan Upah Lembur"
          >
            Efisiensi Material vs Lonjakan Upah
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-[12px]">
          <span className="text-[#64748B]">Health Variance:</span>
          <span className="px-1.5 py-0.5 bg-[#16A34A]/15 text-[#16A34A] font-bold text-[11px] rounded font-code-metric">
            Dalam Toleransi (&lt;±5%)
          </span>
        </div>
      </div>
    </div>
  );
};
