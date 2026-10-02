import React, { useState, useMemo } from 'react';
import { SystemAuditItem } from '../../types';

interface AuditLogsViewProps {
  auditLogs: SystemAuditItem[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ auditLogs }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = query.toLowerCase();
      const matchesQuery =
        log.action.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.targetUserId && log.targetUserId.toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === 'All' ||
        (selectedCategory === 'Primary' && log.category === 'primary') ||
        (selectedCategory === 'Security' && log.category === 'tertiary') ||
        (selectedCategory === 'Error' && log.category === 'error');

      return matchesQuery && matchesCat;
    });
  }, [auditLogs, query, selectedCategory]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e0e3e5]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#191c1e] tracking-tight">
              System Audit Logs &amp; Access Compliance
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#7ffc97] text-[#002109]">
              WORM Compliant
            </span>
          </div>
          <p className="text-[12px] text-[#545f73] mt-0.5">
            Cryptographically signed ledger of permission grants, PIN resets, terminal lockout events, and parameter updates.
          </p>
        </div>

        <button
          onClick={() => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
            const dl = document.createElement('a');
            dl.setAttribute('href', dataStr);
            dl.setAttribute('download', `audit_trail_${Date.now()}.json`);
            dl.click();
          }}
          className="px-3.5 py-1.5 rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6] text-xs font-semibold flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Audit Trail (JSON)
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#e0e3e5] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#737686] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, actor, target user, or log hash..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="text-[#545f73]">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#f2f4f6] border border-[#e0e3e5] rounded-lg py-1 px-2.5 text-xs text-[#191c1e]"
          >
            <option value="All">All Events ({auditLogs.length})</option>
            <option value="Primary">Operational / Shift</option>
            <option value="Security">Security &amp; RBAC</option>
            <option value="Error">Deactivations / Warnings</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-[#e0e3e5] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f2f4f6] border-b border-[#e0e3e5] text-[11px] font-semibold text-[#545f73] uppercase tracking-wider">
                <th className="py-2.5 px-4">Event ID &amp; Action</th>
                <th className="py-2.5 px-3">Actor (Initiator)</th>
                <th className="py-2.5 px-3">Target ID</th>
                <th className="py-2.5 px-3">Scope &amp; Details</th>
                <th className="py-2.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8ea]">
              {filteredLogs.map((log) => {
                let badgeClass = 'bg-[#2563eb]/10 text-[#2563eb]';
                if (log.category === 'tertiary') badgeClass = 'bg-[#007f36]/15 text-[#007f36]';
                else if (log.category === 'error') badgeClass = 'bg-[#ba1a1a]/15 text-[#ba1a1a]';
                else if (log.category === 'secondary') badgeClass = 'bg-[#545f73]/15 text-[#545f73]';

                return (
                  <tr key={log.id} className="hover:bg-[#f2f4f6]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${badgeClass}`}>
                          {log.id}
                        </span>
                        <span className="font-semibold text-[#191c1e]">{log.action}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#191c1e] font-mono text-[11px]">
                      {log.user}
                    </td>
                    <td className="py-3 px-3">
                      {log.targetUserId ? (
                        <span className="font-mono text-[#004ac6] font-semibold">
                          {log.targetUserId}
                        </span>
                      ) : (
                        <span className="text-[#545f73]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#545f73] max-w-md">
                      {log.details || 'Standard access lifecycle transition.'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-[#545f73] whitespace-nowrap">
                      <div>{log.timeAgo}</div>
                      <div className="text-[10px] text-[#737686]">{log.timestamp}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
