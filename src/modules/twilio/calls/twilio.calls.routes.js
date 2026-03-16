import { Router } from 'express';
import { twilioCallsController } from './twilio.calls.controller.js';

const router = Router();

router.get('/voice', twilioCallsController.voice);
router.post('/voice', twilioCallsController.voice);

export default router;

