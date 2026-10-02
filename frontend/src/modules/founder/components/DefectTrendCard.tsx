import React from 'react';
import { ChevronRight } from 'lucide-react';
import { DefectDriver } from '../types';

interface DefectTrendCardProps {
  drivers: DefectDriver[];
  onOpenAudit: () => void;
  onDriverClick?: (driver: DefectDriver) => void;
}

export const DefectTrendCard: React.FC<DefectTrendCardProps> = ({
  drivers,
  onOpenAudit,
  onDriverClick,
}) => {
  const bars = [
    { label: 'D1-5: 1.55%', height: '45%', isSpike: false },
    { label: 'D6-10: 1.72%', height: '52%', isSpike: false },
    { label: 'D11-15: 1.88%', height: '60%', isSpike: false },
    { label: 'D16-20: 2.15% (Spike Alert)', height: '68%', isSpike: true },
    { label: 'D21-25: 1.60%', height: '48%', isSpike: false },
    { label: 'D26-28: 1.35%', height: '38%', isSpike: false },
    { label: 'Hari Ini: 1.21%', height: '32%', isToday: true },
  ];

  return (
    <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="font-headline text-[#0F172A] font-bold text-lg tracking-tight">
              Defect Rate Trend (30 Hari)
            </h2>
            <p className="text-xs text-[#64748B]">Threshold toleransi QC: max 2.0%</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#64748B] block">Rata-rata Terkini</span>
            <span className="font-headline font-bold text-[#16A34A] text-xl font-code-metric">
              1.42%
            </span>
          </div>
        </div>

        {/* Trajectory Visualizer */}
        <div className="pt-4">
          <div className="relative h-28 w-full bg-[#f2f4f6] rounded-lg p-2 flex flex-col justify-end overflow-hidden">
            {/* Tolerance Line at 2.0% */}
            <div className="absolute inset-x-0 top-7 border-b border-dashed border-[#dc2626] flex items-center justify-between px-2 text-[10px] text-[#dc2626] font-semibold z-20">
              <span>Batas Toleransi (2.00%)</span>
              <span>QC Limit Flag</span>
            </div>

            {/* Trend Bars */}
            <div className="flex items-end justify-between h-20 gap-1.5 z-10 pt-4">
              {bars.map((b, i) => (
                <div
                  key={i}
                  className={`w-full rounded-t transition-all duration-300 relative group cursor-pointer ${
                    b.isSpike 
                      ? 'bg-red-500/70 hover:bg-red-600' 
                      : b.isToday 
                      ? 'bg-[#004ac6] hover:bg-[#2563eb]' 
                      : 'bg-[#b4c5ff] hover:bg-[#004ac6]'
                  }`}
                  style={{ height: b.height }}
                  title={b.label}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none transition-opacity z-30 font-code-metric">
                    {b.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between text-[11px] font-code-metric text-[#64748B] mt-1 px-1">
            <span>1 Okt</span>
            <span>8 Okt</span>
            <span>15 Okt</span>
            <span>22 Okt</span>
            <span>Hari Ini (Okt 26)</span>
          </div>
        </div>

        {/* Top Defect Drivers */}
        <div className="mt-5 space-y-2.5">
          <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide block">
            Top Defect Drivers (Root-Cause Distribution)
          </span>

          {drivers.map((driver) => (
            <div
              key={driver.id}
              onClick={() => onDriverClick && onDriverClick(driver)}
              className="space-y-1 p-1 -mx-1 rounded hover:bg-[#f7f9fb] transition-colors cursor-pointer"
            >
              <div className="flex justify-between text-xs">
                <span className="text-[#191c1e] font-medium flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${driver.dotColor}`} />
                  {driver.name} <span className="text-[#64748B] font-normal">({driver.subname})</span>
                </span>
                <span className="font-code-metric font-semibold text-[#0F172A]">
                  {driver.percentage}%{' '}
                  <span className="text-[#64748B] font-normal">({driver.pcsCount} pcs)</span>
                </span>
              </div>
              <div className="w-full bg-[#e6e8ea] h-2 rounded-full overflow-hidden">
                <div
                  className={`${driver.barColor} h-full rounded-full transition-all duration-300`}
                  style={{ width: `${driver.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QC Operator Summary Footer */}
      <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
        <span>Stasiun QC Aktif: 6 Inspeksi Meja</span>
        <button
          onClick={onOpenAudit}
          className="text-[#004ac6] font-semibold flex items-center hover:underline cursor-pointer"
        >
          <span>Buka Inspection Audit</span>
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
