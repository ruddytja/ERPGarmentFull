import React from 'react';
import { IncidentReport } from '../../types/mes';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: IncidentReport[];
  onClearIncident: (id: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  incidents,
  onClearIncident,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 select-none">
      <div className="bg-[#111827] border-l-2 border-[#2563EB] w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="h-14 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
            <span className="material-symbols-outlined text-[#2563EB]">notifications</span>
            <span>STATION ALERTS &amp; LOGS ({incidents.length})</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-xs">
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-[#64748B]">
              <span className="material-symbols-outlined text-4xl mb-2 text-[#16A34A]">
                check_circle
              </span>
              <div>NO ACTIVE STATION INCIDENTS</div>
              <div className="text-[11px] mt-1">ALL INTERLOCKS AND SCANNERS NOMINAL</div>
            </div>
          ) : (
            incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-[#051424] border border-[#334155] flex flex-col gap-1.5"
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`px-1.5 py-0.5 border text-[10px] font-bold ${
                      inc.severity === 'CRITICAL'
                        ? 'border-[#DC2626] bg-[#300C0C] text-[#DC2626]'
                        : inc.severity === 'WARNING'
                        ? 'border-[#D97706] bg-[#2D1D05] text-[#D97706]'
                        : 'border-[#2563EB] bg-[#1E293B] text-[#b4c5ff]'
                    }`}
                  >
                    {inc.severity} // {inc.id}
                  </span>
                  <span className="text-[10px] text-[#64748B]">{inc.timestamp}</span>
                </div>

                <div className="font-bold text-xs text-[#F8FAFC]">{inc.title}</div>
                <div className="text-[11px] text-[#d4e4fa] leading-relaxed">{inc.description}</div>

                <div className="border-t border-[#334155] pt-1.5 flex justify-between items-center text-[10px] text-[#64748B]">
                  <span>{inc.station}</span>
                  <button
                    onClick={() => onClearIncident(inc.id)}
                    className="text-[#b4c5ff] hover:text-white uppercase font-bold cursor-pointer"
                  >
                    RESOLVE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-[#1E293B] border-t border-[#334155]">
          <button
            onClick={onClose}
            className="w-full h-9 bg-[#051424] hover:bg-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase border border-[#334155] cursor-pointer"
          >
            CLOSE NOTIFICATIONS
          </button>
        </div>
      </div>
    </div>
  );
};
