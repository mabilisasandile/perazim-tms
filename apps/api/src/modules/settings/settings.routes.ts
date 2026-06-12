import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { settingsService } from './settings.service';

const router = Router();
router.use(authenticate);
router.get('/',         async (_req, res, next) => { try { res.json(await settingsService.get()); } catch(e) { next(e); } });
router.put('/',         async (req,  res, next) => { try { res.json(await settingsService.update(req.body)); } catch(e) { next(e); } });
router.get('/smtp',     async (_req, res, next) => { try { res.json(await settingsService.getSmtp()); } catch(e) { next(e); } });
router.put('/smtp',     async (req,  res, next) => { try { res.json(await settingsService.updateSmtp(req.body)); } catch(e) { next(e); } });
router.post('/smtp/test', async (_req, res, next) => { try { res.json(await settingsService.testSmtp()); } catch(e) { next(e); } });
export default router;
