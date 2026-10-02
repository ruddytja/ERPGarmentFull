import React from 'react';
import { CurrencyType } from '../../types/costing';
import { formatCurrency } from '../../utils/formatters';

interface ExecutiveReportsScreenProps {
  currency: CurrencyType;
  onOpenExportModal: () => void;
}

export const ExecutiveReportsScreen: React.FC<ExecutiveReportsScreenProps> = ({
  currency,
  onOpenExportModal,
}) => {
  const brandReports = [
    { brand: 'NAQALA', revenue: 640000000, cogs: 395000000, margin: 38.3, status: 'Healthy' },
    { brand: 'B2B Cotton Modal', revenue: 780000000, cogs: 512000000, margin: 34.4, status: 'Review Needed' },
    { brand: 'AUSTIN', revenue: 520000000, cogs: 310000000, margin: 40.4, status: 'High Margin' },
    { brand: 'VELONA', revenue: 410000000, cogs: 265000000, margin: 35.4, status: 'Healthy' },
    { brand: 'ATHLETA', revenue: 490000000, cogs: 295000000, margin: 39.8, status: 'Healthy' },
  ];

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[12px] text-[#64748B]">Financial Statements &amp; Portfolio Margin Analysis</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">Executive Reports Hub</h1>
        </div>

        <button
          onClick={onOpenExportModal}
          className="px-4 py-2 bg-[#004ac6] hover:bg-[#0053db] text-white rounded-lg text-[13px] font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">file_download</span>
          <span>Download Executive Financial Pack</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
        <h2 className="text-[18px] font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
          Analisis Gross Profit Margin per Brand Portofolio B2B
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#1E293B] text-[#F8FAFC] font-code-metric">
              <tr>
                <th className="py-2.5 px-4">Brand Portofolio</th>
                <th className="py-2.5 px-4 text-right">Nilai Kontrak Revenue</th>
                <th className="py-2.5 px-4 text-right">Total HPP Produksi (COGS)</th>
                <th className="py-2.5 px-4 text-right">Gross Profit Margin</th>
                <th className="py-2.5 px-4 text-center">Status Portofolio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-code-metric">
              {brandReports.map((b) => (
                <tr key={b.brand} className="hover:bg-[#f2f4f6]">
                  <td className="py-3 px-4 font-bold text-[#0F172A]">{b.brand}</td>
                  <td className="py-3 px-4 text-right text-[#0F172A]">
                    {formatCurrency(b.revenue, currency)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#64748B]">
                    {formatCurrency(b.cogs, currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#16A34A]">
                    {b.margin}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        b.status === 'Review Needed'
                          ? 'bg-[#ffdad6] text-[#ba1a1a]'
                          : 'bg-[#16A34A]/15 text-[#16A34A]'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
