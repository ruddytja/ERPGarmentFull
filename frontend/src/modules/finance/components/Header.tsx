import React, { useState } from 'react';
import { ActiveScreen } from './Sidebar';

interface HeaderProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenDateFilter: () => void;
  onOpenExport: () => void;
  globalSearch: string;
  onSearchChange: (val: string) => void;
  unreadNotifications: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  onNavigate,
  onOpenDateFilter,
  onOpenExport,
  globalSearch,
  onSearchChange,
  unreadNotifications,
}) => {
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  return (
    <header className="w-full bg-white border-b border-[#E2E8F0] sticky top-0 z-30 shadow-xs">
      <div className="flex justify-between items-center w-full px-6 py-2.5 max-w-[1600px] mx-auto">
        {/* Search bar on left */}
        <div className="flex items-center gap-3 w-80">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari SPK, BOM ID, Vendor Kain..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#f2f4f6] border border-[#E2E8F0] text-[13px] text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:border-[#004ac6] transition-colors"
            />
            {globalSearch && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#0F172A] text-[14px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`text-[14px] pb-1 transition-colors duration-150 cursor-pointer font-medium ${
              activeScreen === 'dashboard'
                ? 'text-[#004ac6] border-b-2 border-[#004ac6] font-semibold'
                : 'text-[#434655] hover:text-[#191c1e]'
            }`}
          >
            Executive Overview
          </button>
          <button
            onClick={() => onNavigate('costing')}
            className={`text-[14px] pb-1 transition-colors duration-150 cursor-pointer font-medium ${
              activeScreen === 'costing'
                ? 'text-[#004ac6] border-b-2 border-[#004ac6] font-semibold'
                : 'text-[#434655] hover:text-[#191c1e]'
            }`}
          >
            Costing &amp; HPP
          </button>
          <button
            onClick={() => onNavigate('wip')}
            className={`text-[14px] pb-1 transition-colors duration-150 cursor-pointer font-medium ${
              activeScreen === 'wip'
                ? 'text-[#004ac6] border-b-2 border-[#004ac6] font-semibold'
                : 'text-[#434655] hover:text-[#191c1e]'
            }`}
          >
            Production Lines
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className={`text-[14px] pb-1 transition-colors duration-150 cursor-pointer font-medium ${
              activeScreen === 'reports'
                ? 'text-[#004ac6] border-b-2 border-[#004ac6] font-semibold'
                : 'text-[#434655] hover:text-[#191c1e]'
            }`}
          >
            B2B Portfolios
          </button>
        </nav>

        {/* Trailing Actions & Avatar */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDateFilter}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] text-[#545f73] hover:bg-[#f2f4f6] transition-colors duration-150 text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Date Filter</span>
          </button>

          <button
            onClick={onOpenExport}
            className="px-3 py-1.5 rounded-lg bg-[#004ac6] hover:bg-[#0053db] active:scale-[0.99] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Financials</span>
          </button>

          <div className="h-6 w-px bg-[#E2E8F0] mx-1"></div>

          {/* Notifications button */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              className="p-1.5 text-[#545f73] hover:text-[#0F172A] hover:bg-[#f2f4f6] rounded-lg transition-colors cursor-pointer relative"
              title="Notifikasi Sistem"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
              )}
            </button>

            {showNotificationsMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#CBD5E1] rounded-xl shadow-lg p-3 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <span className="text-[13px] font-bold text-[#0F172A]">Notifikasi Operasional</span>
                  <span className="text-[11px] font-semibold text-[#004ac6]">Tandai Terbaca</span>
                </div>
                <div className="mt-2 space-y-2 text-[12px]">
                  <div className="p-2 bg-[#ffdad6]/20 border border-[#ba1a1a]/30 rounded-lg">
                    <p className="font-bold text-[#ba1a1a]">Peringatan HPP SPK-2026-10-095</p>
                    <p className="text-[#0F172A] text-[11px] mt-0.5">
                      Lonjakan harga benang elastane 40D melewati batas 5%.
                    </p>
                  </div>
                  <div className="p-2 bg-[#f2f4f6] rounded-lg">
                    <p className="font-semibold text-[#0F172A]">Sync MES Sukabumi Berhasil</p>
                    <p className="text-[#64748B] text-[11px] mt-0.5">
                      142 tiket bundle barcode siap diverifikasi untuk payroll.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Executive Founder Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-[12px] ring-2 ring-[#E2E8F0] shadow-xs cursor-pointer select-none"
            title="Executive Founder (EF) - Ruddy T."
          >
            EF
          </div>
        </div>
      </div>
    </header>
  );
};
