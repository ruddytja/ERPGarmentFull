import React, { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  Sliders, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert
} from 'lucide-react';
import { RAW_MATERIALS } from '../../data/initialData';
import { SPKBatch } from '../../types';

interface CostingHppViewProps {
  batches: SPKBatch[];
  currency: 'IDR' | 'USD';
  onInspectBatch: (batch: SPKBatch) => void;
  onOpenCostAlert: (batch: SPKBatch) => void;
}

export const CostingHppView: React.FC<CostingHppViewProps> = ({
  batches,
  currency,
  onInspectBatch,
  onOpenCostAlert,
}) => {
  // Interactive BOM Simulator State
  const [simFabricKg, setSimFabricKg] = useState(142000); // Rp/kg
  const [simGsm, setSimGsm] = useState(180); // gsm
  const [simSamMinutes, setSimSamMinutes] = useState(3.5); // SAM
  const [simLaborRateMin, setSimLaborRateMin] = useState(1500); // Rp/min
  const [simOverheadPct, setSimOverheadPct] = useState(15); // %
  const [simTargetWholesale, setSimTargetWholesale] = useState(32000); // Rp

  // Calculations
  const fabricUsedGrams = 85; // grams per brief
  const materialCost = Math.round((simFabricKg / 1000) * fabricUsedGrams + 1600); // fabric + trims
  const laborCost = Math.round(simSamMinutes * simLaborRateMin);
  const overheadCost = Math.round((materialCost + laborCost) * (simOverheadPct / 100));
  const simTotalHpp = materialCost + laborCost + overheadCost;
  const simGrossProfit = simTargetWholesale - simTotalHpp;
  const simGrossMargin = ((simGrossProfit / simTargetWholesale) * 100).toFixed(1);

  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100).toFixed(2)}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            HPP &amp; Cost Control Management Engine
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Analisis Bill of Materials (BOM), simulasi biaya per lembar, dan pemantauan fluktuasi bahan baku harian
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-green-50 border border-green-200 text-[#16A34A] text-xs font-semibold">
            BOM Benchmark: Target Margin &gt; 35%
          </span>
        </div>
      </div>

      {/* Raw Materials Market Watch Tracker */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#004ac6]" />
            <h3 className="font-headline font-bold text-sm text-[#0F172A]">
              Pemantauan Harga Bahan Baku Tekstil (Raw Material Fluctuation Tracker)
            </h3>
          </div>
          <span className="text-[11px] text-[#64748B]">
            Sumber: Indeks Pasar Tekstil Bandung &amp; Impor Hyosung Global
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {RAW_MATERIALS.map((mat, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border transition-all ${
                mat.status === 'spike'
                  ? 'bg-red-50/50 border-red-200'
                  : mat.status === 'down'
                  ? 'bg-green-50/50 border-green-200'
                  : 'bg-[#f8fafc] border-[#E2E8F0]'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-[#0F172A] line-clamp-1">{mat.name}</span>
                {mat.status === 'spike' ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-[#DC2626] bg-red-100 px-1 rounded">
                    <ArrowUpRight className="w-3 h-3" /> +{mat.changePct}%
                  </span>
                ) : mat.status === 'down' ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-[#16A34A] bg-green-100 px-1 rounded">
                    <ArrowDownRight className="w-3 h-3" /> {mat.changePct}%
                  </span>
                ) : (
                  <span className="text-[10px] text-[#64748B] font-code-metric">0.0%</span>
                )}
              </div>
              <div className="mt-2">
                <div className="font-code-metric font-bold text-sm text-[#0F172A]">
                  {formatMoney(mat.currentPrice)} <span className="text-[10px] font-normal text-[#64748B]">/{mat.unit}</span>
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 truncate">
                  Supplier: {mat.supplier}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive BOM Calculator & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Controls (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#004ac6]" />
              <h3 className="font-headline font-bold text-sm text-[#0F172A]">
                Interactive BOM Simulator: Garment Costing Engine
              </h3>
            </div>
            <button
              onClick={() => {
                setSimFabricKg(142000);
                setSimSamMinutes(3.5);
                setSimOverheadPct(15);
                setSimTargetWholesale(32000);
              }}
              className="flex items-center gap-1 text-[11px] text-[#004ac6] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reset Nilai
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Slider 1: Fabric Price */}
            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <span>Harga Kain / Benang Spandex per Kg:</span>
                <span className="font-code-metric text-[#004ac6]">{formatMoney(simFabricKg)} / kg</span>
              </div>
              <input
                type="range"
                min="80000"
                max="200000"
                step="2000"
                value={simFabricKg}
                onChange={(e) => setSimFabricKg(Number(e.target.value))}
                className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#004ac6]"
              />
              <div className="flex justify-between text-[10px] text-[#64748B] mt-1">
                <span>Rp 80.000 (Cotton Standard)</span>
                <span>Rp 142.000 (Spandex Alert)</span>
                <span>Rp 200.000 (Micro Italian)</span>
              </div>
            </div>

            {/* Slider 2: SAM Sewing Minutes */}
            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <span>Standard Allowed Minutes (SAM Jahit/Bonding):</span>
                <span className="font-code-metric text-[#004ac6]">{simSamMinutes} Menit</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="6.0"
                step="0.1"
                value={simSamMinutes}
                onChange={(e) => setSimSamMinutes(Number(e.target.value))}
                className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#004ac6]"
              />
              <div className="flex justify-between text-[10px] text-[#64748B] mt-1">
                <span>1.5m (Seamless Ultra-simple)</span>
                <span>3.5m (Standard Boxer Trunk)</span>
                <span>6.0m (Sports Bra Multi-panel)</span>
              </div>
            </div>

            {/* Slider 3: Factory Overhead % */}
            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <span>Alokasi Overhead Pabrik &amp; Listrik (%):</span>
                <span className="font-code-metric text-[#004ac6]">{simOverheadPct}%</span>
              </div>
              <input
                type="range"
                min="8"
                max="25"
                step="1"
                value={simOverheadPct}
                onChange={(e) => setSimOverheadPct(Number(e.target.value))}
                className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#004ac6]"
              />
              <div className="flex justify-between text-[10px] text-[#64748B] mt-1">
                <span>8% (Minimalist)</span>
                <span>15% (Sukabumi Average)</span>
                <span>25% (High Cleanroom AC)</span>
              </div>
            </div>

            {/* Slider 4: Target Wholesale Price */}
            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <span>Target Harga Jual Grosir (Wholesale Selling Price):</span>
                <span className="font-code-metric text-[#16A34A]">{formatMoney(simTargetWholesale)}</span>
              </div>
              <input
                type="range"
                min="18000"
                max="65000"
                step="1000"
                value={simTargetWholesale}
                onChange={(e) => setSimTargetWholesale(Number(e.target.value))}
                className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#16A34A]"
              />
            </div>
          </div>
        </div>

        {/* Right: Calculated Waterfall Outcome (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-headline font-bold text-sm text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
              Hasil Kalkulasi HPP per Lembar &amp; Marjin
            </h3>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#E2E8F0] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Bahan Baku Kain + Trims:</span>
                  <span className="font-code-metric font-semibold text-[#0F172A]">{formatMoney(materialCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Tenaga Kerja Langsung:</span>
                  <span className="font-code-metric font-semibold text-[#0F172A]">{formatMoney(laborCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Overhead Pabrik ({simOverheadPct}%):</span>
                  <span className="font-code-metric font-semibold text-[#0F172A]">{formatMoney(overheadCost)}</span>
                </div>

                <div className="pt-2 border-t border-[#CBD5E1] flex justify-between text-sm font-bold">
                  <span className="text-[#0F172A]">Total HPP / Pcs:</span>
                  <span className="font-code-metric text-[#004ac6]">{formatMoney(simTotalHpp)}</span>
                </div>
              </div>

              {/* Profit & Margin Metrics */}
              <div className="p-4 bg-green-50/70 border border-green-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#16A34A] font-semibold">Proyeksi Laba Kotor / Pcs:</span>
                  <span className="font-code-metric font-bold text-sm text-[#16A34A]">
                    +{formatMoney(simGrossProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#0F172A] font-semibold">Gross Profit Margin:</span>
                  <span className="font-code-metric font-bold text-lg text-[#16A34A]">
                    {simGrossMargin}%
                  </span>
                </div>

                <div className="w-full bg-white h-2 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-[#16A34A] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, Number(simGrossMargin)))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#64748B]">
            Formula HPP mengadopsi standar IFRS Cost Accounting &amp; Lean Manufacturing Apparel.
          </div>
        </div>
      </div>
    </div>
  );
};
