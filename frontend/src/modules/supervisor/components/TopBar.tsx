import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/audio';

interface TopBarProps {
  onOpenPrintModal: () => void;
  onOpenHaltModal: () => void;
  onOpenConfigModal: () => void;
  isLineHalted: boolean;
  selectedStation: string;
  onSelectStation: (station: string) => void;
  notificationCount: number;
  onToggleNotifications: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenPrintModal,
  onOpenHaltModal,
  onOpenConfigModal,
  isLineHalted,
  selectedStation,
  onSelectStation,
  notificationCount,
  onToggleNotifications,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('08:42:15 WIB');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds} WIB`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex justify-between items-center w-full px-6 h-16 bg-[#051424] border-b border-[#334155] shrink-0 sticky top-0 z-40">
      {/* Left Brand & Station Telemetry */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#b4c5ff] text-2xl" data-icon="precision_manufacturing">
            precision_manufacturing
          </span>
          <span className="font-condensed text-xl font-bold tracking-widest text-[#F8FAFC] uppercase">
            THEUNDERWEARSUPPLY // MES-OPS
          </span>
        </div>

        {/* Telemetry Navigation Status Links */}
        <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-[#334155]">
          {/* Station selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1E293B] border border-[#334155]">
            <span className="material-symbols-outlined text-[#64748B] text-sm" data-icon="factory">
              factory
            </span>
            <select
              value={selectedStation}
              onChange={(e) => {
                soundManager.playClick();
                onSelectStation(e.target.value);
              }}
              className="bg-transparent text-[#64748B] hover:text-[#F8FAFC] text-[11px] font-bold tracking-wider uppercase font-mono focus:outline-none cursor-pointer"
            >
              <option value="SEWING LINE 1" className="bg-[#111827] text-white">
                STATION: SEWING LINE 1
              </option>
              <option value="SEWING LINE 2" className="bg-[#111827] text-white">
                STATION: SEWING LINE 2
              </option>
              <option value="CUTTING BAY 3" className="bg-[#111827] text-white">
                STATION: CUTTING BAY 3
              </option>
            </select>
          </div>

          {/* Shift & Time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1E293B] border border-[#334155]">
            <span className="material-symbols-outlined text-[#64748B] text-sm" data-icon="schedule">
              schedule
            </span>
            <span className="text-[#64748B] font-mono text-[11px] font-bold tracking-wider uppercase">
              SHIFT 01 [07:00-15:30] · {currentTime}
            </span>
          </div>

          {/* System Online / Halted Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1E293B] border border-[#334155]">
            <span
              className={`w-2 h-2 inline-block ${
                isLineHalted ? 'bg-[#DC2626] animate-ping' : 'bg-[#16A34A] animate-pulse'
              }`}
            ></span>
            <span
              className={`border-b-2 font-mono text-[11px] font-bold tracking-wider uppercase pb-0.5 ${
                isLineHalted ? 'border-[#DC2626] text-[#ffb4ab]' : 'border-[#2563EB] text-[#F8FAFC]'
              }`}
            >
              {isLineHalted ? 'SYSTEM: EMERGENCY HALT' : 'SYSTEM: ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Trailing Profile & Actions */}
      <div className="flex items-center gap-4">
        {/* Supervisor Profile Chip */}
        <div className="hidden sm:flex items-center gap-2 bg-[#111827] border border-[#334155] px-3 py-1.5">
          <div className="w-7 h-7 bg-[#2563eb] text-[#eeefff] flex items-center justify-center font-bold text-xs uppercase font-mono">
            SPV
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-xs font-bold text-[#F8FAFC] leading-tight">Budi Hartono</span>
            <span className="font-mono text-[11px] text-[#64748B]">ID: SPV-7092 [SUPERVISOR]</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Print Bundle Tickets */}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenPrintModal();
            }}
            className="tactile-edge tactile-shadow bg-[#2563eb] hover:bg-[#1d4ed8] text-[#F8FAFC] px-3 py-2 border border-[#2563EB] flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" data-icon="qr_code_scanner">
              qr_code_scanner
            </span>
            <span>PRINT BUNDLE TICKETS</span>
          </button>

          {/* Halt Line */}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenHaltModal();
            }}
            className={`tactile-edge tactile-shadow border px-3 py-2 flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer ${
              isLineHalted
                ? 'bg-[#DC2626] text-white border-white animate-pulse'
                : 'bg-[#111827] hover:bg-[#1E293B] text-[#DC2626] border-[#DC2626]'
            }`}
          >
            <span className="material-symbols-outlined text-base" data-icon="warning">
              warning
            </span>
            <span>{isLineHalted ? 'RESUME LINE' : 'HALT LINE'}</span>
          </button>
        </div>

        {/* System Settings & Notifications */}
        <div className="flex items-center border-l border-[#334155] pl-2 gap-1">
          <button
            onClick={() => {
              soundManager.playClick();
              onToggleNotifications();
            }}
            className="w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-lg" data-icon="notifications">
              notifications
            </span>
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC2626]"></span>
            )}
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenConfigModal();
            }}
            className="w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition-colors cursor-pointer"
            title="Terminal Config"
          >
            <span className="material-symbols-outlined text-lg" data-icon="settings">
              settings
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
