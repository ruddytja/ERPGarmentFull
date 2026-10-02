import React from 'react';
import { AUDIT_LOGS } from '../../data/mockData';

export const AuditLogsScreen: React.FC = () => {
  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div>
        <span className="text-[12px] text-[#64748B]">Security &amp; Transaction Ledger</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">Audit Logs &amp; Activity Trail</h1>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <h2 className="text-[18px] font-bold text-[#0F172A]">Riwayat Aktivitas Finansial &amp; Operasional</h2>
          <span className="text-[12px] text-[#64748B]">4 Transaksi Terkini Tercatat</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#1E293B] text-[#F8FAFC] font-code-metric">
              <tr>
                <th className="py-2.5 px-3">Waktu (WIB)</th>
                <th className="py-2.5 px-3">Pengguna / Terminal</th>
                <th className="py-2.5 px-3">Kode Aksi</th>
                <th className="py-2.5 px-3">Rincian Perubahan / Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-code-metric">
              {AUDIT_LOGS.map((item, i) => (
                <tr key={i} className="hover:bg-[#f2f4f6]">
                  <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">{item.timestamp}</td>
                  <td className="py-3 px-3 font-semibold text-[#0F172A]">{item.user}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded font-bold bg-[#dbe1ff] text-[#004ac6]">
                      {item.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#0F172A]">{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
