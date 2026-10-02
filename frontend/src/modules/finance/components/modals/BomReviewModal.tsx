import React, { useState } from 'react';
import { SpkBatch, CurrencyType } from '../../types/costing';
import { formatCurrency } from '../../utils/formatters';

interface BomReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: SpkBatch | null;
  currency: CurrencyType;
  onApplyMitigation: (id: string, updatedFields: Partial<SpkBatch>) => void;
}

export const BomReviewModal: React.FC<BomReviewModalProps> = ({
  isOpen,
  onClose,
  batch,
  currency,
  onApplyMitigation,
}) => {
  const [selectedMitigation, setSelectedMitigation] = useState<'supplier' | 'nesting' | 'surcharge'>('supplier');
  const [applied, setApplied] = useState(false);

  if (!isOpen || !batch) return null;

  const handleApply = () => {
    let updatedMaterial = batch.realMaterialPerPc;
    let newVariance = batch.variancePct;
    let cause = batch.varianceCause;

    if (selectedMitigation === 'supplier') {
      updatedMaterial = 12400; // was 14120
      const newTotal = updatedMaterial + batch.realLaborPerPc + batch.realOverheadPerPc;
      newVariance = Number((((newTotal - batch.bomHppPerPc) / batch.bomHppPerPc) * 100).toFixed(2));
      cause = 'Mitigasi berhasil: Pengalihan supplier ke PT Sansan Saudaratex mengembalikan deviasi ke rentang normal.';
    } else if (selectedMitigation === 'nesting') {
      updatedMaterial = 12900;
      const newTotal = updatedMaterial + batch.realLaborPerPc + batch.realOverheadPerPc;
      newVariance = Number((((newTotal - batch.bomHppPerPc) / batch.bomHppPerPc) * 100).toFixed(2));
      cause = 'Mitigasi berhasil: Optimasi CAD nesting marker memangkas waste kain sebesar 3.4%.';
    } else {
      cause = 'Otorisasi darurat: Biaya deviasi +5.7% disetujui dibebankan pada surcharge klien B2B.';
    }

    const newTotal = updatedMaterial + batch.realLaborPerPc + batch.realOverheadPerPc;
    const isNowFavorable = newVariance <= -1;
    const isNowOnBudget = newVariance > -1 && newVariance <= 1;

    onApplyMitigation(batch.id, {
      realMaterialPerPc: updatedMaterial,
      totalRealHppPerPc: newTotal,
      variancePct: newVariance,
      varianceStatus: isNowFavorable ? 'Favorable' : isNowOnBudget ? 'On Budget' : 'Unfavorable',
      isCritical: false,
      varianceCause: cause,
    });

    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[24px]">inventory</span>
            <div>
              <h2 className="text-[20px] font-bold text-[#0F172A]">
                Review BOM &amp; Mitigasi Supplier
              </h2>
              <span className="text-[12px] text-[#ba1a1a] font-code-metric font-semibold">
                {batch.id} • {batch.brand} - {batch.productName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg text-[20px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4 text-[13px]">
          {/* Alert Root Cause Details */}
          <div className="p-3.5 bg-[#ffdad6]/30 border border-[#ba1a1a]/30 rounded-xl">
            <div className="flex items-center gap-2 text-[#ba1a1a] font-bold">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Deviasi Biaya Melebihi Toleransi (+5.7% &gt; Toleransi Max 5.0%)</span>
            </div>
            <p className="mt-1.5 text-[#0F172A]">
              Kenaikan sepihak harga benang Spandex Elastane grade 40/100 dari supplier{' '}
              <strong>PT Indo-Bharat Rayon Textile</strong> sebesar Rp 2.320 / pcs pada purchase order minggu ke-4.
            </p>
            <div className="mt-2 flex items-center gap-4 text-[12px]">
              <div>
                <span className="text-[#64748B]">BOM Baseline Material:</span>{' '}
                <strong className="text-[#0F172A] font-code-metric">
                  {formatCurrency(11800, currency)}
                </strong>
              </div>
              <div className="h-3 w-px bg-[#CBD5E1]"></div>
              <div>
                <span className="text-[#64748B]">Realisasi Faktur:</span>{' '}
                <strong className="text-[#ba1a1a] font-code-metric">
                  {formatCurrency(batch.realMaterialPerPc, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Action Decision Options */}
          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-2">
              Pilih Solusi Tindakan Korektif (Corrective Action):
            </label>

            <div className="space-y-2.5">
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  selectedMitigation === 'supplier'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/20'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6]'
                }`}
              >
                <input
                  type="radio"
                  name="mitigation"
                  value="supplier"
                  checked={selectedMitigation === 'supplier'}
                  onChange={() => setSelectedMitigation('supplier')}
                  className="mt-1 text-[#004ac6] focus:ring-[#004ac6]"
                />
                <div>
                  <strong className="text-[#0F172A] block">
                    1. Alihkan Alokasi ke Supplier Cadangan (PT Sansan Saudaratex Jaya)
                  </strong>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    Menstabilkan harga spandex elastane kembali ke Rp 12.400 / pcs (-Rp 1.720/pc). HPP kembali di bawah toleransi 5%.
                  </p>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  selectedMitigation === 'nesting'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/20'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6]'
                }`}
              >
                <input
                  type="radio"
                  name="mitigation"
                  value="nesting"
                  checked={selectedMitigation === 'nesting'}
                  onChange={() => setSelectedMitigation('nesting')}
                  className="mt-1 text-[#004ac6] focus:ring-[#004ac6]"
                />
                <div>
                  <strong className="text-[#0F172A] block">
                    2. Optimasi Nesting CAD Marker &amp; Interlocking Cutting
                  </strong>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    Merampingkan limbah tepi pola kain Lady Brief pada mesin CNC Gerber, menghemat Rp 1.220 / pcs.
                  </p>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  selectedMitigation === 'surcharge'
                    ? 'border-[#004ac6] bg-[#dbe1ff]/20'
                    : 'border-[#E2E8F0] hover:bg-[#f2f4f6]'
                }`}
              >
                <input
                  type="radio"
                  name="mitigation"
                  value="surcharge"
                  checked={selectedMitigation === 'surcharge'}
                  onChange={() => setSelectedMitigation('surcharge')}
                  className="mt-1 text-[#004ac6] focus:ring-[#004ac6]"
                />
                <div>
                  <strong className="text-[#0F172A] block">
                    3. Otorisasi Darurat &amp; Tagihkan Surcharge Bahan Baku ke Klien B2B
                  </strong>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    Menerapkan klausul fluktuasi bahan baku pada purchase order kontrak B2B.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {applied && (
            <div className="p-2.5 bg-[#16A34A]/15 text-[#16A34A] rounded-lg text-center font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Rencana mitigasi berhasil diterapkan! Status deviasi SPK telah diperbarui.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6] font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#0053db] text-white font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              <span>Terapkan Mitigasi &amp; Update HPP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
