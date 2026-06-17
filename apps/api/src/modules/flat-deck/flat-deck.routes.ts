import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { flatDeckService } from './flat-deck.service';
import {
  createJobSchema, updateJobSchema, updateJobStatusSchema,
  createRouteSchema, updateRouteSchema,
  compatibilityCheckSchema,
} from './flat-deck.schema';

const router = Router();
router.use(authenticate);

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try { res.json(await flatDeckService.getStats()); } catch (e) { next(e); }
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────
router.get('/jobs', async (req, res, next) => {
  try {
    const { status, trailerType } = req.query;
    res.json(await flatDeckService.findAllJobs({
      status:      status as string | undefined,
      trailerType: trailerType as string | undefined,
    }));
  } catch (e) { next(e); }
});
router.get('/jobs/:id',   async (req, res, next) => { try { res.json(await flatDeckService.findJobById(+req.params.id)); } catch (e) { next(e); } });
router.post('/jobs',      async (req, res, next) => { try { res.status(201).json(await flatDeckService.createJob(createJobSchema.parse(req.body))); } catch (e) { next(e); } });
router.put('/jobs/:id',   async (req, res, next) => { try { res.json(await flatDeckService.updateJob(+req.params.id, updateJobSchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/jobs/:id', async (req, res, next) => { try { await flatDeckService.deleteJob(+req.params.id); res.json({ message: 'Job deleted' }); } catch (e) { next(e); } });
router.patch('/jobs/:id/status', async (req, res, next) => {
  try { res.json(await flatDeckService.updateJobStatus(+req.params.id, updateJobStatusSchema.parse(req.body))); } catch (e) { next(e); }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get('/routes',      async (_req, res, next) => { try { res.json(await flatDeckService.findAllRoutes()); } catch (e) { next(e); } });
router.get('/routes/:id',  async (req,  res, next) => { try { res.json(await flatDeckService.findRouteById(+req.params.id)); } catch (e) { next(e); } });
router.post('/routes',     async (req,  res, next) => { try { res.status(201).json(await flatDeckService.createRoute(createRouteSchema.parse(req.body))); } catch (e) { next(e); } });
router.put('/routes/:id',  async (req,  res, next) => { try { res.json(await flatDeckService.updateRoute(+req.params.id, updateRouteSchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/routes/:id', async (req, res, next) => { try { await flatDeckService.deleteRoute(+req.params.id); res.json({ message: 'Route deleted' }); } catch (e) { next(e); } });

// ─── Compatibility check ──────────────────────────────────────────────────────
router.post('/compatibility', async (req, res, next) => {
  try { res.json(await flatDeckService.checkCompatibility(compatibilityCheckSchema.parse(req.body))); } catch (e) { next(e); }
});

export default router;
