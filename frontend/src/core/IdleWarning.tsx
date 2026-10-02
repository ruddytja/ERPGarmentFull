import { useIdleTimeout } from './session';

/** Peringatan "Sesi akan berakhir dalam 60 detik" (FR-00.2). */
export function IdleWarning() {
  const { secondsLeft, stayLoggedIn } = useIdleTimeout();
  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm bg-white text-[#191c1e] rounded-xl shadow-2xl p-6 text-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <span className="material-symbols-outlined text-[#D97706]" style={{ fontSize: 40 }}>lock_clock</span>
        <h2 className="text-lg font-bold mt-2">Sesi akan berakhir</h2>
        <p className="text-sm text-[#545f73] mt-1">
          Tidak ada aktivitas. Anda akan keluar otomatis dalam <b className="tabular-nums">{secondsLeft}</b> detik.
        </p>
        <button
          onClick={stayLoggedIn}
          className="mt-5 w-full py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#004ac6] text-white text-sm font-semibold cursor-pointer"
        >
          Tetap Masuk
        </button>
      </div>
    </div>
  );
}
