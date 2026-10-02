import React, { useState } from 'react';
import { OperatorPayrollItem, CurrencyType } from '../../types/costing';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface PayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  operators: OperatorPayrollItem[];
  currency: CurrencyType;
  onVerifyAll: () => void;
}

export const PayrollModal: React.FC<PayrollModalProps> = ({
  isOpen,
  onClose,
  operators,
  currency,
  onVerifyAll,
}) => {
  const [filterRole, setFilterRole] = useState<'All' | 'Sewing' | 'Cutting' | 'Bonding'>('All');
  const [search, setSearch] = useState('');
  const [verifiedToast, setVerifiedToast] = useState(false);

  if (!isOpen) return null;

  const filtered = operators.filter((op) => {
    if (filterRole !== 'All' && op.role !== filterRole) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return op.name.toLowerCase().includes(q) || op.nik.toLowerCase().includes(q);
    }
    return true;
  });

  const totalCompensation = operators.reduce((acc, curr) => acc + curr.totalCompensation, 0);
  const totalBundles = operators.reduce((acc, curr) => acc + curr.bundlesCompleted, 0);

  const handleVerify = () => {
    onVerifyAll();
    setVerifiedToast(true);
    setTimeout(() => setVerifiedToast(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#16A34A] text-[24px]">groups</span>
            <div>
              <h2 className="text-[20px] font-bold text-[#0F172A]">
                Draft Payroll Borongan Operator (Piece-Rate)
              </h2>
              <span className="text-[12px] text-[#64748B]">
                Integrasi MES Barcode Tiket Bundles QC Lulus • Plant Sukabumi #01
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg text-[20px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Quick summary stats */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#f2f4f6] rounded-xl border border-[#E2E8F0]">
          <div>
            <span className="text-[11px] text-[#64748B] uppercase block">Total Tenaga Kerja</span>
            <strong className="text-[18px] text-[#0F172A] font-code-metric">142 Operator Terdata</strong>
          </div>
          <div>
            <span className="text-[11px] text-[#64748B] uppercase block">Total Tiket Bundle QC</span>
            <strong className="text-[18px] text-[#0F172A] font-code-metric">
              {formatNumber(totalBundles * 3)} Barcode Scan
            </strong>
          </div>
          <div>
            <span className="text-[11px] text-[#64748B] uppercase block">Total Kompensasi Terakumulasi</span>
            <strong className="text-[18px] text-[#16A34A] font-code-metric">
              {formatCurrency(totalCompensation, currency)}
            </strong>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(['All', 'Sewing', 'Cutting', 'Bonding'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-3 py-1 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                  filterRole === role
                    ? 'bg-[#004ac6] text-white font-semibold'
                    : 'bg-[#f2f4f6] text-[#545f73] hover:text-[#0F172A]'
                }`}
              >
                {role === 'All' ? 'Semua Divisi' : role}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737686] text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari nama atau NIK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-[12px] bg-[#f2f4f6] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#004ac6]"
            />
          </div>
        </div>

        {/* Operators dense table */}
        <div className="mt-3 overflow-x-auto border border-[#E2E8F0] rounded-xl max-h-[360px]">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#1E293B] text-[#F8FAFC] font-code-metric uppercase sticky top-0">
              <tr>
                <th className="py-2.5 px-3">NIK &amp; Nama Operator</th>
                <th className="py-2.5 px-3">Jalur Produksi</th>
                <th className="py-2.5 px-3 text-right">Bundles Selesai</th>
                <th className="py-2.5 px-3 text-right">Tarif Borongan/pc</th>
                <th className="py-2.5 px-3 text-right">Total Upah</th>
                <th className="py-2.5 px-3 text-center">QC Pass Rate</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-code-metric">
              {filtered.map((op) => (
                <tr key={op.id} className="hover:bg-[#f2f4f6]">
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-[#0F172A] block">{op.name}</span>
                    <span className="text-[11px] text-[#64748B]">{op.nik}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[#545f73]">{op.line}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-[#0F172A]">
                    {op.bundlesCompleted} ({formatNumber(op.piecesCompleted)} pcs)
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#64748B]">
                    {formatCurrency(op.pieceRatePerPcs, currency)} /pc
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#16A34A]">
                    {formatCurrency(op.totalCompensation, currency)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#16A34A]/15 text-[#16A34A]">
                      {op.qcPassRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        op.status === 'Diverifikasi'
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-[#dbe1ff] text-[#004ac6]'
                      }`}
                    >
                      {op.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {verifiedToast && (
          <div className="mt-3 p-2 bg-[#16A34A]/15 text-[#16A34A] rounded-lg text-[13px] font-semibold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Seluruh 142 Operator berhasil diverifikasi untuk payroll transfer perbankan.</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
          <span className="text-[12px] text-[#64748B]">
            Otorisasi: Hendrik Pratama, Finance Manager Sukabumi #01
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6] text-[13px] font-medium cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleVerify}
              className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Verifikasi Batch Payroll</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
