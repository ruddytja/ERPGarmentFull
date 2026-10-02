import React from 'react';
import { soundManager } from '../utils/audio';
import { useSession } from '../../../core/session';

export type NavTab = 'TELEMETRY' | 'WIP FLOW' | 'DOWNTIME' | 'BUNDLE QC';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenReportIncident: () => void;
  onOpenTerminalConfig: () => void;
  onLogout: () => void;
  activeDowntimeCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenReportIncident,
  onOpenTerminalConfig,
  onLogout,
  activeDowntimeCount,
}) => {
  const { user } = useSession();
  const tabs: { id: NavTab; label: string; icon: string; badge?: string }[] = [
    { id: 'TELEMETRY', label: 'TELEMETRY', icon: 'precision_manufacturing' },
    { id: 'WIP FLOW', label: 'WIP FLOW', icon: 'linear_scale' },
    {
      id: 'DOWNTIME',
      label: 'DOWNTIME',
      icon: 'warning',
      badge: activeDowntimeCount > 0 ? `${activeDowntimeCount} ISSUE` : undefined,
    },
    { id: 'BUNDLE QC', label: 'BUNDLE QC', icon: 'qr_code_scanner' },
  ];

  return (
    <aside className="flex flex-col justify-between h-[calc(100vh-4rem)] w-64 bg-[#0B0F17] border-r border-[#334155] p-4 shrink-0">
      <div className="flex flex-col gap-4">
        {/* Station Identity Header */}
        <div className="p-2 bg-[#111827] border border-[#334155]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-[#16A34A]"></span>
            <span className="font-condensed text-base font-bold text-[#F8FAFC] tracking-widest uppercase">
              {user?.name ?? 'SUPERVISOR'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider block">
            ID: {user?.id} · {user?.department}
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundManager.playClick();
                  onSelectTab(tab.id);
                }}
                className={`flex items-center justify-between px-4 py-2 font-mono text-sm uppercase transition-colors cursor-pointer w-full text-left ${
                  isActive
                    ? 'bg-[#1E293B] text-[#b4c5ff] border-l-2 border-[#2563EB] font-bold'
                    : 'text-[#64748B] hover:text-[#d4e4fa] hover:bg-[#111827]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`material-symbols-outlined text-xl ${
                      tab.id === 'DOWNTIME' && activeDowntimeCount > 0 ? 'text-[#D97706]' : ''
                    }`}
                    data-icon={tab.icon}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 bg-[#300C0C] border border-[#DC2626] text-[#ffb4ab] text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rail CTA & Footer Tabs */}
      <div className="flex flex-col gap-4">
        {/* REPORT INCIDENT Action */}
        <button
          onClick={() => {
            soundManager.playHazardAlarm();
            onOpenReportIncident();
          }}
          className="tactile-edge tactile-shadow w-full py-3 bg-[#DC2626] text-[#F8FAFC] font-condensed text-base uppercase tracking-wider font-bold border border-[#DC2626] flex items-center justify-center gap-2 hover:bg-red-700 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg" data-icon="warning">
            warning
          </span>
          <span>REPORT INCIDENT</span>
        </button>

        {/* Bottom Utility Links */}
        <div className="border-t border-[#334155] pt-2 flex flex-col gap-1">
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenTerminalConfig();
            }}
            className="flex items-center gap-2 text-[#64748B] hover:text-[#d4e4fa] px-4 py-2 font-mono text-xs uppercase transition-colors w-full text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" data-icon="terminal">
              terminal
            </span>
            <span>TERMINAL CONFIG</span>
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              onLogout();
            }}
            className="flex items-center gap-2 text-[#64748B] hover:text-[#DC2626] px-4 py-2 font-mono text-xs uppercase transition-colors w-full text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" data-icon="logout">
              logout
            </span>
            <span>LOGOUT</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
