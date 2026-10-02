import React, { useState } from 'react';

interface PrintShippingLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartonId: string;
  onPrintConfirmed: (qty: number, printer: string) => void;
}

export const PrintShippingLabelsModal: React.FC<PrintShippingLabelsModalProps> = ({
  isOpen,
  onClose,
  cartonId,
  onPrintConfirmed,
}) => {
  const [selectedPrinter, setSelectedPrinter] = useState<string>('ZEBRA ZT411 [DOCK 02 - IP: .42]');
  const [labelQty, setLabelQty] = useState<number>(1);
  const [darkness, setDarkness] = useState<number>(22);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onPrintConfirmed(labelQty, selectedPrinter);
      setIsSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-lg flex flex-col shadow-2xl">
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">print</span>
            <span>PRINT SHIPPING LABELS // THERMAL SPOOL</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Status Chip */}
          <div className="p-3 bg-[#051424] border border-[#334155] flex justify-between items-center font-mono text-xs">
            <div>
              <div className="text-[#64748B] text-[10px]">TARGET UNIT:</div>
              <div className="font-bold text-[#b4c5ff]">{cartonId}</div>
            </div>
            <div className="text-right">
              <div className="text-[#64748B] text-[10px]">STOCK STATUS:</div>
              <div className="text-[#16A34A] font-bold">READY TO SPOOL</div>
            </div>
          </div>

          {/* Form settings */}
          <div className="flex flex-col gap-3 font-mono text-xs">
            <div>
              <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
                ASSIGNED INDUSTRIAL THERMAL PRINTER
              </label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full h-10 bg-[#051424] border border-[#334155] text-[#F8FAFC] px-3 font-mono text-xs focus:outline-none focus:border-[#2563EB]"
              >
                <option value="ZEBRA ZT411 [DOCK 02 - IP: .42]">
                  ZEBRA ZT411 [DOCK 02 - IP: 192.168.10.42] (ONLINE)
                </option>
                <option value="ZEBRA ZD620 [FINISHING LINE 01]">
                  ZEBRA ZD620 [FINISHING LINE 01] (STANDBY)
                </option>
                <option value="SATO CL4NX [LOGISTICS BERTH 01]">
                  SATO CL4NX [LOGISTICS BERTH 01] (ONLINE)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
                  LABEL QUANTITY
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setLabelQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 bg-[#1E293B] border border-[#334155] text-[#F8FAFC] font-bold text-lg cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={labelQty}
                    onChange={(e) => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 h-10 bg-[#051424] border-y border-[#334155] text-[#F8FAFC] text-center font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setLabelQty((q) => q + 1)}
                    className="w-10 h-10 bg-[#1E293B] border border-[#334155] text-[#F8FAFC] font-bold text-lg cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
                  PRINT DARKNESS ({darkness})
                </label>
                <input
                  type="range"
                  min={10}
                  max={30}
                  value={darkness}
                  onChange={(e) => setDarkness(parseInt(e.target.value))}
                  className="w-full h-10 accent-[#2563EB]"
                />
              </div>
            </div>

            <div className="p-2.5 bg-[#1E293B] border border-[#334155] flex justify-between text-[11px]">
              <span className="text-[#64748B]">RIBBON GRADE:</span>
              <span className="text-[#F8FAFC] font-bold">100mm x 150mm RESIN (ESD SAFE)</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              onClick={onClose}
              disabled={isSuccess}
              className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider border border-[#334155] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              onClick={handlePrint}
              disabled={isSuccess}
              className="h-10 bg-[#2563EB] hover:bg-blue-600 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer tactile-button flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">
                {isSuccess ? 'check' : 'print'}
              </span>
              <span>{isSuccess ? 'SENT TO SPOOLER' : `PRINT ${labelQty} LABEL(S)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
