import React, { useState, useMemo } from 'react';
import { UserAccount } from '../types';

interface UserTableProps {
  users: UserAccount[];
  onEditUser: (user: UserAccount) => void;
  onResetSecurity: (user: UserAccount) => void;
  onToggleUserStatus: (user: UserAccount) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onEditUser,
  onResetSecurity,
  onToggleUserStatus,
  onRefresh,
  isRefreshing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.stationBadge && u.stationBadge.toLowerCase().includes(query)) ||
        u.department.toLowerCase().includes(query);

      const matchesRole =
        selectedRole === 'All' ||
        (selectedRole === 'Founder' && u.role === 'FOUNDER') ||
        (selectedRole === 'Finance' && u.role === 'FINANCE') ||
        (selectedRole === 'Supervisor' && u.role === 'SUPERVISOR') ||
        (selectedRole === 'Staff' && u.role === 'STAFF') ||
        (selectedRole === 'Admin' && u.role === 'ADMIN');

      const matchesDept =
        selectedDepartment === 'All' ||
        (selectedDepartment === 'Sewing' && u.department.includes('Sewing')) ||
        (selectedDepartment === 'Cutting' && (u.department.includes('Cutting') || u.department.includes('Bundling'))) ||
        (selectedDepartment === 'QC' && u.department.includes('QC')) ||
        (selectedDepartment === 'Finance' && (u.department.includes('Costing') || u.department.includes('Finance') || u.department.includes('Payroll')));

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, searchQuery, selectedRole, selectedDepartment]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages);

  const displayedUsers = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, clampedPage, pageSize]);

  const startIndex = (clampedPage - 1) * pageSize + 1;
  const endIndex = Math.min(clampedPage * pageSize, filteredUsers.length);

  // Helper for role badge styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'FOUNDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#312e81]/10 text-[#312e81] border border-[#312e81]/20">
            FOUNDER
          </span>
        );
      case 'SUPERVISOR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#047857]/10 text-[#047857] border border-[#047857]/20">
            SUPERVISOR
          </span>
        );
      case 'FINANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20">
            FINANCE
          </span>
        );
      case 'STAFF':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#b45309]/10 text-[#b45309] border border-[#b45309]/20">
            STAFF
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#1e293b] text-white">
            ADMIN
          </span>
        );
      default:
        return null;
    }
  };

  // Helper for initials
  const getInitials = (name: string, role: string) => {
    if (role === 'ADMIN' && name.includes('Raditya')) return 'RA';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <section className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] overflow-hidden shadow-2xs">
      {/* Section Controls / Filter Bar */}
      <div className="p-3 sm:p-4 border-b border-[#e0e3e5] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#ffffff]">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#737686] pointer-events-none text-[18px]">
              search
            </span>
            <input
              className="w-full pl-8 pr-3 py-1.5 bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg text-[13px] text-[#191c1e] placeholder:text-[#545f73] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
              placeholder="Cari nama, ID operator, atau email..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-[#545f73] hover:text-[#191c1e]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Filter by Role */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[12px] font-medium text-[#545f73]">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg py-1.5 pl-2.5 pr-8 text-[13px] text-[#191c1e] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] cursor-pointer"
            >
              <option value="All">All Roles (5 Active)</option>
              <option value="Founder">Founder</option>
              <option value="Finance">Finance</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Staff">Staff / Operator</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {/* Station Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[12px] font-medium text-[#545f73]">Line:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg py-1.5 pl-2.5 pr-8 text-[13px] text-[#191c1e] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] cursor-pointer"
            >
              <option value="All">All Departments</option>
              <option value="Sewing">Sewing Lines (1 - 6)</option>
              <option value="Cutting">Cutting Floor &amp; Bundling</option>
              <option value="QC">QC Inspection &amp; Finishing</option>
              <option value="Finance">HQ Finance &amp; Costing</option>
            </select>
          </div>
        </div>

        {/* Quick Table Actions */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <span className="text-[12px] text-[#545f73]">
            Showing <strong className="text-[#191c1e] font-semibold">{displayedUsers.length} of {filteredUsers.length}</strong> users
          </span>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded border border-[#e0e3e5] text-[#545f73] hover:text-[#191c1e] hover:bg-[#f2f4f6] transition-colors cursor-pointer"
            title="Refresh Table Data"
          >
            <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Rich High-Density Data Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#f2f4f6] border-b border-[#e0e3e5] text-[11px] font-semibold text-[#545f73] uppercase tracking-wider">
              <th className="py-2.5 px-4 font-semibold">User ID &amp; Full Name</th>
              <th className="py-2.5 px-3 font-semibold">Role Badge</th>
              <th className="py-2.5 px-3 font-semibold">Assigned Station / Dept</th>
              <th className="py-2.5 px-3 font-semibold">Auth Method</th>
              <th className="py-2.5 px-3 font-semibold text-center">Costing View</th>
              <th className="py-2.5 px-3 font-semibold text-center">SPK Activate</th>
              <th className="py-2.5 px-3 font-semibold text-center">Kiosk Scan</th>
              <th className="py-2.5 px-3 font-semibold text-center">Payroll Draft</th>
              <th className="py-2.5 px-3 font-semibold">Status / Last Active</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e8ea] text-[13px]">
            {displayedUsers.map((user) => {
              const initials = getInitials(user.name, user.role);

              // Avatar background logic
              let avatarBgClass = 'bg-[#e0e3e5] text-[#434655]';
              if (user.role === 'FOUNDER') avatarBgClass = 'bg-[#dbe1ff] text-[#004ac6]';
              else if (user.role === 'SUPERVISOR') avatarBgClass = 'bg-[#7ffc97] text-[#002109]';
              else if (user.role === 'FINANCE') avatarBgClass = 'bg-[#d8e3fb] text-[#111c2d]';
              else if (user.role === 'ADMIN') avatarBgClass = 'bg-[#191c1e] text-white';

              return (
                <tr key={user.id} className="hover:bg-[#f2f4f6]/50 transition-colors">
                  {/* User ID & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded ${avatarBgClass} font-bold flex items-center justify-center text-xs shrink-0 select-none`}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold text-[#191c1e] flex items-center gap-1.5 leading-tight">
                          <span>{user.name}</span>
                          {user.isOwner && (
                            <span
                              className="material-symbols-outlined text-[#004ac6] text-[15px]"
                              title="System Owner"
                            >
                              verified
                            </span>
                          )}
                          {user.role === 'ADMIN' && (
                            <span
                              className="material-symbols-outlined text-[#004ac6] text-[14px]"
                              title="Tenant Administrator"
                            >
                              admin_panel_settings
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[#545f73] font-mono leading-tight mt-0.5">
                          {user.id}
                          {user.stationBadge ? ` • Station Badge: ${user.stationBadge}` : ` • ${user.email}`}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role Badge */}
                  <td className="py-3 px-3 whitespace-nowrap">{getRoleBadge(user.role)}</td>

                  {/* Assigned Station / Dept */}
                  <td className="py-3 px-3">
                    <span className="text-[#191c1e] font-medium block leading-tight">
                      {user.department}
                    </span>
                    <span className="block text-[#545f73] text-[11px] leading-tight mt-0.5">
                      {user.subLocation}
                    </span>
                  </td>

                  {/* Auth Method */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[#545f73]">
                      <span className="material-symbols-outlined text-[16px]">
                        {user.authMethodIcon || 'key'}
                      </span>
                      <span className="font-medium text-[#191c1e] text-[12px]">
                        {user.authMethod}
                      </span>
                    </div>
                  </td>

                  {/* Costing View */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        user.permissions.costingView
                          ? 'bg-[#007f36]/15 text-[#007f36]'
                          : 'bg-[#e6e8ea] text-[#545f73]'
                      }`}
                    >
                      {user.permissions.costingView ? 'YES' : 'NO'}
                    </span>
                  </td>

                  {/* SPK Activate */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        user.permissions.spkActivate
                          ? 'bg-[#007f36]/15 text-[#007f36]'
                          : 'bg-[#e6e8ea] text-[#545f73]'
                      }`}
                    >
                      {user.permissions.spkActivate ? 'YES' : 'NO'}
                    </span>
                  </td>

                  {/* Kiosk Scan */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        user.permissions.kioskScan
                          ? 'bg-[#007f36]/15 text-[#007f36]'
                          : 'bg-[#e6e8ea] text-[#545f73]'
                      }`}
                    >
                      {user.permissions.kioskScan ? 'YES' : 'NO'}
                    </span>
                  </td>

                  {/* Payroll Draft */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        user.permissions.payrollDraft
                          ? 'bg-[#007f36]/15 text-[#007f36]'
                          : 'bg-[#e6e8ea] text-[#545f73]'
                      }`}
                    >
                      {user.permissions.payrollDraft ? 'YES' : 'NO'}
                    </span>
                  </td>

                  {/* Status / Last Active */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          user.status === 'active'
                            ? 'bg-[#007f36]'
                            : user.status === 'idle'
                            ? 'bg-[#545f73]'
                            : 'bg-[#ba1a1a]'
                        }`}
                      ></span>
                      <span
                        className={`text-[12px] font-medium leading-tight ${
                          user.status === 'deactivated' ? 'text-[#545f73]' : 'text-[#191c1e]'
                        }`}
                      >
                        {user.statusText}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#545f73] block mt-0.5">
                      {user.status === 'deactivated'
                        ? user.lastActive
                        : `Idle timeout: ${user.idleTimeoutMinutes}m`}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditUser(user)}
                        className="p-1 rounded text-[#545f73] hover:text-[#004ac6] hover:bg-[#eceef0] transition-colors cursor-pointer"
                        title="Edit Permissions & Station"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                      </button>

                      <button
                        onClick={() => onResetSecurity(user)}
                        className="p-1 rounded text-[#545f73] hover:text-[#191c1e] hover:bg-[#eceef0] transition-colors cursor-pointer"
                        title="Security & PIN Reset"
                      >
                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                      </button>

                      <button
                        onClick={() => onToggleUserStatus(user)}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          user.status === 'deactivated'
                            ? 'text-[#007f36] hover:bg-[#007f36]/10'
                            : 'text-[#545f73] hover:text-[#ba1a1a] hover:bg-[#eceef0]'
                        }`}
                        title={user.status === 'deactivated' ? 'Reactivate Account' : 'Deactivate Account'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          power_settings_new
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {displayedUsers.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[#545f73]">
                  <span className="material-symbols-outlined text-[32px] mb-1 block">search_off</span>
                  No operator accounts found matching your query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Pagination */}
      <div className="p-3 border-t border-[#e0e3e5] bg-[#f2f4f6] flex flex-col sm:flex-row items-center justify-between text-[12px] gap-2">
        <div className="text-[#545f73]">
          Showing records <strong className="text-[#191c1e]">{startIndex} - {endIndex}</strong> of{' '}
          {filteredUsers.length} total operators &amp; accounts
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={clampedPage === 1}
            className={`px-2.5 py-1 rounded border border-[#e0e3e5] text-xs transition-colors ${
              clampedPage === 1
                ? 'bg-[#ffffff] text-[#737686] opacity-50 cursor-not-allowed'
                : 'bg-[#ffffff] text-[#191c1e] hover:bg-[#eceef0] cursor-pointer'
            }`}
          >
            Previous
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            // display 1, 2, 3, ... lastPage if many pages
            if (
              totalPages > 6 &&
              pageNum !== 1 &&
              pageNum !== totalPages &&
              Math.abs(pageNum - clampedPage) > 1
            ) {
              if (pageNum === 2 || pageNum === totalPages - 1) {
                return (
                  <span key={pageNum} className="px-1 text-[#545f73]">
                    ...
                  </span>
                );
              }
              return null;
            }

            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                  clampedPage === pageNum
                    ? 'border-[#004ac6] bg-[#004ac6] text-white'
                    : 'border-[#e0e3e5] bg-[#ffffff] text-[#191c1e] hover:bg-[#eceef0]'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={clampedPage === totalPages}
            className={`px-2.5 py-1 rounded border border-[#e0e3e5] text-xs transition-colors ${
              clampedPage === totalPages
                ? 'bg-[#ffffff] text-[#737686] opacity-50 cursor-not-allowed'
                : 'bg-[#ffffff] text-[#191c1e] hover:bg-[#eceef0] cursor-pointer'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};
