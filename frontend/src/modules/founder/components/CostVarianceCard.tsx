import React from 'react';
import { BrandVariance } from '../types';

interface CostVarianceCardProps {
  variances: BrandVariance[];
  currency: 'IDR' | 'USD';
  onBrandClick: (brand: BrandVariance) => void;
}

export const CostVarianceCard: React.FC<CostVarianceCardProps> = ({
  variances,
  currency,
  onBrandClick,
}) => {
  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toFixed(2)}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Card Header & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2">
          <div>
            <h2 className="font-headline text-[#0F172A] font-bold text-lg tracking-tight">
              Estimated vs Actual Cost Variance per Brand
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Analisis HPP terperinci: Komponen Material, Labor Langsung, dan Overhead Pabrik
            </p>
          </div>
          {/* Legend Tags */}
          <div className="flex items-center gap-3 text-[12px] text-[#545f73] flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#004ac6]" /> Material
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#2563eb]" /> Labor
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#cbd5e1]" /> Overhead
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-[#dc2626] bg-white" /> Realized
            </span>
          </div>
        </div>

        {/* Comparison Multi-Stack / Bar Canvas */}
        <div className="py-6 space-y-6">
          {variances.map((item) => (
            <div
              key={item.id}
              onClick={() => onBrandClick(item)}
              className="space-y-1.5 p-2 -mx-2 rounded-lg hover:bg-[#f7f9fb] transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-center text-xs flex-wrap gap-1">
                <span className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.bulletColor}`} />
                  {item.name}
                </span>
                <span className="font-code-metric text-[#64748B]">
                  Estimasi: {formatMoney(item.estimasi)} | Realisasi:{' '}
                  <strong 
                    className={`font-semibold ${
                      item.isOverrun ? 'text-[#dc2626]' : item.deltaPct < -1 ? 'text-[#16a34a]' : 'text-[#004ac6]'
                    }`}
                  >
                    {formatMoney(item.realisasi)} ({item.deltaPct > 0 ? `+${item.deltaPct}% Alert` : `${item.deltaPct}%`})
                  </strong>
                </span>
              </div>

              {/* Stacked Breakdown Bar */}
              <div className="space-y-1">
                <div className="h-6 w-full bg-[#f2f4f6] rounded flex overflow-hidden text-[10px] text-white font-code-metric font-semibold text-center items-center">
                  <div
                    className={`${item.isOverrun ? 'bg-red-600' : 'bg-[#004ac6]'} h-full flex items-center justify-center transition-all duration-300`}
                    style={{ width: `${item.materialPct}%` }}
                    title={`Material: ${item.materialPct}%`}
                  >
                    {item.isOverrun ? `${item.materialPct}% Spandex Fluctuation` : `${item.materialPct}% Mat`}
                  </div>
                  <div
                    className="bg-[#2563eb] h-full flex items-center justify-center transition-all duration-300"
                    style={{ width: `${item.laborPct}%` }}
                    title={`Labor: ${item.laborPct}%`}
                  >
                    {item.laborPct}% Lab
                  </div>
                  <div
                    className="bg-slate-400 h-full flex items-center justify-center text-[#0F172A] transition-all duration-300"
                    style={{ width: `${item.overheadPct}%` }}
                    title={`Overhead: ${item.overheadPct}%`}
                  >
                    {item.overheadPct}% Ov
                  </div>
                </div>

                {/* Subtext info */}
                <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1">
                  <span>{item.isOverrun ? 'Target Budget Overrun' : 'Target Budgeted Bar'}</span>
                  <span
                    className={`font-semibold font-code-metric ${
                      item.isOverrun ? 'text-[#dc2626]' : item.deltaPct < -1 ? 'text-[#16a34a]' : 'text-[#64748B]'
                    }`}
                  >
                    {item.note}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Metrics inside Card */}
      <div className="mt-2 pt-3 border-t border-[#E2E8F0] grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-[#f2f4f6] rounded">
          <span className="text-[#64748B] block text-[11px] font-medium">Avg Material HPP</span>
          <strong className="font-code-metric text-[#0F172A] text-[13px]">
            {currency === 'USD' ? '$0.85/pc' : 'Rp 12.870/pc'}
          </strong>
        </div>
        <div className="p-2 bg-[#f2f4f6] rounded">
          <span className="text-[#64748B] block text-[11px] font-medium">Avg Direct Labor</span>
          <strong className="font-code-metric text-[#0F172A] text-[13px]">
            {currency === 'USD' ? '$0.31/pc' : 'Rp 4.750/pc'}
          </strong>
        </div>
        <div className="p-2 bg-[#f2f4f6] rounded">
          <span className="text-[#64748B] block text-[11px] font-medium">Consolidated Variance</span>
          <strong className="font-code-metric text-[#16a34a] text-[13px]">
            -1.2% Favorable
          </strong>
        </div>
      </div>
    </div>
  );
};
