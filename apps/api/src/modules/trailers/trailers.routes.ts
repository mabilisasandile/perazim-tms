import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { trailersService } from './trailers.service';
import { createTrailerSchema, updateTrailerSchema } from './trailers.schema';

const router = Router();
router.use(authenticate);
router.get('/',       async (_req, res, next) => { try { res.json(await trailersService.findAll()); } catch(e) { next(e); } });
router.get('/:id',    async (req,  res, next) => { try { res.json(await trailersService.findById(+req.params.id)); } catch(e) { next(e); } });
router.post('/',      async (req,  res, next) => { try { res.status(201).json(await trailersService.create(createTrailerSchema.parse(req.body))); } catch(e) { next(e); } });
router.put('/:id',    async (req,  res, next) => { try { res.json(await trailersService.update(+req.params.id, updateTrailerSchema.parse(req.body))); } catch(e) { next(e); } });
router.delete('/:id', async (req,  res, next) => { try { await trailersService.remove(+req.params.id); res.json({ message: 'Trailer deleted' }); } catch(e) { next(e); } });
export default router;
