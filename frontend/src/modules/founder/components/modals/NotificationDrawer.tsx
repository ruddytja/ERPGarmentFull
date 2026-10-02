import React from 'react';
import { X, AlertTriangle, CheckCircle2, TrendingUp, Bell, Clock } from 'lucide-react';

interface NotificationDrawerProps {
  onClose: () => void;
  onSelectCostingAlert: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  onClose,
  onSelectCostingAlert,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl border-l border-[#CBD5E1] flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#f8fafc]">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#004ac6]" />
              <h3 className="font-headline font-bold text-sm text-[#0F172A]">
                Pemberitahuan Eksekutif &amp; Floor Alert
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#64748B] hover:text-[#0F172A] rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="p-4 space-y-3 overflow-y-auto">
            {/* Alert 1 */}
            <div
              onClick={() => {
                onSelectCostingAlert();
                onClose();
              }}
              className="p-3 bg-red-50/70 border border-red-200 rounded-lg space-y-1 cursor-pointer hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#DC2626]">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> HPP Variance Warning
                </span>
                <span className="text-[10px] text-[#64748B]">10m ago</span>
              </div>
              <p className="text-xs text-[#0F172A]">
                SPK-2026-10-095 (B2B Modal Lady Brief) mengalami deviasi HPP +5.7% akibat kenaikan benang spandex.
              </p>
              <span className="text-[11px] font-semibold text-[#004ac6] hover:underline block pt-1">
                Buka Tindakan Mitigasi &rarr;
              </span>
            </div>

            {/* Alert 2 */}
            <div className="p-3 bg-green-50/70 border border-green-200 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#16A34A]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Efisiensi Tercapai
                </span>
                <span className="text-[10px] text-[#64748B]">45m ago</span>
              </div>
              <p className="text-xs text-[#0F172A]">
                NAQALA Seamless Brief M-L hemat Rp 550/pc berkat optimalisasi marker nesting di Cutting Line 1.
              </p>
            </div>

            {/* Alert 3 */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#004ac6]">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Target Pendapatan Terlampaui
                </span>
                <span className="text-[10px] text-[#64748B]">2h ago</span>
              </div>
              <p className="text-xs text-[#0F172A]">
                Realisasi revenue bulan Okt 2026 mencapai Rp 1.485M (+12.4% di atas target anggaran).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#f8fafc] text-center">
          <span className="text-[11px] text-[#64748B]">
            Semua notifikasi terhubung langsung ke Sukabumi Plant Central MES
          </span>
        </div>
      </div>
    </div>
  );
};
