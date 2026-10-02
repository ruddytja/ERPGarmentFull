import React, { Suspense, lazy, useEffect } from 'react';
import { LoginPage } from './core/auth/LoginPage';
import { IdleWarning } from './core/IdleWarning';
import { ModuleFrame } from './core/ModuleFrame';
import { allowedModules, landingPath, ModuleId, moduleForPath } from './core/rbac';
import { usePathname } from './core/router';
import { useSession } from './core/session';
import { initialUsers } from './modules/admin/data/mockData';

// Tiap modul di-load terpisah (code-splitting): user hanya mengunduh modul role-nya.
const MODULE_COMPONENTS: Record<ModuleId, React.LazyExoticComponent<() => React.JSX.Element>> = {
  admin: lazy(() => import('./modules/admin/App')),
  founder: lazy(() => import('./modules/founder/App')),
  finance: lazy(() => import('./modules/finance/App')),
  supervisor: lazy(() => import('./modules/supervisor/App')),
  kiosk: lazy(() => import('./modules/kiosk/App')),
  qc: lazy(() => import('./modules/qc/App')),
  packing: lazy(() => import('./modules/packing/App')),
};

function ModuleLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c131f] text-gray-300 text-xs gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Memuat modul…
    </div>
  );
}

export default function App() {
  const { user, login, logoutNotice } = useSession();
  const { pathname, navigate } = usePathname();

  const requested = moduleForPath(pathname);
  const allowed = user ? allowedModules(user) : [];
  // URL di luar hak akses role → arahkan ke landing page role (menu terkunci = tidak bisa dibuka).
  const active: ModuleId | null = user ? (requested && allowed.includes(requested) ? requested : allowed[0] ?? null) : null;

  useEffect(() => {
    if (!user) {
      if (pathname !== '/login') navigate('/login', { replace: true });
    } else if (active && moduleForPath(pathname) !== active) {
      navigate(landingPath(user), { replace: true });
    }
  }, [user, active, pathname, navigate]);

  if (!user) {
    return (
      <ModuleFrame id="login">
        <LoginPage
          users={initialUsers}
          currentShift="Shift 1"
          notice={logoutNotice}
          onLogin={(u, source, shift) => {
            login({ user: u, source, shift });
            navigate(landingPath(u), { replace: true });
          }}
        />
      </ModuleFrame>
    );
  }

  if (!active) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[#545f73]">
        Role {user.role} belum memiliki modul yang dapat diakses. Hubungi Admin.
      </div>
    );
  }

  const ActiveModule = MODULE_COMPONENTS[active];
  return (
    <ModuleFrame id={active}>
      <Suspense fallback={<ModuleLoading />}>
        {/* key: state modul di-reset saat user berganti */}
        <ActiveModule key={`${active}:${user.id}`} />
      </Suspense>
      <IdleWarning />
    </ModuleFrame>
  );
}
