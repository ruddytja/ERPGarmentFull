import React, { useState } from 'react';
import { GlobalConfigSettings } from '../../types';

interface GlobalConfigViewProps {
  config: GlobalConfigSettings;
  onUpdateConfig: (newConfig: Partial<GlobalConfigSettings>) => void;
}

export const GlobalConfigView: React.FC<GlobalConfigViewProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [currency, setCurrency] = useState(config.operatingCurrency);
  const [stockMass, setStockMass] = useState(config.warehouseStockMass);
  const [yieldUnit, setYieldUnit] = useState(config.bomYieldUnit);
  const [bundleTarget, setBundleTarget] = useState(config.defaultBundleTarget);
  const [barcodeFormat, setBarcodeFormat] = useState('Code 128 (GS1 Standard)');
  const [autoLockoutMinutes, setAutoLockoutMinutes] = useState(15);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      operatingCurrency: currency,
      warehouseStockMass: stockMass,
      bomYieldUnit: yieldUnit,
      defaultBundleTarget: bundleTarget,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e0e3e5]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#191c1e] tracking-tight">
              Global Factory Configuration
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#d5e0f8] text-[#111c2d]">
              Live V2.4
            </span>
          </div>
          <p className="text-[12px] text-[#545f73] mt-0.5">
            Configure enterprise ERP accounting currency, stock mass units, barcode symbology, and shift schedules.
          </p>
        </div>
        {savedMessage && (
          <div className="px-3 py-1.5 rounded bg-[#007f36]/15 text-[#007f36] border border-[#007f36]/30 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
            <span className="material-symbols-outlined text-[16px]">check</span>
            Configuration Saved Successfully
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Section 1: Accounting & Units */}
        <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] p-4 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e0e3e5]">
            <span className="material-symbols-outlined text-[#004ac6]">payments</span>
            <h3 className="font-bold text-sm text-[#191c1e]">Global Units &amp; Currency Policy</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Operating Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] font-mono font-bold"
              />
              <span className="text-[10px] text-[#545f73]">Applied across piece-rates and SPK costing</span>
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Warehouse Stock Mass Metric</label>
              <input
                type="text"
                value={stockMass}
                onChange={(e) => setStockMass(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] font-mono font-bold"
              />
              <span className="text-[10px] text-[#545f73]">Raw fabric roll receiving ledger standard</span>
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">BOM / Cutting Yield Unit</label>
              <input
                type="text"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] font-mono font-bold"
              />
              <span className="text-[10px] text-[#545f73]">Standard piece yield per garment body</span>
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Default Bundle Target (Pcs)</label>
              <input
                type="number"
                value={bundleTarget}
                onChange={(e) => setBundleTarget(Number(e.target.value))}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] font-mono font-bold"
              />
              <span className="text-[10px] text-[#545f73]">Default bundle count for sewing line dispatch</span>
            </div>
          </div>
        </div>

        {/* Section 2: Hardware & Barcode Engines */}
        <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] p-4 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e0e3e5]">
            <span className="material-symbols-outlined text-[#004ac6]">barcode_scanner</span>
            <h3 className="font-bold text-sm text-[#191c1e]">Floor Kiosk &amp; Barcode Integration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Barcode Symbology</label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              >
                <option>Code 128 (GS1 Standard)</option>
                <option>DataMatrix 2D Industrial</option>
                <option>QR Code Micro-24</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">
                Kiosk Screen Inactivity Standby
              </label>
              <select
                value={autoLockoutMinutes}
                onChange={(e) => setAutoLockoutMinutes(Number(e.target.value))}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              >
                <option value={15}>15 Minutes (Strict)</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes (Standard Shift)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Shift Operational Windows */}
        <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] p-4 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e0e3e5]">
            <span className="material-symbols-outlined text-[#004ac6]">schedule</span>
            <h3 className="font-bold text-sm text-[#191c1e]">Plant Shift Schedules (Garment Plant A1)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-[#007f36]/30 bg-[#007f36]/5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#007f36]">Shift 1 (Day Run)</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#007f36] text-white">
                  ACTIVE
                </span>
              </div>
              <div className="font-mono text-xs text-[#191c1e]">07:00 - 15:30 WIB</div>
              <div className="text-[10px] text-[#545f73] mt-1">12 Lines • 48 Operators</div>
            </div>

            <div className="p-3 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#191c1e]">Shift 2 (Twilight Run)</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#e0e3e5] text-[#545f73]">
                  UPCOMING
                </span>
              </div>
              <div className="font-mono text-xs text-[#191c1e]">15:30 - 23:00 WIB</div>
              <div className="text-[10px] text-[#545f73] mt-1">12 Lines • 36 Operators</div>
            </div>

            <div className="p-3 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#191c1e]">Shift 3 (Maintenance)</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#e0e3e5] text-[#545f73]">
                  STANDBY
                </span>
              </div>
              <div className="font-mono text-xs text-[#191c1e]">23:00 - 07:00 WIB</div>
              <div className="text-[10px] text-[#545f73] mt-1">Inspection &amp; Knife Sharpening</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 bg-[#2563eb] text-white font-semibold rounded-lg hover:bg-[#004ac6] transition-colors flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save System Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
