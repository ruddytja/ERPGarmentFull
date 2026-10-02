import React from 'react';
import { Cpu, Gauge, CheckCircle2, AlertTriangle, Clock, Wrench } from 'lucide-react';
import { INITIAL_MACHINE_LINES } from '../../data/initialData';

export const OeeMaintenanceView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            Overall Equipment Effectiveness (OEE) &amp; Plant Maintenance
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Telemetri mesin jahit industri Juki, Yamato, mesin bonding seamless Macpi, dan cutter otomatis Gerber
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-green-50 border border-green-200 text-[#16A34A] text-xs font-semibold">
            Plant OEE Target: &gt; 85.0% (Current: 86.8%)
          </span>
        </div>
      </div>

      {/* Top 3 OEE Factor Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wider block">
            1. Availability (Ketersediaan)
          </span>
          <div className="font-headline font-bold text-2xl text-[#0F172A] font-code-metric">
            92.0%
          </div>
          <p className="text-xs text-[#64748B]">
            Downtime tak terencana: 38 menit / shift (penggantian jarum &amp; spool benang).
          </p>
          <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#004ac6] h-full rounded-full" style={{ width: '92%' }} />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wider block">
            2. Performance (Kinerja Kecepatan)
          </span>
          <div className="font-headline font-bold text-2xl text-[#0F172A] font-code-metric">
            88.0%
          </div>
          <p className="text-xs text-[#64748B]">
            Rata-rata 4.200 RPM jahitan vs 4.800 RPM kapasitas teoretis.
          </p>
          <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#2563eb] h-full rounded-full" style={{ width: '88%' }} />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wider block">
            3. Quality Yield (Tingkat Mutu)
          </span>
          <div className="font-headline font-bold text-2xl text-[#16A34A] font-code-metric">
            96.5%
          </div>
          <p className="text-xs text-[#64748B]">
            96.5% produk lolos first-pass yield tanpa re-sewing atau perbaikan.
          </p>
          <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#16A34A] h-full rounded-full" style={{ width: '96.5%' }} />
          </div>
        </div>
      </div>

      {/* Machine Telemetry List */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-[#0F172A]">
          Status Operasional Lini Mesin Sukabumi Central Plant
        </h3>

        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#0F172A] text-white text-[11px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Kode &amp; Nama Mesin</th>
                <th className="py-2.5 px-3">Tipe &amp; Model</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">OEE Score</th>
                <th className="py-2.5 px-3 text-right">Output (Pcs/Jam)</th>
                <th className="py-2.5 px-3">Active SPK Batch</th>
                <th className="py-2.5 px-3">Service Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {INITIAL_MACHINE_LINES.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-semibold text-[#0F172A]">{m.name}</td>
                  <td className="py-3 px-3 text-[#64748B]">{m.machineModel}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        m.status === 'running'
                          ? 'bg-green-50 text-[#16A34A] border border-green-200'
                          : 'bg-amber-50 text-[#D97706] border border-amber-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'running' ? 'bg-[#16A34A]' : 'bg-[#D97706]'}`} />
                      {m.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-code-metric font-bold text-[#004ac6]">
                    {m.oee}%
                  </td>
                  <td className="py-3 px-3 text-right font-code-metric text-[#0F172A]">
                    {m.unitsPerHour} pcs/h
                  </td>
                  <td className="py-3 px-3 font-code-metric text-[#0F172A]">{m.activeSpk}</td>
                  <td className="py-3 px-3 text-[#64748B] font-code-metric">{m.lastService}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
