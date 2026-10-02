import React from 'react';
import { SPKOrder, DowntimeTicket, OperatorTelemetry } from '../types/mes';
import { soundManager } from '../utils/audio';

interface TelemetryViewProps {
  spks: SPKOrder[];
  downtimeTickets: DowntimeTicket[];
  operators: OperatorTelemetry[];
  onOpenBundleDetail: (spk: SPKOrder) => void;
  onOpenPriorityModal: (spk: SPKOrder) => void;
  onOpenPrintModalWithSpk: (spkCode: string) => void;
  onResolveTicket: (ticketId: string) => void;
  onCallChiefTechnician: (ticket: DowntimeTicket) => void;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  spks,
  downtimeTickets,
  operators,
  onOpenBundleDetail,
  onOpenPriorityModal,
  onResolveTicket,
  onCallChiefTechnician,
}) => {
  const activeDowntimeCount = downtimeTickets.filter((t) => t.status !== 'SELESAI / RUNNING').length;
  const criticalTicket = downtimeTickets.find((t) => t.status === 'DALAM PERBAIKAN') || downtimeTickets[0];

  return (
    <main className="flex-1 overflow-y-auto bg-[#0B0F17] p-6 flex flex-col gap-6">
      {/* 2. TOP KPI METRIC SUMMARY BAR (4 Cards) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1: SPK Batches */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2">
            <span className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              ACTIVE SPK BATCHES
            </span>
            <span className="material-symbols-outlined text-[#b4c5ff] text-lg" data-icon="inventory_2">
              inventory_2
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-condensed text-4xl font-bold text-[#F8FAFC]">4</span>
            <span className="font-condensed text-base text-[#64748B] uppercase font-semibold">
              SPK BERJALAN
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#b4c5ff] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" data-icon="sync">
              sync
            </span>
            <span>LINE INVENTORY: 150 BUNDLES</span>
          </div>
        </div>

        {/* Metric Card 2: Shift Output Target */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2">
            <span className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              TARGET OUTPUT SHIFT INI
            </span>
            <span className="material-symbols-outlined text-[#b4c5ff] text-lg" data-icon="track_changes">
              track_changes
            </span>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-condensed text-4xl font-bold text-[#F8FAFC]">1,848</span>
              <span className="font-condensed text-base text-[#64748B] font-semibold">/ 2,400 PCS</span>
            </div>
            <div className="w-full bg-[#1E293B] h-2 mt-2 border border-[#334155] overflow-hidden">
              <div className="bg-[#2563eb] h-full" style={{ width: '77%' }}></div>
            </div>
          </div>
          <div className="mt-2 text-xs font-mono text-[#16A34A] flex items-center justify-between">
            <span className="font-bold">CAPAIAN: 77.0%</span>
            <span className="text-[#64748B]">SISA: 552 PCS</span>
          </div>
        </div>

        {/* Metric Card 3: Line Efficiency OEE */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between border-l-4 border-l-[#16A34A]">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2">
            <span className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              LINE EFFICIENCY (OEE)
            </span>
            <span className="px-2 py-0.5 text-xs font-mono uppercase bg-[#0F291E] border border-[#16A34A] text-[#4ADE80] font-bold">
              NORMAL HIJAU
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-condensed text-4xl font-bold text-[#4ADE80]">89.4%</span>
            <span className="font-condensed text-base text-[#64748B] font-semibold">/ TARGET 85%</span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#64748B] flex items-center gap-2">
            <span>AVAIL: 94%</span>
            <span>•</span>
            <span>PERF: 92%</span>
            <span>•</span>
            <span>QUAL: 99.1%</span>
          </div>
        </div>

        {/* Metric Card 4: Active Downtime */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between border-l-4 border-l-[#DC2626] animate-hazard">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2">
            <span className="font-mono text-[11px] text-[#DC2626] uppercase tracking-wider font-bold">
              ACTIVE DOWNTIME
            </span>
            <span className="material-symbols-outlined text-[#DC2626] text-lg" data-icon="error">
              error
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-condensed text-4xl font-bold text-[#F8FAFC]">{activeDowntimeCount}</span>
            <span className="font-condensed text-base text-[#DC2626] uppercase font-bold">
              MESIN KENDALA
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#DC2626] flex items-center justify-between">
            <span className="font-bold">{criticalTicket ? criticalTicket.machineName : 'ALL CLEAR'}</span>
            <span className="underline font-bold">
              {criticalTicket ? `STOP: ${criticalTicket.durationMinutes} MIN` : '0 MIN'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. MAIN 2-COLUMN OPERATIONAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: WIP Progress per SPK (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-[#1E293B] border border-[#334155] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#b4c5ff]" data-icon="alt_route">
                alt_route
              </span>
              <h2 className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
                Monitoring Progres WIP SPK Aktif
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
              <span>FIFO SEQUENCING</span>
              <span className="text-[#2563EB]">● AUTO-BALANCING ON</span>
            </div>
          </div>

          {/* SPK Cards */}
          {spks.slice(0, 3).map((spk) => (
            <div
              key={spk.id}
              className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4 hover:border-[#475569] transition-colors"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#334155] pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#1E293B] text-[#b4c5ff] border border-[#334155] px-2 py-0.5 font-mono text-xs font-bold">
                      {spk.code}
                    </span>
                    <span className="font-condensed text-xl font-bold text-[#F8FAFC]">{spk.name}</span>
                    {spk.priority === 'RUSH' && (
                      <span className="bg-[#300C0C] text-[#ffb4ab] border border-[#DC2626] text-[10px] px-1 font-mono font-bold">
                        RUSH
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs font-mono text-[#64748B]">
                    <span>
                      TARGET: <strong className="text-[#F8FAFC]">{spk.targetPcs.toLocaleString()} PCS</strong> ({spk.totalBundles} BUNDLES)
                    </span>
                    <span>
                      SKU: <strong className="text-[#F8FAFC]">{spk.sku}</strong>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-xs font-mono text-[#64748B]">OVERALL PROGRESS:</span>
                    <span
                      className={`font-condensed text-2xl font-bold ${
                        spk.progressPercent >= 70
                          ? 'text-[#16A34A]'
                          : spk.progressPercent >= 30
                          ? 'text-[#D97706]'
                          : 'text-[#64748B]'
                      }`}
                    >
                      {spk.progressPercent}%
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#64748B]">EST FINISH: {spk.estFinish}</span>
                </div>
              </div>

              {/* Pipeline Stage Telemetry */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono uppercase text-[#64748B]">
                  PIPELINE STAGE TELEMETRY:
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {spk.stages.map((stg) => {
                    const isZero = stg.percentage === 0;
                    const statusColor =
                      stg.percentage === 100
                        ? 'text-[#16A34A]'
                        : stg.percentage >= 60
                        ? 'text-[#b4c5ff]'
                        : stg.percentage > 0
                        ? 'text-[#D97706]'
                        : 'text-[#64748B]';

                    const barColor =
                      stg.percentage === 100
                        ? 'bg-[#16A34A]'
                        : stg.percentage >= 60
                        ? 'bg-[#2563EB]'
                        : stg.percentage > 0
                        ? 'bg-[#D97706]'
                        : 'bg-transparent';

                    return (
                      <div
                        key={stg.stage}
                        className={`bg-[#1E293B] border border-[#334155] p-2 ${
                          isZero ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-mono text-[#64748B] uppercase">
                          <span>{stg.stage}</span>
                          <span className={`font-bold ${statusColor}`}>{stg.percentage}%</span>
                        </div>
                        <div className="w-full bg-[#0B0F17] h-1.5 my-1.5 overflow-hidden">
                          <div
                            className={`h-full ${barColor}`}
                            style={{ width: `${stg.percentage}%` }}
                          ></div>
                        </div>
                        <div
                          className={`text-[11px] font-mono text-right ${
                            isZero ? 'text-[#64748B]' : 'text-[#F8FAFC]'
                          }`}
                        >
                          {stg.completedBundles}/{stg.totalBundles} BDL
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Action Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-[#334155] flex-wrap gap-2">
                <div
                  className={`text-xs font-mono flex items-center gap-1.5 ${
                    spk.linePaceType === 'optimal'
                      ? 'text-[#16A34A]'
                      : spk.linePaceType === 'warning'
                      ? 'text-[#D97706]'
                      : 'text-[#64748B]'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    data-icon={
                      spk.linePaceType === 'optimal'
                        ? 'check_circle'
                        : spk.linePaceType === 'warning'
                        ? 'schedule'
                        : 'hourglass_empty'
                    }
                  >
                    {spk.linePaceType === 'optimal'
                      ? 'check_circle'
                      : spk.linePaceType === 'warning'
                      ? 'schedule'
                      : 'hourglass_empty'}
                  </span>
                  <span>{spk.linePace}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onOpenBundleDetail(spk);
                    }}
                    className="tactile-edge bg-[#1E293B] hover:bg-[#334155] border border-[#334155] px-3 py-1.5 text-xs font-mono uppercase text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    Lihat Detail Bundle
                  </button>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onOpenPriorityModal(spk);
                    }}
                    className="tactile-edge bg-[#1E293B] hover:bg-[#334155] border border-[#334155] px-3 py-1.5 text-xs font-mono uppercase text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    Ubah Prioritas Line
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* RIGHT COLUMN: Downtime & Operator Leaderboard (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          {/* SECTION 1: Active Downtime Tickets */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between bg-[#1E293B] border border-[#334155] px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#DC2626]" data-icon="report_problem">
                  report_problem
                </span>
                <h3 className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
                  Active Downtime Tickets (Kendala Mesin)
                </h3>
              </div>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#300C0C] border border-[#DC2626] text-[#F87171] font-bold">
                {activeDowntimeCount} ACTIVE INCIDENT
              </span>
            </div>

            {/* Ticket 1: Active in progress */}
            {downtimeTickets.map((ticket) => {
              const isInRepair = ticket.status === 'DALAM PERBAIKAN';
              return (
                <div
                  key={ticket.id}
                  className={`bg-[#111827] border p-4 flex flex-col gap-2 relative transition-all ${
                    isInRepair ? 'border-2 border-[#DC2626]' : 'border-[#334155] opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-condensed text-xl font-bold text-[#F8FAFC] uppercase">
                          {ticket.machineName}
                        </span>
                        <span className="text-xs font-mono text-[#64748B]">({ticket.machineType})</span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold uppercase tracking-wider block mt-0.5 ${
                          isInRepair ? 'text-[#DC2626]' : 'text-[#64748B]'
                        }`}
                      >
                        {ticket.issueDescription}
                      </span>
                    </div>
                    <div className="text-right">
                      {isInRepair ? (
                        <div className="inline-flex items-center gap-1.5 bg-[#300C0C] border border-[#DC2626] px-2 py-0.5 animate-pulse">
                          <span className="w-2 h-2 bg-[#DC2626]"></span>
                          <span className="font-mono text-xs font-bold text-[#F87171]">
                            {ticket.durationMinutes} MENIT
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-mono bg-[#0F291E] border border-[#16A34A] text-[#4ADE80] font-bold">
                          {ticket.durationMinutes} MENIT
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#334155] text-xs font-mono">
                    <div>
                      <span className="text-[#64748B]">TEKNISI:</span>
                      <span className="text-[#F8FAFC] font-bold ml-1">{ticket.technician}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#64748B]">STATUS:</span>
                      <span
                        className={`font-bold ml-1 uppercase ${
                          isInRepair ? 'text-[#D97706]' : 'text-[#16A34A]'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>

                  {isInRepair && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onCallChiefTechnician(ticket);
                        }}
                        className="tactile-edge flex-1 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] py-1.5 text-xs font-mono uppercase text-[#F8FAFC] font-bold cursor-pointer"
                      >
                        PANGGIL TEKNISI UTAMA
                      </button>
                      <button
                        onClick={() => {
                          soundManager.playSuccess();
                          onResolveTicket(ticket.id);
                        }}
                        className="tactile-edge flex-1 bg-[#16A34A] hover:bg-green-700 text-[#F8FAFC] py-1.5 text-xs font-mono uppercase font-bold border border-[#16A34A] cursor-pointer"
                      >
                        RESOLVE &amp; RESUME
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SECTION 2: Operator Output Leaderboard */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between bg-[#1E293B] border border-[#334155] px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#b4c5ff]" data-icon="leaderboard">
                  leaderboard
                </span>
                <h3 className="font-condensed text-base uppercase text-[#F8FAFC] font-bold tracking-wider">
                  Operator Output Leaderboard (Shift 1)
                </h3>
              </div>
              <span className="text-xs font-mono text-[#64748B]">REAL-TIME TACT</span>
            </div>

            <div className="bg-[#111827] border border-[#334155] divide-y divide-[#334155]">
              {operators.map((op, idx) => {
                const isDown = op.status === 'MACHINE_ISSUE';
                return (
                  <div
                    key={op.id}
                    className={`p-4 flex items-center justify-between hover:bg-[#1E293B] transition-colors ${
                      isDown ? 'border-l-2 border-l-[#DC2626] bg-[#1e1315]/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center font-bold text-xs font-mono ${
                          isDown
                            ? 'bg-[#300C0C] border border-[#DC2626] text-[#DC2626]'
                            : 'bg-[#1E293B] border border-[#334155] text-[#b4c5ff]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-condensed text-base text-[#F8FAFC] uppercase font-bold">
                          {op.name}
                        </span>
                        <div
                          className={`text-xs font-mono ${
                            isDown ? 'text-[#DC2626]' : 'text-[#64748B]'
                          }`}
                        >
                          {op.machine}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-condensed text-xl font-bold text-[#F8FAFC]"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {op.bundlesCompleted} Bundles{' '}
                        <span className="text-xs text-[#64748B] font-mono font-normal">
                          ({op.pcsCompleted} pcs)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase font-bold ${
                          isDown
                            ? 'text-[#DC2626]'
                            : op.variancePercent > 0
                            ? 'text-[#16A34A]'
                            : 'text-[#16A34A]'
                        }`}
                      >
                        {isDown
                          ? '▲ SEDANG KENDALA MESIN'
                          : op.variancePercent > 0
                          ? `● ON TARGET (+${op.variancePercent}%)`
                          : '● ON TARGET'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
