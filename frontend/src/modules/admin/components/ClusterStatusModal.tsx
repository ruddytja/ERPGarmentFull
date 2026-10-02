import React from 'react';

interface ClusterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerReplication: () => void;
  isSyncing: boolean;
}

export const ClusterStatusModal: React.FC<ClusterStatusModalProps> = ({
  isOpen,
  onClose,
  onTriggerReplication,
  isSyncing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">dns</span>
            <div>
              <h3 className="font-bold text-[16px] text-[#191c1e]">
                Enterprise Cluster &amp; Telemetry
              </h3>
              <p className="text-[11px] text-[#545f73]">
                Garment Plant A1 • Multi-Region Fabric Ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#545f73] hover:text-[#191c1e] p-1 rounded hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Nodes grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6]">
              <div className="flex items-center justify-between text-[#545f73] mb-1">
                <span>PostgreSQL Cluster</span>
                <span className="w-2 h-2 rounded-full bg-[#007f36]"></span>
              </div>
              <div className="text-[15px] font-bold text-[#191c1e] font-mono">PRIMARY-01</div>
              <div className="text-[11px] text-[#007f36] font-medium mt-1">
                Latency: 6.4ms • 0 deadlocks
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6]">
              <div className="flex items-center justify-between text-[#545f73] mb-1">
                <span>Worker Threads</span>
                <span className="w-2 h-2 rounded-full bg-[#007f36]"></span>
              </div>
              <div className="text-[15px] font-bold text-[#191c1e] font-mono">16 / 16 Active</div>
              <div className="text-[11px] text-[#545f73] mt-1">Queue Depth: 0 tasks</div>
            </div>
          </div>

          {/* Node health breakdown */}
          <div className="space-y-2 border border-[#e0e3e5] rounded-lg p-3 bg-white">
            <div className="flex justify-between items-center text-[11px] font-semibold text-[#545f73] pb-1 border-b border-[#e0e3e5]">
              <span>Subsystem</span>
              <span>State</span>
              <span>Heartbeat</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="font-medium text-[#191c1e]">Kiosk WebSocket Broker</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#007f36]/15 text-[#007f36]">
                ONLINE
              </span>
              <span className="font-mono text-[#545f73] text-[11px]">0.2ms ping</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="font-medium text-[#191c1e]">RFID Badge Validator Daemon</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#007f36]/15 text-[#007f36]">
                ONLINE
              </span>
              <span className="font-mono text-[#545f73] text-[11px]">0.4ms ping</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="font-medium text-[#191c1e]">SPK Batch Ledger Syncer</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#007f36]/15 text-[#007f36]">
                ONLINE
              </span>
              <span className="font-mono text-[#545f73] text-[11px]">1.1ms ping</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="font-medium text-[#191c1e]">Cloud ERP Bi-directional Gateway</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#007f36]/15 text-[#007f36]">
                SYNCED
              </span>
              <span className="font-mono text-[#545f73] text-[11px]">3.8ms ping</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between">
          <span className="text-[11px] text-[#545f73]">ISO/IEC 27001 High-Availability Pod</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#e0e3e5] text-[#545f73] hover:bg-white text-xs font-medium"
            >
              Close
            </button>
            <button
              onClick={onTriggerReplication}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded bg-[#2563eb] text-white text-xs font-semibold hover:bg-[#004ac6] flex items-center gap-1 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[15px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {isSyncing ? 'Replicating...' : 'Force Sync Replication'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
