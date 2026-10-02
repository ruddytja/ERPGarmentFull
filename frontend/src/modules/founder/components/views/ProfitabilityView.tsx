import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Filter,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  Info,
  Search,
} from 'lucide-react';
import { SPKBatch, BrandVariance } from '../../types';

interface ProfitabilityViewProps {
  batches: SPKBatch[];
  variances: BrandVariance[];
  currency: 'IDR' | 'USD';
  onInspectBatch: (batch: SPKBatch) => void;
}

type GroupBy = 'brand' | 'sku';
type SortKey = 'margin' | 'variance' | 'volume';

const fmt = (val: number, currency: 'IDR' | 'USD') => {
  if (currency === 'IDR') {
    return `Rp ${val >= 1_000_000 ? (val / 1_000_000).toFixed(1) + 'jt' : val.toLocaleString('id-ID')}`;
  }
  return `$${(val / 15800).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// Brand summary derived from SPKBatch data
function computeBrandSummaries(batches: SPKBatch[], currency: 'IDR' | 'USD') {
  const map: Record<
    string,
    {
      brand: string;
      totalQty: number;
      totalRevenue: number;
      totalHppActual: number;
      totalHppEstimasi: number;
      spkCount: number;
      flaggedCount: number;
    }
  > = {};

  batches.forEach((b) => {
    if (!map[b.brand]) {
      map[b.brand] = {
        brand: b.brand,
        totalQty: 0,
        totalRevenue: 0,
        totalHppActual: 0,
        totalHppEstimasi: 0,
        spkCount: 0,
        flaggedCount: 0,
      };
    }
    const entry = map[b.brand];
    entry.totalQty += b.completedQty;
    // Simulate sell price = realisasiHpp / (1 - marginKontribusi/100)
    const sellPrice = b.realisasiHpp / (1 - b.marginKontribusi / 100);
    entry.totalRevenue += sellPrice * b.completedQty;
    entry.totalHppActual += b.realisasiHpp * b.completedQty;
    entry.totalHppEstimasi += b.estimasiHpp * b.completedQty;
    entry.spkCount++;
    if (b.flagged) entry.flaggedCount++;
  });

  return Object.values(map).map((e) => ({
    ...e,
    marginPct:
      e.totalRevenue > 0 ? ((e.totalRevenue - e.totalHppActual) / e.totalRevenue) * 100 : 0,
    variancePct:
      e.totalHppEstimasi > 0
        ? ((e.totalHppActual - e.totalHppEstimasi) / e.totalHppEstimasi) * 100
        : 0,
  }));
}

export const ProfitabilityView: React.FC<ProfitabilityViewProps> = ({
  batches,
  variances,
  currency,
  onInspectBatch,
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('brand');
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [search, setSearch] = useState('');
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  const brandSummaries = computeBrandSummaries(batches, currency);

  const sortedBrands = [...brandSummaries].sort((a, b) => {
    if (sortKey === 'margin') return b.marginPct - a.marginPct;
    if (sortKey === 'variance') return Math.abs(b.variancePct) - Math.abs(a.variancePct);
    return b.totalQty - a.totalQty;
  });

  const filteredBatches = batches.filter(
    (b) =>
      b.skuName.toLowerCase().includes(search.toLowerCase()) ||
      b.brand.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase())
  );

  const getVarianceChipColor = (pct: number) => {
    if (pct <= 3) return 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]';
    if (pct <= 5) return 'bg-[#FEF9C3] text-[#A16207] border border-[#FDE68A]';
    return 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]';
  };

  const getVarianceIcon = (pct: number) => {
    if (pct > 5) return <AlertTriangle className="w-3 h-3" />;
    if (pct > 3) return <Info className="w-3 h-3" />;
    return null;
  };

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'margin', label: 'Margin %' },
    { key: 'variance', label: 'Variance' },
    { key: 'volume', label: 'Volume FG' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#2563eb]" />
            Profitabilitas per Brand &amp; SKU
          </h2>
          <p className="text-[#64748B] text-sm mt-0.5">
            Margin % = (Harga Jual − HPP Aktual) ÷ Harga Jual, berbobot qty FG &nbsp;·&nbsp;
            Variance % = (HPP Aktual − HPP Estimasi) ÷ HPP Estimasi
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Group By Toggle */}
          <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-0.5 text-sm">
            {(['brand', 'sku'] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer capitalize ${
                  groupBy === g
                    ? 'bg-white shadow-sm text-[#2563eb] font-semibold'
                    : 'text-[#64748B] hover:text-[#191c1e]'
                }`}
              >
                {g === 'brand' ? 'Per Brand' : 'Per SKU'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg bg-white px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-xs text-[#64748B] mr-1">Urutkan:</span>
            {sortOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all ${
                  sortKey === s.key
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748B] hover:bg-[#f2f4f6]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Summary Cards */}
      {groupBy === 'brand' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedBrands.map((brand) => {
              const isExpanded = expandedBrand === brand.brand;
              const brandBatches = batches.filter((b) => b.brand === brand.brand);
              return (
                <div
                  key={brand.brand}
                  className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden"
                >
                  <div
                    className="p-5 cursor-pointer hover:bg-[#f8fafc] transition-colors"
                    onClick={() =>
                      setExpandedBrand(isExpanded ? null : brand.brand)
                    }
                  >
                    {/* Brand header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-bold text-[#0F172A] text-base">{brand.brand}</div>
                        <div className="text-[#64748B] text-xs mt-0.5">
                          {brand.spkCount} SPK &nbsp;·&nbsp; {brand.totalQty.toLocaleString()} pcs FG
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 text-[#94A3B8] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>

                    {/* Margin % gauge */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-[#64748B] font-medium">Margin %</span>
                        <span
                          className={`font-bold text-lg ${brand.marginPct >= 30 ? 'text-[#16A34A]' : brand.marginPct >= 15 ? 'text-[#D97706]' : 'text-[#DC2626]'}`}
                        >
                          {brand.marginPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${brand.marginPct >= 30 ? 'bg-[#16A34A]' : brand.marginPct >= 15 ? 'bg-[#D97706]' : 'bg-[#DC2626]'}`}
                          style={{ width: `${Math.min(100, brand.marginPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Cost variance chip */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#64748B]">Cost Variance</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getVarianceChipColor(Math.abs(brand.variancePct))}`}
                      >
                        {getVarianceIcon(Math.abs(brand.variancePct))}
                        {brand.variancePct > 0 ? '+' : ''}
                        {brand.variancePct.toFixed(1)}%
                      </span>
                    </div>

                    {/* Revenue & HPP */}
                    <div className="mt-3 pt-3 border-t border-[#F1F5F9] grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[#94A3B8] mb-0.5">Total Revenue</div>
                        <div className="font-semibold text-[#0F172A]">
                          {fmt(brand.totalRevenue, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#94A3B8] mb-0.5">HPP Aktual</div>
                        <div className="font-semibold text-[#0F172A]">
                          {fmt(brand.totalHppActual, currency)}
                        </div>
                      </div>
                    </div>

                    {brand.flaggedCount > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-[#DC2626] font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {brand.flaggedCount} SPK dengan variance &gt; 5%
                      </div>
                    )}
                  </div>

                  {/* Expanded SPK list */}
                  {isExpanded && (
                    <div className="border-t border-[#F1F5F9] bg-[#fafbfd]">
                      <div className="px-5 py-3">
                        <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                          SPK List — {brand.brand}
                        </div>
                        <div className="space-y-1.5">
                          {brandBatches.map((b) => (
                            <button
                              key={b.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectBatch(b);
                              }}
                              className="w-full flex items-center justify-between text-left bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 hover:border-[#2563eb]/40 hover:bg-[#eff6ff] transition-all cursor-pointer"
                            >
                              <div>
                                <div className="text-xs font-semibold text-[#0F172A]">
                                  {b.id}
                                </div>
                                <div className="text-[11px] text-[#64748B] truncate max-w-[160px]">
                                  {b.skuName}
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-xs font-bold ${b.marginKontribusi >= 30 ? 'text-[#16A34A]' : 'text-[#D97706]'}`}
                                >
                                  {b.marginKontribusi.toFixed(1)}%
                                </div>
                                {b.flagged && (
                                  <AlertTriangle className="w-3 h-3 text-[#DC2626] ml-auto" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Per SKU Table */}
      {groupBy === 'sku' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Cari SKU, brand, atau nomor SPK…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none placeholder-[#94A3B8] text-[#0F172A]"
            />
            <Filter className="w-4 h-4 text-[#94A3B8]" />
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    SPK / SKU
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    HPP Estimasi
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    HPP Aktual
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Margin %
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Volume FG
                  </th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[#94A3B8] text-sm">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Belum ada SPK selesai di periode ini.
                    </td>
                  </tr>
                )}
                {filteredBatches.map((b) => {
                  const variancePct =
                    b.estimasiHpp > 0
                      ? ((b.realisasiHpp - b.estimasiHpp) / b.estimasiHpp) * 100
                      : 0;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => onInspectBatch(b)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#0F172A] text-xs">{b.id}</div>
                        <div className="text-[#64748B] text-[11px] max-w-[200px] truncate">
                          {b.skuName}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#2563eb] border border-[#BFDBFE]">
                          {b.brand}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-[#64748B] font-mono">
                        {fmt(b.estimasiHpp, currency)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-[#0F172A] font-mono font-semibold">
                        {fmt(b.realisasiHpp, currency)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getVarianceChipColor(Math.abs(variancePct))}`}
                        >
                          {getVarianceIcon(Math.abs(variancePct))}
                          {variancePct > 0 ? '+' : ''}
                          {variancePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-bold text-sm ${b.marginKontribusi >= 30 ? 'text-[#16A34A]' : b.marginKontribusi >= 15 ? 'text-[#D97706]' : 'text-[#DC2626]'}`}
                        >
                          {b.marginKontribusi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-[#0F172A] font-mono">
                        {b.completedQty.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          Data berstatus <strong>PROVISIONAL</strong> diberi label "Sementara" sampai Finance mengunci overhead periode.
          SKU tanpa harga jual akan menampilkan &ldquo;Harga jual belum diisi&rdquo;.
        </span>
      </div>
    </div>
  );
};
