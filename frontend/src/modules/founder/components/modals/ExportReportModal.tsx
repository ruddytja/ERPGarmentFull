import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { SPKBatch, KPIStats } from '../../types';

interface ExportReportModalProps {
  batches: SPKBatch[];
  stats: KPIStats;
  currency: 'IDR' | 'USD';
  onClose: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  batches,
  stats,
  currency,
  onClose,
}) => {
  const [reportType, setReportType] = useState<'financial' | 'spk_ledger' | 'qc_audit'>('financial');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const handleDownload = () => {
    if (format === 'csv') {
      let content = '';
      if (reportType === 'financial') {
        content = [
          'THEUNDERWEARSUPPLY ERP - EXECUTIVE FINANCIAL STATEMENT (OKTOBER 2026)',
          `Gross Revenue,${stats.monthlyGrossRevenue}`,
          `Budget Target,${stats.revenueTarget}`,
          `Total HPP (COGS Actual),${stats.totalHppActual}`,
          `HPP Budgeted,${stats.hppBudgeted}`,
          `Net Profit Margin,${stats.netProfitMargin}%`,
          `EBITDA,${stats.ebitda}`,
          `Factory Efficiency,${stats.factoryEfficiencyRate}%`,
          `Plant OEE,${stats.overallOee}%`,
        ].join('\n');
      } else {
        content = [
          'SPK ID,Brand,SKU Name,Target Qty,Estimasi HPP,Realisasi HPP,Delta,Status',
          ...batches.map(b => `${b.id},"${b.brand}","${b.skuName}",${b.targetQty},${b.estimasiHpp},${b.realisasiHpp},${b.deltaHpp},"${b.statusLabel}"`)
        ].join('\n');
      }

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `THEUNDERWEARSUPPLY_Laporan_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } else {
      window.print();
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#CBD5E1] max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center">
              <Download className="w-5 h-5 text-[#004ac6]" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                Ekspor Laporan Keuangan &amp; Manufaktur
              </h3>
              <p className="text-xs text-[#64748B]">
                Download laporan audit executive founder (Bulan Ini: Okt 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-[#0F172A] font-semibold mb-1.5">
              Pilih Jenis Dokumen Laporan
            </label>
            <div className="space-y-2">
              {[
                { id: 'financial', title: 'Ringkasan Eksekutif P&L & Variansi HPP', desc: 'Pendapatan bruto, HPP aktual, EBITDA, dan surplus efisiensi pabrik.' },
                { id: 'spk_ledger', title: 'Buku Besar SPK & Unit Costing BOM', desc: 'Daftar semua batch SPK aktif, deviasi per lembar, dan scrap pemotongan.' },
                { id: 'qc_audit', title: 'Laporan Mutu QC & Utilisasi OEE Sukabumi', desc: 'Distribusi pareto defect, 6 meja inspeksi, dan availability mesin.' },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reportType === item.id
                      ? 'bg-blue-50/70 border-[#004ac6] text-[#0F172A]'
                      : 'border-[#E2E8F0] hover:bg-[#f8fafc]'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    checked={reportType === item.id}
                    onChange={() => setReportType(item.id as any)}
                    className="mt-0.5 text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <div>
                    <div className="font-semibold text-xs text-[#0F172A]">{item.title}</div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#0F172A] font-semibold mb-1.5">
              Format Berkas
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  format === 'csv'
                    ? 'bg-blue-50/70 border-[#004ac6] text-[#004ac6]'
                    : 'border-[#E2E8F0] text-[#545f73] hover:bg-[#f8fafc]'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold text-xs text-[#0F172A]">Excel / CSV Spreadsheet</div>
                  <div className="text-[10px] text-[#64748B]">Untuk analisis rumus &amp; pivot</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  format === 'pdf'
                    ? 'bg-blue-50/70 border-[#004ac6] text-[#004ac6]'
                    : 'border-[#E2E8F0] text-[#545f73] hover:bg-[#f8fafc]'
                }`}
              >
                <FileText className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold text-xs text-[#0F172A]">PDF / Print Summary</div>
                  <div className="text-[10px] text-[#64748B]">Untuk rapat direksi &amp; investor</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Preview Box */}
          <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg space-y-1">
            <div className="text-[11px] font-semibold text-[#0F172A]">Data Terangkum:</div>
            <div className="flex justify-between text-[11px] text-[#64748B]">
              <span>Gross Revenue:</span>
              <strong className="text-[#0F172A] font-code-metric">{formatMoney(stats.monthlyGrossRevenue)}</strong>
            </div>
            <div className="flex justify-between text-[11px] text-[#64748B]">
              <span>Actual COGS (HPP):</span>
              <strong className="text-[#0F172A] font-code-metric">{formatMoney(stats.totalHppActual)}</strong>
            </div>
            <div className="flex justify-between text-[11px] text-[#64748B]">
              <span>Batch Aktif:</span>
              <strong className="text-[#0F172A] font-code-metric">{batches.length} Batch ({batches.reduce((a, b) => a + b.targetQty, 0).toLocaleString()} Pcs)</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#f8fafc] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#545f73] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleDownload}
            disabled={downloadSuccess}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] hover:bg-[#2563eb] rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Mengunduh...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
