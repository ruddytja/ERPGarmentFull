import React, { useState } from 'react';
import { 
  Calendar, 
  Filter, 
  ChevronDown, 
  Coins, 
  Bell, 
  SlidersHorizontal, 
  Download, 
  LineChart,
  DollarSign
} from 'lucide-react';
import { SubTab } from '../types';

interface HeaderProps {
  selectedSubTab: SubTab;
  onSubTabChange: (tab: SubTab) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedBrandFilter: string;
  onBrandFilterChange: (brand: string) => void;
  currency: 'IDR' | 'USD';
  onToggleCurrency: () => void;
  onExportClick: () => void;
  onNotificationClick: () => void;
  unreadAlertCount: number;
  isRealtime: boolean;
  onToggleRealtime: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSubTab,
  onSubTabChange,
  selectedMonth,
  onMonthChange,
  selectedBrandFilter,
  onBrandFilterChange,
  currency,
  onToggleCurrency,
  onExportClick,
  onNotificationClick,
  unreadAlertCount,
  isRealtime,
  onToggleRealtime,
}) => {
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const months = ['Bulan Ini: Okt 2026', 'Sep 2026', 'Agu 2026', 'Q3 2026', 'YTD 2026'];
  const brands = [
    'Semua Brand: NAQALA, Pierre UNO, B2B Clients',
    'NAQALA (Intimate & Seamless)',
    'Pierre UNO (Men Bamboo)',
    'B2B Contract Orders (OEM)'
  ];

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-sm select-none">
      {/* Top Header Row */}
      <div className="flex justify-between items-center w-full px-6 py-2.5 max-w-[1600px] mx-auto">
        {/* Left: Brand / Title Identity Context */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-[20px] font-bold tracking-tight text-[#004ac6]">
                THEUNDERWEARSUPPLY ERP
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#d8e3fb] text-[#111c2d] border border-[#d5e0f8]">
                FOUNDER (Executive)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#64748B] text-[12px]">
              <span className="font-code-metric text-[#545f73] font-medium">
                Founder Executive View (/dash/founder)
              </span>
              <span>•</span>
              <button
                onClick={onToggleRealtime}
                className="flex items-center gap-1.5 text-[#16A34A] font-medium hover:underline cursor-pointer"
                title="Click to toggle simulated realtime updates"
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-[#16A34A] inline-block ${isRealtime ? 'animate-ping' : ''}`} />
                {isRealtime ? 'Live • 100% Realtime' : 'Simulated Realtime Paused'}
              </button>
            </div>
          </div>
        </div>

        {/* Center: Quick Executive Filter Cockpit */}
        <div className="hidden xl:flex items-center gap-2 bg-[#f2f4f6] px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] relative">
          {/* Month Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowBrandDropdown(false);
              }}
              className="flex items-center gap-1.5 text-[#545f73] text-[13px] font-medium hover:text-[#191c1e] cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[#545f73]" />
              <span className="text-[#191c1e] font-semibold">{selectedMonth}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {showMonthDropdown && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-[#CBD5E1] rounded-lg shadow-lg py-1 z-50">
                {months.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      onMonthChange(m);
                      setShowMonthDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6] ${
                      selectedMonth === m ? 'font-semibold text-[#004ac6]' : 'text-[#191c1e]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[#CBD5E1]">|</span>

          {/* Brand Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBrandDropdown(!showBrandDropdown);
                setShowMonthDropdown(false);
              }}
              className="flex items-center gap-1 text-[#545f73] text-[13px] hover:text-[#191c1e] cursor-pointer"
            >
              <Filter className="w-4 h-4 text-[#545f73]" />
              <span className="text-[#191c1e] font-medium max-w-[280px] truncate">
                {selectedBrandFilter}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {showBrandDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#CBD5E1] rounded-lg shadow-lg py-1 z-50">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      onBrandFilterChange(b);
                      setShowBrandDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f2f4f6] ${
                      selectedBrandFilter === b ? 'font-semibold text-[#004ac6]' : 'text-[#191c1e]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions, Currency Indicator & Profile */}
        <div className="flex items-center gap-3">
          {/* Currency Indicator Toggle */}
          <button
            onClick={onToggleCurrency}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-[#eceef0] hover:bg-[#e0e3e5] rounded border border-[#E2E8F0] text-[#545f73] text-[12px] font-medium cursor-pointer transition-colors"
            title="Click to toggle Currency (IDR / USD)"
          >
            {currency === 'IDR' ? (
              <Coins className="w-4 h-4 text-[#004ac6]" />
            ) : (
              <DollarSign className="w-4 h-4 text-[#16a34a]" />
            )}
            <span className="font-semibold text-[#0F172A]">{currency} ({currency === 'IDR' ? 'Rp' : '$'})</span>
          </button>

          {/* Notification & Tool Icons */}
          <div className="flex items-center border-l border-[#E2E8F0] pl-2 space-x-1">
            <button
              onClick={onNotificationClick}
              className="p-2 text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors relative cursor-pointer"
              title="Notifications & Production Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadAlertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC2626] rounded-full" />
              )}
            </button>
            <button
              onClick={() => setShowBrandDropdown((v) => !v)}
              className="p-2 text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-lg transition-colors cursor-pointer"
              title="Filter & View Config"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Financial Export CTA */}
          <button
            onClick={onExportClick}
            className="flex items-center gap-2 bg-[#2563eb] text-white px-3.5 py-2 rounded-lg font-semibold text-sm hover:bg-[#004ac6] transition-all active:scale-[0.98] shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Download className="w-[18px] h-[18px]" />
            <span>Ekspor Laporan Keuangan (PDF/XLS)</span>
          </button>

          {/* User Avatar Profile */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-full bg-[#e6e8ea] border border-[#CBD5E1] flex items-center justify-center font-bold text-[#004ac6] text-sm overflow-hidden shrink-0">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQqW0cJnmwuJg7BiCKkbBe8IiUKmKDA3ZhaPX7dgTPOMGoUW3ts5-Ful4O9uQRmm-oF_v-6ZZdLb-x2KC6D9eKIDLRIdt67O1PAoNHYNLDBIdmpFltO1NyijmxsaSZfJRyTKs9fOU1vSjgqqpCkbDvaTiTpTbdxM6y0ySFphS9R3kxc0D8pXc1iR5hzvlfOajDyX28gEYFKO2vhzGunIJ-KYNlxrDeC1kzlgS5PiZMcEzTVGWXBtaOSg"
                alt="Executive Founder & CEO"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="hidden 2xl:block leading-tight text-left">
              <div className="font-semibold text-[#0F172A] text-sm">Founder &amp; CEO</div>
              <div className="text-[11px] text-[#64748B]">Executive Oversight</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation links */}
      <div className="bg-white border-t border-[#E2E8F0] px-8">
        <div className="flex items-center gap-6 max-w-[1600px] mx-auto text-sm pt-2.5">
          <button
            onClick={() => onSubTabChange('overview')}
            className={`font-semibold pb-2.5 flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
              selectedSubTab === 'overview'
                ? 'text-[#004ac6] border-[#004ac6]'
                : 'text-[#434655] border-transparent hover:text-[#191c1e]'
            }`}
          >
            <LineChart className="w-[18px] h-[18px]" />
            <span>Executive Overview</span>
          </button>
          
          <button
            onClick={() => onSubTabChange('costing')}
            className={`font-medium pb-2.5 transition-colors cursor-pointer border-b-2 ${
              selectedSubTab === 'costing'
                ? 'text-[#004ac6] border-[#004ac6] font-semibold'
                : 'text-[#434655] border-transparent hover:text-[#191c1e]'
            }`}
          >
            Costing &amp; HPP
          </button>
          
          <button
            onClick={() => onSubTabChange('lines')}
            className={`font-medium pb-2.5 transition-colors cursor-pointer border-b-2 ${
              selectedSubTab === 'lines'
                ? 'text-[#004ac6] border-[#004ac6] font-semibold'
                : 'text-[#434655] border-transparent hover:text-[#191c1e]'
            }`}
          >
            Production Lines
          </button>
          
          <button
            onClick={() => onSubTabChange('portfolios')}
            className={`font-medium pb-2.5 transition-colors cursor-pointer border-b-2 ${
              selectedSubTab === 'portfolios'
                ? 'text-[#004ac6] border-[#004ac6] font-semibold'
                : 'text-[#434655] border-transparent hover:text-[#191c1e]'
            }`}
          >
            B2B Portfolios
          </button>
        </div>
      </div>
    </div>
  );
};
