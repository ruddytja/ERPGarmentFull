import React, { useState } from 'react';

interface ReportDamagedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDamage: (damageType: string, notes: string) => void;
  cartonId: string;
}

export const ReportDamagedModal: React.FC<ReportDamagedModalProps> = ({
  isOpen,
  onClose,
  onConfirmDamage,
  cartonId,
}) => {
  const [damageType, setDamageType] = useState<string>('PUNCTURED POLYBAG / PACKAGING TEAR');
  const [notes, setNotes] = useState<string>('Outer 3-pack presentation box corner crushed on conveyor');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmDamage(damageType, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#DC2626] w-full max-w-lg flex flex-col shadow-2xl">
        <div className="h-10 bg-[#300C0C] border-b border-[#DC2626] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#DC2626] tracking-wider font-bold">
            <span className="material-symbols-outlined text-base">broken_image</span>
            <span>REPORT DAMAGED PACK // SCRAP OR REWORK</span>
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
            <span className="text-[#DC2626] font-bold">{cartonId}</span>
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              DAMAGE CLASSIFICATION
            </label>
            <div className="flex flex-col gap-1.5">
              {[
                'PUNCTURED POLYBAG / PACKAGING TEAR',
                'DIRT / SEWING OIL STAIN ON FABRIC',
                'BROKEN WAISTBAND ELASTIC SEAM',
                'MISMATCHED COLOR OR INCORRECT SIZE IN PACK',
                'CRUSHED MULTIPACK CARTON SLEEVE',
              ].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDamageType(type)}
                  className={`p-2.5 text-left border font-bold text-xs cursor-pointer ${
                    damageType === type
                      ? 'border-[#DC2626] bg-[#300C0C] text-[#DC2626]'
                      : 'border-[#334155] bg-[#051424] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              OBSERVATION REMARKS
            </label>
            <textarea
              rows={2}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#051424] border border-[#334155] text-[#F8FAFC] p-2.5 font-mono text-xs focus:outline-none focus:border-[#DC2626] resize-none"
            />
          </div>

          <div className="p-2.5 bg-[#1E293B] border border-[#334155] text-[#D97706] text-[11px] font-bold">
            ACTION: Pack will be ejected to Rework Line. Master carton counter will be preserved.
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
              className="h-10 bg-[#DC2626] hover:bg-red-700 text-white font-bold uppercase cursor-pointer tactile-button"
            >
              CONFIRM DEFECT &amp; REJECT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
