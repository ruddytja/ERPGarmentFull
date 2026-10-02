import React, { useState } from 'react';

export const InventoryOutScreen: React.FC = () => {
  const [selectedBerth, setSelectedBerth] = useState<string>('BERTH 02');

  const berths = [
    {
      berth: 'BERTH 01',
      carrier: 'INDAH CARGO LOGISTICS',
      vehicle: 'B 9421 KXT',
      driver: 'Suryadi Pratama',
      destination: 'SURABAYA DISTRIBUTION HUB',
      manifestPo: 'PO-MTR-2026-881',
      cartonsLoaded: 42,
      cartonsTotal: 50,
      status: 'LOADING IN PROGRESS (84%)',
      badgeColor: 'border-[#D97706] text-[#D97706] bg-[#2D1D05]',
    },
    {
      berth: 'BERTH 02',
      carrier: 'JNE CARGO EXPRESS',
      vehicle: 'B 9811 UO',
      driver: 'Joko Santoso',
      destination: 'JAKARTA CENTRAL HUB // MARUNDA',
      manifestPo: 'PO-JKT-2026-104',
      cartonsLoaded: 0,
      cartonsTotal: 36,
      status: 'VEHICLE ARRIVED // STAGING ACTIVE',
      badgeColor: 'border-[#D97706] text-[#D97706] bg-[#2D1D05] animate-pulse',
    },
    {
      berth: 'BERTH 03',
      carrier: 'J&T CARGO E-COMMERCE',
      vehicle: 'B 9132 PXN',
      driver: 'Ahmad Fauzi',
      destination: 'TIKTOK SHOP / SHOPEE BULK POOL',
      manifestPo: 'POOL-ECOM-2026-88',
      cartonsLoaded: 120,
      cartonsTotal: 120,
      status: 'DISPATCH CLEARANCE OK',
      badgeColor: 'border-[#16A34A] text-[#16A34A] bg-[#0F291E]',
    },
    {
      berth: 'BERTH 04',
      carrier: 'SICEPAT CARGO LINE',
      vehicle: 'D 8842 AB',
      driver: 'Hendra Gunawan',
      destination: 'BANDUNG REGIONAL WAREHOUSE',
      manifestPo: 'PO-BDG-2026-033',
      cartonsLoaded: 0,
      cartonsTotal: 25,
      status: 'AWAITING VEHICLE INBOUND',
      badgeColor: 'border-[#334155] text-[#64748B] bg-[#1E293B]',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase text-[#64748B] tracking-widest flex items-center gap-2 font-bold">
            <span>PLANT HUB C // LOGISTICS FREIGHT OUTFLOW</span>
            <span>•</span>
            <span className="text-[#16A34A] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block animate-pulse"></span>
              4 DOCK BAYS MONITORED
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl text-[#F8FAFC] uppercase tracking-wider font-extrabold mt-0.5">
            INVENTORY OUT &amp; LOGISTICS DOCK BERTHS
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] bg-[#111827] border border-[#334155] px-3 py-1.5">
          <span className="text-[#64748B]">SCHEDULED TRUCKS:</span>
          <span className="text-[#b4c5ff] font-bold">4 CARRIERS</span>
          <span className="text-[#334155]">|</span>
          <span className="text-[#64748B]">GATE PASS:</span>
          <span className="text-[#16A34A] font-bold">ACTIVE</span>
        </div>
      </div>

      {/* Dock Bay Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {berths.map((b) => {
          const isSelected = selectedBerth === b.berth;
          return (
            <div
              key={b.berth}
              onClick={() => setSelectedBerth(b.berth)}
              className={`p-4 bg-[#111827] border ${
                isSelected ? 'border-[#2563EB] ring-1 ring-[#2563EB]' : 'border-[#334155]'
              } flex flex-col justify-between cursor-pointer hover:bg-[#1E293B]/40 transition-colors select-none`}
            >
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-[#334155]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2563EB] text-xl">
                      local_shipping
                    </span>
                    <span className="font-headline-md text-xl font-bold text-[#F8FAFC]">
                      {b.berth}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 font-mono text-[11px] font-bold border ${b.badgeColor}`}>
                    {b.status}
                  </span>
                </div>

                <div className="my-3">
                  <div className="font-headline-sm text-lg font-bold text-[#b4c5ff]">
                    {b.carrier}
                  </div>
                  <div className="font-mono text-xs text-[#F8FAFC] mt-0.5">
                    VEHICLE: <span className="font-bold">{b.vehicle}</span> // DRIVER: {b.driver}
                  </div>
                  <div className="font-mono text-[11px] text-[#64748B] mt-1">
                    DESTINATION: {b.destination}
                  </div>
                </div>

                <div className="bg-[#051424] p-2.5 border border-[#334155] font-mono text-xs flex justify-between items-center">
                  <div>
                    <span className="text-[#64748B] block text-[10px]">PO MANIFEST:</span>
                    <span className="font-bold text-[#F8FAFC]">{b.manifestPo}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#64748B] block text-[10px]">STAGED CARTONS:</span>
                    <span className="font-bold text-[#16A34A] tabular-nums">
                      {b.cartonsLoaded} / {b.cartonsTotal} CTN
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#334155] flex justify-between items-center font-mono text-[11px]">
                <span className="text-[#64748B]">DISPATCH SEAL: APPLIED</span>
                <button className="px-3 py-1 bg-[#1E293B] hover:bg-[#2563EB] text-[#F8FAFC] font-bold uppercase transition-colors tactile-button cursor-pointer border border-[#334155]">
                  VIEW GATE PASS
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
