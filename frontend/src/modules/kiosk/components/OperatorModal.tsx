import React, { useState } from 'react';
import { Operator } from '../types';
import { initialOperators } from '../data/mockData';
import { playScanSuccessBeep, playTactileClick } from '../utils/audio';

interface OperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOperator: Operator;
  onSwitchOperator: (newOp: Operator) => void;
}

export const OperatorModal: React.FC<OperatorModalProps> = ({
  isOpen,
  onClose,
  currentOperator,
  onSwitchOperator,
}) => {
  const [selectedOp, setSelectedOp] = useState<Operator>(currentOperator);
  const [pin, setPin] = useState<string>('4092');
  const [rfidSuccess, setRfidSuccess] = useState(false);

  if (!isOpen) return null;

  const handleKeyClick = (digit: string) => {
    playTactileClick();
    if (digit === 'CLR') {
      setPin('');
    } else if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleRfidScanSim = () => {
    playScanSuccessBeep();
    setRfidSuccess(true);
    setPin('4092');
    setTimeout(() => {
      setRfidSuccess(false);
      onSwitchOperator(selectedOp);
      onClose();
    }, 1000);
  };

  const handleAuthorize = () => {
    playScanSuccessBeep();
    onSwitchOperator(selectedOp);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="bg-[#1E293B] border border-[#334155] w-full max-w-lg rounded p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-[#adc6ff]">
              badge
            </span>
            <h3 className="text-xl font-bold text-white font-['Hanken_Grotesk']">
              Ganti Operator / PIN Otorisasi
            </h3>
          </div>
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="text-[#94A3B8] hover:text-white"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Operator Selection */}
        <div>
          <label className="text-xs text-[#94A3B8] uppercase font-bold block mb-2">
            Pilih Operator Stasiun 04
          </label>
          <div className="grid grid-cols-2 gap-2">
            {initialOperators.map((op) => {
              const isSelected = selectedOp.id === op.id;
              return (
                <button
                  key={op.id}
                  onClick={() => {
                    playTactileClick();
                    setSelectedOp(op);
                  }}
                  className={`p-2.5 rounded border text-left flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'bg-[#2563EB]/20 border-[#2563EB] ring-1 ring-[#2563EB]'
                      : 'bg-[#27354A] border-[#334155] hover:bg-[#323537]'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-[#3e495d] flex items-center justify-center text-xs font-bold text-[#adc6ff]">
                    {op.initials}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {op.name}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] leading-tight font-mono">
                      {op.code}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RFID Tap Simulation Option */}
        <div className="bg-[#27354A] p-3 rounded border border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl text-[#60A5FA]">
              contactless
            </span>
            <div>
              <div className="text-xs font-bold text-white">Tap Kartu RFID Operator</div>
              <div className="text-[11px] text-[#94A3B8]">
                Sensitivitas pembaca kartu badge aktif
              </div>
            </div>
          </div>
          <button
            onClick={handleRfidScanSim}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
              rfidSuccess
                ? 'bg-[#16A34A] text-white'
                : 'bg-[#3e495d] hover:bg-[#4d8eff] text-white'
            }`}
          >
            {rfidSuccess ? '✓ Terotentikasi' : 'Simulasi Tap RFID'}
          </button>
        </div>

        {/* PIN Dots Display */}
        <div>
          <p className="text-xs text-[#94A3B8] text-center mb-1">
            Atau masukkan 4-Digit PIN Operator
          </p>
          <div className="flex justify-center gap-3 my-2">
            {[0, 1, 2, 3].map((idx) => {
              const hasDigit = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-12 h-12 rounded bg-[#191c1e] border flex items-center justify-center text-2xl font-bold ${
                    hasDigit
                      ? 'border-[#adc6ff] text-[#adc6ff]'
                      : 'border-[#334155] text-transparent'
                  }`}
                >
                  •
                </div>
              );
            })}
          </div>
        </div>

        {/* Numeric PIN Pad */}
        <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '⌫'].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === '⌫') {
                  playTactileClick();
                  setPin((prev) => prev.slice(0, -1));
                } else {
                  handleKeyClick(k);
                }
              }}
              className="h-10 rounded bg-[#27354A] hover:bg-[#323537] text-white font-bold text-sm active:scale-95 transition-all"
            >
              {k}
            </button>
          ))}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
          <button
            onClick={() => {
              playTactileClick();
              onClose();
            }}
            className="h-11 px-5 rounded bg-[#27354A] hover:bg-[#323537] text-[#F8FAFC] font-bold border border-[#334155] text-xs active:scale-95"
          >
            Batal
          </button>
          <button
            onClick={handleAuthorize}
            disabled={pin.length < 4}
            className="h-11 px-6 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95"
          >
            Otorisasi Shift
          </button>
        </div>
      </div>
    </div>
  );
};
