import React from 'react';
import { StationView } from '../types/mes';
import { useSession } from '../../../core/session';

interface SidebarProps {
  currentView: StationView;
  onSelectView: (view: StationView) => void;
  onReportIncident: () => void;
  onTerminalConfig: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onReportIncident,
  onTerminalConfig,
  onLogout,
}) => {
  const { user } = useSession();
  const allNavItems: { id: StationView; label: string; icon: string }[] = [
    { id: 'TELEMETRY', label: 'TELEMETRY', icon: 'precision_manufacturing' },
    { id: 'WIP_FLOW', label: 'WIP FLOW', icon: 'linear_scale' },
    { id: 'BUNDLE_QC', label: 'BUNDLE QC', icon: 'qr_code_scanner' },
    { id: 'PACKAGING_DISPATCH', label: 'PACKAGING & DISPATCH', icon: 'package_2' },
    { id: 'INVENTORY_OUT', label: 'INVENTORY OUT', icon: 'local_shipping' },
  ];
  // Staff Packing/Gudang hanya mengakses stasiun packing & stok keluar (FRD Role 05).
  const navItems = allNavItems.filter((item) => item.id === 'PACKAGING_DISPATCH' || item.id === 'INVENTORY_OUT');

  return (
    <aside className="hidden md:flex flex-col justify-between h-[calc(100vh-4rem)] w-60 lg:w-64 bg-[#0B0F17] border-r border-[#334155] p-3 lg:p-4 shrink-0 select-none">
      <div className="flex flex-col gap-3 lg:gap-4">
        {/* Station Metadata Header */}
        <div className="p-2.5 bg-[#111827] border border-[#334155]">
          <div className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
            TERMINAL IDENTITY
          </div>
          <div className="font-headline-sm font-bold text-[#F8FAFC] tracking-widest mt-0.5 text-sm uppercase">
            {user?.name ?? 'PACKING STATION'}
          </div>
          <div className="font-mono text-[11px] text-[#b4c5ff] mt-0.5 font-bold">
            ID: {user?.stationBadge ?? user?.id}
          </div>
        </div>

        {/* Navigation Stack */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 text-left font-mono text-[13px] uppercase transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#1E293B] text-[#b4c5ff] border-l-2 border-[#2563EB] font-bold'
                    : 'text-[#64748B] hover:text-[#d4e4fa] hover:bg-[#111827]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-lg"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rail Footer Section */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onReportIncident}
          className="w-full py-2 bg-[#300C0C] border border-[#DC2626] text-[#DC2626] font-mono text-[11px] uppercase tracking-wider hover:bg-[#DC2626] hover:text-white transition-all flex items-center justify-center gap-1.5 font-bold cursor-pointer tactile-button"
        >
          <span className="material-symbols-outlined text-sm">warning</span>
          <span>REPORT INCIDENT</span>
        </button>

        <div className="border-t border-[#334155] pt-2 flex flex-col gap-1">
          <button
            onClick={onTerminalConfig}
            className="flex items-center gap-2 text-[#64748B] hover:text-[#F8FAFC] px-3 py-1 font-mono text-xs uppercase cursor-pointer transition-colors text-left"
          >
            <span className="material-symbols-outlined text-base">terminal</span>
            <span>TERMINAL CONFIG</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-[#64748B] hover:text-[#DC2626] px-3 py-1 font-mono text-xs uppercase cursor-pointer transition-colors text-left"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>LOGOUT</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
