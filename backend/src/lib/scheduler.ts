// Penjadwal job latar belakang sederhana (setInterval). Job didaftarkan modul
// di src/jobs/*.ts dan dijalankan oleh index.ts. Matikan dengan JOBS_ENABLED=false.
export interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
}

const jobs: Job[] = [];
export const registerJob = (job: Job) => jobs.push(job);

export function startJobs() {
  if (process.env.JOBS_ENABLED === 'false') return;
  for (const job of jobs) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try { await job.run(); } catch (e: any) { console.error(`[job:${job.name}]`, e?.message ?? e); } finally { running = false; }
    };
    setInterval(tick, job.intervalMs).unref();
    console.log(`[jobs] ${job.name} setiap ${Math.round(job.intervalMs / 1000)} dtk`);
  }
}
