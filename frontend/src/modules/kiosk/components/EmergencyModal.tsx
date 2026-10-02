import React, { useEffect, useState } from 'react';
import { playEmergencyAlarm, playTactileClick } from '../utils/audio';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetEmergency: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onResetEmergency,
}) => {
  const [alarmActive, setAlarmActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (alarmActive) {
        playEmergencyAlarm();
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [isOpen, alarmActive]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="bg-[#1E293B] border-4 border-[#DC2626] w-full max-w-xl rounded-lg p-6 shadow-[0_0_50px_rgba(220,38,38,0.7)] flex flex-col items-center text-center gap-4">
        {/* Pulsing Alert Icon */}
        <div className="w-20 h-20 rounded-full bg-[#DC2626]/20 border-2 border-[#DC2626] flex items-center justify-center text-[#DC2626] animate-bounce">
          <span className="material-symbols-outlined text-5xl font-bold">
            e911_emergency
          </span>
        </div>

        <div>
          <h2 className="text-3xl font-extrabold text-white font-['Hanken_Grotesk'] tracking-wide">
            EMERGENCY HALT DIPICU
          </h2>
          <p className="text-sm text-red-200 mt-1">
            Lini 02 Sewing (Station 01 - 08) telah diputus daya motornya.
          </p>
        </div>

        <div className="bg-[#27354A] w-full p-3 rounded border border-[#DC2626]/40 text-left text-xs text-[#94A3B8] space-y-1 font-mono">
          <div className="text-white font-bold">TELEMETRY INTERLOCK PROTOCOL:</div>
          <div>• PLC Relays: DE-ENERGIZED (OPEN)</div>
          <div>• Sewing Motor Drive: ZERO SPEED CLAMP</div>
          <div>• Notification: Supervisor Dispatch SMS &amp; ANDON TOWER RED FLASH</div>
        </div>

        <div className="flex items-center gap-3 w-full pt-2">
          <button
            onClick={() => {
              playTactileClick();
              setAlarmActive(!alarmActive);
            }}
            className="flex-1 h-12 rounded bg-[#27354A] hover:bg-[#323537] text-white text-xs font-bold border border-[#334155] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">
              {alarmActive ? 'volume_off' : 'volume_up'}
            </span>
            <span>{alarmActive ? 'Mute Sirene' : 'Aktifkan Sirene'}</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              onResetEmergency();
            }}
            className="flex-1 h-12 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
            <span>Reset Interlock Line</span>
          </button>
        </div>
      </div>
    </div>
  );
};
