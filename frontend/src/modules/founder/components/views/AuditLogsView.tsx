import React from 'react';
import { ShieldCheck, Clock, User, FileText, CheckCircle2 } from 'lucide-react';

interface AuditLog {
  id: string;
  time: string;
  user: string;
  role: string;
  action: string;
  details: string;
  status: 'success' | 'warning' | 'info';
}

const AUDIT_LOGS: AuditLog[] = [
  { id: 'AUD-991', time: '14:48:12 WIB', user: 'Founder & CEO', role: 'Executive', action: 'EXPORT_STATEMENT', details: 'Ekspor laporan keuangan bulan Oktober 2026 format CSV', status: 'success' },
  { id: 'AUD-990', time: '14:20:05 WIB', user: 'Supervisor Line 2', role: 'Floor Manager', action: 'LOG_DEFECT_SPIKE', details: 'Input temuan 12 pcs loncat jahitan pada batch SPK-2026-10-095', status: 'warning' },
  { id: 'AUD-989', time: '13:15:30 WIB', user: 'Finance Lead', role: 'Controller', action: 'BOM_VARIANCE_FLAG', details: 'Flagged kenaikan benang spandex elastane (+6.2%) dari Hyosung', status: 'warning' },
  { id: 'AUD-988', time: '11:00:12 WIB', user: 'Production Planner', role: 'PPIC Lead', action: 'SPK_CREATE', details: 'Penerbitan Surat Perintah Kerja SPK-2026-10-101 (NAQALA Sport)', status: 'info' },
  { id: 'AUD-987', time: '09:30:45 WIB', user: 'MES System Daemon', role: 'Automated', action: 'PLANT_SYNC_HEARTBEAT', details: 'Sinkronisasi 12 Sewing Lines & 2 Ultrasonic Bays Sukabumi Plant', status: 'success' },
];

export const AuditLogsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            Security &amp; Operational Audit Trail
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Catatan log aktivitas eksekutif, supervisor lantai jahit, dan pembaruan sistem tanpa modifikasi (Immutable)
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden text-xs">
        <table className="w-full text-left">
          <thead className="bg-[#0F172A] text-white text-[11px] uppercase">
            <tr>
              <th className="py-2.5 px-4">Log ID &amp; Waktu</th>
              <th className="py-2.5 px-4">Pengguna &amp; Peran</th>
              <th className="py-2.5 px-4">Aksi Sistem</th>
              <th className="py-2.5 px-4">Rincian Aktivitas</th>
              <th className="py-2.5 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {AUDIT_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-code-metric text-[#64748B]">
                  <strong className="text-[#0F172A] block">{log.id}</strong>
                  {log.time}
                </td>
                <td className="py-3 px-4">
                  <strong className="text-[#0F172A] block">{log.user}</strong>
                  <span className="text-[11px] text-[#64748B]">{log.role}</span>
                </td>
                <td className="py-3 px-4 font-code-metric font-semibold text-[#004ac6]">
                  {log.action}
                </td>
                <td className="py-3 px-4 text-[#0F172A]">
                  {log.details}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                      log.status === 'success'
                        ? 'bg-green-50 text-[#16A34A]'
                        : log.status === 'warning'
                        ? 'bg-amber-50 text-[#D97706]'
                        : 'bg-blue-50 text-[#004ac6]'
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
