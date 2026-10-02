import React, { useState } from 'react';
import { GlobalConfigSettings, SystemAuditItem } from '../types';

interface QuickConfigPanelProps {
  config: GlobalConfigSettings;
  onUpdateConfig: (newConfig: Partial<GlobalConfigSettings>) => void;
  auditLogs: SystemAuditItem[];
  onViewAllAudits: () => void;
  onOpenDiagnostics: () => void;
}

export const QuickConfigPanel: React.FC<QuickConfigPanelProps> = ({
  config,
  onUpdateConfig,
  auditLogs,
  onViewAllAudits,
  onOpenDiagnostics,
}) => {
  const [isEditingUnits, setIsEditingUnits] = useState(false);
  const [currency, setCurrency] = useState(config.operatingCurrency);
  const [stockMass, setStockMass] = useState(config.warehouseStockMass);
  const [yieldUnit, setYieldUnit] = useState(config.bomYieldUnit);
  const [bundleTarget, setBundleTarget] = useState(config.defaultBundleTarget);
  const [savedBadgeVisible, setSavedBadgeVisible] = useState(true);

  const handleSaveUnits = () => {
    onUpdateConfig({
      operatingCurrency: currency,
      warehouseStockMass: stockMass,
      bomYieldUnit: yieldUnit,
      defaultBundleTarget: bundleTarget,
    });
    setIsEditingUnits(false);
  };

  const handleTimeoutChange = (
    key: 'staff' | 'supervisor' | 'adminFinance',
    value: number
  ) => {
    onUpdateConfig({
      idleTimeouts: {
        ...config.idleTimeouts,
        [key]: value,
      },
    });
    setSavedBadgeVisible(true);
  };

  const handleToggleLockout = () => {
    const nextState = !config.emergencyFloorLockout;
    onUpdateConfig({
      emergencyFloorLockout: nextState,
      lockoutReason: nextState ? 'Manual Emergency Lock initiated by USR-ADMIN-01' : '',
    });
  };

  return (
    <aside className="w-80 bg-[#ffffff] border-l border-[#e0e3e5] flex-shrink-0 flex flex-col justify-between overflow-y-auto custom-scrollbar p-3.5 sm:p-4 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#e0e3e5]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-[18px]">tune</span>
            <h2 className="text-[17px] font-bold text-[#191c1e] tracking-tight">Quick Config</h2>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-[#e6e8ea] text-[#545f73] text-[10px] font-bold tracking-wide">
            V2.4 LIVE
          </span>
        </div>

        {/* Section A: Currency & Unit Rules */}
        <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#e0e3e5] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#545f73]">
              Global Units &amp; Currency
            </span>
            <button
              onClick={() => setIsEditingUnits(!isEditingUnits)}
              className="text-[#545f73] hover:text-[#004ac6] text-xs transition-colors flex items-center gap-1 cursor-pointer"
              title="Edit parameters"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isEditingUnits ? 'check' : 'edit'}
              </span>
              <span className="text-[10px] font-semibold">{isEditingUnits ? 'Done' : 'Edit'}</span>
            </button>
          </div>

          {!isEditingUnits ? (
            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between items-center bg-[#ffffff] p-1.5 rounded border border-[#e0e3e5]">
                <span className="text-[#545f73] text-[11px]">Operating Currency</span>
                <span className="font-bold text-[#191c1e] font-mono">{config.operatingCurrency}</span>
              </div>
              <div className="flex justify-between items-center bg-[#ffffff] p-1.5 rounded border border-[#e0e3e5]">
                <span className="text-[#545f73] text-[11px]">Warehouse Stock Mass</span>
                <span className="font-bold text-[#191c1e] font-mono">{config.warehouseStockMass}</span>
              </div>
              <div className="flex justify-between items-center bg-[#ffffff] p-1.5 rounded border border-[#e0e3e5]">
                <span className="text-[#545f73] text-[11px]">BOM / Cutting Yield Unit</span>
                <span className="font-bold text-[#191c1e] font-mono">{config.bomYieldUnit}</span>
              </div>
              <div className="flex justify-between items-center bg-[#ffffff] p-1.5 rounded border border-[#e0e3e5]">
                <span className="text-[#545f73] text-[11px]">Default Bundle Target</span>
                <span className="font-bold text-[#004ac6] font-mono">
                  {config.defaultBundleTarget} Pcs / Polybag
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs bg-white p-2.5 rounded border border-[#bcc7de]">
              <div>
                <label className="text-[10px] font-semibold text-[#545f73] block mb-0.5">
                  Operating Currency
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs p-1 border border-[#e0e3e5] rounded bg-[#f2f4f6]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#545f73] block mb-0.5">
                  Stock Mass Metric
                </label>
                <input
                  type="text"
                  value={stockMass}
                  onChange={(e) => setStockMass(e.target.value)}
                  className="w-full text-xs p-1 border border-[#e0e3e5] rounded bg-[#f2f4f6]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#545f73] block mb-0.5">
                  BOM Yield Unit
                </label>
                <input
                  type="text"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  className="w-full text-xs p-1 border border-[#e0e3e5] rounded bg-[#f2f4f6]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#545f73] block mb-0.5">
                  Default Bundle Target (Pcs)
                </label>
                <input
                  type="number"
                  value={bundleTarget}
                  onChange={(e) => setBundleTarget(Number(e.target.value))}
                  className="w-full text-xs p-1 border border-[#e0e3e5] rounded bg-[#f2f4f6]"
                />
              </div>
              <button
                onClick={handleSaveUnits}
                className="w-full py-1 bg-[#2563eb] text-white rounded text-xs font-semibold hover:bg-[#004ac6] transition-colors cursor-pointer"
              >
                Apply Changes
              </button>
            </div>
          )}
        </div>

        {/* Section B: Security Policy - Idle Timeout Sliders */}
        <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#e0e3e5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#545f73]">
              Idle Timeout Limits
            </span>
            {savedBadgeVisible && (
              <span className="text-[10px] text-[#007f36] font-bold">SAVED AUTO</span>
            )}
          </div>

          {/* Staff Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#545f73]">Staff &amp; Line Kiosks</span>
              <span className="font-mono font-bold text-[#191c1e]">
                {config.idleTimeouts.staff} min
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="5"
              value={config.idleTimeouts.staff}
              onChange={(e) => handleTimeoutChange('staff', Number(e.target.value))}
              className="w-full h-1.5 bg-[#e0e3e5] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
            />
          </div>

          {/* Supervisor Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#545f73]">Floor Supervisors</span>
              <span className="font-mono font-bold text-[#191c1e]">
                {config.idleTimeouts.supervisor} min
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={config.idleTimeouts.supervisor}
              onChange={(e) => handleTimeoutChange('supervisor', Number(e.target.value))}
              className="w-full h-1.5 bg-[#e0e3e5] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
            />
          </div>

          {/* Finance & Admins */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#545f73]">Finance &amp; Super Admins</span>
              <span className="font-mono font-bold text-[#ba1a1a]">
                {config.idleTimeouts.adminFinance} min (Strict)
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={config.idleTimeouts.adminFinance}
              onChange={(e) => handleTimeoutChange('adminFinance', Number(e.target.value))}
              className="w-full h-1.5 bg-[#e0e3e5] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
            />
          </div>
        </div>

        {/* Section C: Emergency Kiosk Lock / Maintenance Switch */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            config.emergencyFloorLockout
              ? 'border-[#ba1a1a] bg-[#ffdad6]/60 shadow-xs'
              : 'border-[#ba1a1a]/30 bg-[#ffdad6]/30'
          } space-y-2`}
        >
          <div className="flex items-center gap-1.5 text-[#ba1a1a]">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            <span className="text-[11px] font-bold uppercase tracking-wide">Floor Lockout Switch</span>
          </div>
          <p className="text-xs text-[#434655] leading-relaxed">
            Immediately forces all 12 line floor tablets into pin-locked maintenance standby.
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[13px] font-semibold text-[#191c1e]">
              {config.emergencyFloorLockout ? 'Lockout Active' : 'Emergency Lock'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.emergencyFloorLockout}
                onChange={handleToggleLockout}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#e0e3e5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ba1a1a]"></div>
            </label>
          </div>
        </div>

        {/* Section D: Recent Admin Activity Logs Preview */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#545f73]">
              Recent RBAC Audits
            </span>
            <button
              onClick={onViewAllAudits}
              className="text-[11px] text-[#004ac6] hover:underline font-medium cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {auditLogs.slice(0, 3).map((item) => {
              let borderColor = 'border-[#2563eb]';
              if (item.category === 'tertiary') borderColor = 'border-[#007f36]';
              else if (item.category === 'secondary') borderColor = 'border-[#545f73]';
              else if (item.category === 'error') borderColor = 'border-[#ba1a1a]';

              return (
                <div
                  key={item.id}
                  className={`text-xs border-l-2 ${borderColor} pl-2 py-0.5 bg-[#f2f4f6]/50 rounded-r hover:bg-[#eceef0] transition-colors`}
                >
                  <div className="font-medium text-[#191c1e] line-clamp-1">{item.action}</div>
                  <div className="text-[10px] text-[#545f73] flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[11px]">schedule</span>{' '}
                    {item.timeAgo} • {item.user}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick System Diagnostic Badge */}
      <div
        onClick={onOpenDiagnostics}
        className="pt-3 border-t border-[#e0e3e5] mt-4 cursor-pointer hover:bg-[#f2f4f6] -mx-2 px-2 py-1 rounded transition-colors"
        title="Click to view full cluster telemetry"
      >
        <div className="flex items-center justify-between text-[11px] text-[#545f73]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007f36]"></span>
            PostgreSQL Cluster
          </span>
          <span className="font-mono text-[#007f36] font-bold">healthy (6.4ms)</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#545f73] mt-1">
          <span>Worker Threads</span>
          <span className="font-mono text-[#191c1e]">16 / 16 active</span>
        </div>
      </div>
    </aside>
  );
};
