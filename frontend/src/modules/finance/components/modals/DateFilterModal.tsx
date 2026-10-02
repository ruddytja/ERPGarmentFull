import React from 'react';

interface DateFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const DateFilterModal: React.FC<DateFilterModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  onSelectMonth,
}) => {
  if (!isOpen) return null;

  const periods = [
    { label: 'Okt 2026 (Bulan Berjalan)', val: 'Okt 2026' },
    { label: 'Sep 2026 (Tutup Buku)', val: 'Sep 2026' },
    { label: 'Agu 2026 (Historical)', val: 'Agu 2026' },
    { label: 'Q3 2026 (Kuartal 3)', val: 'Q3 2026' },
    { label: 'Q4 2026 (Forecast Q4)', val: 'Q4 2026' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[20px]">calendar_month</span>
            <h2 className="text-[18px] font-bold text-[#0F172A]">Filter Periode Akuntansi</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg text-[20px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {periods.map((p) => (
            <button
              key={p.val}
              onClick={() => {
                onSelectMonth(p.val);
                onClose();
              }}
              className={`w-full p-2.5 rounded-lg text-left text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                selectedMonth === p.val
                  ? 'bg-[#004ac6] text-white font-bold'
                  : 'bg-[#f2f4f6] text-[#0F172A] hover:bg-[#e6e8ea]'
              }`}
            >
              <span>{p.label}</span>
              {selectedMonth === p.val && (
                <span className="material-symbols-outlined text-[18px]">check</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
