import React from 'react';
import { CurrencyType } from '../../types/costing';
import { formatCurrency } from '../../utils/formatters';

interface QualityQcScreenProps {
  currency: CurrencyType;
}

export const QualityQcScreen: React.FC<QualityQcScreenProps> = ({ currency }) => {
  const defectCategories = [
    { name: 'Skipped Stitches (Jahitan Loncat)', count: 48, pct: 36, loss: 1250000 },
    { name: 'Bonding Delamination (Lem Menggelembung)', count: 32, pct: 24, loss: 1840000 },
    { name: 'Fabric Ladder / Runner (Serat Kain Tertarik)', count: 26, pct: 19, loss: 890000 },
    { name: 'Oil / Needle Stain (Noda Pelumas Siruba)', count: 18, pct: 13, loss: 540000 },
    { name: 'Size Tolerance Variance (Dimensi ±0.5cm)', count: 11, pct: 8, loss: 420000 },
  ];

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div>
        <span className="text-[12px] text-[#64748B]">Quality Assurance &amp; Defect Control</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">Quality &amp; Defect QC Hub</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">First-Pass Yield (FPY) Bulan Ini</span>
          <div className="text-[24px] font-bold text-[#16A34A] font-code-metric mt-1">98.6%</div>
          <span className="text-[12px] text-[#64748B]">Target Minimum: 98.0%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Total Pcs Cacat / Reject</span>
          <div className="text-[24px] font-bold text-[#ba1a1a] font-code-metric mt-1">135 pcs</div>
          <span className="text-[12px] text-[#64748B]">0.36% dari total output 37.500 pcs</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Beban Scrap Loss Terhadap HPP</span>
          <div className="text-[24px] font-bold text-[#0F172A] font-code-metric mt-1">
            {formatCurrency(4940000, currency)}
          </div>
          <span className="text-[12px] text-[#16A34A] font-semibold">Terserap dalam buffer allowance</span>
        </div>
      </div>

      {/* Defect Pareto Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
        <h2 className="text-[18px] font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
          Analisis Pareto Cacat Jahit &amp; Bonding Intimate Wear
        </h2>

        <div className="mt-4 space-y-4">
          {defectCategories.map((item) => (
            <div key={item.name} className="p-3 bg-[#f2f4f6] rounded-lg">
              <div className="flex items-center justify-between text-[13px]">
                <strong className="text-[#0F172A]">{item.name}</strong>
                <span className="font-code-metric font-bold text-[#ba1a1a]">
                  {item.count} pcs ({item.pct}%) • {formatCurrency(item.loss, currency)}
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#ba1a1a] h-full rounded-full"
                  style={{ width: `${item.pct * 2}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
