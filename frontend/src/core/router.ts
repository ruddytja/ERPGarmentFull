import { useCallback, useEffect, useState } from 'react';

/** Router minimal berbasis History API — cukup untuk memetakan URL ke modul per role. */
export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    if (replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setPathname(to);
  }, []);

  return { pathname, navigate };
}
