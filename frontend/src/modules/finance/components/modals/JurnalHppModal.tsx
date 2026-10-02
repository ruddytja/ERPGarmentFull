import React from 'react';
import { SpkBatch, CurrencyType } from '../../types/costing';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface JurnalHppModalProps {
  batch: SpkBatch | null;
  onClose: () => void;
  currency: CurrencyType;
  onToggleLock: (id: string) => void;
}

export const JurnalHppModal: React.FC<JurnalHppModalProps> = ({
  batch,
  onClose,
  currency,
  onToggleLock,
}) => {
  if (!batch) return null;

  const totalBomCost = batch.bomHppPerPc * batch.targetQty;
  const totalRealCost = batch.totalRealHppPerPc * batch.targetQty;
  const netVarianceTotal = totalRealCost - totalBomCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[24px]">receipt_long</span>
            <div>
              <h2 className="text-[20px] font-bold text-[#0F172A]">
                Jurnal Rekonsiliasi HPP &amp; Ledger SPK
              </h2>
              <span className="text-[12px] text-[#64748B] font-code-metric">
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

        <div className="mt-4 space-y-4">
          {/* Top Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#f2f4f6] rounded-xl border border-[#E2E8F0] text-[12px]">
            <div>
              <span className="text-[#64748B] block">Total Kuantitas</span>
              <strong className="text-[#0F172A] text-[14px] font-code-metric">
                {formatNumber(batch.targetQty)} pcs ({batch.bundles} Bundles)
              </strong>
            </div>
            <div>
              <span className="text-[#64748B] block">BOM Budget</span>
              <strong className="text-[#0F172A] text-[14px] font-code-metric">
                {formatCurrency(totalBomCost, currency)}
              </strong>
            </div>
            <div>
              <span className="text-[#64748B] block">Realisasi Lapangan</span>
              <strong
                className={`text-[14px] font-code-metric ${
                  batch.variancePct > 5
                    ? 'text-[#ba1a1a]'
                    : batch.variancePct < 0
                    ? 'text-[#16A34A]'
                    : 'text-[#0F172A]'
                }`}
              >
                {formatCurrency(totalRealCost, currency)}
              </strong>
            </div>
            <div>
              <span className="text-[#64748B] block">Net Variance</span>
              <strong
                className={`text-[14px] font-code-metric ${
                  netVarianceTotal > 0 ? 'text-[#ba1a1a]' : 'text-[#16A34A]'
                }`}
              >
                {formatCurrency(netVarianceTotal, currency)} ({batch.variancePct}%)
              </strong>
            </div>
          </div>

          {/* Technical Manufacturing Specifications */}
          <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
            <div>
              <span className="text-[#64748B] block">Spesifikasi Kain:</span>
              <span className="text-[#0F172A] font-semibold">{batch.fabricType}</span>
            </div>
            <div>
              <span className="text-[#64748B] block">Jalur Alokasi Mesin:</span>
              <span className="text-[#0F172A] font-semibold">{batch.productionLine}</span>
            </div>
            <div>
              <span className="text-[#64748B] block">Tingkat Lolos QC (FPY):</span>
              <span className="text-[#16A34A] font-bold font-code-metric">
                {batch.qcPassRate}% Lulus Barcode Bundle
              </span>
            </div>
          </div>

          {/* Accounting Ledger Debit/Credit Entries */}
          <div>
            <h3 className="text-[13px] font-bold text-[#0F172A] mb-2 uppercase tracking-wide">
              Ayat Jurnal Pembebanan Biaya Produksi (Job Order Costing)
            </h3>
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#1E293B] text-[#F8FAFC] font-code-metric">
                  <tr>
                    <th className="py-2.5 px-3">Kode Akun &amp; Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Debit</th>
                    <th className="py-2.5 px-3 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] font-code-metric">
                  {/* Raw Material */}
                  <tr>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-[#0F172A]">
                        1301 - Barang Dalam Proses (BDP) - Bahan Baku Kain &amp; Spandex
                      </span>
                      <span className="block text-[11px] text-[#64748B]">
                        Alokasi konsumsi kain modal &amp; elastane 40D untuk {formatNumber(batch.targetQty)} pcs
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realMaterialPerPc * batch.targetQty, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-8">
                      <span className="text-[#545f73]">
                        1105 - Persediaan Bahan Baku Utama (Gudang Kain Sukabumi)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realMaterialPerPc * batch.targetQty, currency)}
                    </td>
                  </tr>

                  {/* Labor */}
                  <tr className="bg-[#f2f4f6]/50">
                    <td className="py-2 px-3">
                      <span className="font-semibold text-[#0F172A]">
                        1302 - Barang Dalam Proses (BDP) - Tenaga Kerja Langsung (Piece-Rate)
                      </span>
                      <span className="block text-[11px] text-[#64748B]">
                        Tiket barcode operator sewing, cutting, &amp; bonding selesai QC
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realLaborPerPc * batch.targetQty, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                  </tr>
                  <tr className="bg-[#f2f4f6]/50">
                    <td className="py-2 px-3 pl-8">
                      <span className="text-[#545f73]">
                        2104 - Beban Akrual Upah Borongan Operator Pabrik
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realLaborPerPc * batch.targetQty, currency)}
                    </td>
                  </tr>

                  {/* Overhead */}
                  <tr>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-[#0F172A]">
                        1303 - Barang Dalam Proses (BDP) - Overhead Pabrik Dibebankan
                      </span>
                      <span className="block text-[11px] text-[#64748B]">
                        Daya listrik Santoni, boiler, adhesive tape Bemis, &amp; jarum
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realOverheadPerPc * batch.targetQty, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 pl-8">
                      <span className="text-[#545f73]">5109 - Overhead Pabrik Dibebankan (Applied)</span>
                    </td>
                    <td className="py-2 px-3 text-right text-[#64748B]">-</td>
                    <td className="py-2 px-3 text-right font-bold text-[#0F172A]">
                      {formatCurrency(batch.realOverheadPerPc * batch.targetQty, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance Explanation note */}
          <div className="p-3 bg-[#f2f4f6] rounded-xl text-[12px]">
            <span className="font-bold text-[#0F172A] block mb-1">Catatan Auditor Biaya:</span>
            <p className="text-[#545f73]">{batch.varianceCause}</p>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
            <button
              onClick={() => onToggleLock(batch.id)}
              className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                batch.isLocked
                  ? 'border-[#004ac6] bg-[#dbe1ff] text-[#004ac6]'
                  : 'border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {batch.isLocked ? 'lock' : 'lock_open'}
              </span>
              <span>{batch.isLocked ? 'SPK Terkunci (Locked)' : 'Kunci Biaya SPK Ini'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#004ac6] text-white text-[13px] font-semibold hover:bg-[#0053db] cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
