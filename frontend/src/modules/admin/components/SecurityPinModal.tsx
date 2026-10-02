import React, { useState } from 'react';
import { UserAccount } from '../types';

interface SecurityPinModalProps {
  user: UserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSecurity: (userId: string, newPin: string, newRfid: string) => void;
}

export const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateSecurity,
}) => {
  const [pin, setPin] = useState(user?.pinCode || '2311');
  const [rfid, setRfid] = useState(user?.rfidCardId || 'RFID-OP-2311');
  const [copied, setCopied] = useState(false);
  const [invalidatedSessions, setInvalidatedSessions] = useState(true);

  if (!isOpen || !user) return null;

  const handleGenerateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(random);
    setCopied(false);
  };

  const handleGenerateNewRfid = () => {
    const randomRfid = `RFID-${user.role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`;
    setRfid(randomRfid);
  };

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdateSecurity(user.id, pin, rfid);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/40 p-4">
      <div className="bg-[#ffffff] rounded-xl border border-[#e0e3e5] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e0e3e5] flex items-center justify-between bg-[#f2f4f6]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">lock_reset</span>
            <div>
              <h3 className="font-bold text-[15px] text-[#191c1e]">
                Security Credential &amp; PIN Reset
              </h3>
              <p className="text-[11px] text-[#545f73]">
                {user.name} • {user.id}
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

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* PIN Section */}
          <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#e0e3e5] space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#545f73] uppercase text-[10px]">
                4-Digit Kiosk Station PIN
              </span>
              <button
                type="button"
                onClick={handleGenerateRandomPin}
                className="text-[#004ac6] hover:underline flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">casino</span>
                Randomize
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-32 text-center text-xl font-mono font-bold tracking-widest p-2 bg-white border border-[#bcc7de] rounded text-[#191c1e] focus:border-[#2563eb] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPin}
                className="px-2.5 py-2 border border-[#e0e3e5] bg-white rounded hover:bg-[#eceef0] flex items-center gap-1 text-[#545f73] hover:text-[#191c1e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span className="font-medium text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* RFID Section */}
          <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#e0e3e5] space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#545f73] uppercase text-[10px]">
                NFC / RFID Badge Token ID
              </span>
              <button
                type="button"
                onClick={handleGenerateNewRfid}
                className="text-[#004ac6] hover:underline flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">refresh</span>
                Issue New Card
              </button>
            </div>
            <input
              type="text"
              value={rfid}
              onChange={(e) => setRfid(e.target.value)}
              className="w-full text-xs font-mono p-2 bg-white border border-[#e0e3e5] rounded text-[#191c1e]"
            />
          </div>

          {/* Invalidate active sessions */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={invalidatedSessions}
              onChange={(e) => setInvalidatedSessions(e.target.checked)}
              className="rounded text-[#2563eb]"
            />
            <span className="text-[#545f73] text-[11px]">
              Immediately terminate active session on floor tablets and require new PIN entry.
            </span>
          </label>
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
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-[#2563eb] text-white font-semibold hover:bg-[#004ac6] transition-colors flex items-center gap-1 shadow-xs text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            Commit Credentials
          </button>
        </div>
      </div>
    </div>
  );
};
