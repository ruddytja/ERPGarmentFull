import React from 'react';
import { CurrencyType } from '../types/costing';

interface SubheaderProps {
  currency: CurrencyType;
  onCurrencyChange: (c: CurrencyType) => void;
  selectedMonth: string;
  onOpenMonthFilter: () => void;
  onOpenOverheadModal: () => void;
  onOpenExportModal: () => void;
}

export const Subheader: React.FC<SubheaderProps> = ({
  currency,
  onCurrencyChange,
  selectedMonth,
  onOpenMonthFilter,
  onOpenOverheadModal,
  onOpenExportModal,
}) => {
  return (
    <section className="bg-white border-b border-[#E2E8F0] py-4 px-8">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb & Role Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#64748B]">Home</span>
            <span className="text-[12px] text-[#64748B]">/</span>
            <span className="text-[12px] text-[#004ac6] font-semibold">Finance &amp; Costing Hub</span>
            <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#d5e0f8] text-[#586377] text-[12px] font-semibold border border-[#c3c6d7]/30">
              <span className="material-symbols-outlined text-[13px]">admin_panel_settings</span>
              FINANCE MANAGER (Costing &amp; Payroll)
            </span>
          </div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#0F172A] tracking-tight leading-tight">
            Finance &amp; Costing Hub
          </h1>
        </div>

        {/* Currency Selector, Date Filter & Primary Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Currency selector */}
          <div className="flex items-center bg-[#f2f4f6] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 shadow-2xs">
            <span className="text-[12px] text-[#64748B] mr-1.5 font-medium">Mata Uang:</span>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as CurrencyType)}
              className="bg-transparent font-medium text-[13px] text-[#0F172A] border-none focus:ring-0 p-0 pr-2 cursor-pointer font-code-metric outline-none"
            >
              <option value="IDR">IDR (Rp)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {/* Date Filter Picker */}
          <button
            onClick={onOpenMonthFilter}
            className="flex items-center gap-2 bg-[#f2f4f6] hover:bg-[#e6e8ea] border border-[#E2E8F0] rounded-lg px-3 py-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[#737686] text-[18px]">calendar_month</span>
            <span className="text-[13px] text-[#0F172A] font-medium">Bulan Ini: {selectedMonth}</span>
            <span className="material-symbols-outlined text-[#737686] text-[16px]">expand_more</span>
          </button>

          {/* Secondary Action: Input Overhead Bulanan */}
          <button
            onClick={onOpenOverheadModal}
            className="px-3.5 py-1.5 bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#f2f4f6] rounded-lg text-[13px] font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px] text-[#004ac6]">add_chart</span>
            <span>Input Overhead Bulanan</span>
          </button>

          {/* Primary Action CTA: Export Costing PDF/XLS */}
          <button
            onClick={onOpenExportModal}
            className="px-4 py-1.5 bg-[#004ac6] hover:bg-[#0053db] text-white rounded-lg text-[13px] font-semibold flex items-center gap-2 shadow-xs active:scale-[0.99] transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Export Costing PDF/XLS</span>
          </button>
        </div>
      </div>
    </section>
  );
};
