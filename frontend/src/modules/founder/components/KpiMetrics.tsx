import React from 'react';
import { 
  Wallet, 
  PieChart, 
  PiggyBank, 
  Gauge, 
  Cpu, 
  TrendingUp, 
  ArrowDown, 
  CheckCircle2 
} from 'lucide-react';
import { KPIStats } from '../types';

interface KpiMetricsProps {
  stats: KPIStats;
  currency: 'IDR' | 'USD';
  onCardClick?: (metricKey: string) => void;
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({
  stats,
  currency,
  onCardClick,
}) => {
  const formatMoney = (val: number) => {
    if (currency === 'USD') {
      const usdVal = val / 15100;
      return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const formatTargetMoney = (val: number) => {
    if (currency === 'USD') {
      return `$${(val / 15100 / 1000).toFixed(1)}K`;
    }
    return `Rp ${(val / 1000000000).toFixed(2)}M`;
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Metric 1: Monthly Gross Revenue */}
      <div 
        onClick={() => onCardClick && onCardClick('revenue')}
        className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:border-[#CBD5E1] cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <span className="text-[#545f73] text-xs font-semibold uppercase tracking-wide">
            Monthly Gross Revenue
          </span>
          <span className="p-1.5 rounded-lg bg-blue-50 text-[#004ac6]">
            <Wallet className="w-[18px] h-[18px]" />
          </span>
        </div>
        <div className="mt-3">
          <div className="font-headline text-[#0F172A] font-bold text-2xl num-tabular tracking-tight">
            {formatMoney(stats.monthlyGrossRevenue)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-semibold text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-[13px] h-[13px] mr-0.5" />
              +{stats.revenueGrowthPct}% vs target
            </span>
            <span className="text-[11px] text-[#64748B]">
              Target: {formatTargetMoney(stats.revenueTarget)}
            </span>
          </div>
        </div>
        <div className="w-full bg-[#e6e8ea] h-1 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#004ac6] h-full rounded-full transition-all duration-500" style={{ width: '84%' }} />
        </div>
      </div>

      {/* Metric 2: Total HPP (COGS Actual) */}
      <div 
        onClick={() => onCardClick && onCardClick('hpp')}
        className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:border-[#CBD5E1] cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <span className="text-[#545f73] text-xs font-semibold uppercase tracking-wide">
            Total HPP (COGS Actual)
          </span>
          <span className="p-1.5 rounded-lg bg-[#f2f4f6] text-[#545f73]">
            <PieChart className="w-[18px] h-[18px]" />
          </span>
        </div>
        <div className="mt-3">
          <div className="font-headline text-[#0F172A] font-bold text-2xl num-tabular tracking-tight">
            {formatMoney(stats.totalHppActual)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-semibold text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded">
              <ArrowDown className="w-[13px] h-[13px] mr-0.5" />
              {stats.hppEfficiencyPct}% Efisien
            </span>
            <span className="text-[11px] text-[#64748B]">BOM Budgeted</span>
          </div>
        </div>
        <div className="w-full bg-[#e6e8ea] h-1 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#16A34A] h-full rounded-full transition-all duration-500" style={{ width: '62.2%' }} />
        </div>
      </div>

      {/* Metric 3: Net Profit Margin */}
      <div 
        onClick={() => onCardClick && onCardClick('margin')}
        className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:border-[#CBD5E1] cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <span className="text-[#545f73] text-xs font-semibold uppercase tracking-wide">
            Net Profit Margin
          </span>
          <span className="p-1.5 rounded-lg bg-green-50 text-[#16A34A]">
            <PiggyBank className="w-[18px] h-[18px]" />
          </span>
        </div>
        <div className="mt-3">
          <div className="font-headline text-[#0F172A] font-bold text-2xl num-tabular tracking-tight">
            {stats.netProfitMargin}%
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-semibold text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-[13px] h-[13px] mr-0.5" />
              +{stats.netProfitGrowthMoM}% MoM
            </span>
            <span className="text-[11px] text-[#64748B]">
              EBITDA: {currency === 'USD' ? `$${(stats.ebitda / 15100 / 1000).toFixed(0)}K` : `Rp ${(stats.ebitda / 1000000).toFixed(0)}M`}
            </span>
          </div>
        </div>
        <div className="w-full bg-[#e6e8ea] h-1 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#2563eb] h-full rounded-full transition-all duration-500" style={{ width: '75%' }} />
        </div>
      </div>

      {/* Metric 4: Factory Efficiency Rate */}
      <div 
        onClick={() => onCardClick && onCardClick('efficiency')}
        className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:border-[#CBD5E1] cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <span className="text-[#545f73] text-xs font-semibold uppercase tracking-wide">
            Factory Efficiency Rate
          </span>
          <span className="p-1.5 rounded-lg bg-blue-50 text-[#004ac6]">
            <Gauge className="w-[18px] h-[18px]" />
          </span>
        </div>
        <div className="mt-3">
          <div className="font-headline text-[#0F172A] font-bold text-2xl num-tabular tracking-tight">
            {stats.factoryEfficiencyRate}%
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-semibold text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-[13px] h-[13px] mr-0.5" />
              Target: {stats.factoryEfficiencyTarget}%
            </span>
            <span className="text-[11px] text-[#64748B]">
              +{stats.factoryEfficiencySurplus}% Surplus
            </span>
          </div>
        </div>
        <div className="w-full bg-[#e6e8ea] h-1 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#16A34A] h-full rounded-full transition-all duration-500" style={{ width: `${stats.factoryEfficiencyRate}%` }} />
        </div>
      </div>

      {/* Metric 5: Overall Machine OEE */}
      <div 
        onClick={() => onCardClick && onCardClick('oee')}
        className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:border-[#CBD5E1] cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <span className="text-[#545f73] text-xs font-semibold uppercase tracking-wide">
            Overall Machine OEE
          </span>
          <span className="p-1.5 rounded-lg bg-[#f2f4f6] text-[#545f73]">
            <Cpu className="w-[18px] h-[18px]" />
          </span>
        </div>
        <div className="mt-3">
          <div className="font-headline text-[#0F172A] font-bold text-2xl num-tabular tracking-tight">
            {stats.overallOee}%
          </div>
          <div className="mt-1.5 text-[11px] font-code-metric text-[#64748B] flex justify-between">
            <span>Avail {stats.oeeAvailability}%</span>
            <span>Perf {stats.oeePerformance}%</span>
            <span className="text-[#16A34A] font-semibold">Qual {stats.oeeQuality}%</span>
          </div>
        </div>
        <div className="w-full bg-[#e6e8ea] h-1 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#004ac6] h-full rounded-full transition-all duration-500" style={{ width: `${stats.overallOee}%` }} />
        </div>
      </div>
    </section>
  );
};
