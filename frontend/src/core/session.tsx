import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { UserAccount } from '../modules/admin/types';
import { Capability, DEFAULT_IDLE_MINUTES, hasCapability } from './rbac';

export type AuthSource = 'database' | 'demo';

export interface Session {
  user: UserAccount;
  source: AuthSource;
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  loginAt: number;
}

interface SessionContextValue {
  session: Session | null;
  user: UserAccount | null;
  login: (session: Omit<Session, 'loginAt'>) => void;
  logout: (reason?: 'manual' | 'idle') => void;
  can: (cap: Capability) => boolean;
  /** Pesan dari logout terakhir (mis. sesi berakhir karena idle) untuk ditampilkan di halaman login. */
  logoutNotice: string | null;
}

const STORAGE_KEY = 'erp_session';
const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);

  const login = useCallback((next: Omit<Session, 'loginAt'>) => {
    const full: Session = { ...next, loginAt: Date.now() };
    setSession(full);
    setLogoutNotice(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {
      // storage penuh / diblokir: sesi tetap berjalan di memori
    }
  }, []);

  const logout = useCallback((reason: 'manual' | 'idle' = 'manual') => {
    setSession(null);
    setLogoutNotice(reason === 'idle' ? 'Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali.' : null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      login,
      logout,
      can: (cap) => hasCapability(session?.user, cap),
      logoutNotice,
    }),
    [session, login, logout, logoutNotice]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession harus dipakai di dalam <SessionProvider>');
  return ctx;
}

/**
 * Auto-logout idle (FR-00.2): peringatan 60 detik sebelum batas, tombol "Tetap Masuk".
 * Batas idle diambil dari akun (erp.session_policies) atau default per role.
 */
export function useIdleTimeout() {
  const { user, logout } = useSession();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  const limitMs = user ? (user.idleTimeoutMinutes || DEFAULT_IDLE_MINUTES[user.role]) * 60_000 : 0;

  const stayLoggedIn = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    lastActivity.current = Date.now();

    const onActivity = () => {
      // Selama peringatan tampil, hanya tombol "Tetap Masuk" yang memperpanjang sesi.
      if (Date.now() - lastActivity.current < limitMs - 60_000) lastActivity.current = Date.now();
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const remaining = limitMs - (Date.now() - lastActivity.current);
      if (remaining <= 0) {
        setSecondsLeft(null);
        logout('idle');
      } else if (remaining <= 60_000) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [user, limitMs, logout]);

  return { secondsLeft, stayLoggedIn };
}
