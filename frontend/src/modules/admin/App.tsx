import { useState, useCallback } from 'react';
import {
  initialUsers,
  initialAuditLogs,
  initialTerminals,
  initialConfig,
} from './data/mockData';
import { UserAccount, GlobalConfigSettings, SystemAuditItem } from './types';
import { useSession } from '../../core/session';
import { TopNavBar } from './components/TopNavBar';
import { SideNavBar } from './components/SideNavBar';
import { QuickConfigPanel } from './components/QuickConfigPanel';
import { MetricsCards } from './components/MetricsCards';
import { UserTable } from './components/UserTable';
import { AddUserModal } from './components/AddUserModal';
import { EditUserModal } from './components/EditUserModal';
import { SecurityPinModal } from './components/SecurityPinModal';
import { ExportAuditModal } from './components/ExportAuditModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ClusterStatusModal } from './components/ClusterStatusModal';
import { TerminalsFleetModal } from './components/TerminalsFleetModal';
import { NotificationsModal } from './components/NotificationsModal';
import { MasterDataView } from './components/views/MasterDataView';
import { GlobalConfigView } from './components/views/GlobalConfigView';
import { AuditLogsView } from './components/views/AuditLogsView';

export default function App() {
  // Sesi dikelola shell ERP (core/session); modul ini hanya dirender untuk user yang sudah login.
  const { user, logout } = useSession();
  const currentUser = user!;

  // Core application state
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  const [config, setConfig] = useState<GlobalConfigSettings>(initialConfig);
  const [auditLogs, setAuditLogs] = useState<SystemAuditItem[]>(initialAuditLogs);
  const [terminals, setTerminals] = useState(initialTerminals);
  const [activeTab, setActiveTab] = useState<'rbac' | 'master-data' | 'config' | 'audit'>('rbac');

  // UI state
  const [quickConfigOpen, setQuickConfigOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityUser, setSecurityUser] = useState<UserAccount | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [isTerminalsModalOpen, setIsTerminalsModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Mock notifications
  const [notifications, setNotifications] = useState([
    {
      id: 'N-1',
      title: 'Shift 1 Active: 12 Kiosks Synchronized',
      desc: 'Plant A1 sewing and cutting floor terminals are reporting 0ms latency.',
      time: '12m ago',
      type: 'success' as const,
      read: false,
    },
    {
      id: 'N-2',
      title: 'ISO/IEC 27001 Annual Attestation',
      desc: 'RBAC user matrix integrity verified. 48 identities confirmed in tenant root.',
      time: '1h ago',
      type: 'info' as const,
      read: false,
    },
    {
      id: 'N-3',
      title: 'Emergency Floor Lockout Standby Ready',
      desc: 'Master kill-switch armed for production line hardware.',
      time: '2h ago',
      type: 'warning' as const,
      read: true,
    },
  ]);

  // Append new audit entry
  const logAuditAction = useCallback(
    (action: string, category: 'primary' | 'tertiary' | 'secondary' | 'error', targetUserId?: string, details?: string) => {
      const newAudit: SystemAuditItem = {
        id: `AUD-${Math.floor(9000 + Math.random() * 999)}`,
        action,
        user: currentUser?.id || 'AUTH_GATEWAY',
        timeAgo: 'Just now',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        category,
        targetUserId,
        details,
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser?.id]
  );

  const handleLogout = () => {
    logAuditAction(
      `User ${currentUser.name} (${currentUser.id}) keluar sesi (logout)`,
      'primary',
      currentUser.id,
      'Sesi diakhiri secara manual oleh pengguna.'
    );
    logout();
  };

  // Add User handler
  const handleAddUser = (newUser: UserAccount) => {
    setUsers((prev) => [newUser, ...prev]);
    logAuditAction(
      `Added new operator account ${newUser.name} (${newUser.id})`,
      'tertiary',
      newUser.id,
      `Assigned to ${newUser.department} with role ${newUser.role}. Initial PIN issued.`
    );
  };

  // Edit User handler
  const handleSaveUser = (updatedUser: UserAccount) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    logAuditAction(
      `Updated permissions and station for ${updatedUser.name}`,
      'primary',
      updatedUser.id,
      `Permissions: Costing=${updatedUser.permissions.costingView ? 'Y' : 'N'}, SPK=${updatedUser.permissions.spkActivate ? 'Y' : 'N'}, Kiosk=${updatedUser.permissions.kioskScan ? 'Y' : 'N'}, Payroll=${updatedUser.permissions.payrollDraft ? 'Y' : 'N'}.`
    );
  };

  // Reset Security / PIN handler
  const handleUpdateSecurity = (userId: string, newPin: string, newRfid: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pinCode: newPin, rfidCardId: newRfid } : u))
    );
    const targetUser = users.find((u) => u.id === userId);
    logAuditAction(
      `Updated PIN for Operator ${targetUser?.name || userId}`,
      'primary',
      userId,
      `New 4-digit hash generated. Active floor tablet sessions invalidated.`
    );
  };

  // Toggle user activation
  const handleToggleUserStatus = (user: UserAccount) => {
    const isNowActive = user.status === 'deactivated';
    const updatedStatus = isNowActive ? 'active' : 'deactivated';
    const updatedText = isNowActive ? 'Active now' : 'Deactivated';

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              status: updatedStatus,
              statusText: updatedText,
              lastActive: isNowActive ? 'Just now' : 'Deactivated by Admin',
            }
          : u
      )
    );

    logAuditAction(
      `${isNowActive ? 'Reactivated' : 'Deactivated'} account for ${user.name}`,
      isNowActive ? 'tertiary' : 'error',
      user.id,
      `Operator account status toggled to ${updatedStatus}.`
    );
  };

  // Update Config
  const handleUpdateConfig = (newConfig: Partial<GlobalConfigSettings>) => {
    setConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (newConfig.emergencyFloorLockout !== undefined && newConfig.emergencyFloorLockout !== prev.emergencyFloorLockout) {
        logAuditAction(
          newConfig.emergencyFloorLockout
            ? 'ENGAGED EMERGENCY FLOOR LOCKOUT'
            : 'Disengaged Emergency Floor Lockout',
          newConfig.emergencyFloorLockout ? 'error' : 'tertiary',
          undefined,
          newConfig.emergencyFloorLockout
            ? 'All 12 floor terminals forced into PIN maintenance standby mode.'
            : 'Floor kiosks resumed normal line scanning operations.'
        );
      }
      return merged;
    });
  };

  // Cycle Shifts
  const handleCycleShift = () => {
    const shifts: ('Shift 1' | 'Shift 2' | 'Shift 3')[] = ['Shift 1', 'Shift 2', 'Shift 3'];
    const nextIdx = (shifts.indexOf(config.shift) + 1) % shifts.length;
    const nextShift = shifts[nextIdx];
    setConfig((prev) => ({ ...prev, shift: nextShift }));
    logAuditAction(
      `Rotated plant operations to ${nextShift}`,
      'primary',
      undefined,
      `Line shift handover recorded for Garment Plant A1.`
    );
  };

  // Force Sync replication
  const handleTriggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      logAuditAction(
        'Manual Cloud Sync replication completed',
        'secondary',
        undefined,
        'PostgreSQL cluster state replicated across backup replicas with 0 dropped frames.'
      );
    }, 1200);
  };

  // Refresh Table
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Toggle terminal individual status
  const handleToggleTerminalStatus = (terminalId: string) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.id === terminalId
          ? {
              ...t,
              status: t.status === 'ONLINE' ? 'STANDBY' : 'ONLINE',
              lastSync: 'Just now',
            }
          : t
      )
    );
  };

  const onlineTerminalsCount = terminals.filter((t) => t.status === 'ONLINE').length;

  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen flex flex-col font-sans">
      {/* Emergency Lockout Banner if engaged */}
      {config.emergencyFloorLockout && (
        <div className="bg-[#ba1a1a] text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md z-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] animate-pulse">warning</span>
            <span>
              EMERGENCY FLOOR LOCKOUT ACTIVE: All 12 line floor tablets are in pin-locked maintenance standby.
            </span>
          </div>
          <button
            onClick={() => handleUpdateConfig({ emergencyFloorLockout: false })}
            className="px-2.5 py-0.5 rounded bg-white text-[#ba1a1a] font-bold text-[11px] hover:bg-[#ffdad6] transition-colors cursor-pointer"
          >
            Disengage Lockout
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <TopNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenClusterModal={() => setIsClusterModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onToggleQuickConfig={() => setQuickConfigOpen(!quickConfigOpen)}
        quickConfigOpen={quickConfigOpen}
        shift={config.shift}
        onCycleShift={handleCycleShift}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Multi-Pane Layout Structure */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Left SideBar */}
        <SideNavBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenTerminalsModal={() => setIsTerminalsModalOpen(true)}
          onOpenClusterModal={() => setIsClusterModalOpen(true)}
          isFloorLockout={config.emergencyFloorLockout}
        />

        {/* Center Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-[#f7f9fb]">
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Authenticated User Session Banner */}
            <div className="bg-[#ffffff] border border-[#e0e3e5] rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#004ac6] text-[20px]">
                  verified_user
                </span>
                <div className="text-xs">
                  <span className="font-bold text-[#191c1e]">
                    Sesi Terotentikasi: {currentUser.name}
                  </span>
                  <span className="text-[#545f73] ml-1.5 font-medium">
                    ({currentUser.role} &bull; {currentUser.department})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#545f73]">
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#007f36]"></span>
                  Stasiun: {currentUser.subLocation}
                </span>
                <span>&bull;</span>
                <span className="font-semibold text-[#111c2d]">{config.shift} Aktif</span>
                <button
                  onClick={handleLogout}
                  className="px-2 py-0.5 rounded border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 font-semibold transition-colors cursor-pointer ml-1"
                >
                  Keluar
                </button>
              </div>
            </div>
            {activeTab === 'rbac' && (
              <>
                {/* Top Section Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e0e3e5]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-[22px] font-bold text-[#191c1e] tracking-tight">
                        User Management &amp; RBAC Control Matrix
                      </h1>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#d5e0f8] text-[#111c2d]">
                        ISO/IEC 27001
                      </span>
                    </div>
                    <p className="text-[12px] text-[#545f73] mt-0.5">
                      Define factory station credentials, operational permission scopes, idle security constraints, and biometric/PIN bypass limits.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 self-start md:self-auto">
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg border border-[#e0e3e5] bg-[#ffffff] text-[#191c1e] hover:bg-[#f2f4f6] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[#545f73] text-[18px]">
                        download
                      </span>
                      <span>Export Audit Matrix</span>
                    </button>

                    <button
                      onClick={() => setIsAddUserOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2563eb] text-white hover:bg-[#004ac6] text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      <span>+ Tambah Pengguna Baru</span>
                    </button>
                  </div>
                </div>

                {/* 1. System Health & User Role Metrics (4 Top Bento Cards) */}
                <MetricsCards
                  users={users}
                  config={config}
                  terminalsCount={terminals.length}
                  onlineTerminalsCount={onlineTerminalsCount}
                  onOpenTerminalsModal={() => setIsTerminalsModalOpen(true)}
                />

                {/* 2. User & RBAC Matrix Control (Primary High-Density Table) */}
                <UserTable
                  users={users}
                  onEditUser={(user) => {
                    setEditingUser(user);
                    setIsEditUserOpen(true);
                  }}
                  onResetSecurity={(user) => {
                    setSecurityUser(user);
                    setIsSecurityModalOpen(true);
                  }}
                  onToggleUserStatus={handleToggleUserStatus}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                />
              </>
            )}

            {activeTab === 'master-data' && <MasterDataView />}

            {activeTab === 'config' && (
              <GlobalConfigView config={config} onUpdateConfig={handleUpdateConfig} />
            )}

            {activeTab === 'audit' && <AuditLogsView auditLogs={auditLogs} />}
          </div>
        </main>

        {/* 3. Collapsible Right Side Panel (Quick Global Configuration Overview) */}
        {quickConfigOpen && (
          <QuickConfigPanel
            config={config}
            onUpdateConfig={handleUpdateConfig}
            auditLogs={auditLogs}
            onViewAllAudits={() => setActiveTab('audit')}
            onOpenDiagnostics={() => setIsClusterModalOpen(true)}
          />
        )}
      </div>

      {/* Interactive Modals */}
      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAddUser={handleAddUser}
        existingUsersCount={users.length}
      />

      <EditUserModal
        user={editingUser}
        isOpen={isEditUserOpen}
        onClose={() => {
          setIsEditUserOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
      />

      <SecurityPinModal
        user={securityUser}
        isOpen={isSecurityModalOpen}
        onClose={() => {
          setIsSecurityModalOpen(false);
          setSecurityUser(null);
        }}
        onUpdateSecurity={handleUpdateSecurity}
      />

      <ExportAuditModal
        users={users}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        users={users}
        onSelectUser={(u) => {
          setEditingUser(u);
          setIsEditUserOpen(true);
        }}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenAddUser={() => setIsAddUserOpen(true)}
        onOpenTerminals={() => setIsTerminalsModalOpen(true)}
      />

      <ClusterStatusModal
        isOpen={isClusterModalOpen}
        onClose={() => setIsClusterModalOpen(false)}
        onTriggerReplication={handleTriggerSync}
        isSyncing={isSyncing}
      />

      <TerminalsFleetModal
        isOpen={isTerminalsModalOpen}
        onClose={() => setIsTerminalsModalOpen(false)}
        terminals={terminals}
        isFloorLockout={config.emergencyFloorLockout}
        onToggleTerminalStatus={handleToggleTerminalStatus}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
      />
    </div>
  );
}
