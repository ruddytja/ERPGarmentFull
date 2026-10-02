import React, { useState } from 'react';
import { BundleItem, DefectItem } from '../types/mes';
import { soundManager } from '../utils/audio';

interface BundleQcViewProps {
  bundles: BundleItem[];
  defects: DefectItem[];
  onUpdateBundleStatus: (bundleId: string, status: BundleItem['status']) => void;
  onIncrementDefect: (defectId: string) => void;
}

export const BundleQcView: React.FC<BundleQcViewProps> = ({
  bundles,
  defects,
  onUpdateBundleStatus,
  onIncrementDefect,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>('BDL-0101-012');
  const [activeBundle, setActiveBundle] = useState<BundleItem | null>(bundles[0] || null);

  // Segmented counters for the active inspection station
  const [passCount, setPassCount] = useState<number>(348);
  const [reworkCount, setReworkCount] = useState<number>(14);
  const [rejectCount, setRejectCount] = useState<number>(3);

  const totalInspected = passCount + reworkCount + rejectCount;
  const passRate = totalInspected > 0 ? ((passCount / totalInspected) * 100).toFixed(1) : '100.0';

  const handleScanSearch = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playScanBeep();
    const found = bundles.find(
      (b) =>
        b.bundleId.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        b.barcode.toLowerCase().includes(barcodeInput.trim().toLowerCase())
    );
    if (found) {
      setActiveBundle(found);
    } else {
      // Create temporary inspected bundle representation
      setActiveBundle({
        bundleId: barcodeInput.toUpperCase(),
        bundleNo: 15,
        totalBundles: 50,
        spkCode: 'SPK-2026-10-042',
        productName: 'NAQALA Seamless Brief',
        size: 'M',
        qty: 24,
        currentStage: 'QC INSP',
        currentOp: '100% IN-LINE TENSION CHECK',
        operatorId: 'OP-0210',
        operatorName: 'JOKO OP-0210',
        machine: 'SIRUBA F007-03',
        status: 'IN_PROCESS',
        timestamp: '2026-10-18 08:35',
        barcode: `*SPK202610042-${barcodeInput.replace(/[^0-9]/g, '')}*`,
      });
    }
  };

  const handlePassAction = () => {
    soundManager.playSuccess();
    setPassCount((prev) => prev + 1);
    if (activeBundle) {
      onUpdateBundleStatus(activeBundle.bundleId, 'PASSED');
    }
  };

  const handleReworkAction = () => {
    soundManager.playScanBeep();
    setReworkCount((prev) => prev + 1);
    if (activeBundle) {
      onUpdateBundleStatus(activeBundle.bundleId, 'REWORK');
    }
  };

  const handleRejectAction = () => {
    soundManager.playHazardAlarm();
    setRejectCount((prev) => prev + 1);
    if (activeBundle) {
      onUpdateBundleStatus(activeBundle.bundleId, 'REJECT');
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#0B0F17] p-6 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-[#111827] border border-[#334155] p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#16A34A] text-xl" data-icon="fact_check">
              fact_check
            </span>
            <h1 className="font-condensed text-2xl font-bold uppercase text-[#F8FAFC]">
              Garment Bundle QC &amp; Defect Inspection Terminal
            </h1>
          </div>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            Station: QC-01 Sewing Line 1 · Pass Rate:{' '}
            <strong className="text-[#4ADE80]">{passRate}%</strong> · Target &ge; 98.5%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-[#1E293B] border border-[#334155] font-mono text-xs text-[#64748B]">
            INSPECTOR: <strong className="text-[#F8FAFC]">SRI WAHYUNI [QC-0881]</strong>
          </div>
        </div>
      </div>

      {/* Main 2-Column Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Barcode Scanner & Bundle Context (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Scanner Target Box with four-corner mechanical brackets */}
          <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <span className="font-mono text-xs font-bold uppercase text-[#F8FAFC]">
                Scanner Input / Kamera Barcode
              </span>
              <span className="text-[10px] font-mono uppercase text-[#16A34A] font-bold">
                LASER SCANNER READY
              </span>
            </div>

            {/* Crosshair target frame */}
            <form onSubmit={handleScanSearch} className="flex flex-col gap-2">
              <div className="relative border-2 border-dashed border-[#2563EB] bg-[#0F172A] p-4 flex flex-col items-center justify-center min-h-[110px]">
                {/* Fixed four-corner mechanical brackets */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#2563EB]"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#2563EB]"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#2563EB]"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#2563EB]"></div>

                <span className="material-symbols-outlined text-[#2563EB] text-3xl mb-1" data-icon="barcode_scanner">
                  barcode_scanner
                </span>
                <span className="text-xs font-mono text-[#b4c5ff] font-bold tracking-wider">
                  SCAN ATAU INPUT NOMOR BUNDLE
                </span>
              </div>

              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Contoh: BDL-0101-012"
                  className="flex-1 h-11 bg-[#0B0F17] border border-[#334155] text-[#F8FAFC] font-mono text-xs px-3 focus:outline-none focus:border-[#2563EB] uppercase"
                />
                <button
                  type="submit"
                  className="tactile-edge px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-[#F8FAFC] font-mono text-xs font-bold uppercase border border-[#2563EB] cursor-pointer"
                >
                  Verifikasi
                </button>
              </div>
            </form>

            {/* Active Inspected Bundle Card */}
            {activeBundle && (
              <div className="p-3 bg-[#0B0F17] border border-[#334155] mt-2 flex flex-col gap-2">
                <div className="flex justify-between items-start border-b border-[#334155] pb-2">
                  <div>
                    <span className="text-[10px] font-mono text-[#64748B] block">TERVERIFIKASI:</span>
                    <span className="font-condensed text-xl font-bold text-[#F8FAFC]">
                      {activeBundle.bundleId}
                    </span>
                    <span className="text-xs font-mono text-[#b4c5ff] block">
                      {activeBundle.productName} (SIZE {activeBundle.size})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-condensed text-2xl font-bold text-[#F8FAFC]">
                      {activeBundle.qty} PCS
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] block">
                      #{activeBundle.bundleNo} / {activeBundle.totalBundles}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#64748B]">
                  <div>
                    OPERASI: <strong className="text-[#F8FAFC]">{activeBundle.currentOp}</strong>
                  </div>
                  <div>
                    OPERATOR: <strong className="text-[#F8FAFC]">{activeBundle.operatorName}</strong>
                  </div>
                  <div>
                    MESIN: <strong className="text-[#F8FAFC]">{activeBundle.machine}</strong>
                  </div>
                  <div>
                    STATUS: <strong className="text-[#b4c5ff]">{activeBundle.status}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Defect Taxonomy Quick Buttons */}
          <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <span className="font-mono text-xs font-bold uppercase text-[#F8FAFC]">
                Katalog Jenis Kerusakan (Defect Log)
              </span>
              <span className="text-[10px] font-mono uppercase text-[#D97706] font-bold">
                1-TAP LOG DEFECT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {defects.map((def) => (
                <button
                  key={def.id}
                  onClick={() => {
                    soundManager.playHazardAlarm();
                    onIncrementDefect(def.id);
                  }}
                  className="tactile-edge p-2 bg-[#0B0F17] hover:bg-[#1E293B] border border-[#334155] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-[#F8FAFC] font-semibold">
                      {def.name}
                    </span>
                    <span className="text-[9px] font-mono text-[#64748B] uppercase">
                      {def.category}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 bg-[#300C0C] border border-[#DC2626] text-[#ffb4ab] font-mono text-xs font-bold">
                    {def.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Triple Segmented Counters (PASS, REWORK, REJECT) (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <span className="font-mono text-xs font-bold uppercase text-[#F8FAFC]">
                Eksekusi Hasil Inspeksi Kualitas (Tactile Push Target)
              </span>
              <span className="text-xs font-mono text-[#64748B]">
                TOTAL DIINSPEKSI: <strong className="text-[#F8FAFC]">{totalInspected} PCS</strong>
              </span>
            </div>

            {/* Triple Segmented Cards: PASS, REWORK, REJECT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* PASS Segment */}
              <div className="bg-[#0B0F17] border-2 border-[#16A34A] p-4 flex flex-col items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-[#4ADE80] tracking-wider">
                  PASS (LOLOS)
                </span>
                <span className="font-condensed text-5xl font-extrabold text-[#4ADE80] my-3">
                  {passCount}
                </span>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setPassCount((p) => Math.max(0, p - 1));
                    }}
                    className="tactile-edge w-12 h-12 bg-[#1E293B] hover:bg-[#334155] text-white border border-[#334155] text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    onClick={handlePassAction}
                    className="tactile-edge tactile-shadow flex-1 h-12 bg-[#16A34A] hover:bg-green-700 text-white font-condensed text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    + PASS
                  </button>
                </div>
              </div>

              {/* REWORK Segment */}
              <div className="bg-[#0B0F17] border-2 border-[#D97706] p-4 flex flex-col items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-[#FBBF24] tracking-wider">
                  REWORK (PERBAIKI)
                </span>
                <span className="font-condensed text-5xl font-extrabold text-[#FBBF24] my-3">
                  {reworkCount}
                </span>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setReworkCount((p) => Math.max(0, p - 1));
                    }}
                    className="tactile-edge w-12 h-12 bg-[#1E293B] hover:bg-[#334155] text-white border border-[#334155] text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    onClick={handleReworkAction}
                    className="tactile-edge tactile-shadow flex-1 h-12 bg-[#D97706] hover:bg-amber-700 text-white font-condensed text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    + REWORK
                  </button>
                </div>
              </div>

              {/* REJECT Segment */}
              <div className="bg-[#0B0F17] border-2 border-[#DC2626] p-4 flex flex-col items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-[#ffb4ab] tracking-wider">
                  REJECT (AFVAL)
                </span>
                <span className="font-condensed text-5xl font-extrabold text-[#ffb4ab] my-3">
                  {rejectCount}
                </span>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setRejectCount((p) => Math.max(0, p - 1));
                    }}
                    className="tactile-edge w-12 h-12 bg-[#1E293B] hover:bg-[#334155] text-white border border-[#334155] text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    onClick={handleRejectAction}
                    className="tactile-edge tactile-shadow flex-1 h-12 bg-[#DC2626] hover:bg-red-700 text-white font-condensed text-xl font-bold flex items-center justify-center cursor-pointer"
                  >
                    + REJECT
                  </button>
                </div>
              </div>
            </div>

            {/* Quality Summary Telemetry */}
            <div className="p-3 bg-[#0B0F17] border border-[#334155] flex items-center justify-between mt-2 font-mono text-xs">
              <div>
                <span className="text-[#64748B]">TOLERANSI AFVAL SHIFT:</span>{' '}
                <strong className="text-[#F8FAFC]">MAKSIMAL 1.5%</strong>
              </div>
              <div>
                <span className="text-[#64748B]">STATUS SHIFT 1:</span>{' '}
                <span className="text-[#4ADE80] font-bold">
                  {Number(passRate) >= 98.5 ? '● MEMENUHI STANDAR EXPORT' : '▲ PERINGATAN REJECT'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
