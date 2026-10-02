import React, { useState } from 'react';
import { soundManager } from '../../utils/audio';

interface TerminalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminalConfigModal: React.FC<TerminalConfigModalProps> = ({ isOpen, onClose }) => {
  const [printerIp, setPrinterIp] = useState<string>('192.168.10.84');
  const [printerPort, setPrinterPort] = useState<string>('9100');
  const [printerDpi, setPrinterDpi] = useState<string>('300');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundManager.isEnabled());
  const [pingStatus, setPingStatus] = useState<'IDLE' | 'TESTING' | 'ONLINE'>('IDLE');

  if (!isOpen) return null;

  const handleTestPing = () => {
    soundManager.playScanBeep();
    setPingStatus('TESTING');
    setTimeout(() => {
      soundManager.playSuccess();
      setPingStatus('ONLINE');
    }, 800);
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    soundManager.setSoundEnabled(enabled);
    if (enabled) {
      soundManager.playSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-lg bg-[#111827] border-2 border-[#2563EB] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-10 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-base" data-icon="settings">
              settings
            </span>
            <span className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
              TERMINAL &amp; HARDWARE CONFIGURATION
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111827] cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 font-mono text-xs">
          <div className="border border-[#334155] p-3 bg-[#0B0F17] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <span className="text-xs uppercase font-bold text-[#F8FAFC]">
                Zebra ZT411 Industrial Thermal Printer
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 ${
                  pingStatus === 'ONLINE'
                    ? 'bg-[#0F291E] text-[#4ADE80] border border-[#16A34A]'
                    : 'bg-[#1E293B] text-[#b4c5ff]'
                }`}
              >
                {pingStatus === 'ONLINE' ? 'VERIFIED 3ms' : 'PORT 9100 RAW ZPL'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#64748B] uppercase block mb-1">
                  Printer IP Address
                </label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full h-9 bg-[#1E293B] border border-[#334155] px-2 text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B] uppercase block mb-1">Raw Port</label>
                <input
                  type="text"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  className="w-full h-9 bg-[#1E293B] border border-[#334155] px-2 text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[10px] text-[#64748B] uppercase block mb-1">Printhead DPI</label>
                <select
                  value={printerDpi}
                  onChange={(e) => setPrinterDpi(e.target.value)}
                  className="w-full h-9 bg-[#1E293B] border border-[#334155] px-2 text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="203">203 DPI (Standard)</option>
                  <option value="300">300 DPI (High-Density QR)</option>
                  <option value="600">600 DPI (Micro-Label)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleTestPing}
                disabled={pingStatus === 'TESTING'}
                className="h-9 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#b4c5ff] font-bold uppercase px-3 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm" data-icon="network_ping">
                  network_ping
                </span>
                <span>{pingStatus === 'TESTING' ? 'PINGING...' : 'PING PRINTER'}</span>
              </button>
            </div>
          </div>

          {/* Audio Feedback Settings */}
          <div className="border border-[#334155] p-3 bg-[#0B0F17] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#F8FAFC] uppercase">
                Tactile Audio Beeps &amp; Alarms
              </div>
              <div className="text-[10px] text-[#64748B]">
                Synthesized sound feedback for barcode scanning, print completion, and line halts
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSound(!soundEnabled)}
              className={`px-3 py-1.5 font-bold uppercase border cursor-pointer ${
                soundEnabled
                  ? 'bg-[#16A34A] border-[#16A34A] text-[#F8FAFC]'
                  : 'bg-[#1E293B] border-[#334155] text-[#64748B]'
              }`}
            >
              {soundEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          {/* Plant Floor Environment */}
          <div className="border border-[#334155] p-3 bg-[#0B0F17] flex flex-col gap-2">
            <div className="text-xs font-bold text-[#F8FAFC] uppercase">Station Information</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B]">
              <div>
                TERMINAL ID: <strong className="text-[#F8FAFC]">MES-TERM-SEW01</strong>
              </div>
              <div>
                FIRMWARE: <strong className="text-[#F8FAFC]">v4.8.1-RT-IND</strong>
              </div>
              <div>
                SHIFT WINDOW: <strong className="text-[#F8FAFC]">07:00 - 15:30</strong>
              </div>
              <div>
                PLANT LOCATION: <strong className="text-[#F8FAFC]">PLANT 2 - JAKARTA</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 bg-[#1E293B] border-t border-[#334155] px-6 flex items-center justify-end gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="tactile-edge px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-[#F8FAFC] font-mono text-xs uppercase font-bold cursor-pointer"
          >
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};
