import React, { useState } from 'react';
import { soundManager } from '../../utils/audio';

interface HaltLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHalted: boolean;
  onToggleHalt: (reason: string) => void;
}

export const HaltLineModal: React.FC<HaltLineModalProps> = ({
  isOpen,
  onClose,
  isHalted,
  onToggleHalt,
}) => {
  const [reason, setReason] = useState<string>('KEJADIAN JARUM PATAH MASAL / POTENSI BAHAYA');
  const [authCode, setAuthCode] = useState<string>('7092');

  if (!isOpen) return null;

  const handleAction = () => {
    if (isHalted) {
      soundManager.playSuccess();
      onToggleHalt('Line Resumed by Supervisor');
    } else {
      soundManager.playHazardAlarm();
      onToggleHalt(reason);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-lg bg-[#111827] border-2 border-[#DC2626] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-12 bg-[#300C0C] border-b border-[#DC2626] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#DC2626] text-xl" data-icon="emergency">
              emergency
            </span>
            <span className="font-condensed text-lg uppercase text-[#F8FAFC] font-bold tracking-wider">
              {isHalted ? 'RESUME PROTOCOL // BUKA KEMBALI LINE' : 'EMERGENCY HALT LINE PROTOCOL'}
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#ffb4ab] hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="p-3 bg-[#1e1315] border border-[#DC2626] text-xs font-mono text-[#ffb4ab]">
            {isHalted ? (
              <p>
                Line saat ini dalam status <strong>HALTED</strong>. Pastikan semua kendala mekanik,
                keamanan kerja, dan verifikasi bundle QC telah diselesaikan sebelum memulai kembali aliran
                produksi.
              </p>
            ) : (
              <p>
                <strong>PERINGATAN:</strong> Menghentikan Sewing Line 1 akan menahan seluruh konveyor
                aliran WIP, mencatat waktu henti (downtime log), dan memicu sinyal peringatan ke ruang
                kendali teknisi.
              </p>
            )}
          </div>

          {!isHalted && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">
                Penyebab Penghentian Line
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#DC2626] uppercase cursor-pointer"
              >
                <option value="KEJADIAN JARUM PATAH MASAL / POTENSI BAHAYA">
                  KEJADIAN JARUM PATAH MASAL / POTENSI BAHAYA
                </option>
                <option value="DEFECT SPIKE > 5% REJECT RATE PADA QC SEAM">
                  DEFECT SPIKE &gt; 5% REJECT RATE PADA QC SEAM
                </option>
                <option value="KENDALA MESIN UTAMA / OVERHEAT MOTOR">
                  KENDALA MESIN UTAMA / OVERHEAT MOTOR
                </option>
                <option value="TERKENDALA MATERIAL KAIN / SHADING WARNA">
                  TERKENDALA MATERIAL KAIN / SHADING WARNA
                </option>
                <option value="KEADAAN DARURAT KESELAMATAN KERJA (K3)">
                  KEADAAN DARURAT KESELAMATAN KERJA (K3)
                </option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase text-[#64748B]">
              Kode Otorisasi Supervisor
            </label>
            <div className="flex gap-2">
              <span className="h-11 px-3 bg-[#1E293B] border border-[#334155] flex items-center text-xs font-mono text-[#b4c5ff] font-bold">
                SPV-
              </span>
              <input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-sm px-3 focus:outline-none focus:border-[#DC2626] font-bold tracking-widest"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 bg-[#1E293B] border-t border-[#334155] px-6 flex items-center justify-end gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="tactile-edge px-4 py-2 bg-[#111827] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs uppercase font-bold cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleAction}
            className={`tactile-edge tactile-shadow px-6 py-2.5 font-mono text-xs uppercase font-bold text-white border flex items-center gap-2 cursor-pointer ${
              isHalted
                ? 'bg-[#16A34A] hover:bg-green-700 border-[#16A34A]'
                : 'bg-[#DC2626] hover:bg-red-700 border-[#DC2626]'
            }`}
          >
            <span className="material-symbols-outlined text-sm" data-icon="power_settings_new">
              power_settings_new
            </span>
            <span>{isHalted ? 'KONFIRMASI RESUME LINE' : 'EKSEKUSI HALT LINE SEKARANG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
