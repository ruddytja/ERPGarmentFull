import React, { useState } from 'react';
import { IncidentReport } from '../../types/mes';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentReported: (incident: IncidentReport) => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  onIncidentReported,
}) => {
  const [title, setTitle] = useState<string>('Barcode Scanner Matrix Misread');
  const [severity, setSeverity] = useState<'CRITICAL' | 'WARNING' | 'MAINTENANCE'>('WARNING');
  const [description, setDescription] = useState<string>(
    'Glossy polybag reflection on Slot 03 deep navy item caused optical scanner retry.'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const incident: IncidentReport = {
      id: `INC-7092-${Math.floor(10 + Math.random() * 90)}`,
      timestamp: now.toTimeString().split(' ')[0],
      severity,
      title,
      description,
      station: 'LINE 01 // DOCK 02',
      reportedBy: 'OP: Fajar Maulana [STF-PKG-401]',
      status: 'OPEN',
    };
    onIncidentReported(incident);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="bg-[#111827] border-2 border-[#DC2626] w-full max-w-lg flex flex-col shadow-2xl">
        <div className="h-10 bg-[#300C0C] border-b border-[#DC2626] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-headline-sm uppercase text-[#DC2626] tracking-wider font-bold">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>LOG PLANT FLOOR INCIDENT TICKET</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 font-mono text-xs">
          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              INCIDENT SEVERITY LEVEL
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['CRITICAL', 'WARNING', 'MAINTENANCE'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`py-2 font-bold uppercase border cursor-pointer ${
                    severity === lvl
                      ? lvl === 'CRITICAL'
                        ? 'bg-[#DC2626] text-white border-[#DC2626]'
                        : lvl === 'WARNING'
                        ? 'bg-[#D97706] text-white border-[#D97706]'
                        : 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-[#051424] text-[#64748B] border-[#334155]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              INCIDENT SUBJECT / ANOMALY SUMMARY
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 bg-[#051424] border border-[#334155] text-[#F8FAFC] px-3 font-mono text-xs focus:outline-none focus:border-[#DC2626]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#64748B] uppercase font-bold mb-1">
              TECHNICAL OBSERVATION / DETAILS
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#051424] border border-[#334155] text-[#F8FAFC] p-3 font-mono text-xs focus:outline-none focus:border-[#DC2626] resize-none"
            />
          </div>

          <div className="p-2.5 bg-[#1E293B] border border-[#334155] flex justify-between text-[11px]">
            <span className="text-[#64748B]">TERMINAL ORIGIN:</span>
            <span className="text-[#F8FAFC] font-bold">LINE 01 SUPERVISOR [ID: SPV-7092-JKT]</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-bold uppercase border border-[#334155] cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="h-10 bg-[#DC2626] hover:bg-red-700 text-white font-bold uppercase cursor-pointer tactile-button"
            >
              SUBMIT INCIDENT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
