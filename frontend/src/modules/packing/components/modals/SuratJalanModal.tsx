import React from 'react';
import { B2BManifest } from '../../types/mes';

interface SuratJalanModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: B2BManifest;
}

export const SuratJalanModal: React.FC<SuratJalanModalProps> = ({
  isOpen,
  onClose,
  manifest,
}) => {
  if (!isOpen) return null;

  const handlePrintWindow = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none overflow-y-auto">
      <div className="bg-[#111827] border-2 border-[#2563EB] w-full max-w-2xl flex flex-col shadow-2xl my-auto">
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">description</span>
            <span>SURAT JALAN PENGIRIMAN // OFFICIAL MANIFEST PREVIEW</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-6 bg-white text-black font-mono text-xs select-text">
          <div className="flex justify-between items-start border-b-2 border-black pb-3">
            <div>
              <div className="font-headline-xl text-2xl font-extrabold uppercase tracking-tight">
                PT THE UNDERWEAR SUPPLY INDONESIA
              </div>
              <div className="text-[11px] text-neutral-700">
                PLANT HUB C // LOGISTICS &amp; FULFILLMENT DOCK 02
              </div>
              <div className="text-[10px] text-neutral-600">
                Kawasan Industri Pulogadung, Jakarta Timur // Tel: (021) 460-9921
              </div>
            </div>
            <div className="text-right">
              <div className="font-headline-lg text-lg font-bold border-2 border-black px-2 py-0.5 inline-block uppercase">
                SURAT JALAN
              </div>
              <div className="text-[11px] font-bold mt-1">NO: SJ-2026-10-MTR881</div>
              <div className="text-[10px]">TGL: 2026-10-24</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3 border-b border-black text-[11px]">
            <div>
              <span className="font-bold text-[9px] uppercase block text-neutral-600">
                PENERIMA (DELIVER TO):
              </span>
              <div className="font-bold text-xs">{manifest.clientName}</div>
              <div className="text-[10px] leading-tight text-neutral-800">
                {manifest.destinationAddress}
              </div>
              <div className="text-[10px] mt-1">PO REF: {manifest.poNumber}</div>
            </div>
            <div className="border-l border-black pl-3">
              <span className="font-bold text-[9px] uppercase block text-neutral-600">
                DATA PENGANGKUT (TRANSPORTER):
              </span>
              <div className="font-bold text-xs">{manifest.logisticsCarrier}</div>
              <div className="text-[10px]">NO. POLISI: {manifest.vehiclePlateId}</div>
              <div className="text-[10px]">NAMA PENGEMUDI: {manifest.driverName}</div>
              <div className="text-[10px] font-bold text-neutral-900 mt-1">
                SEAL DISPATCH: #S-9921 (VERIFIED INTACT)
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="py-3 border-b-2 border-black">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b border-black font-bold">
                <tr>
                  <th className="py-1">NO</th>
                  <th className="py-1">DESKRIPSI BARANG</th>
                  <th className="py-1 text-center">ISI / DUS</th>
                  <th className="py-1 text-right">JUMLAH KARTON</th>
                  <th className="py-1 text-right">TOTAL PCS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                <tr>
                  <td className="py-1.5 font-bold">1</td>
                  <td className="py-1.5">
                    <div className="font-bold">NAQALA SEAMLESS BRIEF - 3-PACK BOX</div>
                    <div className="text-[10px] text-neutral-600">SKU: NAQALA-3BX-M (CHAR/BLK/NVY)</div>
                  </td>
                  <td className="py-1.5 text-center">48 PACKS (144 PCS)</td>
                  <td className="py-1.5 text-right font-bold">{manifest.totalCartons} CARTONS</td>
                  <td className="py-1.5 text-right font-bold">1,200 PCS</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-2 pt-6 pb-2 text-center text-[10px]">
            <div>
              <div className="font-bold">DISPATCH / PENGIRIM</div>
              <div className="h-14 flex items-end justify-center font-bold text-[11px] underline">
                ( Fajar Maulana )
              </div>
              <div className="text-[9px] text-neutral-600">SPV-7092-JKT // LINE 01</div>
            </div>
            <div>
              <div className="font-bold">PENGEMUDI / SUPIR</div>
              <div className="h-14 flex items-end justify-center font-bold text-[11px] underline">
                ( {manifest.driverName} )
              </div>
              <div className="text-[9px] text-neutral-600">{manifest.logisticsCarrier}</div>
            </div>
            <div>
              <div className="font-bold">PENERIMA / WAREHOUSE</div>
              <div className="h-14 flex items-end justify-center font-bold text-[11px] text-neutral-400">
                ( ................................... )
              </div>
              <div className="text-[9px] text-neutral-600">Nama Terang &amp; Cap Toko</div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="p-3 bg-[#111827] border-t border-[#334155] flex justify-between items-center font-mono text-xs">
          <span className="text-[#64748B]">RESIN THERMAL DOCK 02 READY</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-bold uppercase border border-[#334155] cursor-pointer"
            >
              TUTUP
            </button>
            <button
              onClick={handlePrintWindow}
              className="px-5 h-9 bg-[#2563EB] hover:bg-blue-600 text-white font-bold uppercase cursor-pointer tactile-button flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>CETAK DOKUMEN</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
