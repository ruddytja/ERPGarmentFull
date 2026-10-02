import React from 'react';
import { 
  Factory, 
  PlusCircle, 
  LayoutDashboard, 
  CreditCard, 
  Boxes, 
  ClipboardCheck, 
  Cpu, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  Radio,
  TrendingUp,
  LogOut,
  User,
} from 'lucide-react';
import { NavigationTab } from '../types';
import { FounderUser } from '../App';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  /** Tidak diisi untuk role read-only (Founder) → tombol disembunyikan. */
  onCreateSpkClick?: () => void;
  isRealtimeActive: boolean;
  currentUser: FounderUser;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onCreateSpkClick,
  isRealtimeActive,
  currentUser,
  onLogout,
}) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'profitability', label: 'Profitabilitas', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'costing_hpp', label: 'HPP & Cost Control', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'wip_spk', label: 'WIP & SPK Tracking', icon: <Boxes className="w-5 h-5" /> },
    { id: 'quality_qc', label: 'Quality & Defect QC', icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: 'oee_maintenance', label: 'OEE & Maintenance', icon: <Cpu className="w-5 h-5" /> },
    { id: 'executive_reports', label: 'Executive Reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-64 px-4 py-6 border-r border-[#E2E8F0] bg-white flex flex-col justify-between select-none">
      <div>
        {/* Header / Logo */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#2563eb] text-white flex items-center justify-center font-bold shadow-sm">
            <Factory className="w-6 h-6" />
          </div>
          <div className="leading-tight overflow-hidden">
            <div className="font-headline text-[#0F172A] font-bold tracking-tight text-base truncate">
              THEUNDERWEARSUPPLY
            </div>
            <div className="font-body text-[#545f73] text-[11px] font-semibold uppercase tracking-wider">
              Executive Suite
            </div>
          </div>
        </div>

        {/* Action Button CTA */}
        {onCreateSpkClick && (
        <div className="px-2 mb-5">
          <button
            onClick={onCreateSpkClick}
            className="w-full flex items-center justify-center gap-2 bg-[#004ac6] hover:bg-[#2563eb] text-white py-2.5 px-3 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-[18px] h-[18px]" />
            <span>Create SPK Order</span>
          </button>
        </div>
        )}

        {/* Primary Nav Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
                    : 'text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]'
                }`}
              >
                <span className={isActive ? 'text-[#004ac6]' : 'text-[#545f73]'}>
                  {item.icon}
                </span>
                <span className="font-body text-[14px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* SideNav Footer */}
      <div className="border-t border-[#E2E8F0] pt-4 space-y-1">
        <button
          onClick={() => onTabChange('system_settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
            currentTab === 'system_settings'
              ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
              : 'text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]'
          }`}
        >
          <Settings className="w-5 h-5 text-[#545f73]" />
          <span className="font-body text-[14px]">System Settings</span>
        </button>

        <button
          onClick={() => onTabChange('audit_logs')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
            currentTab === 'audit_logs'
              ? 'bg-[#f2f4f6] text-[#004ac6] font-semibold'
              : 'text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]'
          }`}
        >
          <ShieldCheck className="w-5 h-5 text-[#545f73]" />
          <span className="font-body text-[14px]">Audit Logs</span>
        </button>

        {/* Quick Server Diagnostic Pill */}
        <div className="mt-3 p-2.5 bg-[#f2f4f6] rounded-lg flex items-center justify-between text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5 font-medium">
            <span 
              className={`w-2 h-2 rounded-full ${
                isRealtimeActive ? 'bg-[#16A34A] animate-pulse' : 'bg-[#64748B]'
              }`}
            />
            MES Core v4.19
          </span>
          <span className="font-code-metric font-medium">99.98% Up</span>
        </div>

        {/* Authenticated User Card + Logout */}
        <div className="mt-3 p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {currentUser.avatarInitials}
            </div>
            <div className="overflow-hidden">
              <div className="text-[11px] font-semibold text-[#0F172A] truncate">{currentUser.name}</div>
              <div className="text-[10px] text-[#2563eb] font-medium uppercase tracking-wide">{currentUser.role} · Read-only</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold text-[#DC2626] hover:bg-[#FEE2E2] border border-[#FECACA] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sesi
          </button>
        </div>
      </div>
    </aside>
  );
};
