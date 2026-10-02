import React, { useState, useEffect } from 'react';

export const FloorStatusBar: React.FC = () => {
  const [currentTime, setCurrentTime] = useState('14:48:12 WIB');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${mins}:${secs} WIB`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs select-none">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          <span className="text-[#0F172A] font-semibold">Cutting Room:</span>
          <span className="text-[#64748B] font-code-metric">Line A, B &amp; C Running (100%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          <span className="text-[#0F172A] font-semibold">Sewing Floor:</span>
          <span className="text-[#64748B] font-code-metric">12 / 12 Lines Synchronized</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
          <span className="text-[#0F172A] font-semibold">Finishing &amp; Packing:</span>
          <span className="text-[#64748B] font-code-metric">94% Capacity (Batch 095 Queue)</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[#64748B] flex-wrap">
        <span>Server Synchronization: <strong className="text-[#0F172A]">Sukabumi Plant Central MES</strong></span>
        <span className="text-[#CBD5E1]">|</span>
        <span className="font-code-metric">Last Auto-Sync: {currentTime}</span>
      </div>
    </footer>
  );
};
