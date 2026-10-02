/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { BundleItem, CompletedBundleLog, Operator } from './types';
import {
  initialOperators,
  initialActiveBundle,
  bundleQueue,
  initialCompletedLogs,
} from './data/mockData';
import { Header } from './components/Header';
import { ScannerBay } from './components/ScannerBay';
import { TelemetryStage } from './components/TelemetryStage';
import { ThroughputTray } from './components/ThroughputTray';
import { DowntimeModal } from './components/DowntimeModal';
import { OperatorModal } from './components/OperatorModal';
import { EmergencyModal } from './components/EmergencyModal';
import { BundleCompleteModal } from './components/BundleCompleteModal';
import { ShiftReportModal } from './components/ShiftReportModal';
import { DefectModal } from './components/DefectModal';
import { playTactileClick, playWarningBuzzer } from './utils/audio';

export default function App() {
  // Application State
  const [operator, setOperator] = useState<Operator>(initialOperators[0]);
  const [activeBundle, setActiveBundle] = useState<BundleItem>(initialActiveBundle);
  const [queue, setQueue] = useState<BundleItem[]>(bundleQueue);
  const [completedLogs, setCompletedLogs] = useState<CompletedBundleLog[]>(initialCompletedLogs);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [totalPcs, setTotalPcs] = useState<number>(288);
  const [totalBundles, setTotalBundles] = useState<number>(12);
  const [oee, setOee] = useState<number>(96.4);

  // Downtime State
  const [activeDowntime, setActiveDowntime] = useState<{
    reason: string;
    elapsedSeconds: number;
    notes?: string;
  } | null>(null);

  // Modal Open/Close States
  const [isDowntimeModalOpen, setIsDowntimeModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [isEmergencyHaltOpen, setIsEmergencyHaltOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [defectModalState, setDefectModalState] = useState<{
    isOpen: boolean;
    type: 'rework' | 'reject';
  }>({
    isOpen: false,
    type: 'rework',
  });

  // Active production cycle timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && !activeDowntime && !isEmergencyHaltOpen) {
      interval = setInterval(() => {
        setActiveBundle((prev) => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, activeDowntime, isEmergencyHaltOpen]);

  // Downtime ticker when line is stopped
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeDowntime) {
      interval = setInterval(() => {
        setActiveDowntime((prev) =>
          prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null
        );
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeDowntime]);

  // Handle Play / Pause cycle
  const handleStartToggle = () => {
    playTactileClick();
    if (activeDowntime) {
      // Prompt user to resolve downtime first
      setIsDowntimeModalOpen(true);
      return;
    }
    setIsRunning((prev) => !prev);
  };

  // Handle Bundle Barcode Scan or Manual Input
  const handleScanBundle = useCallback((barcode: string) => {
    const cleanBarcode = barcode.trim().toUpperCase();

    // Check if barcode matches any in queue
    const queuedIdx = queue.findIndex(
      (b) => b.barcode.toUpperCase() === cleanBarcode || b.id.toUpperCase() === cleanBarcode
    );

    if (queuedIdx >= 0) {
      const selected = queue[queuedIdx];
      const remainingQueue = queue.filter((_, idx) => idx !== queuedIdx);
      // Place current active bundle back in queue if not finished
      setQueue([...remainingQueue, activeBundle]);
      setActiveBundle({
        ...selected,
        status: 'in_progress',
      });
      setIsRunning(true);
    } else {
      // Dynamic creation or lookup for entered barcode
      setActiveBundle({
        id: cleanBarcode,
        barcode: cleanBarcode,
        sku: 'NAQALA-BRF-001',
        productName: "Brief Boxer Men's Cotton Stretch",
        operationStep: 'Coverstitch Pinggang',
        operationSubtext: '(Waistband Stitching)',
        quantity: 24,
        isStdBundle: true,
        targetPaceSecPerPc: 45,
        targetMinutesPerBundle: 18,
        passCount: 0,
        reworkCount: 0,
        rejectCount: 0,
        status: 'in_progress',
        elapsedSeconds: 0,
        defects: [],
      });
      setIsRunning(true);
    }
  }, [activeBundle, queue]);

  // QC Counter increments
  const handleIncrementQC = (type: 'pass' | 'rework' | 'reject') => {
    if (type === 'pass') {
      setActiveBundle((prev) => ({
        ...prev,
        passCount: Math.min(prev.quantity, prev.passCount + 1),
      }));
    } else if (type === 'rework') {
      setActiveBundle((prev) => ({
        ...prev,
        reworkCount: prev.reworkCount + 1,
      }));
      setDefectModalState({ isOpen: true, type: 'rework' });
    } else if (type === 'reject') {
      setActiveBundle((prev) => ({
        ...prev,
        rejectCount: prev.rejectCount + 1,
      }));
      setDefectModalState({ isOpen: true, type: 'reject' });
    }
  };

  // QC Counter decrements
  const handleDecrementQC = (type: 'pass' | 'rework' | 'reject') => {
    if (type === 'pass') {
      setActiveBundle((prev) => ({
        ...prev,
        passCount: Math.max(0, prev.passCount - 1),
      }));
    } else if (type === 'rework') {
      setActiveBundle((prev) => ({
        ...prev,
        reworkCount: Math.max(0, prev.reworkCount - 1),
      }));
    } else if (type === 'reject') {
      setActiveBundle((prev) => ({
        ...prev,
        rejectCount: Math.max(0, prev.rejectCount - 1),
      }));
    }
  };

  // Save Defect classification tag
  const handleConfirmDefectTag = (reason: string) => {
    setActiveBundle((prev) => {
      const defects = prev.defects ? [...prev.defects] : [];
      const existing = defects.find((d) => d.reason === reason);
      if (existing) {
        existing.count += 1;
      } else {
        defects.push({ reason, count: 1 });
      }
      return { ...prev, defects };
    });
  };

  // Open Complete Confirmation Dialog
  const handleOpenComplete = () => {
    playTactileClick();
    setIsCompleteModalOpen(true);
  };

  // Confirm Complete Bundle
  const handleConfirmComplete = () => {
    setIsCompleteModalOpen(false);

    // Current time string
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const cycleMinutes = Number((activeBundle.elapsedSeconds / 60).toFixed(1));
    const targetMin = activeBundle.targetMinutesPerBundle;
    const eff = Math.min(115, Math.max(70, Number(((targetMin / (cycleMinutes || 1)) * 100).toFixed(1))));

    // Create completed bundle record
    const newLog: CompletedBundleLog = {
      id: activeBundle.id,
      completedTimeStr: timeStr,
      operationStep: activeBundle.operationStep,
      quantity: activeBundle.quantity,
      passCount: activeBundle.passCount || activeBundle.quantity,
      operatorCode: operator.code,
      operatorName: operator.name,
      cycleTimeMinutes: cycleMinutes || 17.2,
      efficiency: eff,
    };

    setCompletedLogs((prev) => [newLog, ...prev]);
    setTotalPcs((prev) => prev + activeBundle.quantity);
    setTotalBundles((prev) => prev + 1);

    // Dynamic OEE micro-adjustment
    setOee((prev) => {
      const diff = (eff - 96.4) * 0.05;
      return Number(Math.min(99.4, Math.max(92.0, prev + diff)).toFixed(1));
    });

    // Advance to next bundle from queue or generate next sequential
    if (queue.length > 0) {
      const [nextBundle, ...restQueue] = queue;
      setQueue(restQueue);
      setActiveBundle({
        ...nextBundle,
        status: 'in_progress',
        elapsedSeconds: 0,
        passCount: 0,
        reworkCount: 0,
        rejectCount: 0,
      });
    } else {
      // Generate next sequential bundle
      const nextNum = totalBundles + 13;
      const nextId = `BDL-0101-${String(nextNum).padStart(3, '0')}`;
      setActiveBundle({
        id: nextId,
        barcode: nextId,
        sku: 'NAQALA-BRF-001',
        productName: "Brief Boxer Men's Cotton Stretch",
        operationStep: 'Coverstitch Pinggang',
        operationSubtext: '(Waistband Stitching)',
        quantity: 24,
        isStdBundle: true,
        targetPaceSecPerPc: 45,
        targetMinutesPerBundle: 18,
        passCount: 0,
        reworkCount: 0,
        rejectCount: 0,
        status: 'in_progress',
        elapsedSeconds: 0,
        defects: [],
      });
    }

    setIsRunning(true);
  };

  // Downtime Handlers
  const handleConfirmDowntime = (reason: string, notes?: string) => {
    setActiveDowntime({
      reason,
      elapsedSeconds: 0,
      notes,
    });
    setIsRunning(false);
  };

  const handleResumeFromDowntime = () => {
    setActiveDowntime(null);
    setIsRunning(true);
  };

  // Emergency Halt Handlers
  const handleTriggerEmergency = () => {
    playWarningBuzzer();
    setIsRunning(false);
    setIsEmergencyHaltOpen(true);
  };

  const handleResetEmergency = () => {
    setIsEmergencyHaltOpen(false);
    setIsRunning(true);
  };

  // Switch Operator
  const handleSwitchOperator = (newOp: Operator) => {
    setOperator(newOp);
  };

  return (
    <div className="bg-[#0F172A] text-[#F8FAFC] select-none h-screen w-screen overflow-hidden flex flex-col font-['Geist'] antialiased">
      {/* TOP STATUS BAR */}
      <Header
        currentOperator={operator}
        onOpenSwitchOperator={() => setIsOperatorModalOpen(true)}
        onTriggerEmergencyHalt={handleTriggerEmergency}
        isDowntimeActive={Boolean(activeDowntime)}
      />

      {/* ACTION STAGE / MAIN VIEWPORT (Standard 1024x768 Industrial Partition) */}
      <main className="flex-1 grid grid-cols-12 gap-5 p-5 overflow-hidden">
        {/* LEFT STAGE: SCANNER & BUNDLE TELEMETRY (5 Columns) */}
        <div className="col-span-12 md:col-span-5 h-full overflow-hidden">
          <ScannerBay
            activeBundle={activeBundle}
            onScanBundle={handleScanBundle}
            availableBundles={[activeBundle, ...queue]}
          />
        </div>

        {/* RIGHT STAGE: CONTEXT CARD & BIG TACTILE ACTION BUTTONS (7 Columns) */}
        <div className="col-span-12 md:col-span-7 h-full overflow-hidden">
          <TelemetryStage
            bundle={activeBundle}
            isRunning={isRunning}
            isDowntimeActive={Boolean(activeDowntime)}
            onStart={handleStartToggle}
            onComplete={handleOpenComplete}
            onOpenDowntime={() => setIsDowntimeModalOpen(true)}
            onIncrementQC={handleIncrementQC}
            onDecrementQC={handleDecrementQC}
          />
        </div>
      </main>

      {/* RECENT SCAN HISTORY & THROUGHPUT LOG (Lower Tray / 112px Fixed) */}
      <ThroughputTray
        completedLogs={completedLogs}
        totalPcs={totalPcs}
        totalBundles={totalBundles}
        oeePercentage={oee}
        onOpenReport={() => setIsReportModalOpen(true)}
      />

      {/* MODALS */}
      <DowntimeModal
        isOpen={isDowntimeModalOpen}
        onClose={() => setIsDowntimeModalOpen(false)}
        onConfirmDowntime={handleConfirmDowntime}
        activeDowntime={activeDowntime}
        onResumeProduction={handleResumeFromDowntime}
      />

      <OperatorModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        currentOperator={operator}
        onSwitchOperator={handleSwitchOperator}
      />

      <EmergencyModal
        isOpen={isEmergencyHaltOpen}
        onClose={() => setIsEmergencyHaltOpen(false)}
        onResetEmergency={handleResetEmergency}
      />

      <BundleCompleteModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        bundle={activeBundle}
        onConfirmComplete={handleConfirmComplete}
      />

      <ShiftReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        completedLogs={completedLogs}
        totalPcs={totalPcs}
        totalBundles={totalBundles}
        oee={oee}
      />

      <DefectModal
        isOpen={defectModalState.isOpen}
        onClose={() => setDefectModalState({ isOpen: false, type: 'rework' })}
        defectType={defectModalState.type}
        onConfirmDefectTag={handleConfirmDefectTag}
      />
    </div>
  );
}
