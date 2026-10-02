import React from 'react';
import { KioskTerminal } from '../types';

interface TerminalsFleetModalProps {
  isOpen: boolean;
  onClose: () => void;
  terminals: KioskTerminal[];
  isFloorLockout: boolean;
  onToggleTerminalStatus: (terminalId: string) => void;
}

export const TerminalsFleetModal: React.FC<TerminalsFleetModalProps> = ({
  isOpen,
  onClose,
  terminals,
  isFloorLockout,
  onToggleTerminalStatus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">devices</span>
            <div>
              <h3 className="font-bold text-[16px] text-[#191c1e]">
                Factory Floor Kiosk Fleet (12 Terminals)
              </h3>
              <p className="text-[11px] text-[#545f73]">
                Garment Plant A1 • Real-time Hardware Telemetry &amp; Line Kiosks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#545f73] hover:text-[#191c1e] p-1 rounded hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Status banner if locked */}
        {isFloorLockout && (
          <div className="bg-[#ffdad6] text-[#ba1a1a] px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b border-[#ba1a1a]/30">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            <span>EMERGENCY FLOOR LOCKOUT ACTIVE: All line terminals forced into maintenance standby.</span>
          </div>
        )}

        {/* Content Table */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {terminals.map((t) => {
              const effectiveStatus = isFloorLockout ? 'LOCKED' : t.status;

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border transition-all ${
                    effectiveStatus === 'LOCKED'
                      ? 'border-[#ba1a1a] bg-[#ffdad6]/20'
                      : effectiveStatus === 'ONLINE'
                      ? 'border-[#e0e3e5] bg-[#ffffff] hover:border-[#bcc7de]'
                      : 'border-[#e0e3e5] bg-[#f2f4f6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-[#191c1e]">{t.id}</span>
                      <span className="text-[11px] font-semibold text-[#545f73]">• {t.line}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        effectiveStatus === 'ONLINE'
                          ? 'bg-[#007f36]/15 text-[#007f36]'
                          : effectiveStatus === 'LOCKED'
                          ? 'bg-[#ba1a1a] text-white'
                          : 'bg-[#545f73]/15 text-[#545f73]'
                      }`}
                    >
                      {effectiveStatus}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-[#545f73]">
                    <div className="flex justify-between">
                      <span>Operator:</span>
                      <strong className="text-[#191c1e]">{t.currentOperator}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Active SPK:</span>
                      <span className="font-mono text-[#004ac6]">{t.activeSpk}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-mono text-[#191c1e]">{t.piecesProcessed} pcs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IP / Ping:</span>
                      <span className="font-mono text-[#545f73]">
                        {t.ipAddress} ({t.pingMs}ms)
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#e0e3e5] flex items-center justify-between">
                    <span className="text-[10px] text-[#545f73]">Synced {t.lastSync}</span>
                    <button
                      onClick={() => onToggleTerminalStatus(t.id)}
                      className="text-[11px] font-semibold text-[#004ac6] hover:underline cursor-pointer"
                    >
                      {effectiveStatus === 'ONLINE' ? 'Force Standby' : 'Resume Terminal'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between text-xs">
          <span className="text-[#545f73]">
            12 of 12 Nodes Reporting to Central Factory Switch
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#2563eb] text-white font-semibold hover:bg-[#004ac6] text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
