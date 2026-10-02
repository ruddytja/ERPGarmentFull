import React from 'react';
import { useSession } from '../../../core/session';

export type ActiveScreen =
  | 'costing'
  | 'dashboard'
  | 'wip'
  | 'qc'
  | 'oee'
  | 'reports'
  | 'settings'
  | 'audit';

interface SidebarProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onNavigate,
}) => {
  const { user, logout } = useSession();
  const initials = (user?.name || 'FN').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-64 px-4 py-6 border-r border-[#E2E8F0] bg-white flex flex-col justify-between select-none">
      {/* Top Brand & Navigation */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-[#2563eb] text-white flex items-center justify-center font-bold text-[20px] shadow-sm">
            <span className="material-symbols-outlined text-[20px]">precision_manufacturing</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[#0F172A] tracking-tight leading-tight text-[15px]">
              THEUNDERWEARSUPPLY
            </span>
            <span className="text-[12px] text-[#64748B]">Executive Suite</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-col gap-1">
          {/* 1. Dashboard */}
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'dashboard'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span className="text-[14px]">Dashboard</span>
          </button>

          {/* 2. HPP & Cost Control (Primary) */}
          <button
            onClick={() => onNavigate('costing')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'costing'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeScreen === 'costing' ? "'FILL' 1" : "'FILL' 0" }}
            >
              payments
            </span>
            <span className="text-[14px]">HPP &amp; Cost Control</span>
          </button>

          {/* 3. WIP & SPK Tracking */}
          <button
            onClick={() => onNavigate('wip')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'wip'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            <span className="text-[14px]">WIP &amp; SPK Tracking</span>
          </button>

          {/* 4. Quality & Defect QC */}
          <button
            onClick={() => onNavigate('qc')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'qc'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">fact_check</span>
            <span className="text-[14px]">Quality &amp; Defect QC</span>
          </button>

          {/* 5. OEE & Maintenance */}
          <button
            onClick={() => onNavigate('oee')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'oee'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">precision_manufacturing</span>
            <span className="text-[14px]">OEE &amp; Maintenance</span>
          </button>

          {/* 6. Executive Reports */}
          <button
            onClick={() => onNavigate('reports')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
              activeScreen === 'reports'
                ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            <span className="text-[14px]">Executive Reports</span>
          </button>
        </nav>
      </div>

      {/* Bottom / Footer Navigation */}
      <div className="flex flex-col gap-1 pt-4 border-t border-[#E2E8F0]">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
            activeScreen === 'settings'
              ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
              : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-[14px]">System Settings</span>
        </button>
        <button
          onClick={() => onNavigate('audit')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer ${
            activeScreen === 'audit'
              ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
              : 'text-[#545f73] hover:text-[#191c1e] font-medium hover:bg-[#f2f4f6]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">security</span>
          <span className="text-[14px]">Audit Logs</span>
        </button>

        {/* User Card */}
        <div className="mt-3 p-2.5 rounded-lg bg-[#f2f4f6] border border-[#E2E8F0] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#d5e0f8] text-[#586377] flex items-center justify-center text-[13px] font-bold shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[13px] font-semibold truncate text-[#0F172A]">
              {user?.name}
            </span>
            <span className="text-[11px] text-[#64748B] truncate">{user?.department}</span>
          </div>
          <button
            onClick={() => logout()}
            title="Keluar"
            className="ml-auto p-1.5 rounded-md text-[#545f73] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
