import React from 'react';

interface TopBarProps {
  onScanMasterCarton: () => void;
  onPrintShippingLabels: () => void;
  onHaltStation: () => void;
  isStationHalted: boolean;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  unreadNotificationsCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onScanMasterCarton,
  onPrintShippingLabels,
  onHaltStation,
  isStationHalted,
  onOpenNotifications,
  onOpenSettings,
  unreadNotificationsCount,
}) => {
  return (
    <header className="flex justify-between items-center w-full px-4 lg:px-6 h-16 bg-[#051424] border-b border-[#334155] shrink-0 z-30 select-none">
      {/* Brand / Station Identification */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="font-headline-md font-bold tracking-widest text-[#F8FAFC] uppercase flex items-center gap-2 text-lg sm:text-xl">
          <span className="material-symbols-outlined text-[#2563eb]" style={{ fontVariationSettings: "'FILL' 1" }}>
            warehouse
          </span>
          <span className="truncate">THEUNDERWEARSUPPLY // MES-OPS</span>
        </div>

        <div className="hidden xl:flex items-center gap-4 pl-4 border-l border-[#334155]">
          <span className="border-b-2 border-[#2563EB] text-[#F8FAFC] font-mono text-[11px] tracking-wider uppercase pb-0.5 flex items-center gap-1.5 font-bold">
            <span className={`w-2 h-2 ${isStationHalted ? 'bg-[#DC2626]' : 'bg-[#16A34A]'} animate-pulse inline-block`}></span>
            {isStationHalted ? 'STATION HALTED // EMERGENCY STOP' : 'PACK & DISPATCH DOCK 02'}
          </span>
          <span className="text-[#64748B] font-mono text-[11px] tracking-wider uppercase">
            SHIFT 01 [07:00-15:30]
          </span>
          <span className="text-[#64748B] font-mono text-[11px] tracking-wider uppercase flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">badge</span>
            OP: Fajar Maulana [STF-PKG-401]
          </span>
          <span className={`px-2 py-0.5 border ${isStationHalted ? 'border-[#DC2626] bg-[#300C0C] text-[#DC2626]' : 'border-[#16A34A] bg-[#0F291E] text-[#16A34A]'} font-mono text-[11px] uppercase tracking-wider font-bold`}>
            {isStationHalted ? 'SYSTEM HALTED' : 'ONLINE // PRINTER READY'}
          </span>
        </div>
      </div>

      {/* Top Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onScanMasterCarton}
          className="px-2.5 sm:px-3 h-9 bg-[#1E293B] hover:bg-[#273647] text-[#F8FAFC] border border-[#334155] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-colors active:outline active:outline-2 active:outline-[#2563EB] tactile-button cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">barcode_scanner</span>
          <span className="hidden md:inline">SCAN MASTER CARTON</span>
          <span className="md:hidden">SCAN</span>
        </button>

        <button
          onClick={onPrintShippingLabels}
          className="px-2.5 sm:px-3 h-9 bg-[#2563EB] text-white border border-[#2563EB] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 hover:bg-blue-600 active:outline active:outline-2 active:outline-[#2563EB] tactile-button cursor-pointer"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            print
          </span>
          <span className="hidden md:inline">PRINT SHIPPING LABELS</span>
          <span className="md:hidden">PRINT</span>
        </button>

        <button
          onClick={onHaltStation}
          className={`px-2.5 sm:px-3 h-9 ${
            isStationHalted
              ? 'bg-[#16A34A] text-white border border-[#16A34A] hover:bg-green-600 animate-pulse'
              : 'bg-[#300C0C] text-[#DC2626] border border-[#DC2626] hover:bg-[#DC2626] hover:text-white'
          } font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer tactile-button`}
        >
          <span className="material-symbols-outlined text-base">
            {isStationHalted ? 'play_arrow' : 'emergency_home'}
          </span>
          <span>{isStationHalted ? 'RESUME STATION' : 'HALT STATION'}</span>
        </button>

        <div className="flex items-center border-l border-[#334155] pl-2 gap-1 text-[#64748B]">
          <button
            onClick={onOpenNotifications}
            title="Station Notifications"
            className="relative w-9 h-9 flex items-center justify-center hover:bg-[#1E293B] text-[#64748B] hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC2626] border border-[#051424]"></span>
            )}
          </button>
          <button
            onClick={onOpenSettings}
            title="Terminal Settings"
            className="w-9 h-9 flex items-center justify-center hover:bg-[#1E293B] text-[#64748B] hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
