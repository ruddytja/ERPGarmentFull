import React, { useState } from 'react';

export const TelemetryScreen: React.FC = () => {
  const [activeZone, setActiveZone] = useState<'ALL' | 'ASSEMBLY' | 'PACKAGING' | 'DOCK'>('ALL');

  return (
    <div className="flex flex-col gap-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase text-[#64748B] tracking-widest flex items-center gap-2 font-bold">
            <span>PLANT HUB C // INDUSTRIAL SENSORY MATRIX</span>
            <span>•</span>
            <span className="text-[#16A34A] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block animate-pulse"></span>
              ALL 24 SENSORS OPERATIONAL
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl text-[#F8FAFC] uppercase tracking-wider font-extrabold mt-0.5">
            PLANT TELEMETRY &amp; ENVIRONMENT INSTRUMENTATION
          </h1>
        </div>

        <div className="flex items-center gap-1 bg-[#111827] p-1 border border-[#334155] font-mono text-xs">
          {(['ALL', 'ASSEMBLY', 'PACKAGING', 'DOCK'] as const).map((zone) => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`px-3 py-1 font-bold uppercase transition-colors cursor-pointer ${
                activeZone === zone
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#64748B] hover:text-[#F8FAFC]'
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Telemetry Sensors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sensor 1: ESD Safe Floor Resistance */}
        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
              ESD STATIC POTENTIAL
            </span>
            <span className="px-1.5 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-mono text-[11px] font-bold">
              SAFE &lt; 50V
            </span>
          </div>
          <div className="my-2">
            <div className="font-headline-xl text-3xl font-extrabold text-[#F8FAFC]">14.2 V</div>
            <div className="font-mono text-[11px] text-[#64748B] mt-1">
              BENCH GROUNDING IMPEDANCE: 1.2 MΩ
            </div>
          </div>
          <div className="border-t border-[#334155] pt-2 flex justify-between font-mono text-[11px] text-[#16A34A]">
            <span>WRIST STRAP VERIFIED:</span>
            <span className="font-bold">OP-401 ATTACHED</span>
          </div>
        </div>

        {/* Sensor 2: Ambient Temp & Humidity */}
        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
              THERMAL &amp; HUMIDITY
            </span>
            <span className="px-1.5 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-mono text-[11px] font-bold">
              NOMINAL
            </span>
          </div>
          <div className="my-2">
            <div className="font-headline-xl text-3xl font-extrabold text-[#F8FAFC]">
              24.2°C <span className="text-xl text-[#64748B] font-bold">/ 48% RH</span>
            </div>
            <div className="font-mono text-[11px] text-[#64748B] mt-1">
              AIR FLOW: 0.35 m/s // HVAC UNIT C-02
            </div>
          </div>
          <div className="border-t border-[#334155] pt-2 flex justify-between font-mono text-[11px] text-[#b4c5ff]">
            <span>FABRIC SHRINKAGE RISK:</span>
            <span className="font-bold">0.00% (STABLE)</span>
          </div>
        </div>

        {/* Sensor 3: Line Power & Pneumatics */}
        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
              PNEUMATIC LINE PRESSURE
            </span>
            <span className="px-1.5 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-mono text-[11px] font-bold">
              6.2 BAR
            </span>
          </div>
          <div className="my-2">
            <div className="font-headline-xl text-3xl font-extrabold text-[#F8FAFC]">6.25 BAR</div>
            <div className="font-mono text-[11px] text-[#64748B] mt-1">
              FEED CYLINDERS // AUTOMATIC TAPERS
            </div>
          </div>
          <div className="border-t border-[#334155] pt-2 flex justify-between font-mono text-[11px] text-[#16A34A]">
            <span>PRESSURE DEVIATION:</span>
            <span className="font-bold">±0.05 BAR (PASS)</span>
          </div>
        </div>

        {/* Sensor 4: Conveyor Belt Speed */}
        <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
              PACKAGING CONVEYOR BELT #02
            </span>
            <span className="px-1.5 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-mono text-[11px] font-bold">
              SYNCHRONIZED
            </span>
          </div>
          <div className="my-2">
            <div className="font-headline-xl text-3xl font-extrabold text-[#F8FAFC]">18.4 m/min</div>
            <div className="font-mono text-[11px] text-[#64748B] mt-1">
              MOTOR CURRENT: 3.4A // VIBRATION: 0.8 mm/s
            </div>
          </div>
          <div className="border-t border-[#334155] pt-2 flex justify-between font-mono text-[11px] text-[#b4c5ff]">
            <span>BELT LOAD INDEX:</span>
            <span className="font-bold">42% (CAPACITY 120 kg)</span>
          </div>
        </div>
      </div>

      {/* Main Sensory Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sensor Matrix */}
        <div className="lg:col-span-8 bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-headline-md text-xl uppercase font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2563EB]">speed</span>
              <span>LINE 01 WORKSTATION FEED READINGS</span>
            </span>
            <span className="font-mono text-[11px] text-[#64748B]">SAMPLING: 250ms REFRESH</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'S-701',
                name: 'Carton Weight Sensor (Load Cell)',
                value: '18.42 kg',
                nominal: '18.40 kg ± 0.3 kg',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
              {
                id: 'S-702',
                name: 'Barcode Laser Camera Scanner',
                value: '99.98% decode',
                nominal: '100% at 120 scans/min',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
              {
                id: 'S-703',
                name: 'Automatic Case Taper Heat Seal',
                value: '172°C',
                nominal: '170°C - 175°C',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
              {
                id: 'S-704',
                name: 'Zebra Printhead Temperature',
                value: '42.8°C',
                nominal: 'Target &lt; 55°C',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
              {
                id: 'S-705',
                name: 'Polybag Heat Stamping Sensor',
                value: '185°C',
                nominal: '180°C - 190°C',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
              {
                id: 'S-706',
                name: 'Line Acoustic Noise Level',
                value: '68.4 dBA',
                nominal: 'OSHA Limit &lt; 85 dBA',
                status: 'PASS',
                color: 'text-[#16A34A]',
              },
            ].map((sensor) => (
              <div key={sensor.id} className="p-3 bg-[#051424] border border-[#334155] flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[11px] text-[#64748B] font-bold">{sensor.id}</span>
                  <span className="font-mono text-[11px] text-[#16A34A] border border-[#16A34A] px-1 bg-[#0F291E] font-bold">
                    {sensor.status}
                  </span>
                </div>
                <div className="my-2">
                  <div className="font-mono text-sm font-bold text-[#F8FAFC]">{sensor.name}</div>
                  <div className="font-headline-md text-xl font-bold text-[#b4c5ff] mt-0.5">
                    {sensor.value}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-[#64748B] border-t border-[#334155] pt-1">
                  NOMINAL: {sensor.nominal}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Station Diagnostics */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
            <span className="font-headline-md text-xl uppercase font-bold text-[#F8FAFC]">
              HARDWARE HEALTH
            </span>
            <span className="font-mono text-[11px] text-[#16A34A] font-bold">ALL VERIFIED</span>
          </div>

          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">ZEBRA ZT411 THERMAL</div>
                <div className="text-[11px] text-[#64748B]">IP: 192.168.10.42 // PORT 9100</div>
              </div>
              <span className="px-2 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-bold">
                ONLINE
              </span>
            </div>

            <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">HONEYWELL 1950G SCANNER</div>
                <div className="text-[11px] text-[#64748B]">USB HID POS // AUTO SENSE</div>
              </div>
              <span className="px-2 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-bold">
                READY
              </span>
            </div>

            <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">METTLER TOLEDO BENCH SCALE</div>
                <div className="text-[11px] text-[#64748B]">SERIAL RS-232 // ZERO TARE OK</div>
              </div>
              <span className="px-2 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-bold">
                CALIBRATED
              </span>
            </div>

            <div className="p-2.5 bg-[#051424] border border-[#334155] flex justify-between items-center">
              <div>
                <div className="font-bold text-[#F8FAFC]">MES EDGE GATEWAY HUB</div>
                <div className="text-[11px] text-[#64748B]">UPTIME: 14D 08H // CPU: 12%</div>
              </div>
              <span className="px-2 py-0.5 bg-[#0F291E] border border-[#16A34A] text-[#16A34A] font-bold">
                99.99% UPTIME
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
