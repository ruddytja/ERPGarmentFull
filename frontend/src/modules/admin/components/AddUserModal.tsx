import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (user: UserAccount) => void;
  existingUsersCount: number;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAddUser,
  existingUsersCount,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('STAFF');
  const [stationBadge, setStationBadge] = useState('');
  const [department, setDepartment] = useState('Sewing Line 1 - 3');
  const [subLocation, setSubLocation] = useState('Terminal FL-01 (Station 01)');
  const [authMethod, setAuthMethod] = useState('4-Digit Kiosk PIN');
  const [pinCode, setPinCode] = useState(
    Math.floor(1000 + Math.random() * 9000).toString()
  );

  const [permissions, setPermissions] = useState({
    costingView: false,
    spkActivate: false,
    kioskScan: true,
    payrollDraft: false,
  });

  const [idleTimeout, setIdleTimeout] = useState(60);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'FOUNDER' || newRole === 'ADMIN') {
      setPermissions({ costingView: true, spkActivate: true, kioskScan: true, payrollDraft: true });
      setAuthMethod('SSO + FIDO2 Key');
      setIdleTimeout(15);
      setDepartment('HQ Operations Room');
      setSubLocation('Full Tenant Root');
    } else if (newRole === 'SUPERVISOR') {
      setPermissions({ costingView: false, spkActivate: true, kioskScan: true, payrollDraft: false });
      setAuthMethod('PIN (4-Digit) + RFID');
      setIdleTimeout(30);
      setDepartment('Sewing Floor Supervisor');
      setSubLocation('Floor Lead Terminal');
    } else if (newRole === 'FINANCE') {
      setPermissions({ costingView: true, spkActivate: false, kioskScan: false, payrollDraft: true });
      setAuthMethod('SSO + YubiKey');
      setIdleTimeout(15);
      setDepartment('Costing & Piece-Rate Payroll');
      setSubLocation('HQ Back Office');
    } else {
      setPermissions({ costingView: false, spkActivate: false, kioskScan: true, payrollDraft: false });
      setAuthMethod('4-Digit Kiosk PIN');
      setIdleTimeout(60);
      setDepartment('Cutting Floor & Bundling');
      setSubLocation('Terminal T-04 (Cutting Table)');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const nextIdNumber = existingUsersCount + 1;
    const formattedId =
      role === 'ADMIN'
        ? `USR-ADMIN-${String(nextIdNumber).padStart(2, '0')}`
        : `USR-${String(nextIdNumber).padStart(3, '0')}`;

    const newUser: UserAccount = {
      id: formattedId,
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@theunderwearsupply.com`,
      stationBadge: stationBadge.trim() || undefined,
      role,
      department,
      subLocation,
      authMethod,
      authMethodIcon:
        authMethod.includes('SSO')
          ? 'security'
          : authMethod.includes('RFID')
          ? 'badge'
          : 'dialpad',
      permissions,
      status: 'active',
      statusText: 'Active now',
      idleTimeoutMinutes: idleTimeout,
      lastActive: 'Just registered',
      pinCode,
      rfidCardId: `RFID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    onAddUser(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">person_add</span>
            <h3 className="font-bold text-[16px] text-[#191c1e]">Tambah Pengguna Baru</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#545f73] hover:text-[#191c1e] p-1 rounded hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto custom-scrollbar space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Joko Prasetyo"
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Email / Account ID</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joko.op@theunderwearsupply.com"
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Role Type</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              >
                <option value="STAFF">Staff / Operator (Floor)</option>
                <option value="SUPERVISOR">Supervisor (Line Lead)</option>
                <option value="FINANCE">Finance (Costing / Payroll)</option>
                <option value="ADMIN">Admin (IT &amp; Ops)</option>
                <option value="FOUNDER">Founder (Executive)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#545f73] block mb-1">
                Station Badge ID (Optional)
              </label>
              <input
                type="text"
                value={stationBadge}
                onChange={(e) => setStationBadge(e.target.value)}
                placeholder="e.g. OP-2410 or QC-0099"
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Assigned Station / Dept</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Sub-Location / Terminal</label>
              <input
                type="text"
                value={subLocation}
                onChange={(e) => setSubLocation(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Auth Method</label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              >
                <option value="4-Digit Kiosk PIN">4-Digit Kiosk PIN</option>
                <option value="PIN (4-Digit) + RFID">PIN (4-Digit) + RFID</option>
                <option value="SSO + YubiKey">SSO + YubiKey</option>
                <option value="SSO + FIDO2 Key">SSO + FIDO2 Key</option>
                <option value="Workspace SSO + 2FA">Workspace SSO + 2FA</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Initial 4-Digit PIN</label>
              <input
                type="text"
                maxLength={4}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs font-mono font-bold text-[#191c1e]"
              />
            </div>
          </div>

          {/* Permissions Matrix Checklist */}
          <div className="pt-2 border-t border-[#e0e3e5]">
            <span className="font-semibold text-[#545f73] block mb-2 uppercase text-[10px] tracking-wide">
              RBAC Operational Matrix Grants
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f2f4f6] p-2.5 rounded-lg border border-[#e0e3e5]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.costingView}
                  onChange={(e) =>
                    setPermissions({ ...permissions, costingView: e.target.checked })
                  }
                  className="rounded text-[#2563eb]"
                />
                <span className="font-medium text-[#191c1e]">Costing View</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.spkActivate}
                  onChange={(e) =>
                    setPermissions({ ...permissions, spkActivate: e.target.checked })
                  }
                  className="rounded text-[#2563eb]"
                />
                <span className="font-medium text-[#191c1e]">SPK Activate</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.kioskScan}
                  onChange={(e) =>
                    setPermissions({ ...permissions, kioskScan: e.target.checked })
                  }
                  className="rounded text-[#2563eb]"
                />
                <span className="font-medium text-[#191c1e]">Kiosk Scan</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.payrollDraft}
                  onChange={(e) =>
                    setPermissions({ ...permissions, payrollDraft: e.target.checked })
                  }
                  className="rounded text-[#2563eb]"
                />
                <span className="font-medium text-[#191c1e]">Payroll Draft</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0e3e5]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#e0e3e5] text-[#545f73] hover:bg-[#f2f4f6] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#2563eb] text-white font-semibold hover:bg-[#004ac6] transition-colors flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              Save Operator Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
