import React from 'react';

interface DeviationAlertsCardProps {
  onReviewBomClick: () => void;
  onViewFavorableClick: () => void;
}

export const DeviationAlertsCard: React.FC<DeviationAlertsCardProps> = ({
  onReviewBomClick,
  onViewFavorableClick,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#D97706] text-[20px]">warning</span>
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#0F172A] tracking-tight">
            Peringatan Deviasi HPP &amp; Aksi
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ffdad6] text-[#ba1a1a]">
          1 Tindakan Kritis
        </span>
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        {/* Alert Card 1 (Red / Unfavorable) */}
        <div className="p-3.5 rounded-lg border border-[#ba1a1a]/30 bg-[#ffdad6]/20 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span>
              <span className="font-code-metric font-bold text-[14px] text-[#ba1a1a]">
                SPK-2026-10-095
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-[#ba1a1a] text-white font-code-metric font-bold text-[11px]">
              +5.7% (Batas &gt; 5%)
            </span>
          </div>
          <p className="text-[13px] text-[#0F172A] leading-snug">
            <strong>B2B Cotton Modal Lady Brief:</strong> Deviasi biaya melewati toleransi ±5% akibat lonjakan harga supplier Spandex Elastane grade 40/100.
          </p>
          <div className="mt-1 flex items-center justify-end">
            <button
              onClick={onReviewBomClick}
              className="px-2.5 py-1 rounded bg-[#ba1a1a] text-white font-semibold text-[12px] hover:bg-[#ba1a1a]/90 transition-colors flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">inventory</span>
              <span>Review BOM &amp; Supplier</span>
            </button>
          </div>
        </div>

        {/* Alert Card 2 (Green / Favorable) */}
        <div
          onClick={onViewFavorableClick}
          className="p-3 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/10 flex flex-col gap-1.5 cursor-pointer hover:border-[#16A34A] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#16A34A] text-[18px]">check_circle</span>
              <span className="font-code-metric font-bold text-[14px] text-[#16A34A]">
                SPK-2026-10-088
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-[#16A34A] text-white font-code-metric font-bold text-[11px]">
              -2.9% Favorable
            </span>
          </div>
          <p className="text-[13px] text-[#0F172A] leading-snug">
            <strong>NAQALA Seamless Brief M-L:</strong> Efisiensi nesting pemotongan bahan spandex berlebih menghasilkan efisiensi <strong>hemat Rp 550 / pcs</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
