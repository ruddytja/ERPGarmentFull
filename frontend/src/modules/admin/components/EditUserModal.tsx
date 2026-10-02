import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';

interface EditUserModalProps {
  user: UserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: UserAccount) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<UserAccount | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({ ...user, permissions: { ...user.permissions } });
    }
  }, [user]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">edit_note</span>
            <div>
              <h3 className="font-bold text-[16px] text-[#191c1e]">
                Edit Permissions &amp; Access Matrix
              </h3>
              <p className="text-[11px] text-[#545f73]">
                {formData.name} ({formData.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#545f73] hover:text-[#191c1e] p-1 rounded hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto custom-scrollbar space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              />
            </div>
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Station Badge ID</label>
              <input
                type="text"
                value={formData.stationBadge || ''}
                placeholder="None"
                onChange={(e) => setFormData({ ...formData, stationBadge: e.target.value })}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Department / Line</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              />
            </div>
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Location Sub-Deck</label>
              <input
                type="text"
                value={formData.subLocation}
                onChange={(e) => setFormData({ ...formData, subLocation: e.target.value })}
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Idle Timeout (Minutes)</label>
              <select
                value={formData.idleTimeoutMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, idleTimeoutMinutes: Number(e.target.value) })
                }
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              >
                <option value={15}>15 Minutes (Strict / Admin)</option>
                <option value={30}>30 Minutes (Supervisor)</option>
                <option value={60}>60 Minutes (Floor Kiosk)</option>
                <option value={120}>120 Minutes (Extended Shift)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-[#545f73] block mb-1">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as any,
                    statusText:
                      e.target.value === 'active'
                        ? 'Active now'
                        : e.target.value === 'idle'
                        ? 'Idle'
                        : 'Deactivated',
                  })
                }
                className="w-full p-2 bg-[#f2f4f6] border border-[#e0e3e5] rounded text-xs text-[#191c1e]"
              >
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          </div>

          {/* RBAC Matrix Grants */}
          <div className="pt-2 border-t border-[#e0e3e5]">
            <span className="font-semibold text-[#545f73] block mb-2 uppercase text-[10px] tracking-wide">
              RBAC Matrix Permission Scopes
            </span>
            <div className="grid grid-cols-2 gap-2 bg-[#f2f4f6] p-3 rounded-lg border border-[#e0e3e5]">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={formData.permissions.costingView}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permissions: { ...formData.permissions, costingView: e.target.checked },
                    })
                  }
                  className="rounded text-[#2563eb]"
                />
                <div>
                  <span className="font-semibold text-[#191c1e] block">Costing View</span>
                  <span className="text-[10px] text-[#545f73]">Inspect BOM piece rates &amp; margins</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={formData.permissions.spkActivate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permissions: { ...formData.permissions, spkActivate: e.target.checked },
                    })
                  }
                  className="rounded text-[#2563eb]"
                />
                <div>
                  <span className="font-semibold text-[#191c1e] block">SPK Activate</span>
                  <span className="text-[10px] text-[#545f73]">Dispatch batch work orders to lines</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={formData.permissions.kioskScan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permissions: { ...formData.permissions, kioskScan: e.target.checked },
                    })
                  }
                  className="rounded text-[#2563eb]"
                />
                <div>
                  <span className="font-semibold text-[#191c1e] block">Kiosk Scan</span>
                  <span className="text-[10px] text-[#545f73]">Barcode bundle scan &amp; RFID bypass</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={formData.permissions.payrollDraft}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permissions: { ...formData.permissions, payrollDraft: e.target.checked },
                    })
                  }
                  className="rounded text-[#2563eb]"
                />
                <div>
                  <span className="font-semibold text-[#191c1e] block">Payroll Draft</span>
                  <span className="text-[10px] text-[#545f73]">Review &amp; approve operator wages</span>
                </div>
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
