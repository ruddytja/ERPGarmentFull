import React from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { InspectionTable, DefectLogEntry, DefectDriver } from '../../types';

interface QualityQcViewProps {
  tables: InspectionTable[];
  logs: DefectLogEntry[];
  drivers: DefectDriver[];
  onOpenAudit: () => void;
}

export const QualityQcView: React.FC<QualityQcViewProps> = ({
  tables,
  logs,
  drivers,
  onOpenAudit,
}) => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            Quality &amp; Defect QC Analytics
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manajemen toleransi cacat produk (Max 2.0%), audit meja inspeksi, dan tindakan korektif preventif
          </p>
        </div>
        <button
          onClick={onOpenAudit}
          className="flex items-center gap-1.5 bg-[#004ac6] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#2563eb] transition-all cursor-pointer shadow-sm"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Buka Inspection Audit Dialog</span>
        </button>
      </div>

      {/* Meja QC Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`bg-white border rounded-xl p-4 shadow-sm space-y-2 transition-all ${
              t.status === 'warning'
                ? 'border-red-300 ring-1 ring-red-200'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-sm text-[#0F172A]">{t.name}</span>
              <span
                className={`font-code-metric font-bold text-xs px-2 py-0.5 rounded ${
                  t.passRate < 98 ? 'bg-red-100 text-[#DC2626]' : 'bg-green-100 text-[#16A34A]'
                }`}
              >
                {t.passRate}% Pass
              </span>
            </div>
            <div className="text-xs text-[#64748B]">
              Operator: <strong className="text-[#0F172A]">{t.inspectorName}</strong>
            </div>
            <div className="text-xs text-[#64748B]">
              Active SPK: <strong className="text-[#004ac6]">{t.activeBatch}</strong>
            </div>
            <div className="pt-2 border-t border-[#E2E8F0] grid grid-cols-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] block">Inspected</span>
                <strong className="font-code-metric text-[#0F172A]">{t.inspectedPcs}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Pass</span>
                <strong className="font-code-metric text-[#16A34A]">{t.passedPcs}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Defect</span>
                <strong className="font-code-metric text-[#DC2626]">{t.defectPcs}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Root Cause & Corrective Action Matrix */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-[#0F172A] pb-2 border-b border-[#E2E8F0]">
          Standard Operating Procedures (SOP) Mitigasi Defect Pakaian Dalam
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg space-y-1">
            <span className="font-semibold text-[#DC2626] block">1. Jahitan Lompat (Skipped Stitches) — 38%</span>
            <p className="text-[#0F172A]">
              Penyebab: Jarum tumpul atau jarum tidak cocok untuk kain lycra/spandex elastis tinggi.
            </p>
            <p className="text-[#16A34A] font-medium">
              SOP Korektif: Gunakan jarum ballpoint Groz-Beckert SAN-10 (70/10), periksa ketegangan loop benang setiap 500 pcs.
            </p>
          </div>

          <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg space-y-1">
            <span className="font-semibold text-[#D97706] block">2. Bonding Terlepas (Heat-Seal Delamination) — 26%</span>
            <p className="text-[#0F172A]">
              Penyebab: Suhu roller bonding drop di bawah 165°C atau tekanan pneumatic kurang dari 4.5 bar.
            </p>
            <p className="text-[#16A34A] font-medium">
              SOP Korektif: Kalibrasi suhu Macpi setiap awal shift, lakukan peel test 180° sebelum produksi massal.
            </p>
          </div>

          <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg space-y-1">
            <span className="font-semibold text-[#2563EB] block">3. Karet Melintir (Twisted Band) — 21%</span>
            <p className="text-[#0F172A]">
              Penyebab: Tensioner karet feeder tidak sejajar saat penjahitan overlock.
            </p>
            <p className="text-[#16A34A] font-medium">
              SOP Korektif: Kencangkan guide plate rol karet dan pastikan operator memposisikan waist rib tanpa stretching berlebih.
            </p>
          </div>

          <div className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg space-y-1">
            <span className="font-semibold text-[#64748B] block">4. Noda Minyak Pelumas — 15%</span>
            <p className="text-[#0F172A]">
              Penyebab: Pelumasan needle bar melebihi batas reservoir.
            </p>
            <p className="text-[#16A34A] font-medium">
              SOP Korektif: Lap needle bar sebelum shift, gunakan oil stain remover spray ramah lingkungan pada spotting table.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
