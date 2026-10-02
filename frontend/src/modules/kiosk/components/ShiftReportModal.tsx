import React from 'react';
import { CompletedBundleLog } from '../types';
import { playTactileClick } from '../utils/audio';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedLogs: CompletedBundleLog[];
  totalPcs: number;
  totalBundles: number;
  oee: number;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  completedLogs,
  totalPcs,
  totalBundles,
  oee,
}) => {
  if (!isOpen) return null;

  // Breakdown metrics
  const availability = 98.1;
  const performance = 98.4;
  const quality = 99.8;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="bg-[#1E293B] border border-[#334155] w-full max-w-3xl rounded p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-[#16A34A]">
              monitoring
            </span>
            <div>
              <h3 className="text-xl font-bold text-white font-['Hanken_Grotesk']">
                Shift Telemetry &amp; OEE Analytics // Station-04
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Lini 02 Sewing - Shift A (07:00 - 15:30 WIB)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white p-2"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* OEE Metric Scoreboard */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#27354A] p-3 rounded border border-[#334155] text-center">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              OVERALL OEE
            </span>
            <span className="text-3xl font-extrabold text-[#16A34A] font-mono mt-1 block">
              {oee.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[#16A34A] font-bold">
              Class World Benchmark
            </span>
          </div>

          <div className="bg-[#27354A] p-3 rounded border border-[#334155] text-center">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Availability
            </span>
            <span className="text-2xl font-bold text-[#F8FAFC] font-mono mt-1 block">
              {availability}%
            </span>
            <span className="text-[10px] text-[#94A3B8]">Planned Uptime</span>
          </div>

          <div className="bg-[#27354A] p-3 rounded border border-[#334155] text-center">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Performance
            </span>
            <span className="text-2xl font-bold text-[#F8FAFC] font-mono mt-1 block">
              {performance}%
            </span>
            <span className="text-[10px] text-[#94A3B8]">Cycle Pace vs SAM</span>
          </div>

          <div className="bg-[#27354A] p-3 rounded border border-[#334155] text-center">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Quality Rate
            </span>
            <span className="text-2xl font-bold text-[#F8FAFC] font-mono mt-1 block">
              {quality}%
            </span>
            <span className="text-[10px] text-[#94A3B8]">First-Pass Yield</span>
          </div>
        </div>

        {/* Shift Volume Progress Bar */}
        <div className="bg-[#27354A] p-4 rounded border border-[#334155]">
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
            <span className="text-[#94A3B8] uppercase">Target Output Shift A</span>
            <span className="text-white font-mono">
              {totalPcs} / 300 Pcs (Target Harian: 96%)
            </span>
          </div>
          <div className="w-full bg-[#191c1e] h-3 rounded-full overflow-hidden">
            <div
              className="bg-[#16A34A] h-full rounded-full transition-all duration-500"
              style={{ width: `${(totalPcs / 300) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1.5">
            <span>Total Bundle: {totalBundles} Selesai</span>
            <span>Rata-rata Waktu / Bundle: 16.8 menit</span>
          </div>
        </div>

        {/* Historical Bundle Log Table */}
        <div>
          <span className="text-xs text-[#94A3B8] uppercase font-bold block mb-2">
            Riwayat Bundle Selesai (Shift Hari Ini)
          </span>
          <div className="border border-[#334155] rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#27354A] text-[#94A3B8] border-b border-[#334155] font-semibold uppercase">
                <tr>
                  <th className="p-2.5">Bundle ID</th>
                  <th className="p-2.5">Waktu Selesai</th>
                  <th className="p-2.5">Operasi</th>
                  <th className="p-2.5">Qty / Pass</th>
                  <th className="p-2.5">Siklus</th>
                  <th className="p-2.5">Operator</th>
                  <th className="p-2.5 text-right">Efisiensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155] bg-[#1E293B]">
                {completedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#27354A]/50">
                    <td className="p-2.5 font-mono font-bold text-[#60A5FA]">
                      {log.id}
                    </td>
                    <td className="p-2.5 text-[#F8FAFC]">{log.completedTimeStr}</td>
                    <td className="p-2.5 text-[#94A3B8]">{log.operationStep}</td>
                    <td className="p-2.5 text-white font-mono">
                      {log.quantity} ({log.passCount})
                    </td>
                    <td className="p-2.5 text-[#94A3B8] font-mono">
                      {log.cycleTimeMinutes}m
                    </td>
                    <td className="p-2.5 text-white/80 font-mono text-[11px]">
                      {log.operatorCode}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#16A34A]">
                      {log.efficiency.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#334155]">
          <span className="text-[11px] text-[#94A3B8]">
            Sistem Telemetry terhubung dengan ERP Pabrik Tekstil // Versi 4.2.1
          </span>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="h-10 px-5 rounded bg-[#27354A] hover:bg-[#323537] text-white font-bold text-xs border border-[#334155]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
