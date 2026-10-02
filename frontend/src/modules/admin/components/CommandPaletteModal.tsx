import React, { useState, useMemo, useEffect } from 'react';
import { UserAccount } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  onSelectUser: (user: UserAccount) => void;
  onNavigateTab: (tab: 'rbac' | 'master-data' | 'config' | 'audit') => void;
  onOpenAddUser: () => void;
  onOpenTerminals: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  users,
  onSelectUser,
  onNavigateTab,
  onOpenAddUser,
  onOpenTerminals,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const matchedUsers = useMemo(() => {
    if (!query.trim()) return users.slice(0, 5);
    const q = query.toLowerCase();
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          (u.stationBadge && u.stationBadge.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, users]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Search header */}
        <div className="p-3 border-b border-[#e0e3e5] flex items-center gap-2.5 bg-[#ffffff]">
          <span className="material-symbols-outlined text-[#737686] text-[20px]">search</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search operators, lines, SKUs, or type a command..."
            className="w-full text-sm text-[#191c1e] bg-transparent outline-none placeholder:text-[#737686]"
          />
          <span className="px-1.5 py-0.5 rounded border border-[#e0e3e5] text-[10px] font-mono text-[#545f73]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar text-xs divide-y divide-[#f2f4f6]">
          {/* Quick Actions */}
          <div className="pb-2">
            <span className="text-[10px] font-bold text-[#545f73] uppercase tracking-wider px-2 py-1 block">
              Quick Actions
            </span>
            <button
              onClick={() => {
                onOpenAddUser();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#f2f4f6] text-left text-[#191c1e] font-medium"
            >
              <span className="material-symbols-outlined text-[#004ac6] text-[16px]">
                person_add
              </span>
              <span>+ Add New User / Operator</span>
            </button>
            <button
              onClick={() => {
                onOpenTerminals();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#f2f4f6] text-left text-[#191c1e] font-medium"
            >
              <span className="material-symbols-outlined text-[#007f36] text-[16px]">devices</span>
              <span>View Kiosk Fleet (12 Terminals)</span>
            </button>
            <button
              onClick={() => {
                onNavigateTab('audit');
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#f2f4f6] text-left text-[#191c1e] font-medium"
            >
              <span className="material-symbols-outlined text-[#545f73] text-[16px]">
                receipt_long
              </span>
              <span>Jump to Audit Logs Matrix</span>
            </button>
          </div>

          {/* User Results */}
          <div className="pt-2">
            <span className="text-[10px] font-bold text-[#545f73] uppercase tracking-wider px-2 py-1 block">
              Operator Accounts ({matchedUsers.length})
            </span>
            {matchedUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#f2f4f6] text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#e0e3e5] text-[#191c1e] text-[10px] font-bold flex items-center justify-center">
                    {user.name.slice(0, 1)}
                  </span>
                  <div>
                    <span className="font-semibold text-[#191c1e] mr-1.5">{user.name}</span>
                    <span className="text-[11px] text-[#545f73] font-mono">{user.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#545f73]">{user.department}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f2f4f6] text-[#191c1e]">
                    {user.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between text-[11px] text-[#545f73]">
          <span>Tip: Type role or line name to filter</span>
          <div className="flex items-center gap-2">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
