import React, { useState, useRef, useEffect } from 'react';
import { BundleItem } from '../types';
import { playScanSuccessBeep, playTactileClick } from '../utils/audio';

interface ScannerBayProps {
  activeBundle: BundleItem;
  onScanBundle: (barcode: string) => void;
  availableBundles: BundleItem[];
}

export const ScannerBay: React.FC<ScannerBayProps> = ({
  activeBundle,
  onScanBundle,
  availableBundles,
}) => {
  const [manualCode, setManualCode] = useState(activeBundle.barcode);
  const [showKeypad, setShowKeypad] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sensorDistance, setSensorDistance] = useState(21);
  const [lockNumber, setLockNumber] = useState('9981');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync manual input when bundle changes externally
  useEffect(() => {
    setManualCode(activeBundle.barcode);
    triggerScanFlash();
  }, [activeBundle.id]);

  // Ultrasonic sensor distance simulator (18 - 23 cm)
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorDistance(Math.floor(18 + Math.random() * 5));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const triggerScanFlash = () => {
    setScanFlash(true);
    setLockNumber(String(Math.floor(1000 + Math.random() * 9000)));
    playScanSuccessBeep();
    setTimeout(() => setScanFlash(false), 2400);
  };

  // Real webcam camera toggle
  const toggleRealCamera = async () => {
    playTactileClick();
    if (useRealCamera) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setUseRealCamera(false);
      setCameraError(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setUseRealCamera(true);
        setCameraError(null);
      } catch (err: unknown) {
        console.error('Camera access error:', err);
        setCameraError('Kamera fisik tidak diizinkan atau tidak tersedia. Menggunakan sensor simulasi laser.');
        setTimeout(() => setCameraError(null), 4000);
      }
    }
  };

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleKeypadPress = (val: string) => {
    playTactileClick();
    if (val === 'CLR') {
      setManualCode('');
    } else if (val === 'OK') {
      handleManualSubmit();
    } else {
      setManualCode((prev) => prev + val);
    }
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    playTactileClick();
    const clean = manualCode.trim();
    if (clean) {
      onScanBundle(clean);
      triggerScanFlash();
    }
  };

  const handlePresetSelect = (code: string) => {
    playTactileClick();
    setManualCode(code);
    onScanBundle(code);
    triggerScanFlash();
  };

  return (
    <section className="flex flex-col gap-3.5 h-full overflow-hidden select-none">
      {/* Scanner Bay Container */}
      <div className="flex-1 bg-[#1E293B] rounded border border-[#334155] flex flex-col overflow-hidden relative shadow-sm">
        {/* Top Reticle Bar */}
        <div className="h-9 px-3 bg-[#27354A]/80 border-b border-[#334155] flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <span className="material-symbols-outlined text-sm text-[#60A5FA]">
              qr_code_scanner
            </span>
            <span className="text-xs uppercase tracking-wide font-semibold">
              LASER OPTIC SENSOR // CAM-01
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick sensor distance indicator */}
            <span className="text-[10px] font-mono text-[#94A3B8] hidden sm:inline">
              DIST: {sensorDistance}cm
            </span>

            {/* Webcam / Hardware Camera toggle */}
            <button
              onClick={toggleRealCamera}
              title={useRealCamera ? 'Ganti ke Laser Optik Sim' : 'Buka Kamera Web'}
              className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] border border-[#60A5FA]/30"
            >
              <span className="material-symbols-outlined text-xs">
                {useRealCamera ? 'videocam_off' : 'videocam'}
              </span>
              <span>{useRealCamera ? 'Live Cam' : 'Simul'}</span>
            </button>

            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>

        {/* Camera Viewport Canvas */}
        <div className="flex-1 bg-[#070b12] relative flex items-center justify-center overflow-hidden">
          {/* Real video feed if active */}
          {useRealCamera && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
          )}

          {/* Laser Reticle Crosshairs (Corner L-shapes) */}
          <div className="absolute inset-5 pointer-events-none z-10">
            {/* Top-Left */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#60A5FA]"></div>
            {/* Top-Right */}
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#60A5FA]"></div>
            {/* Bottom-Left */}
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#60A5FA]"></div>
            {/* Bottom-Right */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#60A5FA]"></div>

            {/* Animated Laser Scanline */}
            <div className="scanner-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#60A5FA] to-transparent shadow-[0_0_12px_#3B82F6]"></div>
          </div>

          {/* Camera Access Notice Banner if error */}
          {cameraError && (
            <div className="absolute top-3 left-4 right-4 z-20 bg-amber-900/90 text-amber-200 text-xs p-2 rounded border border-amber-600">
              {cameraError}
            </div>
          )}

          {/* Central Target Visual */}
          <div
            onClick={triggerScanFlash}
            className="flex flex-col items-center justify-center text-center z-10 p-4 cursor-pointer group"
            title="Klik untuk memicu simulasi pemindaian QR tiket"
          >
            <div className="w-20 h-20 rounded-lg border border-dashed border-[#60A5FA]/40 group-hover:border-[#60A5FA] flex items-center justify-center mb-2 bg-[#60A5FA]/5 transition-colors">
              <span className="material-symbols-outlined text-[#60A5FA]/70 group-hover:text-[#60A5FA] text-4xl">
                center_focus_strong
              </span>
            </div>
            <p className="text-sm font-bold text-[#F8FAFC]">
              Arahkan QR Tiket Bundle ke Kamera
            </p>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Jarak optimal 15 - 25 cm dari sensor
            </p>
            <span className="mt-2 text-[10px] text-[#60A5FA] bg-[#60A5FA]/10 px-2 py-0.5 rounded border border-[#60A5FA]/20">
              [Klik viewport untuk Trigger Scan]
            </span>
          </div>

          {/* Scanner Feedback Status Overlay */}
          <div
            className={`absolute bottom-3 left-3 right-3 bg-[#16A34A]/95 backdrop-blur border border-[#16A34A] text-white px-3 py-1.5 rounded flex items-center justify-between shadow-lg transition-transform duration-300 z-20 ${
              scanFlash ? 'scale-100 opacity-100 ring-2 ring-emerald-300' : 'opacity-95'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">verified</span>
              <span className="text-xs font-bold tracking-wide">
                QR {activeBundle.barcode} Berhasil Dipindai
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/90">
              LOCK #{lockNumber}
            </span>
          </div>
        </div>

        {/* Manual Input Bar */}
        <form
          onSubmit={handleManualSubmit}
          className="p-2.5 bg-[#27354A] border-t border-[#334155] flex items-center gap-2"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] text-lg">
              barcode_reader
            </span>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik barcode / SPK manual..."
              className="w-full bg-[#191c1e] border border-[#334155] rounded pl-9 pr-3 py-2 text-sm text-[#F8FAFC] font-mono focus:outline-none focus:border-[#60A5FA]"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              playTactileClick();
              setShowKeypad(!showKeypad);
            }}
            title="Buka / Tutup Numpad"
            className={`h-9 px-3 border border-[#334155] rounded flex items-center gap-1 text-xs font-semibold active:scale-95 transition-all ${
              showKeypad ? 'bg-[#3e495d] text-[#60A5FA]' : 'bg-[#323537] hover:bg-[#3e495d] text-[#F8FAFC]'
            }`}
          >
            <span className="material-symbols-outlined text-base">dialpad</span>
          </button>

          <button
            type="submit"
            className="h-9 px-3.5 bg-[#3e495d] hover:bg-[#424754] text-[#F8FAFC] rounded text-xs font-bold border border-[#334155] active:scale-95 transition-all"
          >
            Enter Manual
          </button>
        </form>
      </div>

      {/* Quick Bundle Queue Picker Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 text-xs">
        <span className="text-[11px] text-[#94A3B8] uppercase font-semibold shrink-0">
          Antrean Tiket:
        </span>
        {availableBundles.map((b) => (
          <button
            key={b.id}
            onClick={() => handlePresetSelect(b.barcode)}
            className={`px-2 py-1 rounded font-mono text-[11px] border shrink-0 transition-all ${
              b.id === activeBundle.id
                ? 'bg-[#2563EB]/20 border-[#2563EB] text-[#adc6ff] font-bold'
                : 'bg-[#27354A] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            {b.id}
          </button>
        ))}
      </div>

      {/* Virtual Numeric Keypad Panel (Collapsible for manual entry fallback) */}
      {showKeypad && (
        <div className="bg-[#1E293B] p-2 rounded border border-[#334155] shadow-lg animate-in fade-in">
          <div className="flex justify-between items-center mb-1.5 px-1">
            <span className="text-[11px] font-bold uppercase text-[#94A3B8]">
              Virtual Numeric Keypad
            </span>
            <button
              onClick={() => setShowKeypad(false)}
              className="text-[#94A3B8] hover:text-[#F8FAFC] text-xs"
            >
              Tutup ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((key) => {
              const isClr = key === 'CLR';
              const isOk = key === 'OK';
              return (
                <button
                  key={key}
                  onClick={() => handleKeypadPress(key)}
                  className={`h-10 rounded font-bold transition-transform active:scale-95 ${
                    isClr
                      ? 'bg-[#27354A] hover:bg-[#323537] text-[#ffb4ab]'
                      : isOk
                      ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-headline'
                      : 'bg-[#27354A] hover:bg-[#323537] text-lg text-[#F8FAFC]'
                  }`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
