import { Router } from 'express';
import { twilioCallsController } from './twilio.calls.controller.js';

const router = Router();

// Status callback for voice legs (configure on Twilio Calls.create StatusCallback)
router.post('/voice/status', twilioCallsController.voiceStatus);

router.get('/voice', twilioCallsController.voice);
router.post('/voice', twilioCallsController.voice);

export default router;

