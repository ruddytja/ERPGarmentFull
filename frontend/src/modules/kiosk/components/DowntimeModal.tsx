import React, { useState } from 'react';
import { downtimeReasons } from '../data/mockData';
import { playTactileClick, playWarningBuzzer } from '../utils/audio';

interface DowntimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDowntime: (reason: string, notes?: string) => void;
  activeDowntime: { reason: string; elapsedSeconds: number } | null;
  onResumeProduction: () => void;
}

export const DowntimeModal: React.FC<DowntimeModalProps> = ({
  isOpen,
  onClose,
  onConfirmDowntime,
  activeDowntime,
  onResumeProduction,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(downtimeReasons[0].title);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    playWarningBuzzer();
    onConfirmDowntime(selectedReason, notes);
    onClose();
  };

  // If downtime is currently ongoing, show the resolution screen
  if (activeDowntime) {
    const mins = Math.floor(activeDowntime.elapsedSeconds / 60);
    const secs = activeDowntime.elapsedSeconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
        <div className="bg-[#1E293B] border-2 border-[#DC2626] w-full max-w-2xl rounded p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <span className="material-symbols-outlined text-4xl font-bold animate-pulse">
                emergency_home
              </span>
              <div>
                <h3 className="text-2xl font-bold text-white font-['Hanken_Grotesk']">
                  DOWNTIME SEDANG AKTIF // STATION 04
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Pemberhentian produksi sedang dicatat ke telemetry lini
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playTactileClick();
                onClose();
              }}
              className="text-[#94A3B8] hover:text-white p-2"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>

          <div className="bg-[#27354A] p-4 rounded border border-[#DC2626]/50 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase text-[#94A3B8] font-bold block">
                Alasan Kerusakan
              </span>
              <span className="text-lg font-bold text-[#F8FAFC]">
                {activeDowntime.reason}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-ping"></span>
                  Lini Berhenti
                </span>
                <span className="text-xs text-[#94A3B8]">
                  Teknisi Sewing Dispatched (#MK-08)
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase text-[#94A3B8] font-bold block">
                Durasi Downtime
              </span>
              <span className="text-3xl font-mono font-bold text-[#DC2626] tracking-wider">
                {timeStr}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
            <button
              onClick={() => {
                playTactileClick();
                onClose();
              }}
              className="h-12 px-6 rounded bg-[#27354A] hover:bg-[#323537] text-[#F8FAFC] font-bold border border-[#334155] active:scale-95"
            >
              Tutup Panel (Biarkan Berhenti)
            </button>
            <button
              onClick={() => {
                playTactileClick();
                onResumeProduction();
                onClose();
              }}
              className="h-12 px-6 rounded bg-[#16A34A] hover:bg-[#15803D] text-white font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(22,163,74,0.4)] active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">play_circle</span>
              <span>Selesaikan Downtime &amp; Resume Line</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="bg-[#1E293B] border-2 border-[#DC2626] w-full max-w-2xl rounded p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-3 text-[#DC2626]">
            <span className="material-symbols-outlined text-3xl font-bold">
              report_problem
            </span>
            <div>
              <h3 className="text-2xl font-bold text-white font-['Hanken_Grotesk']">
                Lapor Downtime Mesin // Station 04
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Pilih alasan pemberhentian lini sewing untuk verifikasi supervisor
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white p-2"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Reason Selection Grid */}
        <div className="grid grid-cols-2 gap-3 my-2">
          {downtimeReasons.map((item) => {
            const isSelected = selectedReason === item.title;
            return (
              <button
                key={item.title}
                onClick={() => {
                  playTactileClick();
                  setSelectedReason(item.title);
                }}
                className={`h-16 px-4 rounded border flex items-center gap-3 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#DC2626]/20 border-[#DC2626] ring-1 ring-[#DC2626]'
                    : 'bg-[#27354A] hover:bg-[#DC2626]/20 border-[#334155] hover:border-[#DC2626]'
                }`}
              >
                <span className="material-symbols-outlined text-2xl text-[#D97706]">
                  {item.icon}
                </span>
                <div>
                  <span className="text-base font-bold text-white block leading-tight">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] line-clamp-1">
                    {item.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Optional Notes */}
        <div>
          <label className="text-xs text-[#94A3B8] uppercase font-semibold block mb-1">
            Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Jarum nomor 14 bengkok, butuh mekanik pengganti..."
            className="w-full bg-[#191c1e] border border-[#334155] rounded px-3 py-2 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#DC2626]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="h-12 px-6 rounded bg-[#27354A] text-[#F8FAFC] font-bold border border-[#334155] active:scale-95 transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="h-12 px-6 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold shadow-[0_0_12px_rgba(220,38,38,0.4)] active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">stop_circle</span>
            <span>Konfirmasi Stop Line</span>
          </button>
        </div>
      </div>
    </div>
  );
};
