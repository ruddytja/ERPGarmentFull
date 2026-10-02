import React, { useState } from 'react';

interface HaltStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStationHalted: boolean;
  onConfirmHalt: (reason: string) => void;
  onResumeStation: () => void;
}

export const HaltStationModal: React.FC<HaltStationModalProps> = ({
  isOpen,
  onClose,
  isStationHalted,
  onConfirmHalt,
  onResumeStation,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(
    'CONVEYOR MECHANICAL BLOCKAGE / JAM'
  );
  const [supervisorPin, setSupervisorPin] = useState<string>('7092');
  const [pinError, setPinError] = useState<string>('');

  if (!isOpen) return null;

  const handleAction = () => {
    if (supervisorPin !== '7092' && supervisorPin !== '0000') {
      setPinError('INVALID SUPERVISOR PIN. USE 7092.');
      return;
    }
    setPinError('');
    if (isStationHalted) {
      onResumeStation();
    } else {
      onConfirmHalt(selectedReason);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#DC2626] w-full max-w-lg flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-11 bg-[#300C0C] border-b border-[#DC2626] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#DC2626] tracking-wider font-bold">
            <span className="material-symbols-outlined text-lg">emergency_home</span>
            <span>
              {isStationHalted
                ? 'RESUME STATION // SAFETY INTERLOCK CLEARANCE'
                : 'EMERGENCY HALT // LINE 01 PACKAGING DOCK'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Hazard banner */}
          <div className="p-3 border border-[#DC2626] hazard-stripe-red flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-[#DC2626]">warning</span>
            <div className="font-mono text-xs text-[#F8FAFC]">
              <div className="font-bold text-[#DC2626]">
                {isStationHalted ? 'STATION CURRENTLY HALTED' : 'STATION EMERGENCY STOP PROTOCOL'}
              </div>
              <div className="text-[11px] text-[#d4e4fa] mt-0.5">
                {isStationHalted
                  ? 'All conveyors locked. Verify clear line before resuming production.'
                  : 'Halting freezes barcode acquisitor, conveyor #02 motor, and packaging line index.'}
              </div>
            </div>
          </div>

          {!isStationHalted ? (
            <div className="flex flex-col gap-3 font-mono text-xs">
              <label className="block text-[11px] text-[#64748B] uppercase font-bold">
                SELECT PRIMARY HALT REASON:
              </label>
              {[
                'CONVEYOR MECHANICAL BLOCKAGE / JAM',
                'BARCODE OPTICAL ACQUISITION FAILURE',
                'THERMAL PRINTER TAPE / RIBBON MISFEED',
                'QUALITY REJECT TOLERANCE SPIKE (>2%)',
                'MANUAL EMERGENCY OPERATOR STOP',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`p-2.5 text-left border text-xs font-bold transition-colors cursor-pointer ${
                    selectedReason === reason
                      ? 'border-[#DC2626] bg-[#300C0C] text-[#DC2626]'
                      : 'border-[#334155] bg-[#051424] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 font-mono text-xs bg-[#051424] p-3 border border-[#334155]">
              <div className="text-[#16A34A] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>MECHANICAL INTERLOCK VERIFIED CLEAR</span>
              </div>
              <div className="text-[#16A34A] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>CONVEYOR LIGHT CURTAIN UNBROKEN</span>
              </div>
              <div className="text-[#16A34A] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>ESTOP RELAYS RESET</span>
              </div>
            </div>
          )}

          {/* Supervisor Pin */}
          <div className="font-mono text-xs">
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              SUPERVISOR SECURITY PIN (ID: SPV-7092-JKT)
            </label>
            <input
              type="password"
              maxLength={4}
              value={supervisorPin}
              onChange={(e) => setSupervisorPin(e.target.value)}
              placeholder="7092"
              className="w-full h-10 bg-[#051424] border border-[#334155] text-[#F8FAFC] font-mono text-center tracking-widest text-lg font-bold px-3 focus:outline-none focus:border-[#DC2626]"
            />
            {pinError && <div className="text-[#DC2626] text-[11px] mt-1 font-bold">{pinError}</div>}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={onClose}
              className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider border border-[#334155] cursor-pointer"
            >
              DISMISS
            </button>
            <button
              onClick={handleAction}
              className={`h-10 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer tactile-button ${
                isStationHalted
                  ? 'bg-[#16A34A] hover:bg-green-600 text-white'
                  : 'bg-[#DC2626] hover:bg-red-700 text-white'
              }`}
            >
              {isStationHalted ? 'AUTHORIZE RESUME' : 'EXECUTE HALT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
