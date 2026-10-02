/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, ActiveScreen } from './components/Sidebar';
import { Header } from './components/Header';
import { Subheader } from './components/Subheader';
import { KpiCards } from './components/KpiCards';
import { CostCompositionCard } from './components/CostCompositionCard';
import { DeviationAlertsCard } from './components/DeviationAlertsCard';
import { HppSimulationCard } from './components/HppSimulationCard';
import { SpkReconciliationTable } from './components/SpkReconciliationTable';
import { PayrollStatusBar } from './components/PayrollStatusBar';

// Modals
import { InputOverheadModal } from './components/modals/InputOverheadModal';
import { ExportModal } from './components/modals/ExportModal';
import { JurnalHppModal } from './components/modals/JurnalHppModal';
import { PayrollModal } from './components/modals/PayrollModal';
import { BomReviewModal } from './components/modals/BomReviewModal';
import { DateFilterModal } from './components/modals/DateFilterModal';

// Screens
import { DashboardScreen } from './components/screens/DashboardScreen';
import { WipTrackingScreen } from './components/screens/WipTrackingScreen';
import { QualityQcScreen } from './components/screens/QualityQcScreen';
import { OeeMaintenanceScreen } from './components/screens/OeeMaintenanceScreen';
import { ExecutiveReportsScreen } from './components/screens/ExecutiveReportsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { AuditLogsScreen } from './components/screens/AuditLogsScreen';

// Mock Data & Types
import {
  INITIAL_SPK_BATCHES,
  INITIAL_COST_STRUCTURE,
  INITIAL_OPERATOR_PAYROLL,
} from './data/mockData';
import { SpkBatch, CurrencyType } from './types/costing';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('costing');
  const [currency, setCurrency] = useState<CurrencyType>('IDR');
  const [selectedMonth, setSelectedMonth] = useState<string>('Okt 2026');
  const [globalSearch, setGlobalSearch] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(1);

  // Core Data States
  const [batches, setBatches] = useState<SpkBatch[]>(INITIAL_SPK_BATCHES);
  const [costStructure, setCostStructure] = useState(INITIAL_COST_STRUCTURE);
  const [operators, setOperators] = useState(INITIAL_OPERATOR_PAYROLL);

  // Modals visibility
  const [isOverheadModalOpen, setIsOverheadModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  const [selectedJurnalBatch, setSelectedJurnalBatch] = useState<SpkBatch | null>(null);
  const [criticalReviewBatch, setCriticalReviewBatch] = useState<SpkBatch | null>(null);

  // Global Toast for quick actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // KPI Calculations
  const totalBatchesCount = batches.length;
  const targetBudgetTotal = 1180450000;
  const activeLinesCount = 14;
  const bomEstimatedHpp = 895200000;
  const standardTargetPerUnit = 19250;
  const actualHppRealization = 882150000;
  const averageUnitCost = 18970;
  const netCostVariance = -13050000;

  // Handlers
  const handleToggleLock = (id: string) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const nextLock = !b.isLocked;
          showToast(nextLock ? `SPK ${b.id} berhasil dikunci (Ledger Locked)` : `Kunci SPK ${b.id} dibuka.`);
          return { ...b, isLocked: nextLock };
        }
        return b;
      })
    );
  };

  const handleApplyMitigation = (id: string, updatedFields: Partial<SpkBatch>) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updatedFields } : b))
    );
    setUnreadNotifications(0);
    showToast(`Mitigasi HPP ${id} berhasil diterapkan. Status diperbarui ke Dalam Toleransi.`);
  };

  const handleSaveOverhead = (newOverheadTotal: number) => {
    setCostStructure((prev) => ({
      ...prev,
      overhead: {
        ...prev.overhead,
        realSpend: newOverheadTotal,
        variancePct: Number(
          (((newOverheadTotal - prev.overhead.bomBudget) / prev.overhead.bomBudget) * 100).toFixed(1)
        ),
      },
    }));
    showToast('Realisasi overhead pabrik bulanan berhasil diperbarui!');
  };

  const handleVerifyPayrollAll = () => {
    setOperators((prev) =>
      prev.map((op) => ({ ...op, status: 'Diverifikasi' as const }))
    );
    showToast('Seluruh 142 Operator telah diverifikasi untuk payroll transfer.');
  };

  const handlePrintBatch = (batch: SpkBatch) => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'No. SPK',
      'Brand',
      'Produk',
      'Target Qty (pcs)',
      'Bundles',
      'BOM HPP/pc (IDR)',
      'Real. Material/pc (IDR)',
      'Real. Labor/pc (IDR)',
      'Real. Overhead/pc (IDR)',
      'Total Real. HPP/pc (IDR)',
      'Variance (%)',
      'Status',
    ];

    const rows = batches.map((b) => [
      b.id,
      `"${b.brand}"`,
      `"${b.productName}"`,
      b.targetQty,
      b.bundles,
      b.bomHppPerPc,
      b.realMaterialPerPc,
      b.realLaborPerPc,
      b.realOverheadPerPc,
      b.totalRealHppPerPc,
      b.variancePct,
      b.varianceStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekonsiliasi_HPP_${selectedMonth.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV Rekonsiliasi HPP berhasil diunduh.');
  };

  // Filtered batches for global search
  const visibleBatches = globalSearch.trim()
    ? batches.filter(
        (b) =>
          b.id.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.brand.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.productName.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.fabricType.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : batches;

  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen flex flex-col font-body-md antialiased selection:bg-[#004ac6] selection:text-white">
      {/* SideNavBar Anchor (Docked on left) */}
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
      />

      {/* Main Canvas Content Area (Offset for side navbar) */}
      <div className="pl-64 flex-1 flex flex-col min-h-screen">
        {/* TopNavBar Anchor */}
        <Header
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          onOpenDateFilter={() => setIsDateFilterModalOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          globalSearch={globalSearch}
          onSearchChange={setGlobalSearch}
          unreadNotifications={unreadNotifications}
        />

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 right-8 z-50 p-3 bg-[#0F172A] text-white rounded-xl shadow-xl flex items-center gap-2 text-[13px] animate-in fade-in slide-in-from-top-2 border border-slate-700">
            <span className="material-symbols-outlined text-[18px] text-[#16A34A]">info</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Screen Routing */}
        {activeScreen === 'costing' && (
          <>
            {/* Subheader: Breadcrumbs, RBAC Badge, Hub Controls */}
            <Subheader
              currency={currency}
              onCurrencyChange={setCurrency}
              selectedMonth={selectedMonth}
              onOpenMonthFilter={() => setIsDateFilterModalOpen(true)}
              onOpenOverheadModal={() => setIsOverheadModalOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
            />

            {/* Main Workspace Dashboard Canvas */}
            <main className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6">
              {/* KEY METRICS / 4 KPI CARDS */}
              <KpiCards
                currency={currency}
                totalBatches={totalBatchesCount}
                targetBudgetTotal={targetBudgetTotal}
                activeLines={activeLinesCount}
                bomEstimatedHpp={bomEstimatedHpp}
                standardTargetPerUnit={standardTargetPerUnit}
                actualHppRealization={actualHppRealization}
                averageUnitCost={averageUnitCost}
                netCostVariance={netCostVariance}
                baselineCutoff="01 Okt 2026"
              />

              {/* COST BREAKDOWN & VARIANCE OVERVIEW (2-Column Grid) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Card: Komposisi Struktur Biaya Produksi (7 Cols) */}
                <CostCompositionCard
                  costStructure={costStructure}
                  currency={currency}
                  averageBomUnit={19250}
                  averageRealUnit={18970}
                  onDrilldownCategory={(cat) => {
                    const sample = batches[0];
                    if (sample) setSelectedJurnalBatch(sample);
                  }}
                />

                {/* Right Card: Peringatan Deviasi HPP & Aksi + Simulasi (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <DeviationAlertsCard
                    onReviewBomClick={() => {
                      const critical = batches.find((b) => b.id === 'SPK-2026-10-095') || batches[1];
                      setCriticalReviewBatch(critical);
                    }}
                    onViewFavorableClick={() => {
                      const fav = batches.find((b) => b.id === 'SPK-2026-10-088') || batches[0];
                      setSelectedJurnalBatch(fav);
                    }}
                  />

                  {/* Quick Tool: Simulasi HPP Baru / Kalkulator Mark-up */}
                  <HppSimulationCard currency={currency} />
                </div>
              </div>

              {/* MAIN DATA TABLE: MASTER REKONSILIASI HPP & VARIANCE SPK BATCHES */}
              <SpkReconciliationTable
                batches={visibleBatches}
                currency={currency}
                onOpenJurnal={(batch) => setSelectedJurnalBatch(batch)}
                onToggleLock={handleToggleLock}
                onPrintBatch={handlePrintBatch}
                onReviewCritical={(batch) => setCriticalReviewBatch(batch)}
                onExportCsv={handleExportCsv}
              />

              {/* BOTTOM ACTION: QUICK PAYROLL DRAWER & MES ENGINE STATUS BAR */}
              <PayrollStatusBar
                currency={currency}
                totalOperators={142}
                totalCompensation={84620000}
                onOpenPayroll={() => setIsPayrollModalOpen(true)}
              />
            </main>
          </>
        )}

        {activeScreen === 'dashboard' && (
          <DashboardScreen
            batches={batches}
            currency={currency}
            onNavigateToCosting={() => setActiveScreen('costing')}
            onNavigateToWip={() => setActiveScreen('wip')}
          />
        )}

        {activeScreen === 'wip' && <WipTrackingScreen batches={batches} />}

        {activeScreen === 'qc' && <QualityQcScreen currency={currency} />}

        {activeScreen === 'oee' && <OeeMaintenanceScreen />}

        {activeScreen === 'reports' && (
          <ExecutiveReportsScreen
            currency={currency}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        )}

        {activeScreen === 'settings' && <SettingsScreen />}

        {activeScreen === 'audit' && <AuditLogsScreen />}

        {/* Structural Minimal Bottom Padding & Footer */}
        <footer className="mt-auto py-3 px-8 border-t border-[#E2E8F0] bg-white text-[#64748B] text-[12px] flex items-center justify-between">
          <span>THEUNDERWEARSUPPLY ERP • Industrial Modern Fabric Management Suite • V3.8-Enterprise</span>
          <div className="flex items-center gap-4">
            <span>Server Node: ID-CGK-PROD-04</span>
            <span className="h-3 w-px bg-[#E2E8F0]"></span>
            <span className="text-[#16A34A] font-medium">99.98% System Uptime</span>
          </div>
        </footer>
      </div>

      {/* ALL MODALS */}
      <InputOverheadModal
        isOpen={isOverheadModalOpen}
        onClose={() => setIsOverheadModalOpen(false)}
        currency={currency}
        onSaveOverhead={handleSaveOverhead}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currency={currency}
        selectedMonth={selectedMonth}
      />

      <JurnalHppModal
        batch={selectedJurnalBatch}
        onClose={() => setSelectedJurnalBatch(null)}
        currency={currency}
        onToggleLock={handleToggleLock}
      />

      <PayrollModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        operators={operators}
        currency={currency}
        onVerifyAll={handleVerifyPayrollAll}
      />

      <BomReviewModal
        isOpen={!!criticalReviewBatch}
        onClose={() => setCriticalReviewBatch(null)}
        batch={criticalReviewBatch}
        currency={currency}
        onApplyMitigation={handleApplyMitigation}
      />

      <DateFilterModal
        isOpen={isDateFilterModalOpen}
        onClose={() => setIsDateFilterModalOpen(false)}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />
    </div>
  );
}
