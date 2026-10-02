import React from 'react';
import { soundManager } from '../../utils/audio';

export interface AlertNotification {
  id: string;
  title: string;
  time: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AlertNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onDismiss,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="w-full max-w-sm h-full bg-[#111827] border-l border-[#334155] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-16 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#b4c5ff] text-xl" data-icon="notifications">
              notifications
            </span>
            <span className="font-condensed text-lg uppercase text-[#F8FAFC] font-bold tracking-wider">
              NOTIFIKASI OPERASIONAL
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" data-icon="close">
              close
            </span>
          </button>
        </div>

        {/* Action bar */}
        <div className="p-3 bg-[#0B0F17] border-b border-[#334155] flex justify-between items-center text-xs font-mono">
          <span className="text-[#64748B]">{notifications.length} Pesan Aktif</span>
          {notifications.length > 0 && (
            <button
              onClick={() => {
                soundManager.playClick();
                onClearAll();
              }}
              className="text-[#b4c5ff] hover:underline cursor-pointer"
            >
              Hapus Semua
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#334155] p-2">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-[#64748B]">
              Semua sinyal operasional normal. Tidak ada alert aktif.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 transition-colors ${
                  n.type === 'CRITICAL' ? 'bg-[#300C0C]/30 border-l-2 border-l-[#DC2626]' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase ${
                      n.type === 'CRITICAL'
                        ? 'text-[#DC2626]'
                        : n.type === 'WARNING'
                        ? 'text-[#D97706]'
                        : 'text-[#16A34A]'
                    }`}
                  >
                    {n.type}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">{n.time}</span>
                </div>
                <div className="font-mono text-xs font-bold text-[#F8FAFC]">{n.title}</div>
                <p className="font-mono text-[11px] text-[#64748B] mt-1">{n.message}</p>
                <div className="mt-2 text-right">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onDismiss(n.id);
                    }}
                    className="text-[10px] font-mono text-[#64748B] hover:text-[#F8FAFC] underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
