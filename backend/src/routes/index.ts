// Router /api/v1 — semua endpoint FRD. Semua route di bawah authenticate kecuali /auth publik.
import express from 'express';
import { authenticate } from '../lib/auth.ts';
import { authRouter, kioskAuthRouter } from './auth.ts';
import { adminRouter } from './admin.ts';
import { masterRouter } from './master.ts';
import { inventoryRouter } from './inventory.ts';
import { productionRouter } from './production.ts';
import { qualityRouter } from './quality.ts';
import { fulfillmentRouter } from './fulfillment.ts';
import { financeRouter } from './finance.ts';
import { reportsRouter } from './reports.ts';

export const v1 = express.Router();

v1.use('/auth', authRouter);
v1.use('/kiosk', kioskAuthRouter);

// Polling/SSE notifikasi tidak boleh memperpanjang sesi idle (FR-00.2)
v1.use(['/notifications/stream', '/notifications/unread-count'], (req, _res, next) => { req.headers['x-passive'] = '1'; next(); });
v1.use(authenticate);
v1.use(adminRouter);
v1.use(masterRouter);
v1.use(inventoryRouter);
v1.use(productionRouter);
v1.use(qualityRouter);
v1.use(fulfillmentRouter);
v1.use(financeRouter);
v1.use(reportsRouter);
