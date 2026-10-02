import React, { useState } from 'react';
import { commonDefectOptions } from '../data/mockData';
import { playTactileClick } from '../utils/audio';

interface DefectModalProps {
  isOpen: boolean;
  onClose: () => void;
  defectType: 'rework' | 'reject';
  onConfirmDefectTag: (reason: string) => void;
}

export const DefectModal: React.FC<DefectModalProps> = ({
  isOpen,
  onClose,
  defectType,
  onConfirmDefectTag,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(commonDefectOptions[0]);

  if (!isOpen) return null;

  const isReject = defectType === 'reject';
  const colorClass = isReject ? 'text-[#DC2626]' : 'text-[#D97706]';
  const borderClass = isReject ? 'border-[#DC2626]' : 'border-[#D97706]';
  const btnBgClass = isReject ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#D97706] hover:bg-[#B45309]';

  const handleSelect = (reason: string) => {
    playTactileClick();
    setSelectedReason(reason);
  };

  const handleConfirm = () => {
    playTactileClick();
    onConfirmDefectTag(selectedReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className={`bg-[#1E293B] border-2 ${borderClass} w-full max-w-md rounded p-5 shadow-2xl flex flex-col gap-4`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-2xl ${colorClass}`}>
              {isReject ? 'cancel' : 'build'}
            </span>
            <h3 className="text-lg font-bold text-white font-['Hanken_Grotesk']">
              Klasifikasi Cacat {isReject ? 'REJECT' : 'REWORK'}
            </h3>
          </div>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <p className="text-xs text-[#94A3B8]">
          Pilih alasan cacat jahit untuk pelacakan kualitas (Quality Assurance Log):
        </p>

        {/* Options list */}
        <div className="grid grid-cols-1 gap-2">
          {commonDefectOptions.map((opt) => {
            const isSelected = selectedReason === opt;
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`p-3 rounded text-left text-xs font-bold transition-all border flex items-center justify-between ${
                  isSelected
                    ? `${borderClass} bg-[#27354A] text-white ring-1`
                    : 'border-[#334155] bg-[#27354A]/60 text-[#94A3B8] hover:text-white hover:bg-[#27354A]'
                }`}
              >
                <span>{opt}</span>
                {isSelected && (
                  <span className={`material-symbols-outlined text-base ${colorClass}`}>
                    check_circle
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="h-10 px-4 rounded bg-[#27354A] hover:bg-[#323537] text-[#F8FAFC] font-bold border border-[#334155] text-xs active:scale-95"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className={`h-10 px-5 rounded ${btnBgClass} text-white font-bold text-xs active:scale-95`}
          >
            Simpan Defect Tag
          </button>
        </div>
      </div>
    </div>
  );
};
