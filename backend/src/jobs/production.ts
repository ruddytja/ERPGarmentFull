// FR-04.2 — Eskalasi tiket downtime yang tidak direspons teknisi > 15 menit (setting downtime_escalation_minutes)
import { withTx } from '../lib/db.ts';
import { registerJob } from '../lib/scheduler.ts';

registerJob({
  name: 'downtime-escalation',
  intervalMs: 60_000,
  run: async () => {
    const n = await withTx(null, async (c) => (await c.query(`SELECT erp.fn_escalate_downtime() AS n`)).rows[0].n);
    if (n > 0) console.log(`[job:downtime-escalation] ${n} tiket dieskalasi ke Supervisor`);
    return n;
  },
});
