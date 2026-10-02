import React from 'react';
import { CompletedBundleLog } from '../types';
import { playTactileClick } from '../utils/audio';

interface ThroughputTrayProps {
  completedLogs: CompletedBundleLog[];
  totalPcs: number;
  totalBundles: number;
  oeePercentage: number;
  onOpenReport: () => void;
  onSelectLogItem?: (log: CompletedBundleLog) => void;
}

export const ThroughputTray: React.FC<ThroughputTrayProps> = ({
  completedLogs,
  totalPcs,
  totalBundles,
  oeePercentage,
  onOpenReport,
  onSelectLogItem,
}) => {
  // Show last 3 completed bundles
  const displayedLogs = completedLogs.slice(0, 3);

  return (
    <footer className="h-28 bg-[#1E293B] border-t border-[#334155] px-5 py-2.5 flex items-center justify-between gap-4 shrink-0 z-20 select-none">
      {/* Shift Output Telemetry Badge */}
      <div
        onClick={() => {
          playTactileClick();
          onOpenReport();
        }}
        className="w-72 bg-[#27354A] hover:bg-[#323537] p-2.5 rounded border border-[#334155] flex flex-col justify-center cursor-pointer transition-all active:scale-[0.99] group"
        title="Klik untuk melihat Detail Analitik Shift & OEE Breakdown"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-[#94A3B8] font-semibold group-hover:text-[#F8FAFC]">
            Throughput Hari Ini
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30">
            OEE: {oeePercentage.toFixed(1)}%
          </span>
        </div>

        <div className="text-xl font-bold font-['Hanken_Grotesk'] text-[#F8FAFC] mt-0.5 flex items-baseline gap-1">
          <span>{totalPcs}</span>
          <span className="text-sm font-normal text-[#94A3B8]">Pcs</span>
          <span className="text-xs text-[#adc6ff] font-mono ml-1 font-bold">
            ({totalBundles} Bundle Selesai)
          </span>
        </div>

        <div className="w-full bg-[#191c1e] h-1.5 rounded-full overflow-hidden mt-1.5">
          <div
            className="bg-[#16A34A] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, oeePercentage)}%` }}
          ></div>
        </div>
      </div>

      {/* Completed Bundles Stream (3 Items as per specification) */}
      <div className="flex-1 grid grid-cols-3 gap-2.5 h-full">
        {displayedLogs.map((log) => (
          <div
            key={log.id}
            onClick={() => {
              if (onSelectLogItem) {
                playTactileClick();
                onSelectLogItem(log);
              }
            }}
            className="bg-[#27354A]/70 hover:bg-[#27354A] px-3 py-1.5 rounded border border-[#334155] flex flex-col justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-[#60A5FA]">
                {log.id}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-[#16A34A]/20 text-[#16A34A] font-bold">
                {log.completedTimeStr}
              </span>
            </div>

            <div className="text-sm text-[#F8FAFC] truncate font-medium">
              {log.operationStep}
            </div>

            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>
                {log.quantity} Pcs (Pass: {log.passCount})
              </span>
              <span className="text-white/80 font-mono">{log.operatorCode}</span>
            </div>
          </div>
        ))}

        {displayedLogs.length < 3 &&
          Array.from({ length: 3 - displayedLogs.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="bg-[#27354A]/30 px-3 py-1.5 rounded border border-[#334155]/50 flex items-center justify-center text-xs text-[#94A3B8]/60 border-dashed"
            >
              Slot Antrean Selesai
            </div>
          ))}
      </div>
    </footer>
  );
};
