import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, TrendingUp, Layers, Check } from 'lucide-react';
import { SPKBatch } from '../../types';

interface CostBreakdownModalProps {
  batch: SPKBatch;
  currency: 'IDR' | 'USD';
  onClose: () => void;
  onResolve: (actionText: string) => void;
}

export const CostBreakdownModal: React.FC<CostBreakdownModalProps> = ({
  batch,
  currency,
  onClose,
  onResolve,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<string>(
    'Approve Overrun & Adjust Wholesale Price for Batch 2'
  );
  const [resolutionApplied, setResolutionApplied] = useState(false);

  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toFixed(2)}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const totalImpact = batch.deltaHpp * batch.targetQty;

  const handleApply = () => {
    setResolutionApplied(true);
    setTimeout(() => {
      onResolve(selectedResolution);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#CBD5E1] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-[#DC2626] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                  Cost Variance Breakdown: {batch.id}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-[#DC2626]">
                  +5.7% Cost Overrun
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                {batch.skuName} • Target Order: {batch.targetQty.toLocaleString('id-ID')} Pcs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Impact Banner */}
          <div className="p-4 bg-red-50/70 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-sm text-[#DC2626]">
                Kenaikan Harga Spandex Elastane (+6.2%) &amp; Scrap Re-sewing
              </div>
              <p className="text-[#0F172A]">
                Supplier benang Hyosung menaikkan harga elastane dari Rp 133.700/kg menjadi Rp 142.000/kg.
                Deviasi HPP per lembar adalah <strong className="text-[#DC2626]">+{formatMoney(batch.deltaHpp)} / pcs</strong>.
              </p>
            </div>
            <div className="shrink-0 bg-white p-2.5 rounded border border-red-200 text-right">
              <span className="text-[11px] text-[#64748B] block font-medium">Total Akumulasi Variance</span>
              <strong className="text-base font-bold text-[#DC2626] font-code-metric">
                +{formatMoney(totalImpact)}
              </strong>
            </div>
          </div>

          {/* BOM Variance Comparison Table */}
          <div>
            <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#004ac6]" />
              Detail Komponen BOM (Budgeted vs Actual Cost per Piece)
            </h4>

            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#f8fafc] border-b border-[#E2E8F0] text-[11px] uppercase text-[#64748B]">
                  <tr>
                    <th className="py-2.5 px-3">Komponen Biaya</th>
                    <th className="py-2.5 px-3">Spesifikasi Material / Operasi</th>
                    <th className="py-2.5 px-3 text-right">Target BOM</th>
                    <th className="py-2.5 px-3 text-right">Realisasi HPP</th>
                    <th className="py-2.5 px-3 text-right">Selisih Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-[#0F172A]">Kain Modal Cotton Elastane</td>
                    <td className="py-2 px-3 text-[#64748B]">Surged Spandex Yarn (180 gsm)</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(8330)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-semibold text-[#DC2626]">{formatMoney(8950)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-bold text-[#DC2626]">+{formatMoney(620)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-[#0F172A]">Karet Picot Elastis</td>
                    <td className="py-2 px-3 text-[#64748B]">8mm Scalloped Leg Openings</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(1210)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-semibold text-[#DC2626]">{formatMoney(1250)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-bold text-[#DC2626]">+{formatMoney(40)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-[#0F172A]">Tenaga Kerja Langsung (Sewing)</td>
                    <td className="py-2 px-3 text-[#64748B]">Line 2 Overlock + Re-work (SAM 3.2m)</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(3146)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-semibold text-[#DC2626]">{formatMoney(3286)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-bold text-[#DC2626]">+{formatMoney(140)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-[#0F172A]">Overhead Pabrik &amp; Listrik</td>
                    <td className="py-2 px-3 text-[#64748B]">Alokasi Mesin Sewing Line 2</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(1672)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-semibold text-[#DC2626]">{formatMoney(1722)}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-bold text-[#DC2626]">+{formatMoney(50)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-[#0F172A]">Label &amp; Polybag Pack</td>
                    <td className="py-2 px-3 text-[#64748B]">Barcode &amp; Outer master box</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(442)}</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(442)}</td>
                    <td className="py-2 px-3 text-right font-code-metric text-[#16A34A]">{formatMoney(0)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-[#f8fafc] font-semibold text-xs border-t border-[#E2E8F0]">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-[#0F172A]">Total HPP / Pcs</td>
                    <td className="py-2.5 px-3 text-right font-code-metric text-[#64748B]">{formatMoney(batch.estimasiHpp)}</td>
                    <td className="py-2.5 px-3 text-right font-code-metric text-[#DC2626]">{formatMoney(batch.realisasiHpp)}</td>
                    <td className="py-2.5 px-3 text-right font-code-metric text-[#DC2626]">+{formatMoney(batch.deltaHpp)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Supervisor & Finance Resolution Selector */}
          <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
            <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">
              Pilihan Tindakan Mitigasi &amp; Persetujuan Eksekutif
            </h4>

            <div className="space-y-2 text-xs">
              {[
                {
                  id: 'res-1',
                  title: 'Approve Overrun & Adjust Wholesale Price for Batch 2',
                  desc: 'Serap deviasi Rp 850/pc dari marjin kotor saat ini (29.2%), revisi harga B2B invoice batch berikutnya.',
                },
                {
                  id: 'res-2',
                  title: 'Re-negotiate Spandex Blend with Hyosung & Swap Yarn Spec',
                  desc: 'Ajukan pembelian volume 5 ton dengan lock harga Rp 135.000/kg untuk mengkompensasi kenaikan.',
                },
                {
                  id: 'res-3',
                  title: 'Optimasi SAM Sewing & Kurangi Scrap Toleransi Line 2',
                  desc: 'Ganti jarum mesin overlock ke Groz-Beckert 70/10 untuk mengeliminasi rework loncat benang.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedResolution === opt.title
                      ? 'bg-blue-50/60 border-[#004ac6] text-[#0F172A]'
                      : 'bg-white border-[#E2E8F0] text-[#545f73] hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    checked={selectedResolution === opt.title}
                    onChange={() => setSelectedResolution(opt.title)}
                    className="mt-0.5 text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <div>
                    <div className="font-semibold text-xs text-[#0F172A]">{opt.title}</div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#f8fafc] flex items-center justify-between">
          <span className="text-xs text-[#64748B]">
            Status: Menunggu Persetujuan Founder &amp; Supervisor Pabrik
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#545f73] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleApply}
              disabled={resolutionApplied}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] hover:bg-[#2563eb] rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {resolutionApplied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Tindakan Disetujui!</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span>Setujui Tindakan Mitigasi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
