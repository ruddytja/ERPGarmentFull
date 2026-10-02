import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  FileDown, 
  Tag, 
  Eye, 
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { SPKBatch } from '../types';

interface SpkTableProps {
  batches: SPKBatch[];
  currency: 'IDR' | 'USD';
  onViewBatch: (batch: SPKBatch) => void;
  onAlertClick: (batch: SPKBatch) => void;
}

export const SpkTable: React.FC<SpkTableProps> = ({
  batches,
  currency,
  onViewBatch,
  onAlertClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'efisiensi_tinggi' | 'sesuai_budget' | 'variansi_alert'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toFixed(2)}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch = 
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.lineDetail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || b.statusEfisiensi === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalQty = filteredBatches.reduce((acc, curr) => acc + curr.targetQty, 0);
  const totalRealizedHpp = filteredBatches.reduce((acc, curr) => acc + (curr.realisasiHpp * curr.targetQty), 0);
  const totalBudgetedHpp = filteredBatches.reduce((acc, curr) => acc + (curr.estimasiHpp * curr.targetQty), 0);
  const netDeltaPct = totalBudgetedHpp > 0 ? (((totalRealizedHpp - totalBudgetedHpp) / totalBudgetedHpp) * 100).toFixed(1) : '-1.8';

  const handleExportCsv = () => {
    const headers = 'NO SPK,Brand,SKU,Target Qty,Estimasi HPP,Realisasi HPP,Delta HPP,Margin Kontribusi,Status\n';
    const rows = filteredBatches.map(b => 
      `"${b.id}","${b.brand}","${b.skuName}",${b.targetQty},${b.estimasiHpp},${b.realisasiHpp},${b.deltaHpp},"${b.marginKontribusi}%","${b.statusLabel}"`
    );
    const blob = new Blob([headers + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SPK_Batch_Performance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
      {/* Table Header Toolbar */}
      <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-[#0F172A] font-bold text-lg tracking-tight">
              SPK Batch Profitability &amp; HPP Performance
            </h2>
            <span className="bg-[#f2f4f6] text-[#545f73] text-xs px-2 py-0.5 rounded border border-[#E2E8F0] font-semibold">
              Active Batches ({filteredBatches.length})
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Pemantauan real-time realisasi biaya per lembar, deviasi HPP, dan marjin kotor batch produksi aktif
          </p>
        </div>

        {/* Quick Table Utilities */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari No. SPK / SKU..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#f7f9fb] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004ac6] text-[#0F172A] w-48 font-body"
            />
          </div>

          {/* Filter Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 bg-[#f2f4f6] hover:bg-[#e6e8ea] border border-[#CBD5E1] text-[#0F172A] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{statusFilter === 'all' ? 'Filter Status' : statusFilter === 'variansi_alert' ? 'Variansi Alert' : statusFilter === 'efisiensi_tinggi' ? 'Efisiensi Tinggi' : 'Sesuai Budget'}</span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#CBD5E1] rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { setStatusFilter('all'); setShowFilterDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6]"
                >
                  Semua Status
                </button>
                <button
                  onClick={() => { setStatusFilter('efisiensi_tinggi'); setShowFilterDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6] text-[#16a34a] font-medium"
                >
                  Efisiensi Tinggi
                </button>
                <button
                  onClick={() => { setStatusFilter('sesuai_budget'); setShowFilterDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6] text-[#2563eb] font-medium"
                >
                  Sesuai Budget
                </button>
                <button
                  onClick={() => { setStatusFilter('variansi_alert'); setShowFilterDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6] text-[#dc2626] font-medium"
                >
                  Variansi Overrun
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 bg-[#f2f4f6] hover:bg-[#e6e8ea] border border-[#CBD5E1] text-[#004ac6] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Download CSV report"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* High-Density Executive Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0F172A] text-[#F8FAFC] border-b border-[#E2E8F0] text-[12px] uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">No SPK</th>
              <th className="py-3 px-4 font-semibold">Brand &amp; SKU Name</th>
              <th className="py-3 px-4 font-semibold text-right">Target Qty</th>
              <th className="py-3 px-4 font-semibold text-right">Estimasi HPP/Pcs</th>
              <th className="py-3 px-4 font-semibold text-right">Realisasi HPP/Pcs</th>
              <th className="py-3 px-4 font-semibold text-right">Margin Kontribusi</th>
              <th className="py-3 px-4 font-semibold text-center">Status Efisiensi</th>
              <th className="py-3 px-4 font-semibold text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-xs text-[#0F172A]">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#64748B]">
                  Tidak ada batch SPK yang sesuai dengan pencarian atau filter.
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => {
                const isAlertRow = batch.flagged || batch.statusEfisiensi === 'variansi_alert';

                return (
                  <tr
                    key={batch.id}
                    className={`transition-colors ${
                      isAlertRow 
                        ? 'hover:bg-red-50/60 bg-red-50/20' 
                        : 'hover:bg-blue-50/50 bg-white'
                    }`}
                  >
                    {/* No SPK */}
                    <td className={`py-3.5 px-4 font-code-metric font-semibold ${isAlertRow ? 'text-[#DC2626]' : 'text-[#004ac6]'}`}>
                      <div className="flex items-center gap-1.5">
                        {isAlertRow ? (
                          <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                        ) : (
                          <Tag className="w-4 h-4 text-[#64748B] shrink-0" />
                        )}
                        <span>{batch.id}</span>
                      </div>
                    </td>

                    {/* Brand & SKU Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <span>{batch.skuName}</span>
                        {batch.flagged && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-[#DC2626] font-semibold">
                            Flagged
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] ${isAlertRow ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                        {batch.lineDetail}
                      </div>
                    </td>

                    {/* Target Qty */}
                    <td className="py-3.5 px-4 text-right font-code-metric font-semibold">
                      {batch.targetQty.toLocaleString('id-ID')} Pcs
                    </td>

                    {/* Estimasi HPP */}
                    <td className="py-3.5 px-4 text-right font-code-metric text-[#64748B]">
                      {formatMoney(batch.estimasiHpp)}
                    </td>

                    {/* Realisasi HPP */}
                    <td className="py-3.5 px-4 text-right font-code-metric font-semibold">
                      {isAlertRow ? (
                        <span className="font-bold text-[#DC2626] bg-red-100/60 rounded px-1.5 py-0.5">
                          {formatMoney(batch.realisasiHpp)}{' '}
                          <span className="text-[10px] font-normal text-[#DC2626]">
                            (+{formatMoney(batch.deltaHpp)})
                          </span>
                        </span>
                      ) : batch.deltaHpp < 0 ? (
                        <span className="text-[#16A34A]">
                          {formatMoney(batch.realisasiHpp)}{' '}
                          <span className="text-[10px] font-normal text-[#16A34A]">
                            ({formatMoney(batch.deltaHpp)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#0F172A]">
                          {formatMoney(batch.realisasiHpp)}{' '}
                          <span className="text-[10px] text-[#64748B] font-normal">
                            ({formatMoney(batch.deltaHpp)})
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Margin Kontribusi */}
                    <td className="py-3.5 px-4 text-right font-code-metric font-bold text-[#0F172A]">
                      +{batch.marginKontribusi}%
                    </td>

                    {/* Status Efisiensi */}
                    <td className="py-3.5 px-4 text-center">
                      {batch.statusEfisiensi === 'efisiensi_tinggi' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-green-50 text-[#16A34A] border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                          Efisiensi Tinggi
                        </span>
                      )}
                      {batch.statusEfisiensi === 'sesuai_budget' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                          Sesuai Budget
                        </span>
                      )}
                      {batch.statusEfisiensi === 'variansi_alert' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-red-50 text-[#DC2626] border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                          Variansi (+5.7%)
                        </span>
                      )}
                    </td>

                    {/* Tindakan */}
                    <td className="py-3.5 px-4 text-center">
                      {isAlertRow ? (
                        <button
                          onClick={() => onAlertClick(batch)}
                          className="p-1 text-[#DC2626] hover:bg-red-100 rounded transition-colors cursor-pointer"
                          title="Lihat Deviasi Breakdown"
                        >
                          <AlertTriangle className="w-[18px] h-[18px]" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onViewBatch(batch)}
                          className="p-1 text-[#545f73] hover:text-[#004ac6] hover:bg-[#eceef0] rounded transition-colors cursor-pointer"
                          title="Audit Detail"
                        >
                          <Eye className="w-[18px] h-[18px]" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination & Batch Totals Footer */}
      <div className="px-5 py-3 bg-[#f2f4f6] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            Menampilkan <strong>{filteredBatches.length} dari {batches.length}</strong> SPK Batch Terpilih
          </span>
          <span>
            Total Qty Produksi Terjadwal:{' '}
            <strong className="text-[#0F172A] font-code-metric">
              {totalQty.toLocaleString('id-ID')} Pcs
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">Akumulasi Realisasi HPP Batch:</span>
          <span className="font-code-metric font-bold text-[#0F172A] text-sm">
            {currency === 'USD' ? `$${(totalRealizedHpp / 15100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `Rp ${totalRealizedHpp.toLocaleString('id-ID')}`}
          </span>
          <span className="text-[#16A34A] font-semibold text-[11px] bg-green-100 px-1.5 py-0.5 rounded">
            Net Delta: {netDeltaPct}%
          </span>
        </div>
      </div>
    </section>
  );
};
