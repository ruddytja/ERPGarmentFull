import React, { useState } from 'react';
import { CurrencyType } from '../../types/costing';
import { formatCurrency } from '../../utils/formatters';

interface InputOverheadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyType;
  onSaveOverhead: (newOverheadTotal: number) => void;
}

export const InputOverheadModal: React.FC<InputOverheadModalProps> = ({
  isOpen,
  onClose,
  currency,
  onSaveOverhead,
}) => {
  const [electricity, setElectricity] = useState<number>(38500000);
  const [boiler, setBoiler] = useState<number>(21200000);
  const [needles, setNeedles] = useState<number>(9450000);
  const [glue, setGlue] = useState<number>(11000000);
  const [rent, setRent] = useState<number>(10000000);

  if (!isOpen) return null;

  const total = electricity + boiler + needles + glue + rent;
  const estimatedCapacityPcs = 37500;
  const overheadPerPc = Math.round(total / estimatedCapacityPcs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverhead(total);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[22px]">add_chart</span>
            <h2 className="text-[20px] font-bold text-[#0F172A]">Input Overhead Pabrik Bulanan</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg text-[20px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <p className="text-[13px] text-[#64748B]">
            Sesuaikan realisasi biaya operasional pabrik Sukabumi #01 untuk alokasi HPP bulan Oktober 2026.
          </p>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Listrik &amp; Daya Boiler PLN
            </label>
            <input
              type="number"
              value={electricity}
              onChange={(e) => setElectricity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-code-metric bg-[#f2f4f6]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Bahan Bakar Boiler &amp; Uap Setrika Steam
            </label>
            <input
              type="number"
              value={boiler}
              onChange={(e) => setBoiler(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-code-metric bg-[#f2f4f6]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Konsumsi Jarum Siruba, Pelumas &amp; Spareparts Mesin
            </label>
            <input
              type="number"
              value={needles}
              onChange={(e) => setNeedles(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-code-metric bg-[#f2f4f6]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Lem Seamless Bonding Ultrasonic (Adhesive Film Bemis)
            </label>
            <input
              type="number"
              value={glue}
              onChange={(e) => setGlue(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-code-metric bg-[#f2f4f6]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Sewa Gedung Fasilitas &amp; Amortisasi Ruang Produksi
            </label>
            <input
              type="number"
              value={rent}
              onChange={(e) => setRent(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-code-metric bg-[#f2f4f6]"
            />
          </div>

          <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#16A34A] block font-semibold uppercase">
                Total Realisasi Overhead
              </span>
              <span className="text-[18px] font-code-metric font-bold text-[#16A34A]">
                {formatCurrency(total, currency)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#64748B] block">Alokasi / Pcs:</span>
              <span className="text-[14px] font-code-metric font-bold text-[#0F172A]">
                ~ {formatCurrency(overheadPerPc, currency)} /pc
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6] text-[13px] font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#0053db] text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Terapkan Alokasi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
