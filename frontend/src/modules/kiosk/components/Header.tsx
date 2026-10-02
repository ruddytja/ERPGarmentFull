import React, { useState, useEffect } from 'react';
import { Operator } from '../types';
import { playTactileClick, isSoundEnabled, toggleSound } from '../utils/audio';
import { useSession } from '../../../core/session';

interface HeaderProps {
  currentOperator: Operator;
  onOpenSwitchOperator: () => void;
  onTriggerEmergencyHalt: () => void;
  isDowntimeActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentOperator,
  onOpenSwitchOperator,
  onTriggerEmergencyHalt,
  isDowntimeActive,
}) => {
  const { user, logout } = useSession();
  const [soundOn, setSoundOn] = useState(true);
  const [latency, setLatency] = useState(12);

  // Micro-fluctuation of industrial PLC sync latency (10-15ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(10 + Math.random() * 5));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSoundToggle = () => {
    const next = toggleSound();
    setSoundOn(next);
    playTactileClick();
  };

  return (
    <header className="h-16 flex justify-between items-center w-full px-5 bg-[#1E293B] border-b border-[#334155] shrink-0 z-30 select-none">
      {/* Brand & Line Info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 bg-[#27354A] px-3 py-1.5 rounded border border-[#334155]">
          <span className="text-lg font-bold tracking-wider font-['Hanken_Grotesk'] text-[#F8FAFC]">
            THEUNDERWEARSUPPLY // STATION-04
          </span>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDowntimeActive ? 'bg-red-400' : 'bg-[#16A34A]'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isDowntimeActive ? 'bg-red-500' : 'bg-[#16A34A]'}`}></span>
          </span>
        </div>

        <div className="h-6 w-px bg-[#334155] hidden sm:block"></div>

        <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
          <span className="text-[#adc6ff] font-bold border-b-2 border-[#adc6ff] pb-0.5">
            Line 02 - Sewing
          </span>
          <span className="text-[#94A3B8]">Shift A (07:00 - 15:30)</span>
        </div>
      </div>

      {/* Telemetry State & Operator Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Audio Mute/Unmute Indicator */}
        <button
          onClick={handleSoundToggle}
          title={soundOn ? 'Suara Haptic Aktif' : 'Suara Dimatikan'}
          className="h-10 w-10 flex items-center justify-center rounded bg-[#27354A] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-lg">
            {soundOn ? 'volume_up' : 'volume_off'}
          </span>
        </button>

        {/* Sync State Pill */}
        <div className="hidden sm:flex items-center gap-2 bg-[#27354A] px-3 py-1.5 rounded border border-[#334155]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shadow-[0_0_8px_#16A34A]"></span>
          <span className="text-xs font-bold text-[#F8FAFC]">
            Online - Synced ({latency}ms)
          </span>
          <div className="flex items-center gap-1 text-[#94A3B8] border-l border-[#334155] pl-2 ml-1">
            <span className="material-symbols-outlined text-sm">wifi</span>
            <span className="material-symbols-outlined text-sm">sync</span>
          </div>
        </div>

        {/* Operator Badge Capsule */}
        <div className="flex items-center gap-2.5 bg-[#27354A] pl-1.5 pr-3 py-1 rounded border border-[#334155]">
          <div className="w-7 h-7 rounded bg-[#3e495d] flex items-center justify-center text-[#adc6ff] font-bold text-xs border border-[#adc6ff]/30">
            {currentOperator.initials}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-[#94A3B8] leading-tight">
              Operator: {user?.name ?? currentOperator.name}
            </span>
            <span className="text-sm font-bold text-[#F8FAFC] leading-tight">
              {currentOperator.code}
            </span>
          </div>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playTactileClick();
              onOpenSwitchOperator();
            }}
            className="h-10 px-3 flex items-center gap-1.5 bg-[#27354A] hover:bg-[#323537] text-[#F8FAFC] border border-[#334155] rounded text-xs font-semibold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">manage_accounts</span>
            <span className="hidden sm:inline">Switch Operator</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              onTriggerEmergencyHalt();
            }}
            className="h-10 px-3.5 flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded shadow-[0_0_12px_rgba(220,38,38,0.45)] text-xs active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">e911_emergency</span>
            <span>Emergency Halt</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              logout();
            }}
            title="Keluar dari kios"
            className="h-10 w-10 flex items-center justify-center bg-[#27354A] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] rounded active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
