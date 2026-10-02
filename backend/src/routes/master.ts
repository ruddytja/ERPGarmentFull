// FR-01.1–01.5 — brands, skus, routing, boms, operations, samples, machines, lookups
import express from 'express';
import { lookupsRouter } from './master/lookups.ts';
import { skusRouter } from './master/skus.ts';
import { operationsRouter } from './master/operations.ts';
import { bomsRouter } from './master/boms.ts';
import { samplesRouter } from './master/samples.ts';
import { machinesRouter } from './master/machines.ts';

export const masterRouter = express.Router();

masterRouter.use(lookupsRouter);    // materials, suppliers, customers, sales-channels, production-lines
masterRouter.use(skusRouter);       // FR-01.3 brands & skus, FR-01.2 routing
masterRouter.use(operationsRouter); // FR-01.2 operations & piece rates
masterRouter.use(bomsRouter);       // FR-01.1 BOM
masterRouter.use(samplesRouter);    // FR-01.4 samples
masterRouter.use(machinesRouter);   // FR-01.5 machines
