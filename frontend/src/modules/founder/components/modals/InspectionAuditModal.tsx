import React, { useState } from 'react';
import { X, ClipboardCheck, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { InspectionTable, DefectLogEntry } from '../../types';

interface InspectionAuditModalProps {
  tables: InspectionTable[];
  logs: DefectLogEntry[];
  onClose: () => void;
  onLogDefect: (log: Omit<DefectLogEntry, 'id'>) => void;
}

export const InspectionAuditModal: React.FC<InspectionAuditModalProps> = ({
  tables,
  logs,
  onClose,
  onLogDefect,
}) => {
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedTable, setSelectedTable] = useState(1);
  const [spkId, setSpkId] = useState('SPK-2026-10-088');
  const [defectType, setDefectType] = useState('Jahitan Lompat (Skipped Stitches)');
  const [defectQty, setDefectQty] = useState(5);
  const [rootCause, setRootCause] = useState('Jarum tumpul / tension loose');
  const [actionTaken, setActionTaken] = useState('Ganti jarum & kalibrasi tension');

  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();
    onLogDefect({
      timestamp: `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')} WIB`,
      spkId,
      tableId: selectedTable,
      defectType,
      defectQty,
      severity: defectQty > 10 ? 'major' : 'minor',
      rootCause,
      actionTaken,
    });
    setShowLogForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#CBD5E1] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 text-[#16A34A] flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                QC Inspection Audit &amp; Meja Kerja (6 Stasiun Aktif)
              </h3>
              <p className="text-xs text-[#64748B]">
                Pemeriksaan fisik kain, toleransi jahitan, bonding tape, dan defect log harian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Top 6 Tables Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-lg border transition-all ${
                  t.status === 'warning'
                    ? 'bg-red-50/50 border-red-200'
                    : t.status === 'attention'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-[#f8fafc] border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F172A]">{t.name}</span>
                  <span
                    className={`font-code-metric font-bold text-[11px] px-1.5 py-0.5 rounded ${
                      t.passRate < 98 ? 'bg-red-100 text-[#DC2626]' : 'bg-green-100 text-[#16A34A]'
                    }`}
                  >
                    {t.passRate}% Pass
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">
                  Inspector: <strong className="text-[#0F172A]">{t.inspectorName}</strong> ({t.shift})
                </div>
                <div className="text-[11px] text-[#64748B]">
                  Active Batch: <strong className="text-[#004ac6]">{t.activeBatch}</strong>
                </div>
                <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex justify-between font-code-metric text-[11px]">
                  <span>Inspected: {t.inspectedPcs.toLocaleString()}</span>
                  <span className="text-[#16A34A]">Pass: {t.passedPcs.toLocaleString()}</span>
                  <span className="text-[#DC2626] font-semibold">Defect: {t.defectPcs}</span>
                </div>
              </div>
            ))}
          </div>

          {/* New Log Defect Form Trigger */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-[#0F172A] uppercase tracking-wide">
              Log Temuan Defect Terkini (Real-time Defect Register)
            </h4>
            <button
              onClick={() => setShowLogForm(!showLogForm)}
              className="flex items-center gap-1.5 bg-[#004ac6] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#2563eb] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showLogForm ? 'Tutup Form' : 'Input Temuan Baru'}</span>
            </button>
          </div>

          {showLogForm && (
            <form onSubmit={handleSubmitLog} className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Pilih Stasiun QC</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(Number(e.target.value))}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  >
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">No SPK</label>
                  <input
                    type="text"
                    value={spkId}
                    onChange={(e) => setSpkId(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Jenis Defect</label>
                  <select
                    value={defectType}
                    onChange={(e) => setDefectType(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  >
                    <option value="Jahitan Lompat (Skipped Stitches)">Jahitan Lompat (Skipped Stitches)</option>
                    <option value="Bonding Terlepas (Delamination)">Bonding Terlepas (Delamination)</option>
                    <option value="Karet Melintir (Twisted Band)">Karet Melintir (Twisted Band)</option>
                    <option value="Noda Minyak Kain">Noda Minyak Kain</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Jumlah Defect (Pcs)</label>
                  <input
                    type="number"
                    min="1"
                    value={defectQty}
                    onChange={(e) => setDefectQty(Number(e.target.value))}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Root Cause Teridentifikasi</label>
                  <input
                    type="text"
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Tindakan Koreksi</label>
                  <input
                    type="text"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded p-1.5 text-xs text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#004ac6] text-white rounded font-semibold text-xs hover:bg-[#2563eb] cursor-pointer"
                >
                  Simpan Log Defect
                </button>
              </div>
            </form>
          )}

          {/* Logs Table */}
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc] border-b border-[#E2E8F0] text-[11px] text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">No SPK</th>
                  <th className="py-2.5 px-3">Stasiun</th>
                  <th className="py-2.5 px-3">Jenis Kerusakan</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3">Akar Masalah &amp; Tindakan Korektif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-code-metric text-[#64748B]">{log.timestamp}</td>
                    <td className="py-2 px-3 font-semibold text-[#004ac6]">{log.spkId}</td>
                    <td className="py-2 px-3 text-[#0F172A]">Meja {log.tableId}</td>
                    <td className="py-2 px-3 font-medium text-[#0F172A]">{log.defectType}</td>
                    <td className="py-2 px-3 text-right font-code-metric font-bold text-[#DC2626]">{log.defectQty} pcs</td>
                    <td className="py-2 px-3 text-[#64748B]">
                      <span className="text-[#0F172A]">{log.rootCause}</span> — <em>{log.actionTaken}</em>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#f8fafc] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
