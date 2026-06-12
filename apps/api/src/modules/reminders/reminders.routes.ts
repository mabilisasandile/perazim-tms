import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { remindersService } from './reminders.service';
import { z } from 'zod';

const createSchema = z.object({
  vehicleId:   z.coerce.number().int().positive().optional(),
  title:       z.string().min(1),
  description: z.string().optional(),
  dueDate:     z.string().min(1),
});

const router = Router();
router.use(authenticate);
router.get('/',           async (req,  res, next) => { try { res.json(await remindersService.findAll(req.query.unread === 'true')); } catch(e) { next(e); } });
router.post('/',          async (req,  res, next) => { try { res.status(201).json(await remindersService.create(createSchema.parse(req.body))); } catch(e) { next(e); } });
router.patch('/:id/read', async (req,  res, next) => { try { res.json(await remindersService.markRead(+req.params.id)); } catch(e) { next(e); } });
router.delete('/:id',     async (req,  res, next) => { try { await remindersService.remove(+req.params.id); res.json({ message: 'Reminder deleted' }); } catch(e) { next(e); } });
export default router;
