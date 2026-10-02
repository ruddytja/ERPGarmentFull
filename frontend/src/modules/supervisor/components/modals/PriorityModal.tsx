import React, { useState } from 'react';
import { SPKOrder } from '../../types/mes';
import { soundManager } from '../../utils/audio';

interface PriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  spk: SPKOrder | null;
  onSavePriority: (spkId: string, priority: SPKOrder['priority'], note: string) => void;
}

export const PriorityModal: React.FC<PriorityModalProps> = ({
  isOpen,
  onClose,
  spk,
  onSavePriority,
}) => {
  const [priority, setPriority] = useState<SPKOrder['priority']>(spk?.priority || 'NORMAL');
  const [note, setNote] = useState<string>('');
  const [autoBalancing, setAutoBalancing] = useState<boolean>(true);

  if (!isOpen || !spk) return null;

  const handleSave = () => {
    soundManager.playSuccess();
    onSavePriority(spk.id, priority, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-lg bg-[#111827] border-2 border-[#2563EB] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-base" data-icon="tune">
              tune
            </span>
            <span className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
              UBAH PRIORITAS LINE &amp; FLOW BALANCING
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111827] cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          <div className="p-3 bg-[#0B0F17] border border-[#334155]">
            <span className="text-[11px] font-mono text-[#64748B] uppercase block">TARGET SPK</span>
            <span className="font-condensed text-xl font-bold text-[#F8FAFC]">{spk.code}</span>
            <span className="text-xs font-mono text-[#b4c5ff] block">{spk.name}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase text-[#64748B]">Tingkat Prioritas Line</label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'NORMAL', 'HIGH', 'RUSH'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    soundManager.playClick();
                    setPriority(lvl);
                  }}
                  className={`py-2 px-1 text-center font-mono text-xs font-bold border transition-colors cursor-pointer ${
                    priority === lvl
                      ? lvl === 'RUSH'
                        ? 'bg-[#DC2626] border-[#DC2626] text-[#F8FAFC]'
                        : 'bg-[#2563EB] border-[#2563EB] text-[#F8FAFC]'
                      : 'bg-[#1E293B] border-[#334155] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#1E293B] border border-[#334155]">
            <div>
              <span className="text-xs font-mono font-bold text-[#F8FAFC] block">
                Auto-Balancing Workstation
              </span>
              <span className="text-[10px] font-mono text-[#64748B]">
                Otomatis mengalihkan operator cadangan ke bottleneck sewing
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoBalancing}
              onChange={(e) => setAutoBalancing(e.target.checked)}
              className="w-5 h-5 accent-[#2563EB] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase text-[#64748B]">Catatan Supervisor / Instruksi Shift</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Percepat sewing karet pinggang, buffer packing menipis..."
              rows={3}
              className="w-full bg-[#0B0F17] border border-[#334155] p-2.5 text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="h-14 bg-[#1E293B] border-t border-[#334155] px-6 flex items-center justify-end gap-3">
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
            onClick={handleSave}
            className="tactile-edge tactile-shadow px-5 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-[#F8FAFC] border border-[#2563EB] font-mono text-xs uppercase font-bold cursor-pointer"
          >
            Terapkan Prioritas
          </button>
        </div>
      </div>
    </div>
  );
};
