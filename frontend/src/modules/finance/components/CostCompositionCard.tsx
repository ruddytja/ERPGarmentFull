import React from 'react';
import { CostStructure, CurrencyType } from '../types/costing';
import { formatCurrency } from '../utils/formatters';

interface CostCompositionCardProps {
  costStructure: CostStructure;
  currency: CurrencyType;
  averageBomUnit: number;
  averageRealUnit: number;
  onDrilldownCategory?: (cat: string) => void;
}

export const CostCompositionCard: React.FC<CostCompositionCardProps> = ({
  costStructure,
  currency,
  averageBomUnit,
  averageRealUnit,
  onDrilldownCategory,
}) => {
  const { rawMaterial, directLabor, overhead } = costStructure;

  return (
    <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[20px]">pie_chart</span>
            <h2 className="text-[18px] md:text-[20px] font-bold text-[#0F172A] tracking-tight">
              Komposisi Struktur Biaya Produksi (BOM vs Realisasi)
            </h2>
          </div>
          <span className="text-[12px] text-[#64748B]">Satuan Agregat Bulan Ini</span>
        </div>

        {/* Breakdown Items */}
        <div className="mt-4 flex flex-col gap-4">
          {/* Item 1: Raw Materials */}
          <div
            onClick={() => onDrilldownCategory?.('material')}
            className="p-3 rounded-lg bg-[#f2f4f6] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[#004ac6] inline-block"></span>
                <span className="text-[14px] font-semibold text-[#0F172A] group-hover:text-[#004ac6] transition-colors">
                  Bahan Baku Langsung (Kain Modal, Spandex, Benang)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[12px] font-code-metric font-bold bg-[#ffdad6] text-[#ba1a1a]">
                +{rawMaterial.variancePct}% Unfavorable
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <span className="text-[#64748B] block">Estimasi BOM</span>
                <span className="font-code-metric font-semibold text-[#0F172A]">
                  {formatCurrency(rawMaterial.bomBudget, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Realisasi Lapangan</span>
                <span className="font-code-metric font-semibold text-[#ba1a1a]">
                  {formatCurrency(rawMaterial.realSpend, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Akar Masalah</span>
                <span className="text-[11px] text-[#64748B] italic truncate block">
                  {rawMaterial.rootCause}
                </span>
              </div>
            </div>

            {/* Progress visual representation */}
            <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#ba1a1a] h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* Item 2: Direct Labor */}
          <div
            onClick={() => onDrilldownCategory?.('labor')}
            className="p-3 rounded-lg bg-[#f2f4f6] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[#006329] inline-block"></span>
                <span className="text-[14px] font-semibold text-[#0F172A] group-hover:text-[#006329] transition-colors">
                  Tenaga Kerja Langsung (Piece-rate / Borongan Operator Sewing &amp; Cutting)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[12px] font-code-metric font-bold bg-[#16A34A]/15 text-[#16A34A]">
                {directLabor.variancePct}% Favorable
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <span className="text-[#64748B] block">Estimasi BOM</span>
                <span className="font-code-metric font-semibold text-[#0F172A]">
                  {formatCurrency(directLabor.bomBudget, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Realisasi Lapangan</span>
                <span className="font-code-metric font-semibold text-[#16A34A]">
                  {formatCurrency(directLabor.realSpend, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Faktor Penentu</span>
                <span className="text-[11px] text-[#64748B] truncate block">
                  {directLabor.keyDriver}
                </span>
              </div>
            </div>

            {/* Progress visual representation */}
            <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#16A34A] h-full rounded-full" style={{ width: '92.1%' }}></div>
            </div>
          </div>

          {/* Item 3: Factory Overhead */}
          <div
            onClick={() => onDrilldownCategory?.('overhead')}
            className="p-3 rounded-lg bg-[#f2f4f6] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[#545f73] inline-block"></span>
                <span className="text-[14px] font-semibold text-[#0F172A] group-hover:text-[#545f73] transition-colors">
                  Overhead Pabrik (Listrik, Mesin, Jarum Siruba, Lem Bonding, Sewa)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[12px] font-code-metric font-bold bg-[#16A34A]/15 text-[#16A34A]">
                {overhead.variancePct}% Favorable
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <span className="text-[#64748B] block">Estimasi BOM</span>
                <span className="font-code-metric font-semibold text-[#0F172A]">
                  {formatCurrency(overhead.bomBudget, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Realisasi Lapangan</span>
                <span className="font-code-metric font-semibold text-[#16A34A]">
                  {formatCurrency(overhead.realSpend, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Optimasi</span>
                <span className="text-[11px] text-[#64748B] truncate block">
                  {overhead.optimization}
                </span>
              </div>
            </div>

            {/* Progress visual representation */}
            <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#16A34A] h-full rounded-full" style={{ width: '90.2%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Summary Bar below */}
      <div className="mt-4 pt-3 border-t border-[#E2E8F0] bg-white flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#004ac6] text-[20px]">calculate</span>
          <span className="text-[15px] font-bold text-[#0F172A]">Rata-rata HPP per Pcs:</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[11px] text-[#64748B] uppercase tracking-wider block font-medium">
              Estimasi BOM
            </span>
            <span className="font-code-metric font-bold text-[#64748B] text-[14px]">
              {formatCurrency(averageBomUnit, currency)}
            </span>
          </div>
          <div className="h-6 w-px bg-[#E2E8F0]"></div>
          <div className="text-right">
            <span className="text-[11px] text-[#16A34A] uppercase tracking-wider block font-semibold">
              Realisasi Efektif
            </span>
            <span className="font-code-metric font-bold text-[#16A34A] text-[20px]">
              {formatCurrency(averageRealUnit, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
