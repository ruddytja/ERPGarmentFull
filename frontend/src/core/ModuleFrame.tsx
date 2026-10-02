import React, { useLayoutEffect } from 'react';
import { MODULES, ModuleId } from './rbac';

/**
 * Menandai modul aktif di <html data-module>, agar tema & aturan CSS per modul
 * (styles/modules.css) hanya berlaku pada modul tersebut — termasuk modal/portal.
 */
export function ModuleFrame({ id, children }: { id: ModuleId | 'login'; children: React.ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.module = id;
    document.title = id === 'login' ? 'Masuk | THEUNDERWEARSUPPLY ERP' : `${MODULES[id].title} | THEUNDERWEARSUPPLY ERP`;
    return () => {
      delete root.dataset.module;
    };
  }, [id]);

  return <>{children}</>;
}
