import React, { useState, useEffect } from 'react';

interface FooterTelemetryProps {
  temperature?: number;
  humidity?: number;
  ribbonRemaining?: number;
  latency?: number;
}

export const FooterTelemetry: React.FC<FooterTelemetryProps> = ({
  temperature = 24.2,
  humidity = 48,
  ribbonRemaining = 82,
  latency = 8,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0]);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="mt-auto pt-2 pb-2 px-4 border-t border-[#334155] bg-[#051424] flex flex-col sm:flex-row justify-between items-center font-mono text-[11px] text-[#64748B] gap-2 shrink-0 select-none">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="flex items-center gap-1.5 text-[#F8FAFC]">
          <span className="w-1.5 h-1.5 bg-[#16A34A] animate-pulse"></span>
          <span>
            STATION TELEMETRY: {temperature.toFixed(1)}°C // HUMIDITY: {humidity}% (ESD SAFE)
          </span>
        </span>
        <span className="hidden md:inline text-[#334155]">|</span>
        <span className="hidden md:inline">NETWORK LATENCY: {latency}ms (LAN WIRED)</span>
        <span className="hidden md:inline text-[#334155]">|</span>
        <span className="hidden md:inline">
          LABEL PRINTER: ONLINE // RIBBON: {ribbonRemaining}%
        </span>
        <span className="hidden lg:inline text-[#334155]">|</span>
        <span className="hidden lg:inline text-[#b4c5ff]">TIME: {timeStr || '13:42:15'}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[#64748B]">MES ERP VERSION: v4.82.1-IND-BRUT</span>
      </div>
    </footer>
  );
};
