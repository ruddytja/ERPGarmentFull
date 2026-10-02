// Aplikasi Express (tanpa listen) — dipakai server lokal (index.ts) dan Vercel (vercel.ts).
import express, { NextFunction, Request, Response } from 'express';
import { isDbConfigured } from './lib/db.ts';
import { ah, errorHandler, forbidden, notFound } from './lib/http.ts';
import { jobNames, runJob } from './lib/scheduler.ts';
import { legacyRouter } from './legacy.ts';
import { v1 } from './routes/index.ts';
import './jobs/index.ts';

export const app = express();
app.disable('x-powered-by');
// Di Vercel request melewati proxy platform; lokal hanya percaya loopback
app.set('trust proxy', process.env.VERCEL ? true : 'loopback');
app.use(express.json({ limit: '2mb' }));

// Tanpa konfigurasi database, semua endpoint menjawab 503 agar frontend beralih ke mode demo.
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  if (isDbConfigured) return next();
  res.status(503).json({ error: { code: 'DB_NOT_CONFIGURED', message: 'Database belum dikonfigurasi (.env). Aplikasi berjalan dalam mode demo.', details: {} } });
});

app.get('/api/v1/health', (_req, res) => { res.json({ status: 'OK', time: new Date().toISOString() }); });

// Pemicu job latar belakang untuk lingkungan tanpa proses permanen (Vercel Cron / cron eksternal).
// Wajib header Authorization: Bearer <CRON_SECRET>.
app.get('/api/v1/internal/cron/:job', ah(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) throw forbidden('Token cron tidak valid.');
  const out = await runJob(req.params.job);
  if (!out) throw notFound(`Job tidak dikenal. Tersedia: ${jobNames().join(', ')}.`, 'JOB_NOT_FOUND');
  res.json({ status: 'OK', job: req.params.job, ...out });
}));

app.use('/api/v1', v1);
app.use('/api', legacyRouter);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'ENDPOINT_NOT_FOUND', message: 'Endpoint tidak ditemukan.', details: {} } });
});
app.use(errorHandler);
