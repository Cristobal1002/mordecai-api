import { Router } from 'express';
import { requireAuth } from '../../middlewares/index.js';
import { demoController } from './demo.controller.js';

const router = Router();

router.get('/calls', requireAuth(), demoController.listCalls);
router.post('/start-call', demoController.startCall);
router.post('/start-sms', demoController.startSms);
router.post('/start-email', demoController.startEmail);

export default router;
