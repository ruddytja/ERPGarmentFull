import React, { useState } from 'react';
import { CurrencyType } from '../../types/costing';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyType;
  selectedMonth: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currency,
  selectedMonth,
}) => {
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [includeAuditLog, setIncludeAuditLog] = useState(true);
  const [includePieceRate, setIncludePieceRate] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setSuccessMessage(`File HPP_Costing_Report_${selectedMonth.replace(' ', '_')}.${format} berhasil dibuat!`);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1800);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[22px]">file_download</span>
            <h2 className="text-[20px] font-bold text-[#0F172A]">Export Laporan Finansial &amp; HPP</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg text-[20px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1.5">
              Pilih Format Dokumen
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  format === 'pdf'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/30 text-[#004ac6] font-bold'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6] text-[#545f73]'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
                <span className="text-[12px]">PDF Report</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  format === 'excel'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/30 text-[#004ac6] font-bold'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6] text-[#545f73]'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">table_view</span>
                <span className="text-[12px]">Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  format === 'csv'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/30 text-[#004ac6] font-bold'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6] text-[#545f73]'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">csv</span>
                <span className="text-[12px]">Raw CSV</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-[#f2f4f6] rounded-lg space-y-2 text-[13px]">
            <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wide block">
              Parameter Rekonsiliasi
            </span>
            <div className="flex justify-between text-[#64748B]">
              <span>Periode Akuntansi:</span>
              <strong className="text-[#0F172A]">{selectedMonth}</strong>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Mata Uang Output:</span>
              <strong className="text-[#0F172A]">{currency}</strong>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Penandatangan:</span>
              <strong className="text-[#0F172A]">Hendrik Pratama (FM)</strong>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[13px] text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={includeAuditLog}
                onChange={(e) => setIncludeAuditLog(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#004ac6] focus:ring-[#004ac6]"
              />
              <span>Sertakan Audit Log Deviasi Biaya &gt; 5%</span>
            </label>

            <label className="flex items-center gap-2 text-[13px] text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={includePieceRate}
                onChange={(e) => setIncludePieceRate(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#004ac6] focus:ring-[#004ac6]"
              />
              <span>Lampirkan Rekapitulasi Payroll Borongan Operator (142 NIK)</span>
            </label>
          </div>

          {successMessage && (
            <div className="p-2.5 bg-[#16A34A]/15 border border-[#16A34A]/30 text-[#16A34A] rounded-lg text-[13px] font-semibold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6] text-[13px] font-medium cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#0053db] text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isExporting ? 'hourglass_empty' : 'download'}
              </span>
              <span>{isExporting ? 'Memproses File...' : 'Unduh Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
