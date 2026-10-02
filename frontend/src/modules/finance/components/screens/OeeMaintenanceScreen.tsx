import React from 'react';

export const OeeMaintenanceScreen: React.FC = () => {
  const machines = [
    { name: 'Santoni SM8-TOP2 Seamless Knitting (Unit 01-04)', status: 'Operating', oee: 89.2, mtbf: '142 Jam', nextPm: '12 Okt 2026' },
    { name: 'Macpi 335.50 Ultrasonic Bonding Press (Unit 01-02)', status: 'Operating', oee: 85.4, mtbf: '98 Jam', nextPm: '08 Okt 2026' },
    { name: 'Siruba 747K 4-Thread Super High Speed Overlock (16 Units)', status: 'Operating', oee: 88.0, mtbf: '110 Jam', nextPm: '15 Okt 2026' },
    { name: 'Gerber GTxL Auto-Nesting Fabric CNC Cutter', status: 'Maintenance', oee: 79.1, mtbf: '64 Jam', nextPm: 'Hari ini (Overhaul)' },
    { name: 'Yamato VG2700 Cylinder Bed Interlock Machine (8 Units)', status: 'Operating', oee: 86.5, mtbf: '130 Jam', nextPm: '20 Okt 2026' },
  ];

  return (
    <div className="flex-1 p-8 max-w-[1600px] w-full mx-auto flex flex-col gap-6 animate-in fade-in">
      <div>
        <span className="text-[12px] text-[#64748B]">Plant Maintenance &amp; Machine Performance</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight">OEE &amp; Maintenance Suite</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Overall Plant OEE</span>
          <div className="text-[24px] font-bold text-[#004ac6] font-code-metric mt-1">86.8%</div>
          <span className="text-[12px] text-[#16A34A] font-semibold">World-Class Garment Benchmark: &gt;85%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Availability Factor</span>
          <div className="text-[24px] font-bold text-[#0F172A] font-code-metric mt-1">94.2%</div>
          <span className="text-[12px] text-[#64748B]">Downtime Tak Terencana: 1.8%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[12px] text-[#64748B]">Performance Rate</span>
          <div className="text-[24px] font-bold text-[#0F172A] font-code-metric mt-1">92.4%</div>
          <span className="text-[12px] text-[#16A34A] font-semibold">Kecepatan Jahitan Rata-rata Sesuai RPM</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs overflow-hidden">
        <h2 className="text-[18px] font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
          Status Mesin Pabrik Sukabumi &amp; Jadwal Preventive Maintenance
        </h2>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#1E293B] text-[#F8FAFC] font-code-metric">
              <tr>
                <th className="py-2.5 px-3">Tipe &amp; Seri Mesin</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">OEE Rate</th>
                <th className="py-2.5 px-3 text-right">MTBF</th>
                <th className="py-2.5 px-3 text-right">Jadwal PM Berikutnya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-code-metric">
              {machines.map((m) => (
                <tr key={m.name} className="hover:bg-[#f2f4f6]">
                  <td className="py-3 px-3 font-semibold text-[#0F172A]">{m.name}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        m.status === 'Operating'
                          ? 'bg-[#16A34A]/15 text-[#16A34A]'
                          : 'bg-[#D97706]/15 text-[#D97706]'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[#004ac6]">{m.oee}%</td>
                  <td className="py-3 px-3 text-right text-[#64748B]">{m.mtbf}</td>
                  <td className="py-3 px-3 text-right font-semibold text-[#0F172A]">{m.nextPm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
