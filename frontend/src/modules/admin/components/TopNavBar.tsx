import React from 'react';
import { UserAccount } from '../types';

interface TopNavBarProps {
  activeTab: 'rbac' | 'master-data' | 'config' | 'audit';
  setActiveTab: (tab: 'rbac' | 'master-data' | 'config' | 'audit') => void;
  onOpenCommandPalette: () => void;
  onOpenClusterModal: () => void;
  onOpenNotifications: () => void;
  onToggleQuickConfig: () => void;
  quickConfigOpen: boolean;
  shift: string;
  onCycleShift: () => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  unreadNotificationsCount: number;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCommandPalette,
  onOpenClusterModal,
  onOpenNotifications,
  onToggleQuickConfig,
  quickConfigOpen,
  shift,
  onCycleShift,
  isSyncing,
  onTriggerSync,
  unreadNotificationsCount,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="w-full px-4 sm:px-6 flex items-center justify-between h-14 border-b border-[#e0e3e5] bg-[#ffffff] sticky top-0 z-40 shadow-xs">
      <div className="flex items-center gap-4 lg:gap-5">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('rbac')}>
          <span className="w-8 h-8 rounded-lg bg-[#191c1e] flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
              factory
            </span>
          </span>
          <div className="flex flex-col">
            <span className="text-[15px] sm:text-[17px] font-bold tracking-tight text-[#191c1e] leading-tight">
              THEUNDERWEARSUPPLY
            </span>
            <span className="text-[10px] text-[#545f73] font-semibold -mt-0.5 tracking-wider uppercase">
              Enterprise Garment Ops Admin
            </span>
          </div>
        </div>

        {/* Global Quick Search Bar */}
        <div className="hidden lg:flex items-center relative w-72">
          <span className="material-symbols-outlined absolute left-2.5 text-[#737686] pointer-events-none text-[18px]">
            search
          </span>
          <input
            className="w-full pl-8 pr-12 py-1 bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg text-[13px] text-[#191c1e] placeholder:text-[#737686] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] cursor-pointer"
            placeholder="Global system lookup..."
            type="text"
            readOnly
            onClick={onOpenCommandPalette}
          />
          <button
            onClick={onOpenCommandPalette}
            className="absolute right-1.5 px-1.5 py-0.5 rounded border border-[#e0e3e5] bg-[#ffffff] text-[10px] text-[#545f73] font-mono hover:bg-[#eceef0] transition-colors"
            title="Open command palette"
          >
            ⌘K
          </button>
        </div>
      </div>

      {/* Center Nav Cluster */}
      <nav className="hidden md:flex items-center gap-5 lg:gap-6 h-full">
        <button
          onClick={() => setActiveTab('rbac')}
          className={`h-full border-b-2 font-semibold text-[13px] flex items-center gap-1.5 px-1 transition-colors ${
            activeTab === 'rbac'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#191c1e]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
          User &amp; RBAC
        </button>

        <button
          onClick={() => setActiveTab('master-data')}
          className={`h-full border-b-2 font-medium text-[13px] flex items-center gap-1.5 px-1 transition-colors ${
            activeTab === 'master-data'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#191c1e]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          Master Data
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`h-full border-b-2 font-medium text-[13px] flex items-center gap-1.5 px-1 transition-colors ${
            activeTab === 'config'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#191c1e]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">settings_suggest</span>
          Global Config
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`h-full border-b-2 font-medium text-[13px] flex items-center gap-1.5 px-1 transition-colors ${
            activeTab === 'audit'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#191c1e]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Audit Logs
        </button>
      </nav>

      {/* Trailing Actions & Indicators */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status Badge 1: Cloud Sync */}
        <button
          onClick={onTriggerSync}
          disabled={isSyncing}
          className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#007f36]/10 border border-[#007f36]/20 hover:bg-[#007f36]/15 transition-colors cursor-pointer"
          title="Click to force sync across cluster"
        >
          <span
            className={`w-2 h-2 rounded-full bg-[#007f36] ${isSyncing ? 'animate-spin' : 'animate-pulse'}`}
          ></span>
          <span className="text-[11px] font-semibold text-[#007f36]">
            {isSyncing ? 'Syncing...' : 'Cloud Sync'}
          </span>
        </button>

        {/* Status Badge 2: Shift Indicator */}
        <button
          onClick={onCycleShift}
          className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#d5e0f8]/40 border border-[#bcc7de] hover:bg-[#d5e0f8]/70 transition-colors cursor-pointer"
          title="Click to toggle Shift"
        >
          <span className="material-symbols-outlined text-[#545f73] text-[16px]">schedule</span>
          <span className="text-[11px] font-semibold text-[#111c2d]">{shift} Active</span>
        </button>

        {/* Icon Actions */}
        <div className="flex items-center border-l border-[#e0e3e5] pl-2 sm:pl-3 gap-1">
          <button
            onClick={onOpenClusterModal}
            className="p-1.5 text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors cursor-pointer"
            title="Server Cluster Status & Node Health"
          >
            <span className="material-symbols-outlined text-[18px]">dns</span>
          </button>

          <button
            onClick={onOpenNotifications}
            className="relative p-1.5 text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors cursor-pointer"
            title="System Notifications"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
            )}
          </button>

          <button
            onClick={onToggleQuickConfig}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              quickConfigOpen
                ? 'bg-[#2563eb]/10 text-[#004ac6]'
                : 'text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]'
            }`}
            title="Toggle Quick Config Panel"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>

        {/* Authenticated User Profile Block & Logout */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[#e0e3e5]">
          <div
            className={`w-8 h-8 rounded ${currentUser?.avatarBg || 'bg-[#111c2d]'} ${currentUser?.avatarColor || 'text-white'} flex items-center justify-center font-bold text-xs shadow-xs`}
            title={`${currentUser?.name || 'Administrator'} (${currentUser?.role || 'ADMIN'})`}
          >
            {currentUser?.name
              ? currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()
              : 'RA'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-semibold text-[#191c1e] leading-none">
                {currentUser?.id || 'USR-ADMIN-01'}
              </span>
              <span className="px-1 py-0.2 bg-[#004ac6]/10 text-[#004ac6] rounded text-[9px] font-bold">
                {currentUser?.role || 'ADMIN'}
              </span>
            </div>
            <span className="text-[11px] text-[#545f73] leading-tight max-w-[130px] truncate">
              {currentUser?.name || 'Raditya IT Lead'}
            </span>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-1 p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              title="Keluar dari Sesi (Logout)"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
