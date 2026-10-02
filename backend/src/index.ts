import express, { NextFunction, Request, Response } from 'express';
import { isDbConfigured } from './lib/db.ts';
import { errorHandler } from './lib/http.ts';
import { startJobs } from './lib/scheduler.ts';
import { legacyRouter } from './legacy.ts';
import { v1 } from './routes/index.ts';
import './jobs/index.ts';

const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '2mb' }));

// Tanpa konfigurasi database, semua endpoint menjawab 503 agar frontend beralih ke mode demo.
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  if (isDbConfigured) return next();
  res.status(503).json({ error: { code: 'DB_NOT_CONFIGURED', message: 'Database belum dikonfigurasi (.env). Aplikasi berjalan dalam mode demo.', details: {} } });
});

app.get('/api/v1/health', (_req, res) => { res.json({ status: 'OK', time: new Date().toISOString() }); });
app.use('/api/v1', v1);
app.use('/api', legacyRouter);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'ENDPOINT_NOT_FOUND', message: 'Endpoint tidak ditemukan.', details: {} } });
});
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ERP API] berjalan di http://localhost:${PORT}/api/v1`);
  if (isDbConfigured) startJobs();
});
