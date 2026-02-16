import { Router } from 'express';
import { requireAuth } from '../../middlewares/index.js';
import { demoController } from './demo.controller.js';

const router = Router();

router.get('/calls', requireAuth(), demoController.listCalls);
router.post('/start-call', demoController.startCall);

export default router;
