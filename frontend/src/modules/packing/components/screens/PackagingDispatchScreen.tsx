import React, { useState } from 'react';
import { MasterCartonUnit, MultipackSlot, B2BManifest, B2CManifest } from '../../types/mes';
import { SAMPLE_BARCODES } from '../../data/initialData';

interface PackagingDispatchScreenProps {
  slots: MultipackSlot[];
  onToggleSlot: (index: number) => void;
  masterCarton: MasterCartonUnit;
  onPackCurrentMultipack: () => void;
  onSealMasterCarton: () => void;
  onManualOverride: () => void;
  onReportDamaged: () => void;
  onOpenSuratJalan: () => void;
  onOpenManifestQr: () => void;
  b2bManifest: B2BManifest;
  b2cManifest: B2CManifest;
  packedCartonsToday: number;
  totalCartonsTarget: number;
  onTriggerLabelFeed: () => void;
  isPrintingLabel: boolean;
  onScanCartonQuick: (barcode: string) => void;
}

export const PackagingDispatchScreen: React.FC<PackagingDispatchScreenProps> = ({
  slots,
  onToggleSlot,
  masterCarton,
  onPackCurrentMultipack,
  onSealMasterCarton,
  onManualOverride,
  onReportDamaged,
  onOpenSuratJalan,
  onOpenManifestQr,
  b2bManifest,
  b2cManifest,
  packedCartonsToday,
  totalCartonsTarget,
  onTriggerLabelFeed,
  isPrintingLabel,
  onScanCartonQuick,
}) => {
  const [scannedInput, setScannedInput] = useState<string>('BDL-2026-10-042-012');
  const [activeManifestTab, setActiveManifestTab] = useState<'B2B' | 'B2C'>('B2B');
  const [lastScanInfo, setLastScanInfo] = useState({
    code: 'BDL-2026-10-042-012',
    name: 'NAQALA SEAMLESS BRIEF M (24 PCS)',
    qcStatus: 'QC PASSED',
    time: '13:42:08',
  });
  const [scannerStatus, setScannerStatus] = useState<'LOCKED' | 'TRIGGERING' | 'ACQUIRED'>('LOCKED');

  const allSlotsVerified = slots.every((s) => s.verified);
  const completionPercent = Math.round((packedCartonsToday / totalCartonsTarget) * 100);
  const cartonPercent = Math.round((masterCarton.currentMultipacks / masterCarton.targetMultipacks) * 100);

  const handleForceRetry = () => {
    setScannerStatus('TRIGGERING');
    setTimeout(() => {
      setScannerStatus('LOCKED');
    }, 600);
  };

  const handleQuickScan = (barcode: string, desc: string) => {
    setScannedInput(barcode);
    setScannerStatus('TRIGGERING');
    setTimeout(() => {
      setScannerStatus('LOCKED');
      const now = new Date();
      setLastScanInfo({
        code: barcode,
        name: desc,
        qcStatus: 'QC PASSED',
        time: now.toTimeString().split(' ')[0],
      });
      onScanCartonQuick(barcode);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* SUB-HEADER TITLE / SYSTEM LOCATOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase text-[#64748B] tracking-widest flex items-center gap-2 font-bold">
            <span>PLANT HUB C // FINAL ASSEMBLY AREA</span>
            <span>•</span>
            <span className="text-[#16A34A] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block animate-pulse"></span>
              STATION FEED ACTIVE
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl text-[#F8FAFC] uppercase tracking-wider font-extrabold mt-0.5">
            PACKAGING &amp; DISPATCH STATION // FULFILLMENT HUB
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] bg-[#111827] border border-[#334155] px-3 py-1.5">
          <span className="text-[#64748B]">DISPATCH SPK BATCH:</span>
          <span className="text-[#b4c5ff] font-bold">BATCH-2026-PKG-09</span>
          <span className="text-[#334155]">|</span>
          <span className="text-[#64748B]">LINE BALANCE:</span>
          <span className="text-[#16A34A] font-bold">102.4%</span>
        </div>
      </div>

      {/* KPI TELEMETRY SUMMARY ROW (4 Brutalist Instrumentation Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Cartons Packed */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              TODAY PACKED CARTONS
            </div>
            <span className="px-1.5 py-0.5 border border-[#16A34A] bg-[#0F291E] text-[#16A34A] font-mono text-[11px] font-bold">
              ON TRACK
            </span>
          </div>
          <div className="mt-2 mb-1">
            <div className="font-headline-xl text-3xl sm:text-4xl tabular-nums text-[#F8FAFC] tracking-tight flex items-baseline gap-2 font-extrabold">
              <span>{packedCartonsToday}</span>
              <span className="font-headline-md text-xl text-[#64748B] font-bold">
                / {totalCartonsTarget} CARTONS
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#b4c5ff] mt-0.5 font-bold">
              {(packedCartonsToday * 24).toLocaleString()} PCS TOTAL DISPATCHED
            </div>
          </div>
          {/* Hard Linear Bar */}
          <div className="w-full bg-[#1E293B] h-2 mt-2 border border-[#334155]">
            <div
              className="bg-[#2563EB] h-full transition-all duration-300"
              style={{ width: `${Math.min(completionPercent, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between font-mono text-[11px] text-[#64748B] mt-1 font-bold">
            <span>SHIFT COMPLETION: {completionPercent}%</span>
            <span>TARGET: {totalCartonsTarget} CTN</span>
          </div>
        </div>

        {/* Metric 2: Multipack Accuracy */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              MULTIPACK ACCURACY
            </div>
            <span className="px-1.5 py-0.5 border border-[#16A34A] bg-[#0F291E] text-[#16A34A] font-mono text-[11px] font-bold">
              PASSED
            </span>
          </div>
          <div className="mt-2 mb-1">
            <div className="font-headline-xl text-3xl sm:text-4xl tabular-nums text-[#F8FAFC] tracking-tight flex items-baseline gap-1 font-extrabold">
              <span>99.8</span>
              <span className="font-headline-md text-xl text-[#b4c5ff] font-bold">%</span>
            </div>
            <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
              TARGET ≥ 99.5% // TOLERANCE ±0.2%
            </div>
          </div>
          <div className="bg-[#1E293B] p-1.5 border border-[#334155] font-mono text-[11px] text-[#16A34A] flex items-center justify-between font-bold">
            <span>BARCODE VERIFY:</span>
            <span>0 MISMATCH TODAY</span>
          </div>
        </div>

        {/* Metric 3: Pending SPK */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider font-bold">
              PENDING DISPATCH SPK
            </div>
            <span className="px-1.5 py-0.5 border border-[#D97706] bg-[#2D1D05] text-[#D97706] font-mono text-[11px] font-bold">
              IN QUEUE
            </span>
          </div>
          <div className="mt-2 mb-1">
            <div className="font-headline-xl text-3xl sm:text-4xl tabular-nums text-[#F8FAFC] tracking-tight flex items-baseline gap-2 font-extrabold">
              <span>3</span>
              <span className="font-headline-md text-xl text-[#64748B] font-bold">BATCHES</span>
            </div>
            <div className="font-mono text-[11px] text-[#b4c5ff] mt-0.5">
              QUEUE ID: SPK-2026-10-042/043/044
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
            <div className="bg-[#1E293B] p-1 border border-[#334155] text-[#F8FAFC]">
              B2B: <span className="text-[#b4c5ff] font-bold">2 PO</span>
            </div>
            <div className="bg-[#1E293B] p-1 border border-[#334155] text-[#F8FAFC]">
              B2C DIRECT: <span className="text-[#D97706] font-bold">1 PO</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Logistics Status */}
        <div className="bg-[#111827] border border-[#334155] p-4 relative flex flex-col justify-between hazard-stripe-amber">
          <div className="flex justify-between items-start">
            <div className="font-mono text-[11px] text-[#F8FAFC] font-bold uppercase tracking-wider">
              DISPATCH LOGISTICS STATUS
            </div>
            <span className="px-1.5 py-0.5 border border-[#D97706] bg-[#2D1D05] text-[#D97706] font-mono text-[11px] font-bold animate-pulse">
              BERTH 02
            </span>
          </div>
          <div className="mt-1 mb-1">
            <div className="font-headline-lg text-2xl text-[#F8FAFC] uppercase tracking-tight flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[#D97706] text-xl">local_shipping</span>
              <span>JNE CARGO ARRIVED</span>
            </div>
            <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
              DOCK 2 LOADING BAY // STAGING ACTIVE
            </div>
          </div>
          <div className="bg-[#111827] p-1.5 border border-[#334155] font-mono text-[11px] text-[#F8FAFC] flex justify-between">
            <span className="text-[#64748B]">ASSIGNED DRIVER:</span>
            <span className="font-bold text-[#b4c5ff]">Joko Santoso (B 9811 UO)</span>
          </div>
        </div>
      </section>

      {/* MAIN MULTI-PANEL SPLIT (65% Workstation Operations / 35% Manifest & Dispatch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT WORKSTATION PANEL (Col span 7 on Desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Section 1: Active Workstation & Barcode Scanner Zone */}
          <div className="bg-[#111827] border border-[#334155]">
            {/* Header Bar */}
            <div className="h-9 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-headline-sm uppercase text-[#F8FAFC] tracking-wider font-bold">
                <span className="material-symbols-outlined text-[#2563EB] text-base">nest_cam_stand</span>
                <span>ACTIVE PACKING WORKSTATION // MULTIPACK SCAN &amp; VERIFICATION</span>
              </div>
              <span className="font-mono text-[11px] text-[#16A34A] uppercase font-bold flex items-center gap-1">
                <span className="w-2 h-2 bg-[#16A34A] inline-block animate-pulse"></span>
                READY TO ACQUIRE
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Barcode Scanner Input Zone with Crosshairs */}
              <div className="scanner-target-crosshairs p-4 bg-[#0B0F17] border border-dashed border-[#2563EB]">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block font-mono text-[11px] text-[#64748B] uppercase mb-1 flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-xs text-[#2563EB]">qr_code_scanner</span>
                      SCAN BUNDLE QR OR MULTIPACK BAG BARCODE (OPTICAL TRIGGER)
                    </label>
                    <div className="relative">
                      <input
                        className="w-full h-11 bg-[#111827] border border-[#334155] text-[#F8FAFC] font-mono text-sm font-bold px-3 uppercase tracking-wider focus:outline-none focus:border-[#2563EB] focus:ring-0"
                        placeholder="INPUT SCANNED MATRIX CODE..."
                        type="text"
                        value={scannedInput}
                        onChange={(e) => setScannedInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleQuickScan(scannedInput, 'MANUAL SCANNED BUNDLE (24 PCS)');
                          }
                        }}
                      />
                      <span
                        className={`absolute right-3 top-2.5 font-mono text-[11px] border px-1.5 py-0.5 font-bold ${
                          scannerStatus === 'TRIGGERING'
                            ? 'text-[#D97706] border-[#D97706] bg-[#2D1D05]'
                            : 'text-[#16A34A] border-[#16A34A] bg-[#0F291E]'
                        }`}
                      >
                        {scannerStatus === 'TRIGGERING' ? 'ACQUIRING...' : 'SCANNER LOCKED'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleForceRetry}
                    className="h-11 px-5 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 self-end shrink-0 tactile-button cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">sync</span>
                    <span>FORCE RETRY</span>
                  </button>
                </div>

                {/* Quick Sim Barcode Trigger Chips */}
                <div className="mt-2.5 pt-2 border-t border-[#334155]/60 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-[#64748B] font-bold mr-1">QUICK OPTICAL TRIGGERS:</span>
                  {SAMPLE_BARCODES.map((b) => (
                    <button
                      key={b.code}
                      onClick={() => handleQuickScan(b.code, b.desc)}
                      className="px-2 py-0.5 bg-[#1E293B] hover:bg-[#2563EB] text-[#b4c5ff] hover:text-white border border-[#334155] transition-colors cursor-pointer text-xs"
                    >
                      {b.code} ({b.size})
                    </button>
                  ))}
                </div>

                {/* Last Scanned Telemetry Breadcrumb */}
                <div className="mt-3 p-2 bg-[#1E293B] border border-[#334155] font-mono text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[#64748B] font-bold">LAST CAPTURE:</span>
                  <span className="text-[#b4c5ff] font-bold">{lastScanInfo.code}</span>
                  <span className="text-[#334155]">|</span>
                  <span className="text-[#F8FAFC]">{lastScanInfo.name}</span>
                  <span className="px-1.5 py-0.5 border border-[#16A34A] bg-[#0F291E] text-[#16A34A] font-bold">
                    {lastScanInfo.qcStatus}
                  </span>
                  <span className="text-[#64748B]">TIME: {lastScanInfo.time}</span>
                </div>
              </div>

              {/* Multipack Box Configuration & Validation Checklist */}
              <div className="border border-[#334155] bg-[#111827] p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
                  <div>
                    <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
                      ACTIVE SKU CONFIGURATION
                    </span>
                    <h2 className="font-headline-md text-xl sm:text-2xl text-[#F8FAFC] uppercase tracking-wider font-bold">
                      {masterCarton.skuDescription}
                    </h2>
                  </div>
                  <div className="px-2 py-1 bg-[#1E293B] border border-[#334155] font-mono text-[11px] text-[#b4c5ff] font-bold">
                    PACK TYPE: MULTIPACK-3R
                  </div>
                </div>

                {/* Triple Verification Grid */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {slots.map((slot, index) => (
                    <div
                      key={slot.slotNumber}
                      onClick={() => onToggleSlot(index)}
                      className={`p-3 bg-[#051424] border ${
                        slot.verified ? 'border-[#16A34A]' : 'border-[#334155]'
                      } flex flex-col justify-between cursor-pointer hover:bg-[#1E293B]/40 transition-colors select-none`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[11px] text-[#64748B] font-bold">
                          SLOT {slot.slotNumber} // {slot.pieceLabel}
                        </span>
                        <span
                          className={`material-symbols-outlined text-base ${
                            slot.verified ? 'text-[#16A34A]' : 'text-[#64748B]'
                          }`}
                          style={{ fontVariationSettings: slot.verified ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {slot.verified ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                      </div>
                      <div className="my-2">
                        <div className="font-bold text-[#F8FAFC] font-mono text-sm">
                          {slot.sizeColor}
                        </div>
                        <div
                          className={`font-mono text-[11px] font-bold ${
                            slot.verified ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          {slot.specNote}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] text-[#64748B] border-t border-[#334155] pt-1 flex justify-between">
                        <span>TAG: {slot.tagBarcode}</span>
                        <span className="text-[10px] text-[#b4c5ff]">CLICK TO TOGGLE</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Verification Status Feedback Banner */}
                <div
                  className={`mt-3 p-2 border font-mono text-[11px] flex items-center justify-between ${
                    allSlotsVerified
                      ? 'bg-[#0F291E] border-[#16A34A] text-[#16A34A]'
                      : 'bg-[#2D1D05] border-[#D97706] text-[#D97706]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-sm">
                      {allSlotsVerified ? 'verified' : 'pending'}
                    </span>
                    {allSlotsVerified
                      ? 'STATUS: 3/3 PCS INSERTED & VERIFIED // MULTIPACK BOX READY FOR MASTER CARTON'
                      : `STATUS: ${slots.filter((s) => s.verified).length}/3 PCS VERIFIED // AWAITING REMAINDER`}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold">
                      {allSlotsVerified ? 'STEP COMPLETED' : 'INCOMPLETE'}
                    </span>
                    {allSlotsVerified && (
                      <button
                        onClick={onPackCurrentMultipack}
                        className="px-2.5 py-1 bg-[#16A34A] hover:bg-green-600 text-white font-mono text-xs font-bold uppercase transition-colors tactile-button cursor-pointer"
                      >
                        + PACK INTO CARTON
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Master Carton Aggregation Table & Fill Gauge */}
              <div className="border border-[#334155] bg-[#111827] p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#334155] gap-2">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#2563EB] text-2xl">
                      package_2
                    </span>
                    <div>
                      <div className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
                        ACTIVE MASTER CARTON UNIT
                      </div>
                      <div className="font-headline-md text-xl sm:text-2xl font-bold text-[#F8FAFC]">
                        {masterCarton.cartonId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[11px] text-[#64748B] block font-bold">
                      CAPACITY LIMIT
                    </span>
                    <span className="font-mono text-sm font-bold text-[#F8FAFC]">
                      {masterCarton.targetMultipacks} MULTIPACKS ({masterCarton.targetMultipacks * 3} PCS)
                    </span>
                  </div>
                </div>

                {/* Hard Aggregation Gauge */}
                <div className="mt-4">
                  <div className="flex justify-between items-center font-mono text-[11px] mb-1 font-bold">
                    <span className="text-[#F8FAFC]">
                      AGGREGATION FILL GAUGE: {masterCarton.currentMultipacks} / {masterCarton.targetMultipacks} PACKS ({masterCarton.currentMultipacks * 3} PCS)
                    </span>
                    <span className="text-[#b4c5ff]">{cartonPercent.toFixed(1)}% COMPLETED</span>
                  </div>
                  <div className="w-full bg-[#1E293B] h-6 border border-[#334155] flex p-0.5">
                    <div
                      className="bg-[#2563EB] h-full transition-all duration-300 flex items-center justify-end pr-2 text-xs font-bold text-white whitespace-nowrap"
                      style={{ width: `${Math.max(cartonPercent, 10)}%` }}
                    >
                      {masterCarton.currentMultipacks} PACKS
                    </div>
                    <div className="bg-transparent h-full flex-1 flex items-center justify-center font-mono text-[11px] text-[#64748B] font-bold">
                      {Math.max(0, masterCarton.targetMultipacks - masterCarton.currentMultipacks)} SLOTS REMAINING
                    </div>
                  </div>
                </div>

                {/* Last Packed Items Telemetry Table */}
                <div className="mt-4 border border-[#334155] overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#1E293B] border-b border-[#334155] text-[11px] text-[#64748B] font-bold">
                      <tr>
                        <th className="py-2 px-3">PACK #</th>
                        <th className="py-2 px-3">SUB-BUNDLE SKU</th>
                        <th className="py-2 px-3">OPERATOR</th>
                        <th className="py-2 px-3">TIMESTAMP</th>
                        <th className="py-2 px-3 text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155] tabular-nums">
                      {masterCarton.packedItems.slice(0, 5).map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#1E293B]">
                          <td className="py-1.5 px-3 font-bold text-[#F8FAFC]">{item.packNumber}</td>
                          <td className="py-1.5 px-3 text-[#F8FAFC]">{item.subBundleSku}</td>
                          <td className="py-1.5 px-3 text-[#64748B]">{item.operator}</td>
                          <td className="py-1.5 px-3 text-[#64748B]">{item.timestamp}</td>
                          <td className="py-1.5 px-3 text-right">
                            <span className="text-[#16A34A] font-bold text-[11px]">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Industrial Workstation Action Cluster */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#334155]">
                  <button
                    onClick={onManualOverride}
                    className="sm:col-span-1 h-12 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 tactile-button cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">pin</span>
                    <span>MANUAL OVERRIDE</span>
                  </button>

                  <button
                    onClick={onReportDamaged}
                    className="sm:col-span-1 h-12 bg-[#300C0C] hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#DC2626] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 tactile-button transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">broken_image</span>
                    <span>REPORT DAMAGED PACK</span>
                  </button>

                  <button
                    onClick={onSealMasterCarton}
                    className="sm:col-span-1 h-12 bg-[#2563EB] hover:bg-blue-600 text-white font-headline-md text-base sm:text-lg font-bold uppercase tracking-wider flex items-center justify-center gap-2 tactile-button shadow-[4px_4px_0px_0px_#000000] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      qr_code_2
                    </span>
                    <span>SEAL MASTER &amp; PRINT QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT DISPATCH & SHIPPING MANIFEST (Col span 5 on Desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Section 2: Dispatch Manifest Queue */}
          <div className="bg-[#111827] border border-[#334155] flex flex-col">
            {/* Header with Tab Switcher */}
            <div className="bg-[#1E293B] border-b border-[#334155] p-2 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-headline-sm uppercase text-[#F8FAFC] tracking-wider flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[#2563EB] text-base">
                    local_shipping
                  </span>
                  <span>PENDING &amp; READY DISPATCH MANIFEST</span>
                </span>
                <span className="px-1.5 py-0.5 border border-[#334155] bg-[#051424] font-mono text-[11px] text-[#64748B] font-bold">
                  DOCK 02
                </span>
              </div>

              {/* Segmented Manifest Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-[#051424] p-1 border border-[#334155] font-mono text-[11px]">
                <button
                  onClick={() => setActiveManifestTab('B2B')}
                  className={`py-1.5 font-bold uppercase text-center flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    activeManifestTab === 'B2B'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-transparent text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">store</span>
                  <span>B2B PO SHIPMENT (WHOLESALE)</span>
                </button>
                <button
                  onClick={() => setActiveManifestTab('B2C')}
                  className={`py-1.5 font-bold uppercase text-center flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    activeManifestTab === 'B2C'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-transparent text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">shopping_bag</span>
                  <span>B2C E-COMMERCE CONSOLIDATION</span>
                </button>
              </div>
            </div>

            {/* Manifest Cards List */}
            <div className="p-4 flex flex-col gap-4">
              {activeManifestTab === 'B2B' ? (
                /* Manifest Card 1: B2B Order Ready */
                <div className="border border-[#334155] bg-[#051424] p-4 relative flex flex-col gap-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[11px] text-[#64748B] font-bold">
                        PURCHASE ORDER // CLIENT
                      </span>
                      <h3 className="font-headline-md text-lg sm:text-xl text-[#F8FAFC] font-bold">
                        {b2bManifest.poNumber} // {b2bManifest.clientName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 border border-[#16A34A] bg-[#0F291E] text-[#16A34A] font-mono text-[11px] font-bold">
                      {b2bManifest.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] border-t border-b border-[#334155] py-2">
                    <div>
                      <span className="text-[#64748B] block font-bold">SPK REFERENCE:</span>
                      <span className="text-[#F8FAFC] font-bold">{b2bManifest.spkReference}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-bold">AGGREGATION VOLUME:</span>
                      <span className="text-[#F8FAFC] font-bold tabular-nums">
                        {b2bManifest.aggregationVolume}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-bold">LOGISTICS CARRIER:</span>
                      <span className="text-[#b4c5ff] font-bold">{b2bManifest.logisticsCarrier}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-bold">VEHICLE PLATE ID:</span>
                      <span className="text-[#F8FAFC] font-bold">{b2bManifest.vehiclePlateId}</span>
                    </div>
                  </div>

                  <div className="font-mono text-[11px] text-[#16A34A] flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    <span>ALL {b2bManifest.totalCartons} CARTONS QC CLEARED &amp; DISPATCH SEAL APPLIED</span>
                  </div>

                  {/* B2B Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={onOpenSuratJalan}
                      className="h-9 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 tactile-button cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">description</span>
                      <span>CETAK SURAT JALAN</span>
                    </button>
                    <button
                      onClick={onOpenManifestQr}
                      className="h-9 bg-[#2563EB] hover:bg-blue-600 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 tactile-button cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">qr_code</span>
                      <span>GENERATE MANIFEST QR</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Manifest Card 2: B2C Consolidation In-Progress */
                <div className="border border-[#334155] bg-[#051424] p-4 relative flex flex-col gap-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[11px] text-[#64748B] font-bold">
                        E-COMMERCE POOLING
                      </span>
                      <h3 className="font-headline-md text-lg sm:text-xl text-[#F8FAFC] font-bold">
                        {b2cManifest.poolingName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 border border-[#D97706] bg-[#2D1D05] text-[#D97706] font-mono text-[11px] font-bold">
                      PACKING IN PROGRESS ({b2cManifest.progressPercent}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] border-t border-b border-[#334155] py-2">
                    <div>
                      <span className="text-[#64748B] block font-bold">CONSOLIDATION UNITS:</span>
                      <span className="text-[#F8FAFC] font-bold tabular-nums">
                        {b2cManifest.consolidationUnits}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-bold">COURIER PICKUP:</span>
                      <span className="text-[#b4c5ff] font-bold">{b2cManifest.courierPickup}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#64748B] block font-bold">DISPATCH WINDOW:</span>
                      <span className="text-[#D97706] font-bold">{b2cManifest.dispatchWindow}</span>
                    </div>
                  </div>

                  {/* Linear Progress */}
                  <div className="w-full bg-[#1E293B] h-2 border border-[#334155]">
                    <div
                      className="bg-[#D97706] h-full transition-all"
                      style={{ width: `${b2cManifest.progressPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center font-mono text-[11px] pt-1">
                    <span className="text-[#64748B] font-bold">
                      REMAINING LABELS: {b2cManifest.remainingLabelsCount} ORDERS
                    </span>
                    <button
                      onClick={onOpenManifestQr}
                      className="px-3 h-7 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-bold uppercase tracking-wider flex items-center gap-1 text-xs cursor-pointer tactile-button"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      <span>VIEW ORDER QUEUE</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Live Shipping Label Preview Terminal Card */}
          <div className="bg-[#111827] border border-[#334155] flex flex-col">
            <div className="h-9 bg-[#1E293B] border-b border-[#334155] px-4 flex items-center justify-between">
              <span className="font-headline-sm uppercase text-[#F8FAFC] tracking-wider flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[#2563EB] text-base">print</span>
                <span>SHIPPING LABEL PREVIEW // CARTON {masterCarton.cartonId}</span>
              </span>
              <span className="font-mono text-[11px] text-[#64748B] uppercase font-bold">
                ZEBRA ZT411 THERMAL
              </span>
            </div>

            <div className="p-4 bg-[#0B0F17]">
              {/* Physical Label Mockup in Monospace Terminal Style */}
              <div
                className={`border-2 border-[#F8FAFC] bg-white text-black p-3 font-mono text-xs select-text transition-all duration-300 ${
                  isPrintingLabel ? 'scale-[0.98] ring-2 ring-[#2563EB]' : ''
                }`}
              >
                <div className="flex justify-between items-start border-b-2 border-black pb-1">
                  <div>
                    <div className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight text-black uppercase leading-none">
                      THEUNDERWEARSUPPLY LOGISTICS
                    </div>
                    <div className="text-[10px] font-bold font-mono text-neutral-800">
                      EXPEDITED BULK FREIGHT // SURABAYA DC
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold font-mono border border-black px-1">
                      STANDAR B2B
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b-2 border-black py-2 text-[11px]">
                  <div>
                    <span className="font-bold block text-[9px] uppercase">SHIP TO RECIPIENT:</span>
                    <div className="font-bold leading-tight">
                      MITRA RETAIL NUSANTARA WAREHOUSE 04
                    </div>
                    <div className="text-[10px] leading-tight">
                      JL. RUNGKUT INDUSTRI NO. 14, SURABAYA, JAWA TIMUR
                    </div>
                  </div>
                  <div className="border-l border-black pl-2">
                    <span className="font-bold block text-[9px] uppercase">CARTON ATTRIBUTES:</span>
                    <div className="font-bold">GROSS WT: 18.4 KG</div>
                    <div className="text-[10px]">CONTENT: 48 MULTIPACKS (144 PCS)</div>
                    <div className="text-[10px]">COLOR: ASSTD (CHAR/BLK/NVY)</div>
                  </div>
                </div>

                {/* Simulated Barcode Lines */}
                <div className="py-2 flex flex-col items-center justify-center">
                  <div className="w-full h-12 bg-neutral-900 flex items-center justify-around px-2">
                    <div className="h-full w-1 bg-white"></div>
                    <div className="h-full w-2 bg-white"></div>
                    <div className="h-full w-0.5 bg-white"></div>
                    <div className="h-full w-3 bg-white"></div>
                    <div className="h-full w-1 bg-white"></div>
                    <div className="h-full w-2 bg-white"></div>
                    <div className="h-full w-0.5 bg-white"></div>
                    <div className="h-full w-1.5 bg-white"></div>
                    <div className="h-full w-3 bg-white"></div>
                    <div className="h-full w-1 bg-white"></div>
                    <div className="h-full w-0.5 bg-white"></div>
                    <div className="h-full w-2 bg-white"></div>
                    <div className="h-full w-1 bg-white"></div>
                    <div className="h-full w-3 bg-white"></div>
                    <div className="h-full w-0.5 bg-white"></div>
                    <div className="h-full w-2 bg-white"></div>
                  </div>
                  <div className="text-center font-bold text-xs tracking-widest mt-1">
                    *{masterCarton.cartonId}-PO881*
                  </div>
                </div>

                {/* Footer stamps inside label */}
                <div className="flex justify-between items-center border-t border-black pt-1 text-[9px] font-bold">
                  <span>LINE 01 DOCK 02 // STAMP: VERIFIED 2026-10-24</span>
                  <span className="border border-black px-1 uppercase bg-neutral-100">
                    DISPATCH SEAL #S-9921
                  </span>
                </div>
              </div>

              {/* Direct Thermal Action Toolbar */}
              <div className="mt-3 flex justify-between items-center font-mono text-[11px]">
                <span className="text-[#64748B] flex items-center gap-1 font-bold">
                  <span className="material-symbols-outlined text-sm text-[#16A34A]">
                    check_circle
                  </span>
                  CALIBRATED: 100mm x 150mm RESIN
                </span>
                <button
                  onClick={onTriggerLabelFeed}
                  disabled={isPrintingLabel}
                  className="px-4 h-8 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] font-bold uppercase tracking-wider flex items-center gap-1.5 tactile-button cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isPrintingLabel ? 'sync' : 'print'}
                  </span>
                  <span>{isPrintingLabel ? 'FEEDING LABEL...' : 'FEED & RE-PRINT LABEL'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
