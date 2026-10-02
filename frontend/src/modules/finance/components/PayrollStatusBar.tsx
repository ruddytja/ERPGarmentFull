import React from 'react';
import { CurrencyType } from '../types/costing';
import { formatCurrency } from '../utils/formatters';

interface PayrollStatusBarProps {
  currency: CurrencyType;
  totalOperators: number;
  totalCompensation: number;
  onOpenPayroll: () => void;
}

export const PayrollStatusBar: React.FC<PayrollStatusBarProps> = ({
  currency,
  totalOperators,
  totalCompensation,
  onOpenPayroll,
}) => {
  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-4 flex flex-wrap items-center justify-between gap-4">
      {/* Left: Piece-Rate Payroll Verification */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[26px]">groups</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-[#0F172A]">
              Draft Payroll Borongan Operator (Piece-Rate)
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#dbe1ff] text-[#004ac6]">
              Siap Diverifikasi
            </span>
          </div>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Sebanyak <strong>{totalOperators} Operator</strong> Sewing/Cutting terdata dengan total kompensasi{' '}
            <strong className="text-[#0F172A] font-code-metric">
              {formatCurrency(totalCompensation, currency)}
            </strong>{' '}
            berdasarkan barcode bundle tiket QC lulus.
          </p>
        </div>
      </div>

      {/* Right: Actions & Integration Pulse */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-ping"></span>
            <span className="text-[12px] font-semibold text-[#0F172A]">MES Factory Sukabumi</span>
          </div>
          <span className="text-[11px] text-[#64748B]">Real-Time ERP Finance Engine Connected</span>
        </div>

        <button
          onClick={onOpenPayroll}
          className="px-4 py-2 bg-[#004ac6] hover:bg-[#0053db] active:scale-[0.98] text-white rounded-lg text-[13px] font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span>Lihat Rincian Payroll Borongan</span>
        </button>
      </div>
    </section>
  );
};
