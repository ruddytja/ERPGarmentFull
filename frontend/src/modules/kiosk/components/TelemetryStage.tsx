import React from 'react';
import { BundleItem } from '../types';
import { playTactileClick } from '../utils/audio';

interface TelemetryStageProps {
  bundle: BundleItem;
  isRunning: boolean;
  isDowntimeActive: boolean;
  onStart: () => void;
  onComplete: () => void;
  onOpenDowntime: () => void;
  onIncrementQC: (type: 'pass' | 'rework' | 'reject') => void;
  onDecrementQC: (type: 'pass' | 'rework' | 'reject') => void;
  onOpenDefectDialog?: () => void;
}

export const TelemetryStage: React.FC<TelemetryStageProps> = ({
  bundle,
  isRunning,
  isDowntimeActive,
  onStart,
  onComplete,
  onOpenDowntime,
  onIncrementQC,
  onDecrementQC,
}) => {
  // Format elapsed seconds as HH:MM:SS
  const formatTimer = (totalSecs: number) => {
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const isExceeded = bundle.elapsedSeconds > bundle.targetMinutesPerBundle * 60;

  return (
    <section className="flex flex-col justify-between gap-3 h-full overflow-hidden select-none">
      {/* Active Bundle Context Card */}
      <div className="bg-[#1E293B] rounded border border-[#334155] p-4 relative overflow-hidden flex flex-col justify-between shadow-sm">
        {/* Top Header Row */}
        <div className="flex items-start justify-between border-b border-[#334155] pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase text-[#94A3B8] font-semibold tracking-wider">
                Active Task Telemetry
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#adc6ff]/10 text-[#adc6ff] border border-[#adc6ff]/30">
                CURRENT BUNDLE
              </span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight font-['Hanken_Grotesk'] text-[#F8FAFC]">
              {bundle.id}
            </div>
            <div className="text-sm text-[#60A5FA] font-bold mt-0.5">
              {bundle.sku} | {bundle.productName}
            </div>
          </div>

          <div className="text-right bg-[#27354A] p-2 rounded border border-[#334155] min-w-[100px]">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Bundle Quantity
            </span>
            <span className="text-2xl font-extrabold text-[#F8FAFC] font-['Hanken_Grotesk']">
              {bundle.quantity}{' '}
              <span className="text-sm text-[#94A3B8] font-normal">Pcs</span>
            </span>
            <span className="text-[11px] text-[#16A34A] font-bold block mt-0.5">
              {bundle.isStdBundle ? 'Std Bundle' : 'Custom'}
            </span>
          </div>
        </div>

        {/* Telemetry Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2.5 my-3">
          {/* Operation Step */}
          <div className="bg-[#27354A] p-2.5 rounded border border-[#334155]">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Operation Step
            </span>
            <span className="text-base font-bold text-[#F8FAFC] mt-1 line-clamp-1">
              {bundle.operationStep}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-0.5">
              {bundle.operationSubtext}
            </span>
          </div>

          {/* Target Pace */}
          <div className="bg-[#27354A] p-2.5 rounded border border-[#334155]">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Target Pace
            </span>
            <span className="text-base font-bold text-[#F8FAFC] mt-1">
              {bundle.targetPaceSecPerPc} detik / pcs
            </span>
            <span className="text-[11px] text-[#16A34A] font-bold block mt-0.5">
              Target: {Math.round(bundle.targetMinutesPerBundle)}m / bdl
            </span>
          </div>

          {/* Running Timer */}
          <div className="bg-[#27354A] p-2.5 rounded border border-[#334155]">
            <span className="text-xs text-[#94A3B8] uppercase block font-semibold">
              Running Timer
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isDowntimeActive
                    ? 'bg-[#DC2626] animate-ping'
                    : isRunning
                    ? 'bg-[#16A34A] animate-pulse'
                    : 'bg-[#94A3B8]'
                }`}
              ></span>
              <span
                className={`text-2xl font-mono font-bold tracking-wider ${
                  isDowntimeActive
                    ? 'text-[#DC2626]'
                    : isExceeded
                    ? 'text-[#D97706]'
                    : 'text-[#16A34A]'
                }`}
              >
                {formatTimer(bundle.elapsedSeconds)}
              </span>
            </div>
            <span className="text-[11px] text-[#94A3B8] block">
              {isDowntimeActive
                ? 'DOWNTIME PAUSED'
                : isRunning
                ? isExceeded
                  ? 'Over Target Pace'
                  : 'In-Progress Normal'
                : 'Menunggu Start'}
            </span>
          </div>
        </div>

        {/* Mini QC Tracker Matrix within Active Context */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#334155]">
          {/* PASS */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#16A34A]/10 border border-[#16A34A]/30">
            <span className="text-xs text-[#16A34A] font-bold">
              PASS: {bundle.passCount}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  playTactileClick();
                  onDecrementQC('pass');
                }}
                disabled={bundle.passCount <= 0}
                className="w-6 h-6 rounded bg-[#16A34A]/40 hover:bg-[#16A34A] text-white text-xs font-bold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                -
              </button>
              <button
                onClick={() => {
                  playTactileClick();
                  onIncrementQC('pass');
                }}
                className="w-6 h-6 rounded bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* REWORK */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#D97706]/10 border border-[#D97706]/30">
            <span className="text-xs text-[#D97706] font-bold">
              REWORK: {bundle.reworkCount}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  playTactileClick();
                  onDecrementQC('rework');
                }}
                disabled={bundle.reworkCount <= 0}
                className="w-6 h-6 rounded bg-[#D97706]/40 hover:bg-[#D97706] text-white text-xs font-bold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                -
              </button>
              <button
                onClick={() => {
                  playTactileClick();
                  onIncrementQC('rework');
                }}
                className="w-6 h-6 rounded bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* REJECT */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#DC2626]/10 border border-[#DC2626]/30">
            <span className="text-xs text-[#DC2626] font-bold">
              REJECT: {bundle.rejectCount}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  playTactileClick();
                  onDecrementQC('reject');
                }}
                disabled={bundle.rejectCount <= 0}
                className="w-6 h-6 rounded bg-[#DC2626]/40 hover:bg-[#DC2626] text-white text-xs font-bold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                -
              </button>
              <button
                onClick={() => {
                  playTactileClick();
                  onIncrementQC('reject');
                }}
                className="w-6 h-6 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold active:scale-95"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BIG TOUCH ACTION BUTTONS (Tactile, Min 64px - 72px, gloved friendly) */}
      <div className="grid grid-rows-3 gap-3 flex-1 min-h-[220px]">
        {/* MULAI (START) */}
        <button
          onClick={onStart}
          className={`group h-full min-h-[4.25rem] border border-white/20 rounded flex items-center justify-between px-6 text-white shadow-[0_4px_12px_rgba(22,163,74,0.35)] active:scale-[0.98] transition-all ${
            isRunning
              ? 'bg-[#15803D] ring-2 ring-emerald-400'
              : 'bg-[#16A34A] hover:bg-[#15803D]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl font-bold fill-1">
                {isRunning ? 'pause' : 'play_arrow'}
              </span>
            </div>
            <div className="text-left">
              <span className="text-xl font-bold font-['Hanken_Grotesk'] uppercase tracking-wider block">
                {isRunning ? 'JEDA (PAUSE SIKLUS)' : 'MULAI (START)'}
              </span>
              <span className="text-sm text-white/80">
                {isRunning
                  ? 'Waktu pengerjaan sedang berjalan. Klik untuk jeda sementara.'
                  : 'Mulai pengerjaan bundle dan rekam waktu siklus'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-3xl text-white/60 group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </button>

        {/* SELESAI (COMPLETE) */}
        <button
          onClick={onComplete}
          className="group h-full min-h-[4.25rem] bg-[#2563EB] hover:bg-[#1D4ED8] border border-white/20 rounded flex items-center justify-between px-6 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)] active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl font-bold fill-1">
                check_circle
              </span>
            </div>
            <div className="text-left">
              <span className="text-xl font-bold font-['Hanken_Grotesk'] uppercase tracking-wider block">
                SELESAI (COMPLETE)
              </span>
              <span className="text-sm text-white/80">
                Selesaikan bundle &amp; kirim telemetry ke Line 03
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-3xl text-white/60 group-hover:translate-x-1 transition-transform">
            send
          </span>
        </button>

        {/* LAPOR DOWNTIME */}
        <button
          onClick={onOpenDowntime}
          className={`group h-full min-h-[4.25rem] border border-white/20 rounded flex items-center justify-between px-6 text-white shadow-[0_4px_12px_rgba(220,38,38,0.35)] active:scale-[0.98] transition-all ${
            isDowntimeActive
              ? 'bg-[#B91C1C] ring-4 ring-red-400 animate-pulse'
              : 'bg-[#DC2626] hover:bg-[#B91C1C]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl font-bold fill-1">
                warning
              </span>
            </div>
            <div className="text-left">
              <span className="text-xl font-bold font-['Hanken_Grotesk'] uppercase tracking-wider block">
                {isDowntimeActive ? 'DOWNTIME AKTIF (KLIK UNTUK RESUME)' : 'LAPOR DOWNTIME'}
              </span>
              <span className="text-sm text-white/80">
                {isDowntimeActive
                  ? 'Mesin sedang berhenti. Klik untuk mencatat penyelesaian / restart line.'
                  : 'Benang putus, jarum patah, atau masalah mesin'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-3xl text-white/60 group-hover:scale-110 transition-transform">
            {isDowntimeActive ? 'play_circle' : 'report'}
          </span>
        </button>
      </div>
    </section>
  );
};
