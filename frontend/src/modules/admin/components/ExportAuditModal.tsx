import React, { useState } from 'react';
import { UserAccount } from '../types';

interface ExportAuditModalProps {
  users: UserAccount[];
  isOpen: boolean;
  onClose: () => void;
}

export const ExportAuditModal: React.FC<ExportAuditModalProps> = ({
  users,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      if (format === 'csv') {
        const headers = [
          'User ID',
          'Full Name',
          'Role',
          'Email',
          'Station Badge',
          'Department',
          'Sub Location',
          'Auth Method',
          'Costing View',
          'SPK Activate',
          'Kiosk Scan',
          'Payroll Draft',
          'Idle Timeout (Mins)',
          'Status',
        ];

        const rows = users.map((u) => [
          `"${u.id}"`,
          `"${u.name}"`,
          `"${u.role}"`,
          `"${u.email}"`,
          `"${u.stationBadge || ''}"`,
          `"${u.department}"`,
          `"${u.subLocation}"`,
          `"${u.authMethod}"`,
          u.permissions.costingView ? 'YES' : 'NO',
          u.permissions.spkActivate ? 'YES' : 'NO',
          u.permissions.kioskScan ? 'YES' : 'NO',
          u.permissions.payrollDraft ? 'YES' : 'NO',
          u.idleTimeoutMinutes,
          `"${u.statusText}"`,
        ]);

        const csvContent =
          'data:text/csv;charset=utf-8,' +
          [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `theunderwearsupply_rbac_matrix_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(users, null, 2)
        )}`;
        const link = document.createElement('a');
        link.setAttribute('href', jsonString);
        link.setAttribute('download', `theunderwearsupply_rbac_matrix_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setIsExporting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">download</span>
            <div>
              <h3 className="font-bold text-[16px] text-[#191c1e]">Export RBAC Audit Matrix</h3>
              <p className="text-[11px] text-[#545f73]">ISO/IEC 27001 Access Rights Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#545f73] hover:text-[#191c1e] p-1 rounded hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          <p className="text-[#434655]">
            Generate a standardized snapshot of all <strong>{users.length}</strong> operator
            identities, station assignments, biometric bypass permissions, and idle timeout
            thresholds.
          </p>

          <div className="space-y-2">
            <label className="font-semibold text-[#545f73] block uppercase text-[10px]">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  format === 'csv'
                    ? 'border-[#2563eb] bg-[#2563eb]/5'
                    : 'border-[#e0e3e5] hover:bg-[#f2f4f6]'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="text-[#2563eb]"
                />
                <div>
                  <span className="font-bold text-[#191c1e] block">CSV Spreadsheet</span>
                  <span className="text-[11px] text-[#545f73]">
                    Excel, Google Sheets compatible
                  </span>
                </div>
              </label>

              <label
                onClick={() => setFormat('json')}
                className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  format === 'json'
                    ? 'border-[#2563eb] bg-[#2563eb]/5'
                    : 'border-[#e0e3e5] hover:bg-[#f2f4f6]'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="text-[#2563eb]"
                />
                <div>
                  <span className="font-bold text-[#191c1e] block">Structured JSON</span>
                  <span className="text-[11px] text-[#545f73]">ERP API ingest payload</span>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Preview Box */}
          <div className="bg-[#f2f4f6] p-3 rounded-lg border border-[#e0e3e5] text-[11px] space-y-1">
            <div className="flex justify-between text-[#545f73]">
              <span>Identities included:</span>
              <strong className="text-[#191c1e]">{users.length} accounts</strong>
            </div>
            <div className="flex justify-between text-[#545f73]">
              <span>Matrix columns:</span>
              <strong className="text-[#191c1e]">Costing, SPK, Kiosk, Payroll</strong>
            </div>
            <div className="flex justify-between text-[#545f73]">
              <span>Tenant:</span>
              <strong className="text-[#191c1e]">THEUNDERWEARSUPPLY Corp</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#e0e3e5] bg-[#f2f4f6] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#e0e3e5] text-[#545f73] hover:bg-white font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-4 py-1.5 rounded bg-[#2563eb] text-white font-semibold hover:bg-[#004ac6] transition-colors flex items-center gap-1.5 shadow-xs text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExporting ? 'hourglass_empty' : 'file_download'}
            </span>
            {isExporting ? 'Generating...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};
