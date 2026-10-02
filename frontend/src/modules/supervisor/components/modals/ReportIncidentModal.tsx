import React, { useState } from 'react';
import { DowntimeTicket } from '../../types/mes';
import { soundManager } from '../../utils/audio';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitIncident: (newTicket: DowntimeTicket) => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmitIncident,
}) => {
  const [machineName, setMachineName] = useState<string>('Siruba F007-03');
  const [machineType, setMachineType] = useState<string>('COVERSTITCH');
  const [issueDescription, setIssueDescription] = useState<string>('MASALAH: ');
  const [technician, setTechnician] = useState<string>('Hendra Saputra');
  const [severity, setSeverity] = useState<'CRITICAL' | 'WARNING'>('CRITICAL');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playHazardAlarm();

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )} WIB`;

    const ticket: DowntimeTicket = {
      id: `DT-2026-${Math.floor(890 + Math.random() * 50)}`,
      machineId: machineName.toUpperCase().replace(/\s+/g, '-'),
      machineName,
      machineType,
      issueDescription: issueDescription.toUpperCase(),
      durationMinutes: 1,
      technician,
      status: 'DALAM PERBAIKAN',
      severity,
      startTime: timeStr,
      rootCause: 'Under active inspection by dispatched technician',
    };

    onSubmitIncident(ticket);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-xl bg-[#111827] border-2 border-[#DC2626] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-10 bg-[#300C0C] border-b border-[#DC2626] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#DC2626] text-base" data-icon="report">
              report
            </span>
            <span className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
              LAPOR KENDALA OPERASIONAL / TIKET DOWNTIME
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#ffb4ab] hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">Unit Mesin / Station</label>
              <select
                value={machineName}
                onChange={(e) => {
                  setMachineName(e.target.value);
                  if (e.target.value.includes('Siruba')) setMachineType('COVERSTITCH');
                  else if (e.target.value.includes('Juki DDL')) setMachineType('JAHIT LURUS');
                  else if (e.target.value.includes('Pegasus')) setMachineType('OVERLOCK');
                  else if (e.target.value.includes('Brother')) setMachineType('BARTACK / LOCKSTITCH');
                }}
                className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#DC2626] uppercase"
              >
                <option value="Siruba F007-03">Siruba F007-03</option>
                <option value="Juki DDL-9000B">Juki DDL-9000B</option>
                <option value="Pegasus EXT-5204">Pegasus EXT-5204</option>
                <option value="Brother S-7200">Brother S-7200</option>
                <option value="Heat Sealer 01">Heat Sealer 01 (Bonding)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">Tipe Operasi Mesin</label>
              <input
                type="text"
                readOnly
                value={machineType}
                className="w-full h-11 bg-[#1E293B] border border-[#334155] text-[#b4c5ff] font-mono text-xs px-3 font-bold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase text-[#64748B]">
              Deskripsi Masalah / Indikasi Kerusakan
            </label>
            <input
              type="text"
              required
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="MASALAH: JARUM PATAH & BENANG KUSUT..."
              className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#DC2626]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">
                Tugaskan Teknisi Mesin
              </label>
              <select
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="w-full h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#DC2626]"
              >
                <option value="Hendra Saputra">Hendra Saputra (Lead Tech)</option>
                <option value="Agus P.">Agus P. (Mechanic 1)</option>
                <option value="Rian Hidayat">Rian Hidayat (Electrical)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase text-[#64748B]">Tingkat Keparahan</label>
              <div className="flex h-11 border border-[#334155]">
                <button
                  type="button"
                  onClick={() => setSeverity('CRITICAL')}
                  className={`flex-1 font-mono text-xs font-bold uppercase transition-colors ${
                    severity === 'CRITICAL'
                      ? 'bg-[#DC2626] text-[#F8FAFC]'
                      : 'bg-[#0B0F17] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  CRITICAL (STOP)
                </button>
                <button
                  type="button"
                  onClick={() => setSeverity('WARNING')}
                  className={`flex-1 font-mono text-xs font-bold uppercase transition-colors ${
                    severity === 'WARNING'
                      ? 'bg-[#D97706] text-[#F8FAFC]'
                      : 'bg-[#0B0F17] text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  WARNING (SLOW)
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-14 bg-[#1E293B] border-t border-[#334155] px-4 -mx-6 -mb-6 mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="tactile-edge px-4 py-2 bg-[#111827] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs uppercase font-bold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="tactile-edge tactile-shadow px-5 py-2 bg-[#DC2626] hover:bg-red-700 text-[#F8FAFC] border border-[#DC2626] font-mono text-xs uppercase font-bold cursor-pointer"
            >
              Kirim Tiket &amp; Panggil Teknisi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
