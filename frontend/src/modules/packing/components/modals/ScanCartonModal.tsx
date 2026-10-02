import React, { useState } from 'react';

interface ScanCartonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartonScanned: (cartonId: string) => void;
  currentCartonId: string;
}

export const ScanCartonModal: React.FC<ScanCartonModalProps> = ({
  isOpen,
  onClose,
  onCartonScanned,
  currentCartonId,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>('CTN-2026-0891');
  const [opticalActive, setOpticalActive] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onCartonScanned(barcodeInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-lg flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">barcode_scanner</span>
            <span>SCAN MASTER CARTON BARCODE</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Simulated Optical Viewfinder */}
          <div className="relative bg-[#051424] border border-[#334155] h-44 flex flex-col items-center justify-center overflow-hidden scanner-target-crosshairs">
            {opticalActive && (
              <div className="absolute inset-x-0 h-0.5 bg-[#DC2626] animate-[pulse_1s_infinite] shadow-[0_0_8px_#DC2626]"></div>
            )}
            <div className="flex flex-col items-center gap-2 z-10 text-center px-4">
              <span className="material-symbols-outlined text-4xl text-[#2563EB]">qr_code_2</span>
              <div className="font-mono text-xs text-[#F8FAFC] font-bold">
                ALIGN MASTER CARTON CODE INSIDE TARGET
              </div>
              <div className="font-mono text-[11px] text-[#64748B]">
                OPTICAL SENSOR ACQUIRING AT 120 FPS // DOCK 02
              </div>
            </div>
            <div className="absolute bottom-2 right-2 text-[10px] font-mono text-[#16A34A] bg-[#0F291E] px-1.5 py-0.5 border border-[#16A34A] font-bold">
              LASER READY
            </div>
          </div>

          {/* Quick Carton Presets */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#64748B] font-bold">PRESET CARTONS:</span>
            {['CTN-2026-0891', 'CTN-2026-0892', 'CTN-2026-0893'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setBarcodeInput(code)}
                className={`px-2 py-0.5 border text-xs cursor-pointer ${
                  barcodeInput === code
                    ? 'border-[#2563EB] bg-[#1E293B] text-[#b4c5ff] font-bold'
                    : 'border-[#334155] text-[#64748B] hover:text-[#F8FAFC]'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block font-mono text-[11px] text-[#64748B] uppercase font-bold mb-1">
                CARTON IDENTIFIER CODE (KEYPAD OR HANDHELD TRIGGER)
              </label>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="e.g. CTN-2026-0891"
                className="w-full h-11 bg-[#051424] border border-[#334155] text-[#F8FAFC] font-mono text-sm font-bold px-3 uppercase tracking-wider focus:outline-none focus:border-[#2563EB]"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
              <button
                type="button"
                onClick={onClose}
                className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider border border-[#334155] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="h-10 bg-[#2563EB] hover:bg-blue-600 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer tactile-button"
              >
                LOAD CARTON
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
