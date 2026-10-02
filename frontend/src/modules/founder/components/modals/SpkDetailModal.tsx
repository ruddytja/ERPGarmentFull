import React from 'react';
import { X, Tag, Calendar, Layers, Activity, CheckCircle2, Clock } from 'lucide-react';
import { SPKBatch } from '../../types';

interface SpkDetailModalProps {
  batch: SPKBatch;
  currency: 'IDR' | 'USD';
  onClose: () => void;
}

export const SpkDetailModal: React.FC<SpkDetailModalProps> = ({
  batch,
  currency,
  onClose,
}) => {
  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toFixed(2)}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const progressPct = Math.round((batch.completedQty / batch.targetQty) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#CBD5E1] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center">
              <Tag className="w-5 h-5 text-[#004ac6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                  Batch Passport: {batch.id}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-[#004ac6]">
                  {batch.brand}
                </span>
              </div>
              <p className="text-xs text-[#64748B]">{batch.skuName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Key Metrics Header Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg">
              <span className="text-[#64748B] block text-[11px]">Target Quantity</span>
              <strong className="text-sm font-code-metric text-[#0F172A]">
                {batch.targetQty.toLocaleString('id-ID')} Pcs
              </strong>
            </div>

            <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg">
              <span className="text-[#64748B] block text-[11px]">Completed / Progress</span>
              <strong className="text-sm font-code-metric text-[#16A34A]">
                {batch.completedQty.toLocaleString('id-ID')} ({progressPct}%)
              </strong>
            </div>

            <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg">
              <span className="text-[#64748B] block text-[11px]">Realisasi HPP</span>
              <strong className="text-sm font-code-metric text-[#0F172A]">
                {formatMoney(batch.realisasiHpp)}
              </strong>
            </div>

            <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg">
              <span className="text-[#64748B] block text-[11px]">Margin Kontribusi</span>
              <strong className="text-sm font-code-metric text-[#004ac6]">
                +{batch.marginKontribusi}%
              </strong>
            </div>
          </div>

          {/* Line Floor Routing & Stages */}
          <div>
            <h4 className="font-semibold text-xs text-[#0F172A] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#004ac6]" />
              Status Aliran Produksi (WIP Tracking)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-lg border bg-[#f8fafc] border-[#E2E8F0]">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                  <span>1. Cutting Room</span>
                  {batch.stages.cutting.status === 'done' ? (
                    <span className="text-[#16a34a] flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> 100%</span>
                  ) : (
                    <span className="text-[#2563eb]">{batch.stages.cutting.progress}%</span>
                  )}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1">
                  Scrap Rate: {batch.stages.cutting.scrapRate}%
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-[#f8fafc] border-[#E2E8F0]">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                  <span>2. Sewing Floor</span>
                  {batch.stages.sewing.status === 'done' ? (
                    <span className="text-[#16a34a] flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> 100%</span>
                  ) : (
                    <span className="text-[#2563eb]">{batch.stages.sewing.progress}%</span>
                  )}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1">
                  SAM: {batch.stages.sewing.samMinutes} mins
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-[#f8fafc] border-[#E2E8F0]">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                  <span>3. Bonding Unit</span>
                  {batch.stages.bonding.status === 'n/a' ? (
                    <span className="text-[#64748B]">N/A</span>
                  ) : batch.stages.bonding.status === 'done' ? (
                    <span className="text-[#16a34a] flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> 100%</span>
                  ) : (
                    <span className="text-[#2563eb]">{batch.stages.bonding.progress}%</span>
                  )}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1">
                  {batch.stages.bonding.tempC > 0 ? `Suhu: ${batch.stages.bonding.tempC}°C` : 'Non-seamless'}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-[#f8fafc] border-[#E2E8F0]">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                  <span>4. Packing &amp; QC</span>
                  {batch.stages.packing.status === 'done' ? (
                    <span className="text-[#16a34a] flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> 100%</span>
                  ) : (
                    <span className="text-[#2563eb]">{batch.stages.packing.progress}%</span>
                  )}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1">
                  Defect Rate: {batch.stages.packing.defectRate}%
                </div>
              </div>
            </div>
          </div>

          {/* BOM Breakdown List */}
          <div>
            <h4 className="font-semibold text-xs text-[#0F172A] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#004ac6]" />
              Komponen Bill of Materials (BOM)
            </h4>

            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#f8fafc] border-b border-[#E2E8F0] text-[11px] text-[#64748B]">
                  <tr>
                    <th className="py-2 px-3">Komponen Material / Proses</th>
                    <th className="py-2 px-3">Spesifikasi</th>
                    <th className="py-2 px-3 text-right">Biaya / Pc</th>
                    <th className="py-2 px-3 text-right">Porsi BOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {batch.bom.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-[#0F172A]">{item.name}</td>
                      <td className="py-2 px-3 text-[#64748B]">{item.spec}</td>
                      <td className="py-2 px-3 text-right font-code-metric font-semibold text-[#0F172A]">
                        {formatMoney(item.costPerPc)}
                      </td>
                      <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">
                        {item.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#f8fafc] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Calendar className="w-4 h-4" />
            <span>Target Pengiriman: {batch.deliveryDate}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
