import React, { useState } from 'react';

interface TerminalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminalConfigModal: React.FC<TerminalConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [opticalSensitivity, setOpticalSensitivity] = useState<number>(85);
  const [beeperVolume, setBeeperVolume] = useState<number>(70);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [esdAlarm, setEsdAlarm] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-lg flex flex-col shadow-2xl">
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">settings</span>
            <span>TERMINAL CONFIGURATION // LINE 01 SUPERVISOR</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 font-mono text-xs">
          <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between">
            <span className="text-[#64748B]">KIOSK HARDWARE ID:</span>
            <span className="text-[#b4c5ff] font-bold">TERM-JKT-PLANT-HUB-C-02</span>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between text-[11px] text-[#64748B] uppercase font-bold mb-1">
                <span>BARCODE OPTICAL SENSITIVITY</span>
                <span className="text-[#F8FAFC]">{opticalSensitivity}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={opticalSensitivity}
                onChange={(e) => setOpticalSensitivity(parseInt(e.target.value))}
                className="w-full h-8 accent-[#2563EB]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[#64748B] uppercase font-bold mb-1">
                <span>HARDWARE BEEPER VOLUME</span>
                <span className="text-[#F8FAFC]">{beeperVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beeperVolume}
                onChange={(e) => setBeeperVolume(parseInt(e.target.value))}
                className="w-full h-8 accent-[#2563EB]"
              />
            </div>

            <div className="p-3 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">AUTO-ADVANCE MULTIPACK ON 3/3 VERIFIED</div>
                <div className="text-[10px] text-[#64748B]">
                  Packs multipack automatically when all 3 slots pass optical check
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoAdvance(!autoAdvance)}
                className={`w-12 h-6 border font-bold text-[10px] cursor-pointer ${
                  autoAdvance
                    ? 'border-[#16A34A] bg-[#0F291E] text-[#16A34A]'
                    : 'border-[#334155] bg-[#1E293B] text-[#64748B]'
                }`}
              >
                {autoAdvance ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="p-3 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">ESD SAFETY INTERLOCK AUDIBLE ALARM</div>
                <div className="text-[10px] text-[#64748B]">
                  Alarm sirens if static grounding exceeds 50V threshold
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEsdAlarm(!esdAlarm)}
                className={`w-12 h-6 border font-bold text-[10px] cursor-pointer ${
                  esdAlarm
                    ? 'border-[#16A34A] bg-[#0F291E] text-[#16A34A]'
                    : 'border-[#334155] bg-[#1E293B] text-[#64748B]'
                }`}
              >
                {esdAlarm ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={onClose}
              className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-bold uppercase border border-[#334155] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              onClick={onClose}
              className="h-10 bg-[#2563EB] hover:bg-blue-600 text-white font-bold uppercase cursor-pointer tactile-button"
            >
              SAVE CONFIGURATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
