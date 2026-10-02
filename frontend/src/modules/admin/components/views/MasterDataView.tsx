import React, { useState } from 'react';
import { masterFabrics, masterSKUs } from '../../data/mockData';

export const MasterDataView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'fabrics' | 'skus'>('fabrics');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e0e3e5]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#191c1e] tracking-tight">
              Master Data &amp; Industrial Garment Specifications
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#d5e0f8] text-[#111c2d]">
              BOM V4.2
            </span>
          </div>
          <p className="text-[12px] text-[#545f73] mt-0.5">
            Fabric roll inventory, Standard Allowed Minutes (SAM), yield ratios in grams, and bundle lot configurations.
          </p>
        </div>

        {/* Sub-tab toggles */}
        <div className="flex items-center bg-[#e0e3e5] p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('fabrics')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeSubTab === 'fabrics'
                ? 'bg-white text-[#191c1e] shadow-xs'
                : 'text-[#545f73] hover:text-[#191c1e]'
            }`}
          >
            Raw Fabrics &amp; Elastics ({masterFabrics.length})
          </button>
          <button
            onClick={() => setActiveSubTab('skus')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeSubTab === 'skus'
                ? 'bg-white text-[#191c1e] shadow-xs'
                : 'text-[#545f73] hover:text-[#191c1e]'
            }`}
          >
            Garment SKUs &amp; BOM Specs ({masterSKUs.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'fabrics' ? (
        <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between">
            <span className="font-semibold text-xs text-[#191c1e]">
              Active Warehouse Rolls &amp; Raw Material Lots
            </span>
            <span className="text-[11px] text-[#545f73]">Standard Mass Metric: Kilograms (Kg)</span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f2f4f6] border-b border-[#e0e3e5] text-[11px] font-semibold text-[#545f73] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Fabric Code &amp; Description</th>
                  <th className="py-2.5 px-3">GSM / Width</th>
                  <th className="py-2.5 px-3">Colorways</th>
                  <th className="py-2.5 px-3 text-right">In Stock (Kg)</th>
                  <th className="py-2.5 px-3 text-right">Allocated (Kg)</th>
                  <th className="py-2.5 px-4 text-right">Yield Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ea]">
                {masterFabrics.map((f) => (
                  <tr key={f.code} className="hover:bg-[#f2f4f6]/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#191c1e]">{f.name}</div>
                      <div className="font-mono text-[#545f73] text-[11px]">{f.code}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-[#191c1e]">{f.gsm ? `${f.gsm} GSM` : 'Elastic'}</span>
                      <span className="block text-[#545f73] text-[11px]">{f.widthInches}" Width</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {f.colorways.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-[#f2f4f6] border border-[#e0e3e5] text-[10px] text-[#434655]"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#191c1e]">
                      {f.stockKg.toLocaleString()} Kg
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#545f73]">
                      {f.allocatedKg.toLocaleString()} Kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#007f36]">
                      {f.yieldEfficiency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-[#e0e3e5] bg-[#f2f4f6] flex items-center justify-between">
            <span className="font-semibold text-xs text-[#191c1e]">
              Garment SKUs &amp; Line Production Standards
            </span>
            <span className="text-[11px] text-[#545f73]">Target Lot: 24 Pcs / Polybag</span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f2f4f6] border-b border-[#e0e3e5] text-[11px] font-semibold text-[#545f73] uppercase tracking-wider">
                  <th className="py-2.5 px-4">SKU &amp; Product Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Size Run</th>
                  <th className="py-2.5 px-3 text-center">Bundle Target</th>
                  <th className="py-2.5 px-3 text-right">SAM (Mins)</th>
                  <th className="py-2.5 px-4 text-right">Standard BOM Yield (gr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ea]">
                {masterSKUs.map((sku) => (
                  <tr key={sku.sku} className="hover:bg-[#f2f4f6]/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#191c1e]">{sku.name}</div>
                      <div className="font-mono text-[#004ac6] text-[11px]">{sku.sku}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-[#d5e0f8] text-[#111c2d]">
                        {sku.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#545f73] font-mono text-[11px]">{sku.sizeRun}</td>
                    <td className="py-3 px-3 text-center font-bold text-[#191c1e] font-mono">
                      {sku.targetBundle} Pcs
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#191c1e]">
                      {sku.standardAllowedMinutes} min
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#007f36]">
                      {sku.standardYieldGrams} gr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
