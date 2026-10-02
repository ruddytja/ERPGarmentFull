import React from 'react';
import { UserAccount, GlobalConfigSettings } from '../types';

interface MetricsCardsProps {
  users: UserAccount[];
  config: GlobalConfigSettings;
  terminalsCount: number;
  onlineTerminalsCount: number;
  onOpenTerminalsModal: () => void;
  onOpenConfigModal?: () => void;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  users,
  config,
  terminalsCount,
  onlineTerminalsCount,
  onOpenTerminalsModal,
}) => {
  // Compute role breakdown
  const fndrCount = users.filter((u) => u.role === 'FOUNDER').length;
  const finCount = users.filter((u) => u.role === 'FINANCE').length;
  const spvrCount = users.filter((u) => u.role === 'SUPERVISOR').length;
  const stffCount = users.filter((u) => u.role === 'STAFF').length;
  const admCount = users.filter((u) => u.role === 'ADMIN').length;
  const totalCount = users.length;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Total System Users */}
      <div className="p-4 bg-[#ffffff] rounded-xl border border-[#e0e3e5] flex flex-col justify-between hover:border-[#bcc7de] transition-colors shadow-2xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-[#545f73] tracking-wider block">
              Total System Users
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-bold text-[#191c1e] tabular-nums">
                {totalCount}
              </span>
              <span className="text-[11px] text-[#007f36] font-semibold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                100% Verified
              </span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#dbe1ff]/40 text-[#004ac6]">
            <span className="material-symbols-outlined text-[20px]">group</span>
          </div>
        </div>

        {/* Sub-breakdown of roles */}
        <div className="mt-3 pt-2.5 border-t border-[#e6e8ea] grid grid-cols-5 text-center gap-1">
          <div>
            <span className="text-[10px] text-[#545f73] block">Fndr</span>
            <span className="text-[13px] font-semibold text-[#191c1e] tabular-nums">{fndrCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#545f73] block">Fin</span>
            <span className="text-[13px] font-semibold text-[#191c1e] tabular-nums">{finCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#545f73] block">Spvr</span>
            <span className="text-[13px] font-semibold text-[#191c1e] tabular-nums">{spvrCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#545f73] block">Stff</span>
            <span className="text-[13px] font-semibold text-[#191c1e] tabular-nums">{stffCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#545f73] block">Adm</span>
            <span className="text-[13px] font-semibold text-[#191c1e] tabular-nums">{admCount}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Kiosk Terminals Online */}
      <div
        onClick={onOpenTerminalsModal}
        className="p-4 bg-[#ffffff] rounded-xl border border-[#e0e3e5] flex flex-col justify-between hover:border-[#bcc7de] transition-colors shadow-2xs cursor-pointer group"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-[#545f73] tracking-wider block">
              Kiosk Terminals Online
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-bold text-[#191c1e] tabular-nums">
                {config.emergencyFloorLockout ? '0 / 12' : `${onlineTerminalsCount} / ${terminalsCount}`}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  config.emergencyFloorLockout
                    ? 'bg-[#ffdad6] text-[#ba1a1a]'
                    : 'bg-[#007f36]/15 text-[#007f36]'
                }`}
              >
                {config.emergencyFloorLockout ? 'Lockout Active' : '0ms Queue'}
              </span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#007f36]/10 text-[#007f36] group-hover:bg-[#007f36]/20 transition-colors">
            <span className="material-symbols-outlined text-[20px]">devices</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#e6e8ea] flex items-center justify-between text-[11px]">
          <span className="text-[#545f73]">Factory Floor Lines</span>
          {config.emergencyFloorLockout ? (
            <span className="text-[#ba1a1a] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span> Standby Maintenance
            </span>
          ) : (
            <span className="text-[#007f36] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007f36]"></span> All Floor Nodes Healthy
            </span>
          )}
        </div>
      </div>

      {/* Card 3: Global Idle Timeout Policy */}
      <div className="p-4 bg-[#ffffff] rounded-xl border border-[#e0e3e5] flex flex-col justify-between hover:border-[#bcc7de] transition-colors shadow-2xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-[#545f73] tracking-wider block">
              Security &amp; Idle Timeout
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[22px] font-bold text-[#191c1e]">Enforced</span>
              <span className="text-[12px] text-[#545f73]">Tiered</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#d8e3fb]/60 text-[#545f73]">
            <span className="material-symbols-outlined text-[20px]">timer</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#e6e8ea] flex items-center justify-between text-[11px]">
          <span className="text-[#545f73]">
            Staff: <strong className="text-[#191c1e] font-mono">{config.idleTimeouts.staff}m</strong>
          </span>
          <span className="text-[#545f73]">
            Spvr: <strong className="text-[#191c1e] font-mono">{config.idleTimeouts.supervisor}m</strong>
          </span>
          <span className="text-[#545f73]">
            Adm/Fin: <strong className="text-[#191c1e] font-mono">{config.idleTimeouts.adminFinance}m</strong>
          </span>
        </div>
      </div>

      {/* Card 4: Default Bundle & Yield Rules */}
      <div className="p-4 bg-[#ffffff] rounded-xl border border-[#e0e3e5] flex flex-col justify-between hover:border-[#bcc7de] transition-colors shadow-2xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-[#545f73] tracking-wider block">
              Default Bundle &amp; BOM Units
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[22px] font-bold text-[#191c1e] tabular-nums">
                {config.defaultBundleTarget} Pcs
              </span>
              <span className="text-[12px] text-[#545f73]">/ Bundle</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#e6e8ea] text-[#191c1e]">
            <span className="material-symbols-outlined text-[20px]">view_in_ar</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#e6e8ea] flex items-center justify-between text-[11px]">
          <span className="text-[#545f73]">
            Stock: <strong className="text-[#191c1e] font-medium">Kg</strong>
          </span>
          <span className="text-[#545f73]">
            Yield BOM: <strong className="text-[#191c1e] font-medium">Gram (gr)</strong>
          </span>
          <span className="text-[#007f36] font-medium">Standardized</span>
        </div>
      </div>
    </section>
  );
};
