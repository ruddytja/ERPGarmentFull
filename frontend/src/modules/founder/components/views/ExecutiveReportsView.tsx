import React from 'react';
import { BarChart3, Download, TrendingUp, Layers, PieChart } from 'lucide-react';
import { KPIStats } from '../../types';

interface ExecutiveReportsViewProps {
  stats: KPIStats;
  currency: 'IDR' | 'USD';
  onExportClick: () => void;
}

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({
  stats,
  currency,
  onExportClick,
}) => {
  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            Executive Financial Reports &amp; Portfolio Statement
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Laporan Laba Rugi Operasional Manufaktur (P&amp;L), EBITDA, dan Kontribusi Marjin per Lini Brand
          </p>
        </div>
        <button
          onClick={onExportClick}
          className="flex items-center gap-2 bg-[#2563eb] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#004ac6] transition-all cursor-pointer shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Ekspor Laporan (PDF / XLS)</span>
        </button>
      </div>

      {/* P&L Statement Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-[#0F172A] pb-2 border-b border-[#E2E8F0]">
          Laporan Laba Rugi Pabrik (Consolidated P&amp;L Statement - Okt 2026)
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-2 border-b border-[#E2E8F0]">
            <span className="font-bold text-[#0F172A]">Gross Production Revenue (Pendapatan Kotor)</span>
            <span className="font-code-metric font-bold text-[#004ac6]">{formatMoney(stats.monthlyGrossRevenue)}</span>
          </div>

          <div className="flex justify-between py-1.5 pl-4 text-[#545f73]">
            <span>- Biaya Bahan Baku Langsung (Kain, Karet Picot, Benang Spandex)</span>
            <span className="font-code-metric">{formatMoney(Math.round(stats.totalHppActual * 0.62))}</span>
          </div>

          <div className="flex justify-between py-1.5 pl-4 text-[#545f73]">
            <span>- Upah Buruh Langsung Sewing &amp; Bonding (Direct Labor)</span>
            <span className="font-code-metric">{formatMoney(Math.round(stats.totalHppActual * 0.24))}</span>
          </div>

          <div className="flex justify-between py-1.5 pl-4 text-[#545f73]">
            <span>- Overhead Pabrik, Listrik, Depresiasi Mesin (Factory Overhead)</span>
            <span className="font-code-metric">{formatMoney(Math.round(stats.totalHppActual * 0.14))}</span>
          </div>

          <div className="flex justify-between py-2 border-t border-[#E2E8F0] font-semibold text-[#0F172A]">
            <span>Total Harga Pokok Produksi (COGS / Total HPP Aktual)</span>
            <span className="font-code-metric text-[#DC2626]">({formatMoney(stats.totalHppActual)})</span>
          </div>

          <div className="flex justify-between py-2.5 bg-[#f8fafc] px-3 rounded font-bold text-sm text-[#0F172A]">
            <span>Gross Operating Profit (Laba Kotor Manufaktur)</span>
            <span className="font-code-metric text-[#16A34A]">{formatMoney(stats.monthlyGrossRevenue - stats.totalHppActual)}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-[#E2E8F0] font-medium text-[#545f73]">
            <span>Beban Operasional, Gudang &amp; Logistik (SG&amp;A Pool)</span>
            <span className="font-code-metric">({formatMoney(stats.monthlyGrossRevenue - stats.totalHppActual - stats.ebitda)})</span>
          </div>

          <div className="flex justify-between py-3 bg-green-50 px-3 rounded font-bold text-base text-[#16A34A]">
            <span>EBITDA Operasional &amp; Margin Bersih ({stats.netProfitMargin}%)</span>
            <span className="font-code-metric">{formatMoney(stats.ebitda)}</span>
          </div>
        </div>
      </div>

      {/* Brand Portfolios Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#0F172A]">NAQALA (Intimate &amp; Seamless)</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#004ac6] font-semibold text-[10px]">Brand Sendiri</span>
          </div>
          <div className="font-code-metric font-bold text-lg text-[#004ac6]">
            {formatMoney(680000000)}
          </div>
          <div className="text-xs text-[#64748B] flex justify-between">
            <span>Kontribusi Marjin:</span>
            <strong className="text-[#16A34A]">+42.1%</strong>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Kategori unggulan dengan margin tertinggi berkat teknologi ultrasonic bonding tanpa jahitan.
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#0F172A]">Pierre UNO (Bamboo Trunk)</span>
            <span className="px-2 py-0.5 rounded bg-green-50 text-[#16A34A] font-semibold text-[10px]">Eco Premium</span>
          </div>
          <div className="font-code-metric font-bold text-lg text-[#0F172A]">
            {formatMoney(420000000)}
          </div>
          <div className="text-xs text-[#64748B] flex justify-between">
            <span>Kontribusi Marjin:</span>
            <strong className="text-[#16A34A]">+38.5%</strong>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Penjualan stabil di pasar pria premium dengan bahan serat bambu organik bersertifikat Oeko-Tex.
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#0F172A]">B2B Contract Orders (OEM)</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-[#D97706] font-semibold text-[10px]">Volume Kontrak</span>
          </div>
          <div className="font-code-metric font-bold text-lg text-[#0F172A]">
            {formatMoney(385200000)}
          </div>
          <div className="text-xs text-[#64748B] flex justify-between">
            <span>Kontribusi Marjin:</span>
            <strong className="text-[#D97706]">+29.2%</strong>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Kontrak volume tinggi untuk klien OEM department store, sensitif terhadap fluktuasi benang spandex.
          </p>
        </div>
      </div>
    </div>
  );
};
