import React, { useState } from 'react';
import { DowntimeTicket } from '../types/mes';
import { soundManager } from '../utils/audio';

interface DowntimeViewProps {
  downtimeTickets: DowntimeTicket[];
  onOpenReportIncident: () => void;
  onResolveTicket: (ticketId: string) => void;
  onCallChiefTechnician: (ticket: DowntimeTicket) => void;
}

export const DowntimeView: React.FC<DowntimeViewProps> = ({
  downtimeTickets,
  onOpenReportIncident,
  onResolveTicket,
  onCallChiefTechnician,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const filteredTickets = downtimeTickets.filter((t) => {
    if (filterSeverity === 'ALL') return true;
    if (filterSeverity === 'ACTIVE') return t.status === 'DALAM PERBAIKAN';
    if (filterSeverity === 'RESOLVED') return t.status === 'SELESAI / RUNNING';
    return true;
  });

  return (
    <main className="flex-1 overflow-y-auto bg-[#0B0F17] p-6 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#DC2626] text-xl" data-icon="build">
              build
            </span>
            <h1 className="font-condensed text-2xl font-bold uppercase text-[#F8FAFC]">
              Downtime Registry &amp; Machine Maintenance Center
            </h1>
          </div>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            Sewing Line 1 Mechanical Health · MTTR: 11.4 Menit · MTBF: 14.8 Jam Operasi
          </p>
        </div>

        <button
          onClick={() => {
            soundManager.playHazardAlarm();
            onOpenReportIncident();
          }}
          className="tactile-edge tactile-shadow bg-[#DC2626] hover:bg-red-700 text-[#F8FAFC] border border-[#DC2626] px-4 py-2.5 font-condensed text-base uppercase font-bold flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base" data-icon="add_circle">
            add_circle
          </span>
          <span>+ Buat Tiket Kendala Baru</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#64748B] uppercase font-bold">
            MTTR (MEAN TIME TO REPAIR)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-condensed text-3xl font-bold text-[#F8FAFC]">11.4</span>
            <span className="font-mono text-xs text-[#64748B]">MENIT</span>
          </div>
          <span className="text-[10px] font-mono text-[#16A34A] mt-2 font-bold">
            ▼ 2.1 Menit vs Benchmark Pabrik
          </span>
        </div>

        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#64748B] uppercase font-bold">
            MTBF (MEAN TIME BETWEEN FAILURES)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-condensed text-3xl font-bold text-[#F8FAFC]">14.8</span>
            <span className="font-mono text-xs text-[#64748B]">JAM</span>
          </div>
          <span className="text-[10px] font-mono text-[#16A34A] mt-2 font-bold">
            ▲ 96.2% Reliability Index
          </span>
        </div>

        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between border-l-4 border-l-[#DC2626]">
          <span className="text-[11px] font-mono text-[#DC2626] uppercase font-bold">
            TIKET AKTIF SAAT INI
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-condensed text-3xl font-bold text-[#DC2626]">
              {downtimeTickets.filter((t) => t.status === 'DALAM PERBAIKAN').length}
            </span>
            <span className="font-mono text-xs text-[#ffb4ab]">MESIN BERHENTI</span>
          </div>
          <span className="text-[10px] font-mono text-[#DC2626] mt-2 font-bold">
            SIRUBA F007-03 [COVERSTITCH]
          </span>
        </div>

        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#64748B] uppercase font-bold">
            TEKNISI ON-DUTY
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-condensed text-3xl font-bold text-[#4ADE80]">3 / 3</span>
            <span className="font-mono text-xs text-[#64748B]">STANDBY</span>
          </div>
          <span className="text-[10px] font-mono text-[#64748B] mt-2">
            Hendra S. (Lead), Agus P., Rian H.
          </span>
        </div>
      </div>

      {/* Ticket List Section */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#334155] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-lg" data-icon="assignment">
              assignment
            </span>
            <h2 className="font-condensed text-lg uppercase text-[#F8FAFC] font-bold tracking-wider">
              Log Riwayat &amp; Tiket Perbaikan Mesin
            </h2>
          </div>

          <div className="flex gap-2">
            {['ALL', 'ACTIVE', 'RESOLVED'].map((f) => (
              <button
                key={f}
                onClick={() => {
                  soundManager.playClick();
                  setFilterSeverity(f);
                }}
                className={`px-3 py-1 font-mono text-xs uppercase font-bold border transition-colors cursor-pointer ${
                  filterSeverity === f
                    ? 'bg-[#2563EB] border-[#2563EB] text-[#F8FAFC]'
                    : 'bg-[#1E293B] border-[#334155] text-[#64748B] hover:text-[#F8FAFC]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#334155]">
          {filteredTickets.map((ticket) => {
            const isActive = ticket.status === 'DALAM PERBAIKAN';
            return (
              <div
                key={ticket.id}
                className={`py-4 px-2 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isActive ? 'bg-[#1e1315]/40 border-l-4 border-l-[#DC2626] pl-4' : 'hover:bg-[#1E293B]/40'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#b4c5ff] bg-[#1E293B] border border-[#334155] px-2 py-0.5">
                      {ticket.id}
                    </span>
                    <span className="font-condensed text-xl font-bold text-[#F8FAFC] uppercase">
                      {ticket.machineName}
                    </span>
                    <span className="font-mono text-xs text-[#64748B]">({ticket.machineType})</span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 font-bold uppercase border ${
                        isActive
                          ? 'bg-[#300C0C] border-[#DC2626] text-[#ffb4ab]'
                          : 'bg-[#0F291E] border-[#16A34A] text-[#4ADE80]'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <p
                    className={`font-mono text-xs mt-1 font-bold ${
                      isActive ? 'text-[#DC2626]' : 'text-[#64748B]'
                    }`}
                  >
                    {ticket.issueDescription}
                  </p>

                  <div className="flex items-center gap-4 mt-2 font-mono text-[11px] text-[#64748B]">
                    <span>
                      WAKTU MULAI: <strong className="text-[#F8FAFC]">{ticket.startTime}</strong>
                    </span>
                    <span>
                      DURASI: <strong className="text-[#F8FAFC]">{ticket.durationMinutes} Menit</strong>
                    </span>
                    <span>
                      TEKNISI: <strong className="text-[#F8FAFC]">{ticket.technician}</strong>
                    </span>
                    {ticket.rootCause && (
                      <span className="text-[#b4c5ff]">Root Cause: {ticket.rootCause}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isActive ? (
                    <>
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onCallChiefTechnician(ticket);
                        }}
                        className="tactile-edge px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-mono uppercase text-[#F8FAFC] font-bold cursor-pointer"
                      >
                        Panggil Tim Cepat
                      </button>
                      <button
                        onClick={() => {
                          soundManager.playSuccess();
                          onResolveTicket(ticket.id);
                        }}
                        className="tactile-edge px-4 py-1.5 bg-[#16A34A] hover:bg-green-700 text-[#F8FAFC] border border-[#16A34A] text-xs font-mono uppercase font-bold cursor-pointer"
                      >
                        Resolve &amp; Resume
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1 bg-[#1E293B] text-xs font-mono text-[#64748B]">
                      Telah Diverifikasi
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};
