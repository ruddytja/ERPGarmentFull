import React from 'react';
import { AlertTriangle, ReceiptText, X } from 'lucide-react';

interface AlertBannerProps {
  onViewCosting: () => void;
  onDismiss: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  onViewCosting,
  onDismiss,
}) => {
  return (
    <section className="bg-white border-l-4 border-l-[#D97706] border border-[#E2E8F0] rounded-lg p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-50 text-[#D97706] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-[#D97706]" />
        </div>
        <div className="text-sm text-[#0F172A] leading-relaxed">
          <span className="font-semibold text-[#D97706]">
            Peringatan HPP SPK-2026-10-095:
          </span>{' '}
          Kenaikan harga benang spandex elastane (+6.2%) di Sewing Line 2 memerlukan review bersama Supervisor &amp; Finance.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          onClick={onViewCosting}
          className="bg-[#f2f4f6] hover:bg-[#e6e8ea] text-[#004ac6] border border-[#CBD5E1] px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ReceiptText className="w-[15px] h-[15px]" />
          <span>Lihat Breakdown Costing</span>
        </button>
        <button
          onClick={onDismiss}
          className="text-[#64748B] hover:text-[#0F172A] p-1 rounded hover:bg-[#f2f4f6] transition-colors cursor-pointer"
          title="Dismiss Alert"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>
    </section>
  );
};
