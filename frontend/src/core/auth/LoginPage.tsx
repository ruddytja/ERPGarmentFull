import React, { useState, useEffect } from 'react';
import { UserAccount } from '../../modules/admin/types';
import type { AuthSource } from '../session';
import { ROLE_LABEL } from '../rbac';

interface LoginPageProps {
  onLogin: (user: UserAccount, source: AuthSource, selectedShift: 'Shift 1' | 'Shift 2' | 'Shift 3') => void;
  /** Akun demo, dipakai bila API/database tidak tersedia. */
  users: UserAccount[];
  currentShift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  notice?: string | null;
  onLogAudit?: (action: string, category: 'primary' | 'tertiary' | 'secondary' | 'error', targetUserId?: string, details?: string) => void;
}

type ApiLoginResult =
  | { kind: 'ok'; user: UserAccount }
  | { kind: 'rejected'; status: number; message: string }
  | { kind: 'unavailable' };

// Coba autentikasi ke database. 503 / non-JSON / network error = API tidak tersedia → mode demo.
async function loginViaApi(identifier: string, password: string): Promise<ApiLoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (res.status === 503 || res.status === 404 || !isJson) return { kind: 'unavailable' };
    const data = await res.json();
    if (res.ok && data.success && data.user) return { kind: 'ok', user: data.user };
    return { kind: 'rejected', status: res.status, message: data.message || data.error?.message || 'Login gagal.' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  users,
  currentShift,
  notice,
  onLogAudit,
}) => {
  // Form states
  const [identifier, setIdentifier] = useState(''); // email, username, or id
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Security states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const saved = localStorage.getItem('erp_auth_failed_attempts');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('erp_auth_lockout_until');
    return saved ? parseInt(saved, 10) : null;
  });
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemainingSec(0);
      return;
    }

    const checkLockout = () => {
      const now = Date.now();
      if (now >= lockoutUntil) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        localStorage.removeItem('erp_auth_lockout_until');
        localStorage.removeItem('erp_auth_failed_attempts');
        setErrorMessage(null);
      } else {
        setLockoutRemainingSec(Math.ceil((lockoutUntil - now) / 1000));
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Handle standard credential submit
  const handleCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Check Lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const mins = Math.ceil(lockoutRemainingSec / 60);
      setErrorMessage(`Akun dikunci sementara karena 5 kali percobaan gagal berturut-turut. Coba lagi dalam ${mins} menit.`);
      return;
    }

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Harap masukkan email/username dan password.');
      return;
    }

    setIsLoading(true);

    loginViaApi(identifier.trim(), password).then((result) => {
      if (result.kind === 'ok') {
        setIsLoading(false);
        completeLoginSuccess(result.user, 'Kredensial Password (Database)', 'database');
        return;
      }
      if (result.kind === 'rejected') {
        setIsLoading(false);
        if (result.status === 401) handleFailedAttempt(result.message);
        else setErrorMessage(result.message);
        return;
      }
      loginWithDemoAccounts();
    });
  };

  // Mode demo: validasi terhadap akun mock (dipakai bila database tidak tersedia).
  const loginWithDemoAccounts = () => {
    setTimeout(() => {
      setIsLoading(false);
      const cleanId = identifier.trim().toLowerCase();

      // Find user by email, id, or stationBadge
      const foundUser = users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.id.toLowerCase() === cleanId ||
          (u.stationBadge && u.stationBadge.toLowerCase() === cleanId)
      );

      // Check user existence
      if (!foundUser) {
        handleFailedAttempt('Kredensial tidak ditemukan pada sistem.');
        return;
      }

      // Check account active status (FRD: Akun Deactivated tidak dapat login)
      if (foundUser.status === 'deactivated') {
        setErrorMessage('Akun Anda tidak aktif. Hubungi Admin IT untuk reaktivasi.');
        onLogAudit?.(
          `Percobaan login gagal untuk akun nonaktif: ${foundUser.email}`,
          'error',
          foundUser.id,
          'Percobaan masuk diblokir karena status akun dinonaktifkan.'
        );
        return;
      }

      // Password validation rule
      const validPasswords = ['password123', 'admin123', foundUser.pinCode, 'password'];
      const isPasswordValid =
        validPasswords.includes(password) ||
        (password.length >= 6 && (password === 'secret' || password.toLowerCase() === foundUser.role.toLowerCase()));

      if (!isPasswordValid) {
        handleFailedAttempt(`Password salah untuk akun ${foundUser.email}`);
        return;
      }

      // SUCCESSFUL LOGIN
      completeLoginSuccess(foundUser, 'Kredensial Password (Demo)', 'demo');
    }, 400);
  };

  // Helper for Failed Attempts & Lockout
  const handleFailedAttempt = (logDetail: string) => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    localStorage.setItem('erp_auth_failed_attempts', newCount.toString());

    onLogAudit?.(
      'Percobaan Login Gagal',
      'error',
      undefined,
      `${logDetail} (Percobaan ke-${newCount})`
    );

    if (newCount >= 5) {
      const lockTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
      setLockoutUntil(lockTime);
      localStorage.setItem('erp_auth_lockout_until', lockTime.toString());
      setErrorMessage('Akun dikunci sementara karena 5 kali percobaan gagal berturut-turut. Coba lagi dalam 15 menit.');
    } else {
      setErrorMessage(`Email atau password salah. (Sisa percobaan aman: ${5 - newCount} kali)`);
    }
  };

  // Helper for Success Login
  const completeLoginSuccess = (user: UserAccount, authMechanism: string, source: AuthSource) => {
    setFailedAttempts(0);
    localStorage.removeItem('erp_auth_failed_attempts');
    localStorage.removeItem('erp_auth_lockout_until');

    setSuccessMessage(`Otentikasi Berhasil! Mengalihkan ke dashboard ${ROLE_LABEL[user.role]}...`);

    onLogAudit?.(
      `Otentikasi Berhasil: ${user.name} (${user.id})`,
      'tertiary',
      user.id,
      `Metode: ${authMechanism} | Role: ${user.role} | Shift: ${currentShift}`
    );

    setTimeout(() => {
      onLogin(user, source, currentShift);
    }, 500);
  };

  // Quick 1-Click Demo Profiles (For Instant Evaluation)
  const quickDemoProfiles: { role: string; user: UserAccount; hint: string; badgeColor: string }[] = [
    {
      role: 'Super Admin',
      user: users.find((u) => u.id === 'USR-ADMIN-01') || users[0],
      hint: 'Akses Penuh Tenant & IAM Matrix',
      badgeColor: 'bg-[#191c1e] text-white',
    },
    {
      role: 'Founder / CEO',
      user: users.find((u) => u.id === 'USR-001') || users[0],
      hint: 'Executive Overview & Financials',
      badgeColor: 'bg-[#004ac6] text-white',
    },
    {
      role: 'Supervisor Sewing',
      user: users.find((u) => u.id === 'USR-002') || users[1],
      hint: 'Shift Line Lead & SPK Control',
      badgeColor: 'bg-[#007f36] text-white',
    },
    {
      role: 'Finance & Payroll',
      user: users.find((u) => u.id === 'USR-008') || users[2],
      hint: 'Costing, Piece-rate & Audit',
      badgeColor: 'bg-[#735005] text-white',
    },
    {
      role: 'Staff Operator',
      user: users.find((u) => u.id === 'USR-025') || users[3],
      hint: 'Kios Scan Bundel Sewing',
      badgeColor: 'bg-[#545f73] text-white',
    },
    {
      role: 'Staff QC',
      user: users.find((u) => u.id === 'USR-031') || users[3],
      hint: 'Stasiun Inspeksi & Defect Log',
      badgeColor: 'bg-[#545f73] text-white',
    },
    {
      role: 'Staff Packing',
      user: users.find((u) => u.id === 'USR-029') || users[3],
      hint: 'Packing, FG & Dispatch',
      badgeColor: 'bg-[#545f73] text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c131f] via-[#111c2d] to-[#1a2942] text-white flex flex-col justify-between selection:bg-[#2563eb] selection:text-white relative overflow-hidden font-sans">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#2563eb]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-[#007f36]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-[#4f46e5]/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[22px]">factory</span>
          </div>
          <div>
            <span className="text-[17px] font-black tracking-wider text-white flex items-center gap-2">
              THEUNDERWEARSUPPLY
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                ERP v2.4
              </span>
            </span>
            <p className="text-[11px] text-gray-400 font-medium">Enterprise Garment Manufacturing Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Gateway Node: JKT-PLANT-01</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-300">
            <span className="material-symbols-outlined text-[15px]">schedule</span>
            <span>{currentTime || '12:00:00 WIB'}</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-xl bg-slate-900/80">
          
          {/* Left Column: Industrial Plant Information & Value Props (5 cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-gradient-to-b from-slate-900/90 via-slate-800/60 to-slate-950 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold mb-6">
                <span className="material-symbols-outlined text-[14px]">verified_user</span>
                <span>Zero-Trust Enterprise IAM</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mb-3">
                Industrial Access &amp; Floor Telemetry
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-6">
                Portal autentikasi terpusat untuk jajaran Direksi, Supervisor Jalur Jahit, Tim Finance Payroll, dan Operator Garment.
              </p>

              {/* Security Features List */}
              <div className="space-y-4 my-6 text-xs text-gray-300">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                  </div>
                  <div>
                    <span className="font-semibold text-white">Autentikasi Kredensial Terenkripsi</span>
                    <p className="text-[11px] text-gray-400">Enkripsi sandi dan token sesi JWT berkeamanan tinggi</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">security</span>
                  </div>
                  <div>
                    <span className="font-semibold text-white">RBAC Matrix &amp; Kontrol Akses Modul</span>
                    <p className="text-[11px] text-gray-400">Hak akses dinamis per departemen sesuai standar ISO/IEC 27001</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">lock_clock</span>
                  </div>
                  <div>
                    <span className="font-semibold text-white">Proteksi Brute-force &amp; Audit Trail</span>
                    <p className="text-[11px] text-gray-400">Lockout otomatis 15 menit setelah 5 kali gagal verifikasi</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Compliance Badges */}
            <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1 font-semibold text-gray-300">
                <span className="material-symbols-outlined text-[15px] text-blue-400">shield</span>
                ISO/IEC 27001
              </span>
              <span>TLS 1.3 256-bit</span>
              <span>Audit Ready</span>
            </div>
          </div>

          {/* Right Column: Direct Credential Login Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 bg-slate-900/60 flex flex-col justify-between">
            <div>
              {/* Form Title */}
              <div className="mb-6 pb-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white tracking-tight">Masuk ke Sistem ERP</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Masukkan email perusahaan atau ID pengguna terdaftar beserta password Anda.
                </p>
              </div>

              {/* Alert Notifications */}
              {notice && !errorMessage && !successMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">lock_clock</span>
                  <span className="font-semibold">{notice}</span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold block">{errorMessage}</span>
                    {lockoutRemainingSec > 0 && (
                      <span className="text-[11px] text-red-300 font-mono mt-1 block">
                        Waktu tunggu tersisa: {Math.floor(lockoutRemainingSec / 60)}m {lockoutRemainingSec % 60}d
                      </span>
                    )}
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">
                    check_circle
                  </span>
                  <span className="font-semibold">{successMessage}</span>
                </div>
              )}

              {/* Standard Credential Form */}
              <form onSubmit={handleCredentialLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Email Perusahaan / User ID
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">
                      mail
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="contoh: raditya.ops@theunderwearsupply.com atau USR-ADMIN-01"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-300">Password</label>
                    <button
                      type="button"
                      onClick={() =>
                        alert('Untuk reset password akun ERP, hubungi Helpdesk IT / Admin Infrastructure.')
                      }
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">
                      lock
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password akun Anda"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-800 border-white/20 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Ingat stasiun kerja ini</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || lockoutRemainingSec > 0}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Memverifikasi Kredensial...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">login</span>
                      <span>Masuk ke Konsol ERP</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Demo Accounts Helper (For Instant Evaluation) */}
            <div className="mt-8 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-400">bolt</span>
                  Akses Cepat Pengujian (1-Click Demo Profiles):
                </span>
                <span className="text-[10px] text-gray-400">Klik untuk langsung masuk</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickDemoProfiles.map((p) => (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => {
                      setSuccessMessage(`Otentikasi demo sebagai ${p.role}...`);
                      setTimeout(() => {
                        completeLoginSuccess(p.user, `Demo 1-Click (${p.role})`, 'demo');
                      }, 300);
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.badgeColor}`}>
                        {p.role}
                      </span>
                      <span className="material-symbols-outlined text-[13px] text-gray-500 group-hover:text-white transition-colors">
                        arrow_forward
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-white truncate block">
                      {p.user.name}
                    </span>
                    <span className="text-[9px] text-gray-400 truncate block">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-3 border-t border-white/10 text-center text-[11px] text-gray-500 bg-black/20 z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>&copy; {new Date().getFullYear()} THEUNDERWEARSUPPLY. All rights reserved. Industrial Garment ERP Platform.</span>
        <div className="flex items-center gap-4">
          <span className="hover:text-gray-400 cursor-pointer">Kebijakan Privasi</span>
          <span>•</span>
          <span className="hover:text-gray-400 cursor-pointer">Pedoman Keamanan IT</span>
          <span>•</span>
          <span className="hover:text-gray-400 cursor-pointer">Bantuan Helpdesk</span>
        </div>
      </footer>
    </div>
  );
};
