/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AlertBanner } from './components/AlertBanner';
import { KpiMetrics } from './components/KpiMetrics';
import { CostVarianceCard } from './components/CostVarianceCard';
import { DefectTrendCard } from './components/DefectTrendCard';
import { SpkTable } from './components/SpkTable';
import { FloorStatusBar } from './components/FloorStatusBar';
import { useSession } from '../../core/session';

// Modals
import { CostBreakdownModal } from './components/modals/CostBreakdownModal';
import { SpkDetailModal } from './components/modals/SpkDetailModal';
import { ExportReportModal } from './components/modals/ExportReportModal';
import { InspectionAuditModal } from './components/modals/InspectionAuditModal';
import { NotificationDrawer } from './components/modals/NotificationDrawer';

// Views
import { CostingHppView } from './components/views/CostingHppView';
import { WipTrackingView } from './components/views/WipTrackingView';
import { QualityQcView } from './components/views/QualityQcView';
import { OeeMaintenanceView } from './components/views/OeeMaintenanceView';
import { ExecutiveReportsView } from './components/views/ExecutiveReportsView';
import { SystemSettingsView } from './components/views/SystemSettingsView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { ProfitabilityView } from './components/views/ProfitabilityView';

import { 
  NavigationTab, 
  SubTab, 
  SPKBatch, 
  BrandVariance, 
  DefectLogEntry, 
  InspectionTable 
} from './types';
import { 
  INITIAL_KPIS, 
  INITIAL_BRAND_VARIANCES, 
  DEFECT_DRIVERS, 
  INITIAL_SPK_BATCHES, 
  INITIAL_QC_TABLES, 
  INITIAL_DEFECT_LOGS 
} from './data/initialData';

// Founder user type (read-only)
export interface FounderUser {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarInitials: string;
}

export default function App() {
  // ── Sesi & idle-timeout dikelola shell ERP (core/session) ──────────────────
  const { user, logout } = useSession();
  const currentUser: FounderUser = {
    id: user!.id,
    name: user!.name,
    role: 'Founder',
    email: user!.email,
    avatarInitials: user!.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  };
  const handleLogout = () => logout();

  // ── Dashboard state (all hooks must be declared unconditionally before any early return) ──
  const [currentNavTab, setCurrentNavTab] = useState<NavigationTab>('dashboard');
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState('Bulan Ini: Okt 2026');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('Semua Brand: NAQALA, Pierre UNO, B2B Clients');
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR');
  const [batches, setBatches] = useState<SPKBatch[]>(INITIAL_SPK_BATCHES);
  const [stats, setStats] = useState(INITIAL_KPIS);
  const [variances, setVariances] = useState<BrandVariance[]>(INITIAL_BRAND_VARIANCES);
  const [drivers, setDrivers] = useState(DEFECT_DRIVERS);
  const [tables, setTables] = useState<InspectionTable[]>(INITIAL_QC_TABLES);
  const [defectLogs, setDefectLogs] = useState<DefectLogEntry[]>(INITIAL_DEFECT_LOGS);
  const [showAlertBanner, setShowAlertBanner] = useState(true);
  const [activeCostBreakdownBatch, setActiveCostBreakdownBatch] = useState<SPKBatch | null>(null);
  const [activeInspectorBatch, setActiveInspectorBatch] = useState<SPKBatch | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isInspectionAuditOpen, setIsInspectionAuditOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => { setToastMessage(null); }, 3500);
  };

  // Synchronize Nav Tab with Sub Tab
  const handleNavTabChange = (tab: NavigationTab) => {
    setCurrentNavTab(tab);
    if (tab === 'dashboard') setCurrentSubTab('overview');
    else if (tab === 'costing_hpp') setCurrentSubTab('costing');
    else if (tab === 'wip_spk') setCurrentSubTab('lines');
    else if (tab === 'executive_reports') setCurrentSubTab('portfolios');
  };

  const handleSubTabChange = (sub: SubTab) => {
    setCurrentSubTab(sub);
    if (sub === 'overview') setCurrentNavTab('dashboard');
    else if (sub === 'costing') setCurrentNavTab('costing_hpp');
    else if (sub === 'lines') setCurrentNavTab('wip_spk');
    else if (sub === 'portfolios') setCurrentNavTab('executive_reports');
  };

  const handleToggleCurrency = () => setCurrency((prev) => (prev === 'IDR' ? 'USD' : 'IDR'));

  const handleResolveVariance = (resolutionNote: string) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === 'SPK-2026-10-095'
          ? { ...b, flagged: false, flagReason: undefined, statusEfisiensi: 'sesuai_budget', statusLabel: 'Dimigasiasi' }
          : b
      )
    );
    setShowAlertBanner(false);
    setActiveCostBreakdownBatch(null);
    showToast(`Tindakan Mitigasi HPP disetujui: "${resolutionNote}"`);
  };

  const handleLogDefect = (entry: Omit<DefectLogEntry, 'id'>) => {
    const newLog: DefectLogEntry = { ...entry, id: `LOG-${Math.floor(882 + Math.random() * 50)}` };
    setDefectLogs((prev) => [newLog, ...prev]);
    setTables((prev) =>
      prev.map((t) =>
        t.id === entry.tableId
          ? { ...t, defectPcs: t.defectPcs + entry.defectQty, passRate: Number((((t.passedPcs) / (t.inspectedPcs + entry.defectQty)) * 100).toFixed(2)) }
          : t
      )
    );
    showToast(`Temuan defect berhasil dicatat di Meja QC ${entry.tableId}.`);
  };

  const handleAdvanceBatch = (batchId: string) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== batchId) return b;
        const newCompleted = Math.min(b.targetQty, b.completedQty + 500);
        return { ...b, completedQty: newCompleted, stages: { ...b.stages, packing: { ...b.stages.packing, progress: Math.min(100, b.stages.packing.progress + 10) } } };
      })
    );
    showToast(`Kemajuan produksi batch ${batchId} diperbarui.`);
  };

  const displayedBatches = batches.filter((b) => {
    if (selectedBrandFilter.includes('Semua Brand')) return true;
    if (selectedBrandFilter.includes('NAQALA') && b.brand === 'NAQALA') return true;
    if (selectedBrandFilter.includes('Pierre UNO') && b.brand === 'Pierre UNO') return true;
    if (selectedBrandFilter.includes('B2B') && b.brand === 'B2B Client') return true;
    return true;
  });

  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen flex antialiased selection:bg-[#dbe1ff] selection:text-[#00174b]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#334155] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Shared Component: SideNavBar */}
      <Sidebar
        currentTab={currentNavTab}
        onTabChange={handleNavTabChange}
        isRealtimeActive={isRealtimeActive}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Canvas Wrapper */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        {/* Top App Bar & Sub-navigation */}
        <Header
          selectedSubTab={currentSubTab}
          onSubTabChange={handleSubTabChange}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedBrandFilter={selectedBrandFilter}
          onBrandFilterChange={setSelectedBrandFilter}
          currency={currency}
          onToggleCurrency={handleToggleCurrency}
          onExportClick={() => setIsExportOpen(true)}
          onNotificationClick={() => setIsNotificationOpen(true)}
          unreadAlertCount={showAlertBanner ? 1 : 0}
          isRealtime={isRealtimeActive}
          onToggleRealtime={() => {
            setIsRealtimeActive(!isRealtimeActive);
            showToast(isRealtimeActive ? 'Realtime sync dijeda.' : 'Realtime sync diaktifkan.');
          }}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          {/* VIEW: Dashboard / Executive Overview */}
          {currentNavTab === 'dashboard' && (
            <>
              {/* Alert Banner for Flagged SPK */}
              {showAlertBanner && (
                <AlertBanner
                  onViewCosting={() => {
                    const flaggedBatch = batches.find((b) => b.id === 'SPK-2026-10-095') || batches[2];
                    setActiveCostBreakdownBatch(flaggedBatch);
                  }}
                  onDismiss={() => setShowAlertBanner(false)}
                />
              )}

              {/* 5 Top-Level Executive KPI Metric Cards */}
              <KpiMetrics
                stats={stats}
                currency={currency}
                onCardClick={(key) => {
                  if (key === 'hpp') handleNavTabChange('costing_hpp');
                  else if (key === 'efficiency' || key === 'oee') handleNavTabChange('oee_maintenance');
                  else if (key === 'revenue' || key === 'margin') handleNavTabChange('executive_reports');
                }}
              />

              {/* Bento Grid: 2 Visual Analytics Columns */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <CostVarianceCard
                  variances={variances}
                  currency={currency}
                  onBrandClick={(b) => {
                    const matchedBatch = batches.find(item => item.brand.toLowerCase().includes(b.subType.toLowerCase()) || item.category.toLowerCase().includes(b.subType.toLowerCase())) || batches[0];
                    setActiveInspectorBatch(matchedBatch);
                  }}
                />

                <DefectTrendCard
                  drivers={drivers}
                  onOpenAudit={() => setIsInspectionAuditOpen(true)}
                  onDriverClick={() => setIsInspectionAuditOpen(true)}
                />
              </section>

              {/* SPK Batch Profitability & HPP Performance Table */}
              <SpkTable
                batches={displayedBatches}
                currency={currency}
                onViewBatch={(batch) => setActiveInspectorBatch(batch)}
                onAlertClick={(batch) => setActiveCostBreakdownBatch(batch)}
              />

              {/* Production Floor Status Bar */}
              <FloorStatusBar />
            </>
          )}

          {/* VIEW: Costing & HPP */}
          {currentNavTab === 'costing_hpp' && (
            <CostingHppView
              batches={batches}
              currency={currency}
              onInspectBatch={(batch) => setActiveInspectorBatch(batch)}
              onOpenCostAlert={(batch) => setActiveCostBreakdownBatch(batch)}
            />
          )}

          {/* VIEW: WIP & SPK Tracking */}
          {currentNavTab === 'wip_spk' && (
            <WipTrackingView
              batches={batches}
              currency={currency}
              onInspectBatch={(batch) => setActiveInspectorBatch(batch)}
              onAdvanceBatch={handleAdvanceBatch}
            />
          )}

          {/* VIEW: Quality & Defect QC */}
          {currentNavTab === 'quality_qc' && (
            <QualityQcView
              tables={tables}
              logs={defectLogs}
              drivers={drivers}
              onOpenAudit={() => setIsInspectionAuditOpen(true)}
            />
          )}

          {/* VIEW: OEE & Maintenance */}
          {currentNavTab === 'oee_maintenance' && <OeeMaintenanceView />}

          {/* VIEW: Profitabilitas per Brand/SKU — FR-FND-02 */}
          {currentNavTab === 'profitability' && (
            <ProfitabilityView
              batches={batches}
              variances={variances}
              currency={currency}
              onInspectBatch={(batch) => setActiveInspectorBatch(batch)}
            />
          )}

          {/* VIEW: Executive Reports */}
          {currentNavTab === 'executive_reports' && (
            <ExecutiveReportsView
              stats={stats}
              currency={currency}
              onExportClick={() => setIsExportOpen(true)}
            />
          )}

          {/* VIEW: System Settings */}
          {currentNavTab === 'system_settings' && (
            <SystemSettingsView
              currency={currency}
              onToggleCurrency={handleToggleCurrency}
            />
          )}

          {/* VIEW: Audit Logs */}
          {currentNavTab === 'audit_logs' && <AuditLogsView />}
        </main>
      </div>

      {/* MODAL: Cost Breakdown for Flagged Batch */}
      {activeCostBreakdownBatch && (
        <CostBreakdownModal
          batch={activeCostBreakdownBatch}
          currency={currency}
          onClose={() => setActiveCostBreakdownBatch(null)}
          onResolve={handleResolveVariance}
        />
      )}

      {/* MODAL: SPK Detail Passport */}
      {activeInspectorBatch && (
        <SpkDetailModal
          batch={activeInspectorBatch}
          currency={currency}
          onClose={() => setActiveInspectorBatch(null)}
        />
      )}

      {/* MODAL: Export Financial Report */}
      {isExportOpen && (
        <ExportReportModal
          batches={batches}
          stats={stats}
          currency={currency}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* MODAL: Inspection Audit Dialog */}
      {isInspectionAuditOpen && (
        <InspectionAuditModal
          tables={tables}
          logs={defectLogs}
          onClose={() => setIsInspectionAuditOpen(false)}
          onLogDefect={handleLogDefect}
        />
      )}

      {/* DRAWER: Notifications */}
      {isNotificationOpen && (
        <NotificationDrawer
          onClose={() => setIsNotificationOpen(false)}
          onSelectCostingAlert={() => {
            const flagged = batches.find((b) => b.id === 'SPK-2026-10-095') || batches[2];
            setActiveCostBreakdownBatch(flagged);
          }}
        />
      )}
    </div>
  );
}
