import React from 'react';

interface SideNavBarProps {
  activeTab: 'rbac' | 'master-data' | 'config' | 'audit';
  setActiveTab: (tab: 'rbac' | 'master-data' | 'config' | 'audit') => void;
  onOpenTerminalsModal: () => void;
  onOpenClusterModal: () => void;
  isFloorLockout: boolean;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenTerminalsModal,
  onOpenClusterModal,
  isFloorLockout,
}) => {
  return (
    <aside className="w-64 bg-[#ffffff] border-r border-[#e0e3e5] flex-shrink-0 flex flex-col justify-between py-6 px-4 hidden lg:flex select-none">
      <div className="space-y-5">
        {/* Sub-header context */}
        <div className="px-1">
          <div className="text-[11px] font-semibold uppercase text-[#545f73] tracking-wider">
            Console Module
          </div>
          <div className="text-[18px] font-bold text-[#191c1e] tracking-tight">
            Access &amp; RBAC Matrix
          </div>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1">
          {/* User & RBAC */}
          <button
            onClick={() => setActiveTab('rbac')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors cursor-pointer ${
              activeTab === 'rbac'
                ? 'bg-[#2563eb] text-white font-semibold shadow-xs'
                : 'text-[#434655] hover:bg-[#f2f4f6] font-medium'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === 'rbac' ? 'text-white' : 'text-[#545f73]'
              }`}
            >
              admin_panel_settings
            </span>
            <span className="text-[13px]">User &amp; RBAC</span>
          </button>

          {/* Master Data */}
          <button
            onClick={() => setActiveTab('master-data')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors cursor-pointer ${
              activeTab === 'master-data'
                ? 'bg-[#2563eb] text-white font-semibold shadow-xs'
                : 'text-[#434655] hover:bg-[#f2f4f6] font-medium'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === 'master-data' ? 'text-white' : 'text-[#545f73]'
              }`}
            >
              inventory_2
            </span>
            <span className="text-[13px]">Master Data</span>
          </button>

          {/* Global Config */}
          <button
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-[#2563eb] text-white font-semibold shadow-xs'
                : 'text-[#434655] hover:bg-[#f2f4f6] font-medium'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === 'config' ? 'text-white' : 'text-[#545f73]'
              }`}
            >
              settings_suggest
            </span>
            <span className="text-[13px]">Global Config</span>
          </button>

          {/* Audit Logs */}
          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#2563eb] text-white font-semibold shadow-xs'
                : 'text-[#434655] hover:bg-[#f2f4f6] font-medium'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === 'audit' ? 'text-white' : 'text-[#545f73]'
              }`}
            >
              receipt_long
            </span>
            <span className="text-[13px]">Audit Logs</span>
          </button>
        </nav>

        {/* Floor Telemetry Widget */}
        <div
          onClick={onOpenTerminalsModal}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            isFloorLockout
              ? 'bg-[#ffdad6]/40 border-[#ba1a1a]/40 hover:bg-[#ffdad6]/60'
              : 'bg-[#f2f4f6] border-[#e0e3e5] hover:border-[#bcc7de]'
          }`}
          title="Click to inspect all 12 line floor kiosks"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-[#545f73] mb-1.5">
            <span>Garment Plant A1</span>
            {isFloorLockout ? (
              <span className="text-[#ba1a1a] font-bold animate-pulse">LOCKED (EMERGENCY)</span>
            ) : (
              <span className="text-[#007f36] font-semibold">100% ONLINE</span>
            )}
          </div>
          <div className="h-1.5 w-full bg-[#e0e3e5] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFloorLockout ? 'bg-[#ba1a1a]' : 'bg-[#2563eb]'
              }`}
              style={{ width: '100%' }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#434655]">
            <span>Lines: 12 Active</span>
            <span className="font-mono">Sync delay: 0.2ms</span>
          </div>
        </div>
      </div>

      {/* Footer SideNav Controls */}
      <div className="space-y-2 pt-3 border-t border-[#e0e3e5]">
        {/* Status indicator */}
        <div
          onClick={onOpenClusterModal}
          className="px-3 py-2 bg-[#007f36]/10 rounded border border-[#007f36]/20 flex items-center gap-2 cursor-pointer hover:bg-[#007f36]/15 transition-colors"
        >
          <span className="material-symbols-outlined text-[#007f36] text-[18px]">
            check_circle
          </span>
          <span className="text-[11px] font-semibold text-[#007f36]">
            System Status: Optimal
          </span>
        </div>

        {/* Server Sync info */}
        <div
          onClick={onOpenClusterModal}
          className="flex items-center justify-between px-3 py-1.5 text-[#434655] hover:text-[#191c1e] text-[12px] transition-colors rounded hover:bg-[#f2f4f6] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px] text-[#545f73]">
              cloud_done
            </span>
            <span>Server Sync</span>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#007f36]">SYNCED</span>
        </div>

        {/* Terminal Settings modal trigger */}
        <button
          onClick={onOpenTerminalsModal}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[#434655] hover:text-[#191c1e] text-[12px] transition-colors rounded hover:bg-[#f2f4f6] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px] text-[#545f73]">terminal</span>
            <span>Terminal Settings</span>
          </div>
          <span className="material-symbols-outlined text-[#545f73] text-[16px]">
            chevron_right
          </span>
        </button>
      </div>
    </aside>
  );
};
