// FR-03.1, 03.2, 03.4, FR-04.1–04.3 — work-orders, cutting, bundles, wip, downtime
// Implementasi dipecah per fitur di ./production/*.ts
import express from 'express';
import { workOrdersRouter } from './production/workOrders.ts';
import { cuttingRouter } from './production/cutting.ts';
import { bundlesRouter } from './production/bundles.ts';
import { wipRouter } from './production/wip.ts';
import { downtimeRouter } from './production/downtime.ts';

export const productionRouter = express.Router();

productionRouter.use(workOrdersRouter); // FR-03.1 SPK
productionRouter.use(cuttingRouter); // FR-03.2 Cutting & laporan yield
productionRouter.use(bundlesRouter); // FR-03.4 Bundel & label QR
productionRouter.use(wipRouter); // FR-04.1 Scan kios WIP
productionRouter.use(downtimeRouter); // FR-04.2/04.3 Downtime & spare part
