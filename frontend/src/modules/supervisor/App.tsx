import { useState } from 'react';
import {
  INITIAL_SPKS,
  INITIAL_DOWNTIME_TICKETS,
  INITIAL_OPERATORS,
  INITIAL_BUNDLES,
  INITIAL_DEFECTS,
} from './data/mockData';
import { SPKOrder, DowntimeTicket, OperatorTelemetry, BundleItem, DefectItem } from './types/mes';
import { TopBar } from './components/TopBar';
import { Sidebar, NavTab } from './components/Sidebar';
import { TelemetryView } from './components/TelemetryView';
import { WipFlowView } from './components/WipFlowView';
import { DowntimeView } from './components/DowntimeView';
import { BundleQcView } from './components/BundleQcView';
import { PrintTicketsModal } from './components/modals/PrintTicketsModal';
import { BundleDetailModal } from './components/modals/BundleDetailModal';
import { PriorityModal } from './components/modals/PriorityModal';
import { HaltLineModal } from './components/modals/HaltLineModal';
import { ReportIncidentModal } from './components/modals/ReportIncidentModal';
import { TerminalConfigModal } from './components/modals/TerminalConfigModal';
import { NotificationDrawer, AlertNotification } from './components/modals/NotificationDrawer';
import { soundManager } from './utils/audio';
import { useSession } from '../../core/session';

export default function App() {
  // Data biaya (HPP) dikunci untuk Supervisor sesuai FRD — tidak ada menu COST HPP.
  const { logout } = useSession();
  const [activeTab, setActiveTab] = useState<NavTab>('TELEMETRY');
  const [spks, setSpks] = useState<SPKOrder[]>(INITIAL_SPKS);
  const [downtimeTickets, setDowntimeTickets] = useState<DowntimeTicket[]>(INITIAL_DOWNTIME_TICKETS);
  const [operators, setOperators] = useState<OperatorTelemetry[]>(INITIAL_OPERATORS);
  const [bundles, setBundles] = useState<BundleItem[]>(INITIAL_BUNDLES);
  const [defects, setDefects] = useState<DefectItem[]>(INITIAL_DEFECTS);

  const [selectedStation, setSelectedStation] = useState<string>('SEWING LINE 1');
  const [isLineHalted, setIsLineHalted] = useState<boolean>(false);

  // Modals state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printModalSpkCode, setPrintModalSpkCode] = useState<string>('SPK-2026-10-042');
  const [isHaltModalOpen, setIsHaltModalOpen] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isReportIncidentOpen, setIsReportIncidentOpen] = useState<boolean>(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [selectedBundleSpk, setSelectedBundleSpk] = useState<SPKOrder | null>(null);
  const [selectedPrioritySpk, setSelectedPrioritySpk] = useState<SPKOrder | null>(null);

  // Status Banner / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AlertNotification[]>([
    {
      id: 'notif-1',
      title: 'Siruba F007-03 Jarum Patah',
      time: '08:24 WIB',
      type: 'CRITICAL',
      message: 'Operator Joko OP-0210 melaporkan jarum patah dan looper slip. Teknisi Hendra sedang menangani.',
    },
    {
      id: 'notif-2',
      title: 'Sewing Buffer Warning SPK-045',
      time: '08:18 WIB',
      type: 'WARNING',
      message: 'Buffer antara sewing dan bonding tersisa 4 bundles. Membutuhkan auto-balancing.',
    },
    {
      id: 'notif-3',
      title: 'Zebra ZT411 Ready',
      time: '07:00 WIB',
      type: 'INFO',
      message: 'Printer thermal siap cetak ZPL pada IP 192.168.10.84.',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Actions
  const handleResolveTicket = (ticketId: string) => {
    setDowntimeTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'SELESAI / RUNNING',
              severity: 'RESOLVED',
              rootCause: 'Pembersihan looper & kalibrasi ulang selesai oleh teknisi',
            }
          : t
      )
    );
    // Also resolve machine issue for operator
    setOperators((prev) =>
      prev.map((op) =>
        op.code === 'OP-0210'
          ? {
              ...op,
              status: 'ON_TARGET',
              variancePercent: -2,
            }
          : op
      )
    );
    showToast('TIKET TERSELESAIKAN: Mesin Siruba F007-03 kembali beroperasi');
  };

  const handleCallChiefTechnician = (ticket: DowntimeTicket) => {
    soundManager.playHazardAlarm();
    showToast(`PANGGILAN DARURAT: Lead Teknisi Hendra telah di-page ke ${ticket.machineName}`);
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `Panggilan Darurat ${ticket.machineName}`,
        time: 'Baru saja',
        type: 'CRITICAL',
        message: `Supervisor memanggil teknisi utama untuk ${ticket.issueDescription}`,
      },
      ...prev,
    ]);
  };

  const handleToggleHalt = (reason: string) => {
    const newState = !isLineHalted;
    setIsLineHalted(newState);
    if (newState) {
      showToast(`EMERGENCY HALT: ${reason}`);
      setNotifications((prev) => [
        {
          id: `halt-${Date.now()}`,
          title: 'EMERGENCY LINE HALT',
          time: 'Baru saja',
          type: 'CRITICAL',
          message: `Line dihentikan oleh SPV-7092. Alasan: ${reason}`,
        },
        ...prev,
      ]);
    } else {
      showToast('LINE RESUMED: Aliran konveyor dan mesin sewing kembali berjalan normal.');
    }
  };

  const handlePrintSuccess = (spkCode: string, count: number) => {
    showToast(`SUKSES: ${count} bundle labels berhasil dicetak ke Zebra ZT411 (${spkCode})`);
    setNotifications((prev) => [
      {
        id: `print-${Date.now()}`,
        title: `Cetak Bundle Label: ${spkCode}`,
        time: 'Baru saja',
        type: 'INFO',
        message: `${count} tiket QR Code berhasil dikirim ke printer Zebra ZT411.`,
      },
      ...prev,
    ]);
  };

  const handleSavePriority = (spkId: string, priority: SPKOrder['priority'], note: string) => {
    setSpks((prev) =>
      prev.map((s) => (s.id === spkId ? { ...s, priority, note: note || s.note } : s))
    );
    showToast(`Prioritas SPK diperbarui menjadi ${priority}`);
  };

  const handleNewIncident = (ticket: DowntimeTicket) => {
    setDowntimeTickets((prev) => [ticket, ...prev]);
    showToast(`TIKET BARU DIBUAT: ${ticket.machineName} - ${ticket.technician}`);
    setNotifications((prev) => [
      {
        id: ticket.id,
        title: `Kendala Baru: ${ticket.machineName}`,
        time: ticket.startTime,
        type: ticket.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        message: ticket.issueDescription,
      },
      ...prev,
    ]);
  };

  const handleAdvanceWip = (spkId: string, stageName: string) => {
    setSpks((prev) =>
      prev.map((s) => {
        if (s.id !== spkId) return s;
        const newStages = s.stages.map((stg) => {
          if (stg.stage === stageName) {
            const nextCompleted = Math.min(stg.totalBundles, stg.completedBundles + 1);
            return {
              ...stg,
              completedBundles: nextCompleted,
              percentage: Math.round((nextCompleted / stg.totalBundles) * 100),
            };
          }
          return stg;
        });
        const avg = Math.round(
          newStages.reduce((acc, curr) => acc + curr.percentage, 0) / newStages.length
        );
        return {
          ...s,
          stages: newStages,
          progressPercent: avg,
        };
      })
    );
    showToast(`WIP Stage ${stageName} berhasil di-scan maju 1 bundle.`);
  };

  const handleUpdateBundleStatus = (bundleId: string, status: BundleItem['status']) => {
    setBundles((prev) =>
      prev.map((b) => (b.bundleId === bundleId ? { ...b, status } : b))
    );
    showToast(`Bundle ${bundleId} status: ${status}`);
  };

  const handleIncrementDefect = (defectId: string) => {
    setDefects((prev) =>
      prev.map((d) => (d.id === defectId ? { ...d, count: d.count + 1 } : d))
    );
  };

  return (
    <div className="bg-[#0B0F17] text-[#d4e4fa] min-h-screen flex flex-col font-mono select-none overflow-x-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#1E293B] border-2 border-[#2563EB] text-[#F8FAFC] px-4 py-2.5 shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[#2563EB] text-lg" data-icon="info">
            info
          </span>
          <span className="text-xs font-mono font-bold tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Emergency Halt Banner if Line is Halted */}
      {isLineHalted && (
        <div className="w-full bg-[#300C0C] border-b-2 border-[#DC2626] text-[#ffb4ab] px-6 py-2 flex items-center justify-between text-xs font-mono font-bold animate-pulse z-30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#DC2626] text-xl" data-icon="report">
              report
            </span>
            <span>PERINGATAN: SEWING LINE 1 DALAM STATUS EMERGENCY HALT · KONVEYOR &amp; MESIN BERHENTI</span>
          </div>
          <button
            onClick={() => setIsHaltModalOpen(true)}
            className="px-3 py-1 bg-[#16A34A] hover:bg-green-700 text-white text-[11px] font-bold uppercase cursor-pointer"
          >
            Buka Kunci &amp; Resume Line
          </button>
        </div>
      )}

      {/* TOP APP BAR */}
      <TopBar
        onOpenPrintModal={() => {
          setPrintModalSpkCode('SPK-2026-10-042');
          setIsPrintModalOpen(true);
        }}
        onOpenHaltModal={() => setIsHaltModalOpen(true)}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        isLineHalted={isLineHalted}
        selectedStation={selectedStation}
        onSelectStation={setSelectedStation}
        notificationCount={notifications.length}
        onToggleNotifications={() => setIsNotificationOpen((prev) => !prev)}
      />

      {/* BODY CONTENT AREA (Shell: SideNav + Main Dashboard Canvas) */}
      <div className="flex flex-1 w-full overflow-hidden">
        {/* SIDE NAV BAR */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenReportIncident={() => setIsReportIncidentOpen(true)}
          onOpenTerminalConfig={() => setIsConfigModalOpen(true)}
          onLogout={() => {
            soundManager.playClick();
            logout();
          }}
          activeDowntimeCount={downtimeTickets.filter((t) => t.status === 'DALAM PERBAIKAN').length}
        />

        {/* ACTIVE MAIN VIEW CANVAS */}
        {activeTab === 'TELEMETRY' && (
          <TelemetryView
            spks={spks}
            downtimeTickets={downtimeTickets}
            operators={operators}
            onOpenBundleDetail={(spk) => {
              setSelectedBundleSpk(spk);
            }}
            onOpenPriorityModal={(spk) => {
              setSelectedPrioritySpk(spk);
            }}
            onOpenPrintModalWithSpk={(code) => {
              setPrintModalSpkCode(code);
              setIsPrintModalOpen(true);
            }}
            onResolveTicket={handleResolveTicket}
            onCallChiefTechnician={handleCallChiefTechnician}
          />
        )}

        {activeTab === 'WIP FLOW' && (
          <WipFlowView
            spks={spks}
            onOpenBundleDetail={(spk) => setSelectedBundleSpk(spk)}
            onAdvanceWip={handleAdvanceWip}
          />
        )}

        {activeTab === 'DOWNTIME' && (
          <DowntimeView
            downtimeTickets={downtimeTickets}
            onOpenReportIncident={() => setIsReportIncidentOpen(true)}
            onResolveTicket={handleResolveTicket}
            onCallChiefTechnician={handleCallChiefTechnician}
          />
        )}

        {activeTab === 'BUNDLE QC' && (
          <BundleQcView
            bundles={bundles}
            defects={defects}
            onUpdateBundleStatus={handleUpdateBundleStatus}
            onIncrementDefect={handleIncrementDefect}
          />
        )}
      </div>

      {/* MODALS */}
      {/* 1. Print Bundle Tickets QR Modal */}
      <PrintTicketsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        spks={spks}
        initialSpkCode={printModalSpkCode}
        onPrintSuccess={handlePrintSuccess}
      />

      {/* 2. Bundle Detail Tracking Modal */}
      <BundleDetailModal
        isOpen={selectedBundleSpk !== null}
        onClose={() => setSelectedBundleSpk(null)}
        spk={selectedBundleSpk}
        bundles={bundles}
        onReprintSingleBundle={(bundleId) => {
          showToast(`Mencetak ulang barcode tiket ${bundleId}...`);
        }}
      />

      {/* 3. Priority Rebalancing Modal */}
      <PriorityModal
        isOpen={selectedPrioritySpk !== null}
        onClose={() => setSelectedPrioritySpk(null)}
        spk={selectedPrioritySpk}
        onSavePriority={handleSavePriority}
      />

      {/* 4. Halt Line Modal */}
      <HaltLineModal
        isOpen={isHaltModalOpen}
        onClose={() => setIsHaltModalOpen(false)}
        isHalted={isLineHalted}
        onToggleHalt={handleToggleHalt}
      />

      {/* 5. Report Incident Modal */}
      <ReportIncidentModal
        isOpen={isReportIncidentOpen}
        onClose={() => setIsReportIncidentOpen(false)}
        onSubmitIncident={handleNewIncident}
      />

      {/* 6. Terminal Configuration Modal */}
      <TerminalConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />

      {/* 7. Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        onClearAll={() => setNotifications([])}
      />
    </div>
  );
}
