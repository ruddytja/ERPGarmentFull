// Entry serverless function Vercel: seluruh /api/* ditangani app Express.
// Job latar belakang tidak berjalan di sini — picu lewat /api/v1/internal/cron/:job.
import { app } from './app.ts';

export default app;
