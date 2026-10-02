import React, { useState } from 'react';
import { SPKOrder } from '../../types/mes';
import { soundManager } from '../../utils/audio';

interface PrintTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spks: SPKOrder[];
  initialSpkCode?: string;
  onPrintSuccess: (spkCode: string, count: number) => void;
}

export const PrintTicketsModal: React.FC<PrintTicketsModalProps> = ({
  isOpen,
  onClose,
  spks,
  initialSpkCode,
  onPrintSuccess,
}) => {
  const [selectedSpkCode, setSelectedSpkCode] = useState<string>(
    initialSpkCode || 'SPK-2026-10-042'
  );
  const [bundleSize, setBundleSize] = useState<number>(24);
  const [printStatus, setPrintStatus] = useState<'IDLE' | 'SPOOLING' | 'SUCCESS'>('IDLE');

  if (!isOpen) return null;

  const currentSpk = spks.find((s) => s.code === selectedSpkCode) || spks[0];
  const estimatedTickets = Math.ceil(currentSpk.targetPcs / bundleSize);

  // Extract size from name or sku
  let sizeLabel = 'M';
  if (currentSpk.sku.includes('-L')) sizeLabel = 'L';
  else if (currentSpk.sku.includes('-S')) sizeLabel = 'S';
  else if (currentSpk.sku.includes('-XL')) sizeLabel = 'XL';

  const handlePrint = () => {
    soundManager.playScanBeep();
    setPrintStatus('SPOOLING');
    setTimeout(() => {
      soundManager.playSuccess();
      setPrintStatus('SUCCESS');
      setTimeout(() => {
        onPrintSuccess(selectedSpkCode, estimatedTickets);
        setPrintStatus('IDLE');
        onClose();
      }, 1200);
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl bg-[#111827] border-2 border-[#2563EB] shadow-2xl flex flex-col">
        {/* Modal Header Bar */}
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-base" data-icon="print">
              print
            </span>
            <span className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
              GENERATE &amp; PRINT BUNDLE TICKETS (QR CODE)
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

        {/* Modal Body (Form & Preview) */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Form Configuration */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">Pilih SPK Produksi</label>
              <div className="relative">
                <select
                  value={selectedSpkCode}
                  onChange={(e) => {
                    soundManager.playClick();
                    setSelectedSpkCode(e.target.value);
                  }}
                  className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-sm px-3 focus:outline-none focus:border-[#2563EB] uppercase cursor-pointer"
                >
                  {spks.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} [{s.name.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase text-[#64748B]">Ukuran Bundle</label>
                <select
                  value={bundleSize}
                  onChange={(e) => {
                    soundManager.playClick();
                    setBundleSize(Number(e.target.value));
                  }}
                  className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-sm px-3 focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="12">12 Pcs / Bdl</option>
                  <option value="24">24 Pcs (Standard)</option>
                  <option value="36">36 Pcs / Bdl</option>
                  <option value="48">48 Pcs / Bdl</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase text-[#64748B]">
                  Estimasi Jumlah Tiket
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${estimatedTickets} TIKET`}
                  className="w-full h-11 bg-[#1E293B] border border-[#334155] text-[#F8FAFC] font-mono text-sm px-3 focus:outline-none uppercase font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">
                Thermal Label Printer Target
              </label>
              <div className="p-3 bg-[#0B0F17] border border-[#334155] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#16A34A] text-base" data-icon="print">
                    print
                  </span>
                  <div>
                    <div className="text-xs font-mono font-bold text-[#F8FAFC]">
                      Zebra ZT411 (Line 1 - Station Post)
                    </div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      IP: 192.168.10.84 • DPI: 300 • ZPL READY
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#16A34A] font-bold">READY</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1c2d] border border-[#2563EB] text-xs font-mono text-[#b4c5ff] leading-relaxed">
              ℹ Barcode ZPL stream akan digenerate otomatis dengan nomor urut bundle 01 s/d {estimatedTickets} sesuai sequence cutting master.
            </div>
          </div>

          {/* Right: Ticket Preview (High-Contrast Plant Label 100mm x 75mm) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase text-[#64748B]">
              Pratinjau Label Tiket (100mm x 75mm)
            </label>
            <div className="bg-white text-black p-4 border-2 border-black flex flex-col justify-between font-mono h-full min-h-[280px]">
              {/* Top Bar */}
              <div className="border-b-2 border-black pb-2 flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest leading-none">
                    THEUNDERWEARSUPPLY // MES
                  </div>
                  <div className="text-lg font-black tracking-tight mt-1 leading-none">
                    {currentSpk.code}
                  </div>
                  <div className="text-xs font-bold mt-0.5">
                    {currentSpk.name.toUpperCase()}
                  </div>
                </div>
                <div className="border-2 border-black px-2 py-0.5 text-center">
                  <div className="text-[9px] font-bold">SIZE</div>
                  <div className="text-xl font-black leading-none">{sizeLabel}</div>
                </div>
              </div>

              {/* Mid Section: QR Code & Telemetry */}
              <div className="grid grid-cols-12 gap-2 my-2 items-center">
                <div className="col-span-5 flex flex-col items-center">
                  <div className="w-24 h-24 border border-black p-1 bg-white flex items-center justify-center">
                    <svg
                      className="w-full h-full shape-rendering-crispEdges"
                      viewBox="0 0 29 29"
                      fill="black"
                    >
                      {/* Stylized QR locator patterns */}
                      <rect x="0" y="0" width="7" height="7" />
                      <rect x="1" y="1" width="5" height="5" fill="white" />
                      <rect x="2" y="2" width="3" height="3" />
                      <rect x="22" y="0" width="7" height="7" />
                      <rect x="23" y="1" width="5" height="5" fill="white" />
                      <rect x="24" y="2" width="3" height="3" />
                      <rect x="0" y="22" width="7" height="7" />
                      <rect x="1" y="23" width="5" height="5" fill="white" />
                      <rect x="2" y="24" width="3" height="3" />
                      <rect x="9" y="2" width="3" height="2" />
                      <rect x="14" y="0" width="2" height="4" />
                      <rect x="18" y="3" width="2" height="2" />
                      <rect x="8" y="9" width="4" height="2" />
                      <rect x="14" y="8" width="4" height="3" />
                      <rect x="9" y="14" width="3" height="3" />
                      <rect x="15" y="15" width="2" height="5" />
                      <rect x="10" y="20" width="4" height="2" />
                      <rect x="20" y="10" width="3" height="4" />
                      <rect x="24" y="16" width="3" height="2" />
                      <rect x="18" y="22" width="4" height="3" />
                      <rect x="23" y="23" width="4" height="4" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold mt-1 tracking-wider">BDL-0101-012</span>
                </div>

                <div className="col-span-7 flex flex-col gap-1 text-[11px] leading-tight">
                  <div>
                    <strong>BUNDLE:</strong> 12 / {estimatedTickets} (QTY: {bundleSize} PCS)
                  </div>
                  <div>
                    <strong>OP:</strong> COVERSTITCH PINGGANG
                  </div>
                  <div>
                    <strong>LINE:</strong> SEWING LINE 1
                  </div>
                  <div>
                    <strong>OPERATOR:</strong> JOKO OP-0210
                  </div>
                  <div>
                    <strong>DATE:</strong> 2026-10-18 08:30
                  </div>
                </div>
              </div>

              {/* Bottom: 1D Barcode Strip */}
              <div className="border-t-2 border-black pt-2 flex flex-col items-center">
                <div className="h-6 w-full flex items-stretch gap-[2px]">
                  <div className="bg-black w-[2px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[4px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[1px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[3px]"></div>
                  <div className="bg-white w-[3px]"></div>
                  <div className="bg-black w-[5px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[2px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[1px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[4px]"></div>
                  <div className="bg-white w-[3px]"></div>
                  <div className="bg-black w-[2px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[3px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[5px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[1px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[4px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[2px]"></div>
                  <div className="bg-white w-[3px]"></div>
                  <div className="bg-black w-[3px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[1px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[4px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[2px]"></div>
                  <div className="bg-white w-[2px]"></div>
                  <div className="bg-black w-[3px]"></div>
                  <div className="bg-white w-[1px]"></div>
                  <div className="bg-black w-[5px]"></div>
                  <div className="bg-white w-[3px]"></div>
                  <div className="bg-black w-[2px]"></div>
                </div>
                <span className="text-[9px] font-bold tracking-widest mt-0.5">
                  *{currentSpk.code.replace(/-/g, '')}-BDL012*
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="h-16 bg-[#1E293B] border-t border-[#334155] px-6 flex items-center justify-end gap-4">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            disabled={printStatus !== 'IDLE'}
            className="tactile-edge px-5 py-2.5 bg-[#111827] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs uppercase font-bold cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            disabled={printStatus !== 'IDLE'}
            className="tactile-edge tactile-shadow px-6 py-2.5 bg-[#16A34A] hover:bg-green-700 text-[#F8FAFC] border border-[#16A34A] font-mono text-xs uppercase font-bold flex items-center gap-2 cursor-pointer disabled:opacity-80"
          >
            {printStatus === 'IDLE' && (
              <>
                <span className="material-symbols-outlined text-sm" data-icon="print">
                  print
                </span>
                <span>Cetak {estimatedTickets} QR Labels (Zebra ZT411)</span>
              </>
            )}
            {printStatus === 'SPOOLING' && (
              <>
                <span className="material-symbols-outlined text-sm animate-spin" data-icon="sync">
                  sync
                </span>
                <span>SPOOLING TO ZEBRA ZT411...</span>
              </>
            )}
            {printStatus === 'SUCCESS' && (
              <>
                <span className="material-symbols-outlined text-sm" data-icon="check">
                  check
                </span>
                <span>{estimatedTickets} TICKETS PRINTED OK</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
