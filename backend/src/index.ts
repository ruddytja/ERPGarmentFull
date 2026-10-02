// Server API lokal. Frontend (Vite) mem-proxy /api/* ke sini saat development.
import { app } from './app.ts';
import { isDbConfigured } from './lib/db.ts';
import { startJobs } from './lib/scheduler.ts';

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`[ERP API] berjalan di http://localhost:${PORT}/api/v1`);
  if (isDbConfigured) startJobs();
});
