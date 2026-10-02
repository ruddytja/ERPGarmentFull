import React from 'react';
import { BundleItem } from '../types';
import { playCompleteChime, playTactileClick } from '../utils/audio';

interface BundleCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: BundleItem;
  onConfirmComplete: () => void;
}

export const BundleCompleteModal: React.FC<BundleCompleteModalProps> = ({
  isOpen,
  onClose,
  bundle,
  onConfirmComplete,
}) => {
  if (!isOpen) return null;

  const mins = Math.floor(bundle.elapsedSeconds / 60);
  const secs = bundle.elapsedSeconds % 60;
  const cycleTimeStr = `${mins}m ${secs}s`;
  const targetMinutes = Math.round(bundle.targetMinutesPerBundle);
  const isFaster = bundle.elapsedSeconds <= bundle.targetMinutesPerBundle * 60;

  const handleConfirm = () => {
    playCompleteChime();
    onConfirmComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="bg-[#1E293B] border-2 border-[#2563EB] w-full max-w-lg rounded p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-3 text-[#2563EB]">
            <div className="w-10 h-10 rounded-full bg-[#2563EB]/20 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-2xl fill-1 text-[#60A5FA]">
                check_circle
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-['Hanken_Grotesk']">
                Konfirmasi Selesai Bundle
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Kirim telemetry hasil pengerjaan ke Line 03 (QC &amp; Hemming)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Bundle Info Card */}
        <div className="bg-[#27354A] p-3 rounded border border-[#334155] flex justify-between items-center">
          <div>
            <span className="text-[11px] font-mono text-[#60A5FA] font-bold block">
              {bundle.id}
            </span>
            <span className="text-sm font-bold text-white">
              {bundle.operationStep}
            </span>
            <span className="text-xs text-[#94A3B8] block">
              {bundle.sku} - {bundle.productName}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#94A3B8] block">Total Pieces</span>
            <span className="text-2xl font-bold text-white font-mono">
              {bundle.quantity} <span className="text-xs text-[#94A3B8]">Pcs</span>
            </span>
          </div>
        </div>

        {/* QC Tallies Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#16A34A]/10 border border-[#16A34A]/40 p-2.5 rounded text-center">
            <span className="text-xs uppercase text-[#16A34A] font-bold block">
              PASS
            </span>
            <span className="text-xl font-bold font-mono text-[#16A34A]">
              {bundle.passCount}
            </span>
          </div>
          <div className="bg-[#D97706]/10 border border-[#D97706]/40 p-2.5 rounded text-center">
            <span className="text-xs uppercase text-[#D97706] font-bold block">
              REWORK
            </span>
            <span className="text-xl font-bold font-mono text-[#D97706]">
              {bundle.reworkCount}
            </span>
          </div>
          <div className="bg-[#DC2626]/10 border border-[#DC2626]/40 p-2.5 rounded text-center">
            <span className="text-xs uppercase text-[#DC2626] font-bold block">
              REJECT
            </span>
            <span className="text-xl font-bold font-mono text-[#DC2626]">
              {bundle.rejectCount}
            </span>
          </div>
        </div>

        {/* Cycle Time vs Target */}
        <div className="bg-[#191c1e] p-3 rounded border border-[#334155] flex items-center justify-between text-xs">
          <div>
            <span className="text-[#94A3B8] block">Waktu Siklus Aktual:</span>
            <span className="font-mono text-base font-bold text-white">
              {cycleTimeStr}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#94A3B8] block">Target Standar:</span>
            <span className="font-mono text-base font-bold text-[#adc6ff]">
              {targetMinutes}m 00s
            </span>
          </div>
          <span
            className={`px-2 py-1 rounded font-bold ${
              isFaster
                ? 'bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30'
                : 'bg-[#D97706]/20 text-[#D97706] border border-[#D97706]/30'
            }`}
          >
            {isFaster ? 'On-Pace (Optimal)' : 'Pace Variance'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="h-11 px-5 rounded bg-[#27354A] hover:bg-[#323537] text-[#F8FAFC] font-bold border border-[#334155] text-xs active:scale-95"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="h-11 px-6 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>Konfirmasi &amp; Selesaikan Bundle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
