import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  QrCode,
  ScanLine,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Download,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Maximize2,
  Minimize2,
  UserCheck,
  Check,
  Plus,
  Minus,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  X,
  ArrowRight
} from 'lucide-react';
import { useSession } from '../../core/session';

// Web Audio synthesizer for factory touch feedback
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  beep(freq = 600, duration = 0.08, type: OscillatorType = 'sine') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio policy restrictions
    }
  }

  success() {
    this.beep(880, 0.08);
    setTimeout(() => this.beep(1200, 0.12), 80);
  }

  error() {
    this.beep(300, 0.15, 'sawtooth');
    setTimeout(() => this.beep(240, 0.25, 'sawtooth'), 120);
  }

  click() {
    this.beep(750, 0.04);
  }
}

const sfx = new SoundFX();

interface DefectOption {
  id: string;
  name: string;
  nameEn: string;
  count: number;
  category: 'sewing' | 'bonding' | 'fabric' | 'measurement' | 'finishing';
  defaultRoute: string;
}

interface BundleHistory {
  id: string;
  bundleId: string;
  spk: string;
  sku: string;
  time: string;
  pass: number;
  rework: number;
  reject: number;
  total: number;
  status: 'PASS' | 'RWK' | 'HOLD' | 'DONE';
  operator: string;
  sewingLine: string;
  defectsSummary: string[];
}

const INITIAL_DEFECTS: DefectOption[] = [
  { id: 'd1', name: 'Jahitan Lompat', nameEn: 'Skipped Stitch', count: 1, category: 'sewing', defaultRoute: 'Operator Sewing Rudi - Line 1 (Jahitan Ulang)' },
  { id: 'd2', name: 'Bonding Terlepas', nameEn: 'Bonding Delamination', count: 1, category: 'bonding', defaultRoute: 'Operator Bonding Siti - Line 2 (Heatpress Ulang)' },
  { id: 'd3', name: 'Karet Melintir', nameEn: 'Twisted Elastic Waistband', count: 0, category: 'sewing', defaultRoute: 'Operator Sewing Rudi - Line 1 (Jahitan Ulang)' },
  { id: 'd4', name: 'Noda Minyak / Kotor', nameEn: 'Oil / Dirt Stain', count: 1, category: 'finishing', defaultRoute: 'Washing & Spotting Station (Pembersihan Noda)' },
  { id: 'd5', name: 'Kain Bolong / Jarum Patah', nameEn: 'Needle Hole / Broken Needle', count: 0, category: 'fabric', defaultRoute: 'Cutting Table Specialist (Trimming)' },
  { id: 'd6', name: 'Ukuran Tidak Presisi (Toleransi >0.5cm)', nameEn: 'Out of Tolerance Spec', count: 0, category: 'measurement', defaultRoute: 'Cutting Table Specialist (Trimming)' },
  { id: 'd7', name: 'Jahitan Mengerut (Puckering)', nameEn: 'Seam Puckering', count: 0, category: 'sewing', defaultRoute: 'Operator Sewing Rudi - Line 1 (Jahitan Ulang)' },
  { id: 'd8', name: 'Label Terbalik / Miring', nameEn: 'Misaligned Care Label', count: 0, category: 'bonding', defaultRoute: 'Operator Bonding Siti - Line 2 (Heatpress Ulang)' },
];

const INITIAL_HISTORY: BundleHistory[] = [
  {
    id: 'h1',
    bundleId: 'BDL-0101-011',
    spk: 'SPK-2026-10-044',
    sku: 'NAQALA Seamless Briefs (M / Charcoal)',
    time: '14:08 WIB',
    pass: 24,
    rework: 0,
    reject: 0,
    total: 24,
    status: 'PASS',
    operator: 'Operator Rudi',
    sewingLine: 'Line 1',
    defectsSummary: []
  },
  {
    id: 'h2',
    bundleId: 'BDL-0101-010',
    spk: 'SPK-2026-10-044',
    sku: 'NAQALA Seamless Briefs (M / Charcoal)',
    time: '13:52 WIB',
    pass: 22,
    rework: 2,
    reject: 0,
    total: 24,
    status: 'RWK',
    operator: 'Operator Rudi',
    sewingLine: 'Line 1',
    defectsSummary: ['Jahitan Lompat (2)']
  },
  {
    id: 'h3',
    bundleId: 'BDL-0101-009',
    spk: 'SPK-2026-10-043',
    sku: 'NAQALA Seamless Briefs (S / Charcoal)',
    time: '13:35 WIB',
    pass: 23,
    rework: 0,
    reject: 1,
    total: 24,
    status: 'DONE',
    operator: 'Operator Siti',
    sewingLine: 'Line 2',
    defectsSummary: ['Kain Bolong (1)']
  },
  {
    id: 'h4',
    bundleId: 'BDL-0101-008',
    spk: 'SPK-2026-10-043',
    sku: 'NAQALA Seamless Briefs (S / Charcoal)',
    time: '13:18 WIB',
    pass: 24,
    rework: 0,
    reject: 0,
    total: 24,
    status: 'PASS',
    operator: 'Operator Rudi',
    sewingLine: 'Line 1',
    defectsSummary: []
  },
];

const UPCOMING_BUNDLES = [
  { id: 'BDL-0101-013', spk: 'SPK-2026-10-044', sku: 'NAQALA Seamless Briefs (M / Charcoal)', qty: 24, line: 'Line 1 (Operator Rudi)', fabric: 'Polyamide Elastane #B092' },
  { id: 'BDL-0101-014', spk: 'SPK-2026-10-044', sku: 'NAQALA Seamless Briefs (M / Charcoal)', qty: 24, line: 'Line 1 (Operator Rudi)', fabric: 'Polyamide Elastane #B092' },
  { id: 'BDL-0101-015', spk: 'SPK-2026-10-045', sku: 'NAQALA High-Waist Boxers (L / Nude)', qty: 20, line: 'Line 2 (Operator Siti)', fabric: 'Modal Spandex #M104' },
];

export default function App() {
  const { user, logout } = useSession();
  // Active Bundle State
  const [bundleId, setBundleId] = useState('BDL-0101-012');
  const [targetQty, setTargetQty] = useState(24);
  const [spk, setSpk] = useState('SPK-2026-10-044');
  const [sku, setSku] = useState('NAQALA Seamless Briefs (M / Charcoal)');
  const [sewingLine, setSewingLine] = useState('Line 1 (Operator Rudi)');
  const [fabricBatch, setFabricBatch] = useState('Polyamide Elastane #B092');
  const [timeEntered, setTimeEntered] = useState('14:22 WIB');

  // Inspection Counts
  const [passCount, setPassCount] = useState(21);
  const [reworkCount, setReworkCount] = useState(2);
  const [rejectCount, setRejectCount] = useState(1);

  // Defect Tags
  const [defects, setDefects] = useState<DefectOption[]>(INITIAL_DEFECTS);
  const [reworkDestination, setReworkDestination] = useState('Operator Sewing Rudi - Line 1 (Jahitan Ulang)');

  // Modals & Panels
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [detailModalBundle, setDetailModalBundle] = useState<BundleHistory | null>(null);
  const [scanInputText, setScanInputText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoNext, setAutoNext] = useState(true);
  const [history, setHistory] = useState<BundleHistory[]>(INITIAL_HISTORY);
  const [historySearch, setHistorySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printSuccessAlert, setPrintSuccessAlert] = useState<{ title: string; sub: string; isError?: boolean } | null>(null);

  // Supervisor Hold state
  const [holdReason, setHoldReason] = useState('Ukuran pinggang melebihi toleransi standar (+0.8cm)');
  const [supervisorPin, setSupervisorPin] = useState('');

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState('Baru Saja');
  const [shiftTotalBundles, setShiftTotalBundles] = useState(42);
  const [shiftTotalPcs, setShiftTotalPcs] = useState(1008);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Calculations
  const currentTotal = passCount + reworkCount + rejectCount;
  const isBalanced = currentTotal === targetQty;
  const isOver = currentTotal > targetQty;
  const isUnder = currentTotal < targetQty;

  const totalDefectsCount = defects.reduce((sum, d) => sum + d.count, 0);
  const requiredDefectsCount = reworkCount + rejectCount;

  const passPct = currentTotal > 0 ? ((passCount / currentTotal) * 100).toFixed(1) : '0.0';
  const rwkPct = currentTotal > 0 ? ((reworkCount / currentTotal) * 100).toFixed(1) : '0.0';
  const rejPct = currentTotal > 0 ? ((rejectCount / currentTotal) * 100).toFixed(1) : '0.0';

  // Toggle sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
    if (next) sfx.click();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          setScanModalOpen(false);
          setShiftModalOpen(false);
          setHoldModalOpen(false);
          setDetailModalBundle(null);
        }
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setScanModalOpen(true);
        sfx.click();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitQC();
      } else if (e.key === 'p' || e.key === 'P' || e.key === '1') {
        updateCount('pass', 1);
      } else if (e.key === 'r' || e.key === 'R' || e.key === '2') {
        updateCount('rework', 1);
      } else if (e.key === 'x' || e.key === 'X' || e.key === '3') {
        updateCount('reject', 1);
      } else if (e.key === 'h' || e.key === 'H') {
        setHoldModalOpen(true);
      } else if (e.key === 'Escape') {
        setScanModalOpen(false);
        setShiftModalOpen(false);
        setHoldModalOpen(false);
        setDetailModalBundle(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passCount, reworkCount, rejectCount, targetQty, defects, reworkDestination, bundleId]);

  // Focus barcode input when modal opens
  useEffect(() => {
    if (scanModalOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [scanModalOpen]);

  // Stepper handlers
  const updateCount = (type: 'pass' | 'rework' | 'reject', delta: number) => {
    if (type === 'pass') {
      const next = Math.max(0, passCount + delta);
      setPassCount(next);
    } else if (type === 'rework') {
      const next = Math.max(0, reworkCount + delta);
      setReworkCount(next);
      // Auto adjust first active defect if increasing
      if (delta > 0 && totalDefectsCount < next + rejectCount) {
        setDefects((prev) => {
          const clone = [...prev];
          clone[0] = { ...clone[0], count: clone[0].count + 1 };
          return clone;
        });
      }
    } else if (type === 'reject') {
      const next = Math.max(0, rejectCount + delta);
      setRejectCount(next);
      if (delta > 0 && totalDefectsCount < reworkCount + next) {
        setDefects((prev) => {
          const clone = [...prev];
          clone[1] = { ...clone[1], count: clone[1].count + 1 };
          return clone;
        });
      }
    }
    sfx.click();
  };

  // Toggle or increment defect tag
  const handleDefectClick = (defectId: string) => {
    setDefects((prev) =>
      prev.map((d) => {
        if (d.id === defectId) {
          const newCount = d.count > 0 ? 0 : 1;
          if (newCount > 0) sfx.click();
          return { ...d, count: newCount };
        }
        return d;
      })
    );
  };

  const handleDefectIncrement = (defectId: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefects((prev) =>
      prev.map((d) => {
        if (d.id === defectId) {
          const newCount = Math.max(0, d.count + delta);
          sfx.click();
          return { ...d, count: newCount };
        }
        return d;
      })
    );
  };

  // Fill all remaining to Pass
  const handleFillAllPass = () => {
    const remaining = targetQty - (reworkCount + rejectCount);
    if (remaining >= 0) {
      setPassCount(remaining);
      sfx.click();
    }
  };

  // Reset current counters
  const handleResetCount = () => {
    setPassCount(0);
    setReworkCount(0);
    setRejectCount(0);
    setDefects((prev) => prev.map((d) => ({ ...d, count: 0 })));
    sfx.click();
  };

  // Submit QC
  const handleSubmitQC = () => {
    if (!isBalanced) {
      sfx.error();
      setPrintSuccessAlert({
        title: 'Validasi Jumlah Belum Seimbang!',
        sub: `Total item terhitung (${currentTotal} Pcs) belum sesuai dengan target cut ticket (${targetQty} Pcs). Harap hitung ulang.`,
        isError: true
      });
      setTimeout(() => setPrintSuccessAlert(null), 5000);
      return;
    }

    if ((reworkCount > 0 || rejectCount > 0) && totalDefectsCount === 0) {
      sfx.error();
      setPrintSuccessAlert({
        title: 'Kategori Defect Wajib Diisi!',
        sub: `Terdapat ${reworkCount + rejectCount} item Rework/Reject. Pilih minimal 1 kategori defect penanggung jawab.`,
        isError: true
      });
      setTimeout(() => setPrintSuccessAlert(null), 5000);
      return;
    }

    setIsSubmitting(true);
    sfx.success();

    const activeDefectNames = defects
      .filter((d) => d.count > 0)
      .map((d) => `${d.name} (${d.count})`);

    const newRecord: BundleHistory = {
      id: 'h_' + Date.now(),
      bundleId,
      spk,
      sku,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      pass: passCount,
      rework: reworkCount,
      reject: rejectCount,
      total: currentTotal,
      status: reworkCount > 0 ? 'RWK' : rejectCount > 0 ? 'DONE' : 'PASS',
      operator: sewingLine.includes('Rudi') ? 'Operator Rudi' : 'Operator Siti',
      sewingLine: sewingLine.includes('Line 1') ? 'Line 1' : 'Line 2',
      defectsSummary: activeDefectNames
    };

    setHistory((prev) => [newRecord, ...prev]);
    setShiftTotalBundles((prev) => prev + 1);
    setShiftTotalPcs((prev) => prev + targetQty);
    setLastSyncTime('Baru Saja');

    setPrintSuccessAlert({
      title: 'Hasil QC & Label Berhasil Diproses!',
      sub: reworkCount > 0
        ? `Label Thermal Rework RWK-${bundleId.replace('BDL-', '')}-A telah dikirim ke printer EPSON-TM01.`
        : `Bundle ${bundleId} tervalidasi 100% lolos ke packing station.`
    });

    setTimeout(() => {
      setIsSubmitting(false);
      if (autoNext && UPCOMING_BUNDLES.length > 0) {
        // Auto load next bundle
        loadBundlePreset(UPCOMING_BUNDLES[0]);
      }
    }, 1200);

    setTimeout(() => setPrintSuccessAlert(null), 6000);
  };

  // Hold verification submit
  const handleConfirmHold = () => {
    sfx.click();
    const newRecord: BundleHistory = {
      id: 'h_' + Date.now(),
      bundleId,
      spk,
      sku,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      pass: passCount,
      rework: reworkCount,
      reject: rejectCount,
      total: currentTotal,
      status: 'HOLD',
      operator: 'SPV On-Duty',
      sewingLine,
      defectsSummary: [`HOLD: ${holdReason}`]
    };
    setHistory((prev) => [newRecord, ...prev]);
    setHoldModalOpen(false);
    setPrintSuccessAlert({
      title: 'Bundle Ditandai HOLD / Dalam Investigasi',
      sub: `Tiket inspeksi ditahan untuk verifikasi supervisor Quality Control.`
    });
    setTimeout(() => setPrintSuccessAlert(null), 5000);
  };

  // Load a bundle preset
  const loadBundlePreset = (item: (typeof UPCOMING_BUNDLES)[0]) => {
    setBundleId(item.id);
    setSpk(item.spk);
    setSku(item.sku);
    setTargetQty(item.qty);
    setSewingLine(item.line);
    setFabricBatch(item.fabric);
    setTimeEntered(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
    
    // Reset counters to default clean state
    setPassCount(item.qty);
    setReworkCount(0);
    setRejectCount(0);
    setDefects((prev) => prev.map((d) => ({ ...d, count: 0 })));
    setScanModalOpen(false);
    sfx.click();
  };

  // Manual Scan Submit
  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInputText.trim()) return;
    const cleanId = scanInputText.trim().toUpperCase();
    setBundleId(cleanId);
    setTimeEntered(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
    setPassCount(targetQty);
    setReworkCount(0);
    setRejectCount(0);
    setDefects((prev) => prev.map((d) => ({ ...d, count: 0 })));
    setScanInputText('');
    setScanModalOpen(false);
    sfx.success();
  };

  // Export CSV
  const handleExportCSV = () => {
    sfx.click();
    const headers = ['Bundle ID,No SPK,Waktu,Pass,Rework,Reject,Total,Status,Sewing Line,Defects\n'];
    const rows = history.map(
      (h) =>
        `"${h.bundleId}","${h.spk}","${h.time}",${h.pass},${h.rework},${h.reject},${h.total},"${h.status}","${h.sewingLine}","${h.defectsSummary.join('; ')}"`
    );
    const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SHIFT_QC_LOG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter history
  const filteredHistory = history.filter(
    (h) =>
      h.bundleId.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.spk.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.sku.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ================= TOP STATION HEADER ================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-2.5 flex flex-wrap lg:flex-nowrap justify-between items-center gap-3">
          {/* Brand & Station Identity */}
          <div className="flex items-center gap-3">
            <div className="bg-[#091426] text-white p-2 rounded-md flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-[#091426] leading-tight">
                  THEUNDERWEARSUPPLY ERP — QC Station #03
                </h1>
                <span className="hidden sm:inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide font-mono">
                  v2.6-GARMENT
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 font-semibold text-[#091426]">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">alt_route</span>
                  Line 2 - Briefs Assembly
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  Inspector: {user?.name} ({user?.stationBadge ?? user?.id})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Live Indicators */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Live Online Badge */}
            <div
              className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200"
              title={`Sinkronisasi Cloud: ${lastSyncTime}`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <span className="text-[11px] font-bold text-slate-800 tracking-wide">Status: Online - Auto-Sync</span>
              <span className="material-symbols-outlined text-[16px] text-blue-600">wifi</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2.5 rounded-md border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                soundEnabled
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
              title={soundEnabled ? 'Suara Beep: Aktif' : 'Suara Beep: Senyap'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Scan New Bundle (F1) */}
            <button
              id="btn-scan-f1"
              onClick={() => {
                sfx.click();
                setScanModalOpen(true);
              }}
              className="h-11 px-4 bg-[#091426] hover:bg-slate-800 text-white rounded-md text-xs sm:text-sm font-bold flex items-center gap-2 transition-transform active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-blue-300">qr_code_scanner</span>
              <span>Scan New Bundle (F1)</span>
            </button>

            {/* Selesai Shift */}
            <button
              onClick={() => {
                sfx.click();
                setShiftModalOpen(true);
              }}
              className="h-11 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs sm:text-sm font-bold border border-slate-300 flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              <span>Selesai Shift</span>
            </button>

            {/* Keluar sesi */}
            <button
              onClick={() => {
                sfx.click();
                logout();
              }}
              title="Keluar"
              className="h-11 w-11 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-md border border-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN QC AUDIT CANVAS ================= */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
        {/* 1. ACTIVE BUNDLE INFO HERO BANNER */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            {/* Barcode / QR Identification Badge */}
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="flex items-stretch rounded-md border border-slate-800 overflow-hidden shadow-xs">
                <div className="bg-[#1e293b] text-white px-3 py-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
                  <span className="material-symbols-outlined text-[18px] text-blue-300">qr_code_2</span>
                  <span>QR BUNDLE</span>
                </div>
                <div className="bg-slate-100 px-4 py-2 font-mono text-lg sm:text-xl font-extrabold text-slate-900 tracking-wider flex items-center">
                  {bundleId}
                </div>
              </div>

              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-md text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-[16px] animate-spin text-blue-600" style={{ animationDuration: '6s' }}>
                  sync
                </span>
                ACTIVE LOT
              </span>

              <button
                onClick={() => setScanModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 ml-1"
              >
                Ganti Bundle <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Target Bundle Specification Indicator */}
            <div className="flex items-center gap-4 sm:gap-6 self-end lg:self-auto">
              <div className="text-right">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Bundle Qty</div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#091426] font-mono tabular-nums">
                  {targetQty} <span className="text-sm font-semibold text-slate-500">Pcs</span>
                </div>
              </div>

              <div className="h-9 w-[1.5px] bg-slate-200"></div>

              <div className="text-right">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Waktu Masuk QC</div>
                <div className="text-sm sm:text-base font-bold text-slate-800 font-mono flex items-center gap-1 justify-end">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {timeEntered}
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-3 text-xs sm:text-sm">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">No SPK Induk</span>
              <span className="font-mono font-bold text-slate-900">{spk}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Artikel / SKU</span>
              <span className="font-bold text-slate-900 truncate" title={sku}>
                {sku}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jalur Jahit (Sewing Line)</span>
              <span className="font-semibold text-slate-800">{sewingLine}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Fabric / Material Batch</span>
              <span className="text-slate-600 font-mono truncate" title={fabricBatch}>
                {fabricBatch}
              </span>
            </div>
          </div>
        </section>

        {/* 2. BUNDLE BALANCE LIVE VALIDATOR BAR */}
        <div
          id="validator-bar"
          className={`w-full rounded-lg p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs border-2 transition-all duration-200 ${
            isBalanced
              ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
              : isOver
              ? 'bg-red-50 border-red-600 text-red-950'
              : 'bg-amber-50 border-amber-500 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 flex items-center justify-center text-white shrink-0 ${
                isBalanced ? 'bg-emerald-600' : isOver ? 'bg-red-600' : 'bg-amber-600'
              }`}
            >
              {isBalanced ? (
                <span className="material-symbols-outlined text-[24px]">verified</span>
              ) : isOver ? (
                <span className="material-symbols-outlined text-[24px]">warning</span>
              ) : (
                <span className="material-symbols-outlined text-[24px]">pending</span>
              )}
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold uppercase tracking-wide flex items-center gap-2">
                <span>STATUS VALIDASI BUNDLE:</span>
                <span className="underline font-mono">
                  {isBalanced && 'SEIMBANG & VALID'}
                  {isOver && `LEBIH (+${currentTotal - targetQty} Pcs Over)`}
                  {isUnder && `KURANG (${targetQty - currentTotal} Pcs Belum Dihitung)`}
                </span>
              </div>
              <p className="text-xs sm:text-sm opacity-90">
                {isBalanced && 'Total perhitungan fisik sama dengan target bundle cut ticket. Siap submit & cetak.'}
                {isOver && 'Jumlah fisik melebihi target cut ticket! Periksa kemungkinan tercampurnya potongan bundle lain.'}
                {isUnder && 'Hitung seluruh garmen hingga jumlah pas 24 Pcs sebelum melepaskan lot ini.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center sm:text-right">
              <span className="text-[11px] font-bold text-slate-600 block uppercase">Total Dihitung</span>
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight font-mono tabular-nums">
                {currentTotal} / {targetQty} Pcs
              </span>
            </div>

            {/* Proportion Bar */}
            <div className="w-32 sm:w-36 bg-slate-200 h-4 rounded-full overflow-hidden flex border border-slate-300 shadow-inner">
              <div
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (passCount / targetQty) * 100)}%` }}
                title={`Pass: ${passCount} pcs`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (reworkCount / targetQty) * 100)}%` }}
                title={`Rework: ${reworkCount} pcs`}
              />
              <div
                className="bg-red-600 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (rejectCount / targetQty) * 100)}%` }}
                title={`Reject: ${rejectCount} pcs`}
              />
            </div>
          </div>
        </div>

        {/* 3. CENTRAL INSPECTION COUNTERS (3 TACTILE CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD 1: PASS / LOLOS QC */}
          <div className="bg-white rounded-lg border-2 border-emerald-600 shadow-sm flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">check_circle</span>
                <span className="text-sm font-bold tracking-wide">PASS / LOLOS QC</span>
              </div>
              <span className="bg-emerald-800 text-white text-xs px-2 py-0.5 rounded font-mono font-bold tabular-nums">
                {passPct}%
              </span>
            </div>

            {/* Metric Display */}
            <div className="py-5 px-4 flex flex-col items-center justify-center bg-emerald-50/50">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-1">Siap Packing Box</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-emerald-700 leading-none font-mono tabular-nums">
                  {passCount}
                </span>
                <span className="text-lg font-bold text-slate-500">Pcs</span>
              </div>
              <button
                onClick={handleFillAllPass}
                className="mt-2 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                title="Isi sisa target ke Pass"
              >
                Isi Semua Sisa ({Math.max(0, targetQty - reworkCount - rejectCount)} Pcs)
              </button>
            </div>

            {/* Stepper Controls */}
            <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
              <button
                className="h-16 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('pass', -1)}
              >
                <Minus className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-bold">MINUS 1</span>
              </button>
              <button
                className="h-16 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('pass', 1)}
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-extrabold">TAMBAH 1</span>
              </button>
            </div>
          </div>

          {/* CARD 2: REWORK / PERBAIKAN */}
          <div className="bg-white rounded-lg border-2 border-amber-500 shadow-sm flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">build_circle</span>
                <span className="text-sm font-bold tracking-wide">REWORK / PERBAIKAN</span>
              </div>
              <span className="bg-amber-700 text-white text-xs px-2 py-0.5 rounded font-mono font-bold tabular-nums">
                {rwkPct}%
              </span>
            </div>

            {/* Metric Display & Routing Sub-badge */}
            <div className="py-4 px-4 flex flex-col items-center justify-center bg-amber-50/50">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-amber-600 leading-none font-mono tabular-nums">
                  {reworkCount}
                </span>
                <span className="text-lg font-bold text-slate-500">Pcs</span>
              </div>
              {/* Quick Rework QR Routing Badge */}
              <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded text-[11px] font-bold text-amber-900">
                <span className="material-symbols-outlined text-[16px] text-amber-700">turn_right</span>
                <span>Rework Line: Sewing (Jahitan)</span>
              </div>
            </div>

            {/* Stepper Controls */}
            <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
              <button
                className="h-16 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('rework', -1)}
              >
                <Minus className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-bold">MINUS 1</span>
              </button>
              <button
                className="h-16 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('rework', 1)}
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-extrabold">TAMBAH 1</span>
              </button>
            </div>
          </div>

          {/* CARD 3: REJECT / AFVAL */}
          <div className="bg-white rounded-lg border-2 border-red-600 shadow-sm flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="bg-red-700 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
                <span className="text-sm font-bold tracking-wide">REJECT / AFVAL</span>
              </div>
              <span className="bg-red-800 text-white text-xs px-2 py-0.5 rounded font-mono font-bold tabular-nums">
                {rejPct}%
              </span>
            </div>

            {/* Metric Display */}
            <div className="py-5 px-4 flex flex-col items-center justify-center bg-red-50/50">
              <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider mb-1">
                Cacat Fatal / Tidak Bisa Diperbaiki
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-red-600 leading-none font-mono tabular-nums">
                  {rejectCount}
                </span>
                <span className="text-lg font-bold text-slate-500">Pcs</span>
              </div>
              <span className="mt-2 text-[11px] text-slate-500 italic">Quarantine Box #AFV-02</span>
            </div>

            {/* Stepper Controls */}
            <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
              <button
                className="h-16 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('reject', -1)}
              >
                <Minus className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-bold">MINUS 1</span>
              </button>
              <button
                className="h-16 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                onClick={() => updateCount('reject', 1)}
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-extrabold">TAMBAH 1</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. DEFECT CATEGORY SELECTOR & ROUTING SPECIFICATION */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[24px]">flag</span>
              <h2 className="text-base font-bold text-[#091426]">
                Pilih Kategori Defect / Cacat (Wajib untuk Rework &amp; Reject)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-3 py-1 rounded-md font-bold uppercase ${
                  totalDefectsCount === requiredDefectsCount
                    ? 'bg-emerald-100 text-emerald-800'
                    : totalDefectsCount > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Tercatat {totalDefectsCount} Cacat Terdeteksi (Perlu {requiredDefectsCount})
              </span>
            </div>
          </div>

          {/* Defect Tag Array */}
          <div className="flex flex-wrap gap-2.5 mb-4">
            {defects.map((d) => {
              const isSelected = d.count > 0;
              return (
                <div
                  key={d.id}
                  onClick={() => handleDefectClick(d.id)}
                  className={`h-11 min-w-[140px] px-3 rounded-lg flex items-center justify-between gap-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-red-50 text-red-700 border-2 border-red-600 shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <button
                        onClick={(e) => handleDefectIncrement(d.id, 1, e)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-red-200 hover:bg-red-300 text-red-900 text-xs font-bold"
                        title="Tambah cacat yang sama"
                      >
                        +
                      </button>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        isSelected ? 'bg-red-600 text-white font-bold' : 'text-slate-400 bg-slate-100'
                      }`}
                    >
                      {d.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Specific Rework Station Dropdown */}
          <div className="bg-[#eff4ff] p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label
                htmlFor="rework-destination"
                className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px] text-blue-600">alt_route</span>
                Tujuan Rework:
              </label>
              <div className="relative flex-1 md:w-96">
                <select
                  id="rework-destination"
                  value={reworkDestination}
                  onChange={(e) => setReworkDestination(e.target.value)}
                  className="h-11 w-full pl-3 pr-8 bg-white border-2 border-slate-300 rounded-md text-xs sm:text-sm font-bold text-[#091426] focus:border-blue-600 focus:outline-none"
                >
                  <option>Operator Sewing Rudi - Line 1 (Jahitan Ulang)</option>
                  <option>Operator Bonding Siti - Line 2 (Heatpress Ulang)</option>
                  <option>Washing &amp; Spotting Station (Pembersihan Noda)</option>
                  <option>Cutting Table Specialist (Trimming)</option>
                  <option>Finishing &amp; Steam Ironing (Repacking)</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-slate-500 italic">
              *Label QR Perbaikan otomatis mencantumkan nama operator penanggung jawab.
            </span>
          </div>
        </section>

        {/* 5. ACTION FOOTER & REWORK LABEL GENERATOR PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Primary Action Buttons (8 cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Langkah Akhir Validasi</span>
                <span className="text-xs text-slate-400 font-mono">P = Pass | R = Rework | X = Reject | Enter = Submit</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700">
                Pastikan jumlah fisik telah dihitung akurat sebelum mencetak label dan melepas bundle ke lini selanjutnya.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-2">
              {/* Big Primary Submit Trigger */}
              <button
                id="btn-submit-main"
                disabled={isSubmitting}
                onClick={handleSubmitQC}
                className={`h-16 flex-1 rounded-lg text-sm sm:text-base font-extrabold flex items-center justify-center gap-3 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                  isBalanced
                    ? 'bg-[#091426] hover:bg-slate-800 text-white'
                    : 'bg-slate-400 text-white opacity-80 hover:bg-slate-500'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                ) : (
                  <Printer className="w-6 h-6 text-emerald-400" />
                )}
                <span className="tracking-wide">
                  {isSubmitting
                    ? 'MEMPROSES & MENCETAK LABEL...'
                    : 'SUBMIT HASIL QC & CETAK LABEL REWORK (ENTER)'}
                </span>
              </button>

              {/* Hold / Verification Trigger */}
              <button
                onClick={() => setHoldModalOpen(true)}
                className="h-16 px-5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
              >
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>Hold / Verifikasi Supervisor</span>
              </button>

              {/* Reset Count Button */}
              <button
                onClick={handleResetCount}
                className="h-16 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                title="Reset seluruh hitungan bundle ini"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Instant Rework QR Label Preview Card (4 cols) */}
          <div className="lg:col-span-4 bg-slate-900 text-white p-4 rounded-lg border border-slate-800 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">label</span>
                  Preview Label Thermal
                </span>
                <span className="text-xs text-slate-400 font-mono">100 x 75mm</span>
              </div>

              {/* Visual simulated sticker preview */}
              <div
                id="thermal-print-area"
                className="mt-3 bg-white text-slate-950 p-3 rounded font-mono shadow-xs border border-slate-200 select-none"
              >
                <div className="flex items-start gap-3">
                  {/* Simulated QR Code SVG */}
                  <div className="bg-black p-1.5 text-white flex flex-col items-center justify-center rounded shrink-0">
                    <QrCode className="w-11 h-11 text-white" />
                  </div>

                  <div className="text-[11px] leading-tight space-y-1 overflow-hidden">
                    <div className="font-extrabold text-[12px] text-red-600 flex items-center justify-between">
                      <span>{reworkCount > 0 ? 'TIKET REWORK' : 'TIKET CLEAR / PASS'}</span>
                      <span className="text-slate-500 text-[9px] font-normal">{timeEntered}</span>
                    </div>
                    <div className="font-extrabold text-[12px] tracking-tight">
                      RWK-{bundleId.replace('BDL-', '')}-A
                    </div>
                    <div className="truncate">
                      Qty: <span className="font-bold text-amber-700">{reworkCount || passCount} Pcs</span> | Briefs M
                    </div>
                    <div className="text-[10px] text-slate-700 truncate">
                      Tindakan: <span className="font-bold underline">{defects.find((d) => d.count > 0)?.name || 'Standard Audit'}</span>
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">
                      Tujuan: {reworkDestination.split('-')[0].replace('Operator', 'Op.')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Thermal Printer Ready
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sfx.click();
                    window.print();
                  }}
                  className="text-[10px] text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Test Print
                </button>
                <span className="font-mono text-[11px] text-slate-400">EPSON-TM01</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. AUDIT TRAIL / RIWAYAT BUNDLE DI-INSPEKSI */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[24px]">history</span>
              <h3 className="text-base font-bold text-[#091426]">
                Riwayat Bundle Diperiksa Hari Ini (Shift Pagi: {shiftTotalBundles} Bundle / {shiftTotalPcs.toLocaleString()} Pcs)
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari Bundle / SPK..."
                className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 w-44"
              />
              <button
                onClick={handleExportCSV}
                className="h-9 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Shift Log</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Bundle ID</th>
                  <th className="py-2.5 px-3">No. SPK</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3 text-center">Pass</th>
                  <th className="py-2.5 px-3 text-center">Rework</th>
                  <th className="py-2.5 px-3 text-center">Reject</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-mono">
                {filteredHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#091426] flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-slate-400" />
                      {row.bundleId}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{row.spk}</td>
                    <td className="py-3 px-3 text-slate-600">{row.time}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">{row.pass}</td>
                    <td className="py-3 px-3 text-center font-bold text-amber-700">
                      {row.rework > 0 ? row.rework : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-red-700">
                      {row.reject > 0 ? row.reject : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {row.status === 'PASS' && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">
                          <Check className="w-3 h-3" /> 100% PASS
                        </span>
                      )}
                      {row.status === 'RWK' && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                          <span className="material-symbols-outlined text-[13px]">turn_right</span> RWK TICKET
                        </span>
                      )}
                      {row.status === 'HOLD' && (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded">
                          <ShieldAlert className="w-3 h-3" /> ON HOLD
                        </span>
                      )}
                      {row.status === 'DONE' && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> SELESAI
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        onClick={() => {
                          sfx.click();
                          setDetailModalBundle(row);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline cursor-pointer"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ================= MODAL: SCAN NEW BUNDLE (F1) ================= */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#091426] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-blue-300">qr_code_scanner</span>
                <h3 className="font-bold text-base">Scan Bundle Barcode / Cut Ticket (F1)</h3>
              </div>
              <button
                onClick={() => setScanModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleManualScan} className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">
                  Input Laser Scanner atau Masukkan Kode Bundle Manual
                </label>
                <div className="flex gap-2">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={scanInputText}
                    onChange={(e) => setScanInputText(e.target.value)}
                    placeholder="Contoh: BDL-0101-013"
                    className="flex-1 h-12 px-4 bg-slate-50 border-2 border-blue-600 rounded-lg text-base font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    className="h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    Buka Lot
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Hardware barcode laser siap membaca kode cetak thermal atau cut ticket garmen.
                </p>
              </form>

              {/* Antrean Bundle Siap Masuk QC */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">
                  Pilih Cepat Dari Antrean Sewing Line (Next in Line):
                </span>
                <div className="space-y-2">
                  {UPCOMING_BUNDLES.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadBundlePreset(item)}
                      className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#091426]">{item.id}</span>
                          <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            {item.qty} Pcs
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.sku} • {item.line}
                        </div>
                      </div>
                      <button className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        Pilih <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setScanModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-bold cursor-pointer"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: HOLD / SUPERVISOR VERIFIKASI ================= */}
      {holdModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-amber-200" />
                <h3 className="font-bold text-base">Hold Lot / Verifikasi Supervisor</h3>
              </div>
              <button
                onClick={() => setHoldModalOpen(false)}
                className="text-amber-200 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                Gunakan fitur ini apabila ditemukan ketidaksesuaian parah, cacat material berantai, atau keraguan toleransi
                spesifikasi pola yang membutuhkan otorisasi SPV QC.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block uppercase mb-1">Alasan Penahanan (Hold Reason):</label>
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block uppercase mb-1">PIN / Kode Otorisasi Supervisor:</label>
                <input
                  type="password"
                  placeholder="Masukkan 4-digit PIN SPV"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono bg-slate-50 border border-slate-300 rounded-md focus:border-amber-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Simulasi: sembarang PIN diperbolehkan untuk demonstrasi</span>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setHoldModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmHold}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Konfirmasi Tahan Bundle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SELESAI SHIFT ================= */}
      {shiftModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#091426] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-emerald-400">task_alt</span>
                <h3 className="font-bold text-base">Serah Terima &amp; Laporan Selesai Shift</h3>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Bundle</span>
                  <div className="text-xl font-mono font-bold text-slate-900 mt-1">{shiftTotalBundles}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Pcs Diperiksa</span>
                  <div className="text-xl font-mono font-bold text-slate-900 mt-1">{shiftTotalPcs.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Pass Yield Rate</span>
                  <div className="text-xl font-mono font-bold text-emerald-700 mt-1">96.4%</div>
                </div>
              </div>

              <div className="text-xs space-y-2 border-t border-slate-200 pt-3">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Stasiun Kerja:</span>
                  <span className="font-bold text-slate-800">QC Station #03 (Line 2 Briefs)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Inspector Bertugas:</span>
                  <span className="font-bold text-slate-800">Siti Aminah (QC-088)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Shift Operasional:</span>
                  <span className="font-bold text-slate-800">Pagi (07:00 - 15:00 WIB)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block uppercase mb-1">Catatan Handover untuk Shift Siang:</label>
                <textarea
                  rows={2}
                  defaultValue="Perhatikan jahitan elastis waistband Line 1 karena ada 2 kasus jahitan loncat."
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShiftModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-bold cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={() => {
                  sfx.success();
                  setShiftModalOpen(false);
                  setPrintSuccessAlert({
                    title: 'Shift Ditutup & Log Tersimpan',
                    sub: 'Laporan shift harian telah disinkronkan ke server central ERP.'
                  });
                  setTimeout(() => setPrintSuccessAlert(null), 5000);
                }}
                className="px-4 py-2 bg-[#091426] hover:bg-slate-800 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Cetak &amp; Tutup Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETAIL BUNDLE RIWAYAT ================= */}
      {detailModalBundle && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#091426] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Detail Audit: {detailModalBundle.bundleId}</h3>
              </div>
              <button
                onClick={() => setDetailModalBundle(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">No. SPK:</span>
                <span className="font-mono font-bold">{detailModalBundle.spk}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Artikel:</span>
                <span className="font-bold">{detailModalBundle.sku}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Waktu Audit:</span>
                <span className="font-mono">{detailModalBundle.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Operator Sewing:</span>
                <span className="font-semibold">{detailModalBundle.operator} ({detailModalBundle.sewingLine})</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2">
                <div className="bg-emerald-50 border border-emerald-200 p-2 rounded">
                  <div className="text-[10px] text-emerald-800 font-bold uppercase">Pass</div>
                  <div className="text-lg font-mono font-bold text-emerald-700">{detailModalBundle.pass} Pcs</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2 rounded">
                  <div className="text-[10px] text-amber-800 font-bold uppercase">Rework</div>
                  <div className="text-lg font-mono font-bold text-amber-700">{detailModalBundle.rework} Pcs</div>
                </div>
                <div className="bg-red-50 border border-red-200 p-2 rounded">
                  <div className="text-[10px] text-red-800 font-bold uppercase">Reject</div>
                  <div className="text-lg font-mono font-bold text-red-700">{detailModalBundle.reject} Pcs</div>
                </div>
              </div>

              {detailModalBundle.defectsSummary.length > 0 && (
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Rincian Cacat Terdeteksi:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {detailModalBundle.defectsSummary.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  sfx.click();
                  window.print();
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Ulang Label
              </button>
              <button
                onClick={() => setDetailModalBundle(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= NOTIFICATION TOAST ================= */}
      {printSuccessAlert && (
        <div
          className={`fixed bottom-6 right-6 text-white px-5 py-3 rounded-lg shadow-xl border z-50 flex items-center gap-3 animate-in slide-in-from-bottom duration-200 ${
            printSuccessAlert.isError
              ? 'bg-red-950 border-red-700'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          {printSuccessAlert.isError ? (
            <XCircle className="w-6 h-6 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          )}
          <div>
            <div
              className={`font-bold text-sm ${
                printSuccessAlert.isError ? 'text-red-300' : 'text-emerald-400'
              }`}
            >
              {printSuccessAlert.title}
            </div>
            <div className="text-xs text-slate-300 max-w-sm">{printSuccessAlert.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}
