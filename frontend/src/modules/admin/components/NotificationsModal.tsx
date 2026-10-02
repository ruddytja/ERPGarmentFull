import React from 'react';

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-[#191c1e]/20">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#004ac6] text-[18px]">
              notifications
            </span>
            <span className="font-bold text-xs text-[#191c1e]">System Notifications</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-[11px] text-[#004ac6] hover:underline cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="text-[#545f73] hover:text-[#191c1e] p-0.5 rounded hover:bg-[#e0e3e5]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-[#f2f4f6] text-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 space-y-1 hover:bg-[#f2f4f6]/50 transition-colors ${
                !n.read ? 'bg-[#d5e0f8]/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold text-[#191c1e] leading-tight">{n.title}</span>
                <span className="text-[10px] text-[#737686] whitespace-nowrap">{n.time}</span>
              </div>
              <p className="text-[#545f73] text-[11px] leading-relaxed">{n.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
