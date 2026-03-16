import { Router } from 'express';
import { twilioSmsController } from './twilio.sms.controller.js';

const router = Router();

router.post('/sms-status', twilioSmsController.statusCallback);

export default router;

