import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Server, ShieldCheck, Database } from 'lucide-react';

interface SystemSettingsViewProps {
  currency: 'IDR' | 'USD';
  onToggleCurrency: () => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  currency,
  onToggleCurrency,
}) => {
  const [plantName, setPlantName] = useState('Sukabumi Central Manufacturing Plant');
  const [mesSyncInterval, setMesSyncInterval] = useState('5');
  const [qcToleranceLimit, setQcToleranceLimit] = useState('2.0');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
        <div>
          <h2 className="font-headline font-bold text-xl text-[#0F172A] tracking-tight">
            System &amp; Factory Floor Settings
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Konfigurasi konektivitas MES Core v4.19, ambang batas toleransi QC, dan parameter keuangan
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4 max-w-2xl text-xs">
        <div>
          <label className="block text-[#0F172A] font-semibold mb-1">
            Nama Pabrik &amp; Fasilitas Terdaftar
          </label>
          <input
            type="text"
            value={plantName}
            onChange={(e) => setPlantName(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#0F172A]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[#0F172A] font-semibold mb-1">
              Interval Sinkronisasi MES (Detik)
            </label>
            <input
              type="number"
              value={mesSyncInterval}
              onChange={(e) => setMesSyncInterval(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-[#0F172A] font-semibold mb-1">
              Batas Toleransi Cacat QC (%)
            </label>
            <input
              type="text"
              value={qcToleranceLimit}
              onChange={(e) => setQcToleranceLimit(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#0F172A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#0F172A] font-semibold mb-1">
            Mata Uang Pembukuan Utama
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleCurrency}
              className="px-3 py-1.5 bg-[#f2f4f6] border border-[#CBD5E1] rounded-lg font-semibold text-[#0F172A]"
            >
              Ubah ke {currency === 'IDR' ? 'USD ($)' : 'IDR (Rp)'}
            </button>
            <span className="text-[#64748B]">Saat ini: <strong>{currency}</strong></span>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
          {saved && (
            <span className="text-[#16A34A] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Pengaturan Tersimpan
            </span>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
