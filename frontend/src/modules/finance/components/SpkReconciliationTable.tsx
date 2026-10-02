import React, { useState } from 'react';
import { SpkBatch, CurrencyType } from '../types/costing';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface SpkReconciliationTableProps {
  batches: SpkBatch[];
  currency: CurrencyType;
  onOpenJurnal: (batch: SpkBatch) => void;
  onToggleLock: (id: string) => void;
  onPrintBatch: (batch: SpkBatch) => void;
  onReviewCritical: (batch: SpkBatch) => void;
  onExportCsv: () => void;
}

type FilterTab = 'all' | 'critical' | 'on_budget' | 'high_efficiency';

export const SpkReconciliationTable: React.FC<SpkReconciliationTableProps> = ({
  batches,
  currency,
  onOpenJurnal,
  onToggleLock,
  onPrintBatch,
  onReviewCritical,
  onExportCsv,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Counts
  const totalCount = batches.length;
  const criticalCount = batches.filter((b) => b.variancePct > 5).length;
  const onBudgetCount = batches.filter(
    (b) => b.variancePct >= -1 && b.variancePct <= 1
  ).length;
  const highEfficiencyCount = batches.filter((b) => b.variancePct < -1).length;

  // Filtering
  const filteredBatches = batches.filter((item) => {
    // Tab filter
    if (activeTab === 'critical' && item.variancePct <= 5) return false;
    if (activeTab === 'on_budget' && (item.variancePct < -1 || item.variancePct > 1))
      return false;
    if (activeTab === 'high_efficiency' && item.variancePct >= -1) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = item.id.toLowerCase().includes(q);
      const matchBrand = item.brand.toLowerCase().includes(q);
      const matchProd = item.productName.toLowerCase().includes(q);
      const matchFabric = item.fabricType.toLowerCase().includes(q);
      if (!matchId && !matchBrand && !matchProd && !matchFabric) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const currentBatches = filteredBatches.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col overflow-hidden">
      {/* Table Top Control Bar */}
      <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 bg-white">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#004ac6] text-[22px]">table_chart</span>
          <div className="flex flex-col">
            <h2 className="text-[18px] md:text-[20px] font-bold text-[#0F172A] tracking-tight">
              Master Rekonsiliasi HPP &amp; Variance SPK Batches
            </h2>
            <span className="text-[12px] text-[#64748B]">
              Total {totalCount} Batch Aktif · Audit Real-Time MES vs Akuntansi Pabrik
            </span>
          </div>
        </div>

        {/* Table Controls: Search, Tabs Filter, Export */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Bar in table */}
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737686] text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter SPK atau Brand..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[#f2f4f6] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:border-[#004ac6] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737686] text-[12px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Segmented Filter Badges */}
          <div className="flex items-center bg-[#f2f4f6] p-1 rounded-lg border border-[#E2E8F0] text-[12px]">
            <button
              onClick={() => {
                setActiveTab('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white shadow-xs font-semibold text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] font-medium'
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              onClick={() => {
                setActiveTab('critical');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'critical'
                  ? 'bg-white shadow-xs font-bold text-[#ba1a1a]'
                  : 'text-[#ba1a1a] hover:text-[#ba1a1a]/80 font-medium'
              }`}
            >
              Deviasi &gt; +5% ({criticalCount})
            </button>
            <button
              onClick={() => {
                setActiveTab('on_budget');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'on_budget'
                  ? 'bg-white shadow-xs font-semibold text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] font-medium'
              }`}
            >
              Sesuai Anggaran ({onBudgetCount})
            </button>
            <button
              onClick={() => {
                setActiveTab('high_efficiency');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'high_efficiency'
                  ? 'bg-white shadow-xs font-bold text-[#16A34A]'
                  : 'text-[#16A34A] hover:text-[#16A34A]/80 font-medium'
              }`}
            >
              Efisiensi Tinggi ({highEfficiencyCount})
            </button>
          </div>

          {/* Export Table Actions */}
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] text-[#0F172A] hover:bg-[#f2f4f6] text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>CSV/Excel</span>
          </button>
        </div>
      </div>

      {/* Dense Data Grid */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#1E293B] text-[#F8FAFC] font-code-metric text-[12px] uppercase tracking-wider border-b border-[#E2E8F0]">
              <th className="py-3 px-4 font-semibold">No. SPK &amp; Brand</th>
              <th className="py-3 px-4 font-semibold text-right">Target Qty (Pcs/Bundles)</th>
              <th className="py-3 px-4 font-semibold text-right">BOM HPP/pc</th>
              <th className="py-3 px-4 font-semibold text-right">Real. Material/pc</th>
              <th className="py-3 px-4 font-semibold text-right">Real. Labor/pc</th>
              <th className="py-3 px-4 font-semibold text-right">Real. Overhead/pc</th>
              <th className="py-3 px-4 font-semibold text-right">Total Real. HPP/pc</th>
              <th className="py-3 px-4 font-semibold text-center">Variance Status</th>
              <th className="py-3 px-4 font-semibold text-center">Aksi Finansial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
            {currentBatches.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#64748B]">
                  Tidak ada batch SPK yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              currentBatches.map((item) => {
                const isCriticalUnfavorable = item.variancePct > 5;
                const isFavorable = item.variancePct <= -1;
                const isOnBudget = !isCriticalUnfavorable && !isFavorable;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isCriticalUnfavorable
                        ? 'bg-[#ffdad6]/20 hover:bg-[#ffdad6]/30'
                        : 'hover:bg-[#dbe1ff]/20'
                    }`}
                  >
                    {/* No. SPK & Brand */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-code-metric font-bold ${
                              isCriticalUnfavorable ? 'text-[#ba1a1a]' : 'text-[#0F172A]'
                            }`}
                          >
                            {item.id}
                          </span>
                          {isCriticalUnfavorable && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#ba1a1a]"
                              title="Deviasi Tinggi"
                            ></span>
                          )}
                          {item.isLocked && (
                            <span
                              className="material-symbols-outlined text-[14px] text-[#545f73]"
                              title="Biaya Terkunci (Locked Ledger)"
                            >
                              lock
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[12px] ${
                            isCriticalUnfavorable
                              ? 'text-[#0F172A] font-medium'
                              : 'text-[#64748B]'
                          }`}
                        >
                          {item.brand} {item.productName}
                        </span>
                      </div>
                    </td>

                    {/* Target Qty */}
                    <td className="py-3 px-4 text-right font-code-metric">
                      <div className="font-semibold text-[#0F172A]">
                        {formatNumber(item.targetQty)} pcs
                      </div>
                      <span className="text-[11px] text-[#64748B]">
                        {formatNumber(item.bundles)} Bundles
                      </span>
                    </td>

                    {/* BOM HPP/pc */}
                    <td className="py-3 px-4 text-right font-code-metric text-[#64748B]">
                      {formatCurrency(item.bomHppPerPc, currency)}
                    </td>

                    {/* Real. Material/pc */}
                    <td
                      className={`py-3 px-4 text-right font-code-metric ${
                        isCriticalUnfavorable
                          ? 'text-[#ba1a1a] font-bold'
                          : isFavorable
                          ? 'text-[#16A34A] font-medium'
                          : 'text-[#0F172A]'
                      }`}
                    >
                      {formatCurrency(item.realMaterialPerPc, currency)}
                    </td>

                    {/* Real. Labor/pc */}
                    <td
                      className={`py-3 px-4 text-right font-code-metric ${
                        isFavorable ? 'text-[#16A34A]' : 'text-[#0F172A]'
                      }`}
                    >
                      {formatCurrency(item.realLaborPerPc, currency)}
                    </td>

                    {/* Real. Overhead/pc */}
                    <td className="py-3 px-4 text-right font-code-metric text-[#0F172A]">
                      {formatCurrency(item.realOverheadPerPc, currency)}
                    </td>

                    {/* Total Real. HPP/pc */}
                    <td
                      className={`py-3 px-4 text-right font-code-metric font-bold ${
                        isCriticalUnfavorable
                          ? 'text-[#ba1a1a]'
                          : isFavorable
                          ? 'text-[#16A34A]'
                          : 'text-[#0F172A]'
                      }`}
                    >
                      {formatCurrency(item.totalRealHppPerPc, currency)}
                    </td>

                    {/* Variance Status */}
                    <td className="py-3 px-4 text-center">
                      {isCriticalUnfavorable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold font-code-metric bg-[#ba1a1a] text-white">
                          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                          +{item.variancePct}% Unfavorable
                        </span>
                      ) : isFavorable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold font-code-metric bg-[#16A34A]/15 text-[#16A34A]">
                          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                          {item.variancePct}% Favorable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold font-code-metric bg-[#d5e0f8] text-[#586377]">
                          {item.variancePct >= 0 ? `+${item.variancePct}%` : `${item.variancePct}%`} On Budget
                        </span>
                      )}
                    </td>

                    {/* Aksi Finansial */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenJurnal(item)}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isCriticalUnfavorable
                              ? 'text-[#ba1a1a] hover:bg-[#ffdad6]'
                              : 'text-[#545f73] hover:text-[#004ac6] hover:bg-[#f2f4f6]'
                          }`}
                          title="Lihat Jurnal HPP &amp; Detail Ledger"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        </button>

                        {isCriticalUnfavorable ? (
                          <button
                            onClick={() => onReviewCritical(item)}
                            className="p-1 rounded text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
                            title="Peringatan Terbuka / Review BOM"
                          >
                            <span className="material-symbols-outlined text-[18px]">report_problem</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleLock(item.id)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              item.isLocked
                                ? 'text-[#004ac6] bg-[#dbe1ff]'
                                : 'text-[#545f73] hover:text-[#16A34A] hover:bg-[#f2f4f6]'
                            }`}
                            title={item.isLocked ? 'Buka Kunci SPK' : 'Kunci Biaya / Lock SPK'}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {item.isLocked ? 'lock' : 'lock_open'}
                            </span>
                          </button>
                        )}

                        <button
                          onClick={() => onPrintBatch(item)}
                          className="p-1 rounded text-[#545f73] hover:text-[#0F172A] hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                          title="Cetak Lembar Biaya"
                        >
                          <span className="material-symbols-outlined text-[18px]">print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination & Ledger Lock Status */}
      <div className="p-3.5 bg-white border-t border-[#E2E8F0] flex flex-wrap items-center justify-between text-[12px]">
        <div className="flex items-center gap-3">
          <span className="text-[#64748B]">
            Menampilkan <span className="font-bold text-[#0F172A]">{currentBatches.length}</span>{' '}
            dari <span className="font-bold text-[#0F172A]">{filteredBatches.length}</span> SPK
            Aktif
          </span>
          <span className="h-4 w-px bg-[#E2E8F0]"></span>
          <span className="text-[12px] text-[#64748B] flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-[#16A34A]">verified</span>
            Otomatis sinkron dengan MES Pabrik Sukabumi (12 detik lalu)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validPage === 1}
            className="px-2.5 py-1 rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#f2f4f6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>

          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isSelected = pageNum === validPage;
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-1 rounded font-code-metric cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#004ac6] text-white font-semibold'
                    : 'border border-[#E2E8F0] hover:bg-[#f2f4f6] text-[#0F172A]'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validPage === totalPages}
            className="px-2.5 py-1 rounded border border-[#E2E8F0] text-[#0F172A] hover:bg-[#f2f4f6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};
