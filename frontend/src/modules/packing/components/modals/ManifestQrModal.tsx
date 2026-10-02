import React from 'react';
import { B2BManifest } from '../../types/mes';

interface ManifestQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: B2BManifest;
}

export const ManifestQrModal: React.FC<ManifestQrModalProps> = ({
  isOpen,
  onClose,
  manifest,
}) => {
  if (!isOpen) return null;

  const payload = JSON.stringify(
    {
      po: manifest.poNumber,
      client: manifest.clientName,
      spk: manifest.spkReference,
      cartons: manifest.totalCartons,
      carrier: manifest.logisticsCarrier,
      plate: manifest.vehiclePlateId,
      seal: 'S-9921',
      dispatchTs: '2026-10-24T13:42:00Z',
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-md flex flex-col shadow-2xl">
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">qr_code</span>
            <span>LOGISTICS MANIFEST QR // DOCK 02</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4 text-center">
          {/* High contrast QR box */}
          <div className="p-4 bg-white border-4 border-black flex flex-col items-center justify-center">
            {/* Visual Matrix simulation */}
            <div className="w-48 h-48 bg-black grid grid-cols-12 grid-rows-12 gap-1 p-2">
              {Array.from({ length: 144 }).map((_, i) => {
                const isCorner =
                  (i % 12 < 3 && Math.floor(i / 12) < 3) ||
                  (i % 12 > 8 && Math.floor(i / 12) < 3) ||
                  (i % 12 < 3 && Math.floor(i / 12) > 8);
                const isFilled = isCorner || (i * 37 + 13) % 2 === 0;
                return (
                  <div
                    key={i}
                    className={`${isFilled ? 'bg-black ring-1 ring-black' : 'bg-white'}`}
                  ></div>
                );
              })}
            </div>
            <div className="font-mono font-bold text-xs text-black mt-2 tracking-wider">
              *{manifest.poNumber}*
            </div>
          </div>

          <div className="font-mono text-xs text-[#F8FAFC]">
            <div className="font-bold text-sm text-[#b4c5ff]">{manifest.poNumber}</div>
            <div className="text-[#64748B] text-[11px] mt-0.5">
              CARRIER: {manifest.logisticsCarrier} ({manifest.vehiclePlateId})
            </div>
            <div className="text-[#16A34A] text-[11px] font-bold mt-1">
              STATUS: READY FOR FORKLIFT SCAN &amp; GATE PASS
            </div>
          </div>

          <div className="w-full bg-[#051424] p-3 border border-[#334155] text-left font-mono text-[10px] text-[#64748B] overflow-x-auto">
            <div className="text-[#F8FAFC] font-bold mb-1">MANIFEST JSON PAYLOAD:</div>
            <pre className="text-[#b4c5ff]">{payload}</pre>
          </div>

          <button
            onClick={onClose}
            className="w-full h-10 bg-[#2563EB] hover:bg-blue-600 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer tactile-button"
          >
            CLOSE SCANNER VIEW
          </button>
        </div>
      </div>
    </div>
  );
};
