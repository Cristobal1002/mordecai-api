import { Router } from 'express';
import { twilioController } from './twilio.controller.js';

const router = Router();

// GET/POST /api/v1/twilio/voice
// Temporary TwiML response for initial call testing.
router.get('/voice', twilioController.voice);
router.post('/voice', twilioController.voice);

export default router;
