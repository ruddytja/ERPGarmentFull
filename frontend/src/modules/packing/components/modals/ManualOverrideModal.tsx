import React, { useState } from 'react';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOverrideApproved: (slotIdx: number, reason: string) => void;
  cartonId: string;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  onClose,
  onOverrideApproved,
  cartonId,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>(
    'Barcode label creased during polybag heat seal - visual verify OK'
  );
  const [supervisorCode, setSupervisorCode] = useState<string>('7092');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOverrideApproved(selectedSlot, overrideReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-lg flex flex-col shadow-2xl">
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">pin</span>
            <span>SUPERVISOR MANUAL OVERRIDE PROTOCOL</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 font-mono text-xs">
          <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between">
            <span className="text-[#64748B]">TARGET CARTON:</span>
            <span className="text-[#b4c5ff] font-bold">{cartonId}</span>
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              SELECT TARGET MULTIPACK SLOT TO FORCE-VERIFY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['SLOT 01 (CHARCOAL)', 'SLOT 02 (JET BLACK)', 'SLOT 03 (DEEP NAVY)'].map((slot, idx) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(idx)}
                  className={`p-2 text-center border font-bold text-xs cursor-pointer ${
                    selectedSlot === idx
                      ? 'border-[#2563EB] bg-[#2563EB] text-white'
                      : 'border-[#334155] bg-[#051424] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              OVERRIDE JUSTIFICATION LOG
            </label>
            <textarea
              rows={2}
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-[#051424] border border-[#334155] text-[#F8FAFC] p-2.5 font-mono text-xs focus:outline-none focus:border-[#2563EB] resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              SUPERVISOR AUTHORIZATION PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={supervisorCode}
              onChange={(e) => setSupervisorCode(e.target.value)}
              placeholder="7092"
              className="w-full h-10 bg-[#051424] border border-[#334155] text-[#F8FAFC] text-center tracking-widest text-base font-bold focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-bold uppercase border border-[#334155] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="h-10 bg-[#2563EB] hover:bg-blue-600 text-white font-bold uppercase cursor-pointer tactile-button"
            >
              APPLY OVERRIDE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
