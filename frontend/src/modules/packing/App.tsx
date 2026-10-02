/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StationView, MultipackSlot, MasterCartonUnit, IncidentReport } from './types/mes';
import {
  INITIAL_SLOTS,
  INITIAL_MASTER_CARTON,
  INITIAL_B2B_MANIFEST,
  INITIAL_B2C_MANIFEST,
  INITIAL_INCIDENTS,
} from './data/initialData';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { FooterTelemetry } from './components/FooterTelemetry';
import { PackagingDispatchScreen } from './components/screens/PackagingDispatchScreen';
import { TelemetryScreen } from './components/screens/TelemetryScreen';
import { WipFlowScreen } from './components/screens/WipFlowScreen';
import { BundleQcScreen } from './components/screens/BundleQcScreen';
import { InventoryOutScreen } from './components/screens/InventoryOutScreen';
import { ScanCartonModal } from './components/modals/ScanCartonModal';
import { PrintShippingLabelsModal } from './components/modals/PrintShippingLabelsModal';
import { HaltStationModal } from './components/modals/HaltStationModal';
import { ReportIncidentModal } from './components/modals/ReportIncidentModal';
import { ManualOverrideModal } from './components/modals/ManualOverrideModal';
import { ReportDamagedModal } from './components/modals/ReportDamagedModal';
import { SuratJalanModal } from './components/modals/SuratJalanModal';
import { ManifestQrModal } from './components/modals/ManifestQrModal';
import { TerminalConfigModal } from './components/modals/TerminalConfigModal';
import { NotificationsDrawer } from './components/modals/NotificationsDrawer';
import { useSession } from '../../core/session';

export default function App() {
  const { logout } = useSession();
  const [currentView, setCurrentView] = useState<StationView>('PACKAGING_DISPATCH');
  const [slots, setSlots] = useState<MultipackSlot[]>(INITIAL_SLOTS);
  const [masterCarton, setMasterCarton] = useState<MasterCartonUnit>(INITIAL_MASTER_CARTON);
  const [b2bManifest, setB2bManifest] = useState(INITIAL_B2B_MANIFEST);
  const [b2cManifest, setB2cManifest] = useState(INITIAL_B2C_MANIFEST);
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS);
  const [isStationHalted, setIsStationHalted] = useState<boolean>(false);
  const [packedCartonsToday, setPackedCartonsToday] = useState<number>(142);
  const [totalCartonsTarget] = useState<number>(200);
  const [isPrintingLabel, setIsPrintingLabel] = useState<boolean>(false);

  // Modals
  const [scanCartonModalOpen, setScanCartonModalOpen] = useState<boolean>(false);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [haltModalOpen, setHaltModalOpen] = useState<boolean>(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState<boolean>(false);
  const [manualOverrideModalOpen, setManualOverrideModalOpen] = useState<boolean>(false);
  const [reportDamagedModalOpen, setReportDamagedModalOpen] = useState<boolean>(false);
  const [suratJalanModalOpen, setSuratJalanModalOpen] = useState<boolean>(false);
  const [manifestQrModalOpen, setManifestQrModalOpen] = useState<boolean>(false);
  const [terminalConfigModalOpen, setTerminalConfigModalOpen] = useState<boolean>(false);
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = useState<boolean>(false);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Handlers
  const handleToggleSlot = (index: number) => {
    if (isStationHalted) {
      showToast('⚠️ STATION HALTED: Clear emergency halt before verifying pieces');
      return;
    }
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, verified: !slot.verified } : slot))
    );
  };

  const handlePackCurrentMultipack = () => {
    if (isStationHalted) {
      showToast('⚠️ STATION HALTED: Clear emergency halt first');
      return;
    }
    const nextPackNumber = `#${String(masterCarton.currentMultipacks + 1).padStart(3, '0')}`;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const newItem = {
      packNumber: nextPackNumber,
      subBundleSku: 'NAQALA-3BX-M (CHAR/BLK/NVY)',
      operator: 'OP-401',
      timestamp: timeStr,
      status: 'PACKED' as const,
    };

    const newCurrent = masterCarton.currentMultipacks + 1;
    setMasterCarton((prev) => ({
      ...prev,
      currentMultipacks: newCurrent,
      totalPcs: newCurrent * 3,
      packedItems: [newItem, ...prev.packedItems],
    }));

    // Reset verification slots for next 3-pack
    setSlots((prev) => prev.map((s) => ({ ...s, verified: false })));
    showToast(`✓ PACKED ${nextPackNumber} INTO ${masterCarton.cartonId}`);
  };

  const handleSealMasterCarton = () => {
    if (isStationHalted) {
      showToast('⚠️ STATION HALTED: Seal aborted');
      return;
    }
    const oldCartonId = masterCarton.cartonId;
    const nextNum = parseInt(oldCartonId.replace(/\D/g, '')) + 1;
    const newCartonId = `CTN-2026-${String(nextNum).padStart(4, '0')}`;

    setPackedCartonsToday((prev) => prev + 1);

    // Initialize new carton
    setMasterCarton({
      cartonId: newCartonId,
      targetMultipacks: 48,
      currentMultipacks: 0,
      totalPcs: 0,
      skuCode: 'NAQALA-3BX-M',
      skuDescription: 'NAQALA SEAMLESS BRIEF - 3-PACK BOX (M, L, XL)',
      sealed: false,
      packedItems: [],
    });

    // Reset slots
    setSlots((prev) => prev.map((s) => ({ ...s, verified: true })));

    showToast(`✓ SEALED ${oldCartonId} // DISPATCH QR STAMPED. INITIALIZED ${newCartonId}`);
    setPrintModalOpen(true);
  };

  const handleTriggerLabelFeed = () => {
    setIsPrintingLabel(true);
    showToast(`[ZEBRA ZT411] FEEDING 100mm x 150mm RESIN LABEL FOR ${masterCarton.cartonId}`);
    setTimeout(() => {
      setIsPrintingLabel(false);
      showToast(`✓ LABEL DISPENSED & CALIBRATED FOR ${masterCarton.cartonId}`);
    }, 1200);
  };

  const handleManualOverride = (slotIdx: number, reason: string) => {
    setSlots((prev) =>
      prev.map((s, idx) =>
        idx === slotIdx ? { ...s, verified: true, specNote: `OVERRIDE: ${reason.slice(0, 18)}...` } : s
      )
    );
    showToast(`✓ SUPERVISOR OVERRIDE APPLIED TO SLOT 0${slotIdx + 1}`);
  };

  const handleConfirmDamage = (damageType: string, notes: string) => {
    const now = new Date();
    const newIncident: IncidentReport = {
      id: `INC-7092-${Math.floor(10 + Math.random() * 90)}`,
      timestamp: now.toTimeString().split(' ')[0],
      severity: 'WARNING',
      title: `Damaged Pack: ${damageType}`,
      description: notes,
      station: 'DOCK 02 // PACKAGING',
      reportedBy: 'OP: Fajar Maulana',
      status: 'OPEN',
    };
    setIncidents((prev) => [newIncident, ...prev]);
    // Reset slot check
    setSlots((prev) => prev.map((s) => ({ ...s, verified: false })));
    showToast(`⚠️ DAMAGED PACK RECORDED & DIVERTED TO REWORK`);
  };

  const handleHaltStation = () => {
    setHaltModalOpen(true);
  };

  const handleConfirmHalt = (reason: string) => {
    setIsStationHalted(true);
    const now = new Date();
    const haltIncident: IncidentReport = {
      id: `INC-HALT-${Math.floor(10 + Math.random() * 90)}`,
      timestamp: now.toTimeString().split(' ')[0],
      severity: 'CRITICAL',
      title: `EMERGENCY STOP: ${reason}`,
      description: `Station halted by operator. Conveyor feed interlock engaged.`,
      station: 'LINE 01 DOCK 02',
      reportedBy: 'SPV: Line 01',
      status: 'INVESTIGATING',
    };
    setIncidents((prev) => [haltIncident, ...prev]);
    showToast(`🚨 STATION EMERGENCY STOP ENGAGED: ${reason}`);
  };

  const handleResumeStation = () => {
    setIsStationHalted(false);
    showToast(`✓ STATION SAFETY INTERLOCKS CLEARED. FEED RESUMED.`);
  };

  const handleCartonScanned = (cartonId: string) => {
    setMasterCarton((prev) => ({
      ...prev,
      cartonId,
    }));
    showToast(`✓ LOADED MASTER CARTON: ${cartonId}`);
  };

  return (
    <div className="bg-[#0B0F17] text-[#F8FAFC] min-h-screen flex flex-col font-mono select-none overflow-x-hidden">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#111827] border-2 border-[#2563EB] text-[#F8FAFC] px-4 py-2.5 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 bg-[#2563EB] inline-block animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP BAR */}
      <TopBar
        onScanMasterCarton={() => setScanCartonModalOpen(true)}
        onPrintShippingLabels={() => setPrintModalOpen(true)}
        onHaltStation={handleHaltStation}
        isStationHalted={isStationHalted}
        onOpenNotifications={() => setNotificationsDrawerOpen(true)}
        onOpenSettings={() => setTerminalConfigModalOpen(true)}
        unreadNotificationsCount={incidents.filter((i) => i.status !== 'RESOLVED').length}
      />

      {/* WORKSPACE BODY WITH SIDEBAR RAIL */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          onReportIncident={() => setIncidentModalOpen(true)}
          onTerminalConfig={() => setTerminalConfigModalOpen(true)}
          onLogout={() => logout()}
        />

        {/* MAIN SCROLLABLE CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto bg-[#051424] p-3 sm:p-4 lg:p-6 flex flex-col gap-4">
          {/* Emergency halt active banner */}
          {isStationHalted && (
            <div className="p-3 bg-[#300C0C] border-2 border-[#DC2626] hazard-stripe-red flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#DC2626]">
                <span className="material-symbols-outlined text-xl">warning</span>
                <span>
                  STATION FEED HALTED // SAFETY INTERLOCKS ENGAGED // OPERATOR SUPERVISION REQUIRED
                </span>
              </div>
              <button
                onClick={() => setHaltModalOpen(true)}
                className="px-3 py-1 bg-[#DC2626] hover:bg-red-700 text-white font-mono text-xs font-bold uppercase cursor-pointer"
              >
                OPEN RESUME PROTOCOL
              </button>
            </div>
          )}

          {/* Render Active View */}
          {currentView === 'PACKAGING_DISPATCH' && (
            <PackagingDispatchScreen
              slots={slots}
              onToggleSlot={handleToggleSlot}
              masterCarton={masterCarton}
              onPackCurrentMultipack={handlePackCurrentMultipack}
              onSealMasterCarton={handleSealMasterCarton}
              onManualOverride={() => setManualOverrideModalOpen(true)}
              onReportDamaged={() => setReportDamagedModalOpen(true)}
              onOpenSuratJalan={() => setSuratJalanModalOpen(true)}
              onOpenManifestQr={() => setManifestQrModalOpen(true)}
              b2bManifest={b2bManifest}
              b2cManifest={b2cManifest}
              packedCartonsToday={packedCartonsToday}
              totalCartonsTarget={totalCartonsTarget}
              onTriggerLabelFeed={handleTriggerLabelFeed}
              isPrintingLabel={isPrintingLabel}
              onScanCartonQuick={(barcode) => {
                showToast(`✓ OPTICAL MATRIX ACQUIRED: ${barcode}`);
              }}
            />
          )}

          {currentView === 'TELEMETRY' && <TelemetryScreen />}

          {currentView === 'WIP_FLOW' && <WipFlowScreen />}

          {currentView === 'BUNDLE_QC' && <BundleQcScreen />}

          {currentView === 'INVENTORY_OUT' && <InventoryOutScreen />}

          {/* FOOTER DIAGNOSTICS TELEMETRY TICKER */}
          <FooterTelemetry />
        </main>
      </div>

      {/* MODALS */}
      <ScanCartonModal
        isOpen={scanCartonModalOpen}
        onClose={() => setScanCartonModalOpen(false)}
        onCartonScanned={handleCartonScanned}
        currentCartonId={masterCarton.cartonId}
      />

      <PrintShippingLabelsModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        cartonId={masterCarton.cartonId}
        onPrintConfirmed={(qty, printer) => {
          showToast(`✓ SENT ${qty} LABEL(S) TO ${printer}`);
        }}
      />

      <HaltStationModal
        isOpen={haltModalOpen}
        onClose={() => setHaltModalOpen(false)}
        isStationHalted={isStationHalted}
        onConfirmHalt={handleConfirmHalt}
        onResumeStation={handleResumeStation}
      />

      <ReportIncidentModal
        isOpen={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        onIncidentReported={(inc) => {
          setIncidents((prev) => [inc, ...prev]);
          showToast(`✓ INCIDENT TICKET ${inc.id} SUBMITTED`);
        }}
      />

      <ManualOverrideModal
        isOpen={manualOverrideModalOpen}
        onClose={() => setManualOverrideModalOpen(false)}
        onOverrideApproved={handleManualOverride}
        cartonId={masterCarton.cartonId}
      />

      <ReportDamagedModal
        isOpen={reportDamagedModalOpen}
        onClose={() => setReportDamagedModalOpen(false)}
        onConfirmDamage={handleConfirmDamage}
        cartonId={masterCarton.cartonId}
      />

      <SuratJalanModal
        isOpen={suratJalanModalOpen}
        onClose={() => setSuratJalanModalOpen(false)}
        manifest={b2bManifest}
      />

      <ManifestQrModal
        isOpen={manifestQrModalOpen}
        onClose={() => setManifestQrModalOpen(false)}
        manifest={b2bManifest}
      />

      <TerminalConfigModal
        isOpen={terminalConfigModalOpen}
        onClose={() => setTerminalConfigModalOpen(false)}
      />

      <NotificationsDrawer
        isOpen={notificationsDrawerOpen}
        onClose={() => setNotificationsDrawerOpen(false)}
        incidents={incidents}
        onClearIncident={(id) => {
          setIncidents((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: 'RESOLVED' as const } : i))
          );
          showToast(`✓ INCIDENT ${id} MARKED RESOLVED`);
        }}
      />
    </div>
  );
}
