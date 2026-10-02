import React from 'react';
import { Boxes, ArrowRight, CheckCircle2, Clock, AlertTriangle, Users, Scissors, Flame, Package } from 'lucide-react';
import { SPKBatch } from '../../types';

interface WipTrackingViewProps {
  batches: SPKBatch[];
  currency: 'IDR' | 'USD';
  onInspectBatch: (batch: SPKBatch) => void;
  onAdvanceBatch: (batchId: string) => void;
}

export const WipTrackingView: React.FC<WipTrackingViewProps> = ({
  batches,
  currency,
  onInspectBatch,
  onAdvanceBatch,
}) => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            WIP &amp; Production Floor Pipeline Tracking
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Pelacakan posisi bundle batch manufaktur secara real-time dari pemotongan CNC hingga pengemasan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#004ac6] text-xs font-semibold">
            Plant Sukabumi: 12 Lines Synchronized
          </span>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stage 1: Cutting */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#004ac6]" />
              <h3 className="font-headline font-bold text-xs text-[#0F172A] uppercase tracking-wide">
                1. Cutting Room
              </h3>
            </div>
            <span className="text-[10px] bg-green-50 text-[#16A34A] font-semibold px-1.5 py-0.5 rounded">
              100% Active
            </span>
          </div>

          <div className="space-y-2.5">
            {batches.map((b) => (
              <div
                key={b.id}
                onClick={() => onInspectBatch(b)}
                className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg hover:border-[#004ac6] transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#004ac6] font-code-metric">{b.id}</span>
                  <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Cut Complete
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#0F172A] truncate">{b.skuName}</div>
                <div className="text-[10px] text-[#64748B]">Scrap: {b.stages.cutting.scrapRate}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage 2: Sewing */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#2563eb]" />
              <h3 className="font-headline font-bold text-xs text-[#0F172A] uppercase tracking-wide">
                2. Sewing Lines
              </h3>
            </div>
            <span className="text-[10px] bg-blue-50 text-[#2563eb] font-semibold px-1.5 py-0.5 rounded">
              Assembly
            </span>
          </div>

          <div className="space-y-2.5">
            {batches.map((b) => (
              <div
                key={b.id}
                onClick={() => onInspectBatch(b)}
                className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                  b.flagged
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-[#f8fafc] border-[#E2E8F0] hover:border-[#004ac6]'
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#0F172A] font-code-metric">{b.id}</span>
                  <span className="font-code-metric font-semibold text-[#004ac6] text-[11px]">
                    {b.stages.sewing.progress}%
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#0F172A] truncate">{b.skuName}</div>
                <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${b.flagged ? 'bg-[#DC2626]' : 'bg-[#2563eb]'} h-full rounded-full`}
                    style={{ width: `${b.stages.sewing.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>{b.assignedLine}</span>
                  <span>SAM: {b.stages.sewing.samMinutes}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage 3: Bonding / Ultrasonic */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#D97706]" />
              <h3 className="font-headline font-bold text-xs text-[#0F172A] uppercase tracking-wide">
                3. Bonding &amp; Weld
              </h3>
            </div>
            <span className="text-[10px] bg-amber-50 text-[#D97706] font-semibold px-1.5 py-0.5 rounded">
              Seamless Heat
            </span>
          </div>

          <div className="space-y-2.5">
            {batches.map((b) => (
              <div
                key={b.id}
                onClick={() => onInspectBatch(b)}
                className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg hover:border-[#004ac6] transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#0F172A] font-code-metric">{b.id}</span>
                  <span className="text-[10px] text-[#64748B]">
                    {b.stages.bonding.status === 'n/a' ? 'N/A (Standard)' : `${b.stages.bonding.progress}%`}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#0F172A] truncate">{b.skuName}</div>
                {b.stages.bonding.status !== 'n/a' && (
                  <>
                    <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#D97706] h-full rounded-full"
                        style={{ width: `${b.stages.bonding.progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#64748B]">Temp: {b.stages.bonding.tempC}°C</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stage 4: Packing & Warehousing */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#16A34A]" />
              <h3 className="font-headline font-bold text-xs text-[#0F172A] uppercase tracking-wide">
                4. Packing &amp; QC
              </h3>
            </div>
            <span className="text-[10px] bg-green-50 text-[#16A34A] font-semibold px-1.5 py-0.5 rounded">
              Ready to Ship
            </span>
          </div>

          <div className="space-y-2.5">
            {batches.map((b) => (
              <div
                key={b.id}
                onClick={() => onInspectBatch(b)}
                className="p-3 bg-[#f8fafc] border border-[#E2E8F0] rounded-lg hover:border-[#004ac6] transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#0F172A] font-code-metric">{b.id}</span>
                  <span className="font-code-metric font-semibold text-[#16A34A] text-[11px]">
                    {b.stages.packing.progress}%
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#0F172A] truncate">{b.skuName}</div>
                <div className="w-full bg-[#e6e8ea] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#16A34A] h-full rounded-full"
                    style={{ width: `${b.stages.packing.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>Packed: {b.completedQty.toLocaleString()}</span>
                  <span>Target: {b.targetQty.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
