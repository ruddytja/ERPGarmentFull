import React, { useState } from 'react';

export const SettingsScreen: React.FC = () => {
  const [toleranceThreshold, setToleranceThreshold] = useState('5.0');
  const [exchangeRate, setExchangeRate] = useState('15600');
  const [autoSyncInterval, setAutoSyncInterval] = useState('15');
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div>
        <span className="text-[12px] text-[#64748B]">ERP Configuration &amp; Financial Parameters</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">System Settings</h1>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4 text-[13px]">
          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Batas Maksimum Toleransi Deviasi HPP (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={toleranceThreshold}
              onChange={(e) => setToleranceThreshold(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#f2f4f6] font-code-metric"
            />
            <span className="text-[11px] text-[#64748B] mt-0.5 block">
              Default: 5.0%. Melebihi nilai ini akan memicu alarm Tindakan Kritis pada dashboard.
            </span>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Kurs Konversi Valuta Asing (IDR / 1 USD)
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#f2f4f6] font-code-metric"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#0F172A] block mb-1">
              Interval Sinkronisasi Barcode MES Lantai Pabrik (Detik)
            </label>
            <input
              type="number"
              value={autoSyncInterval}
              onChange={(e) => setAutoSyncInterval(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#f2f4f6] font-code-metric"
            />
          </div>

          {savedToast && (
            <div className="p-2.5 bg-[#16A34A]/15 text-[#16A34A] rounded-lg text-center font-bold">
              ✓ Konfigurasi sistem berhasil disimpan dan diterapkan pada seluruh terminal.
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#0053db] text-white font-semibold cursor-pointer shadow-xs"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
