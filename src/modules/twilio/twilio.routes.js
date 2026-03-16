import { Router } from 'express';
import twilioCallsRoutes from './calls/twilio.calls.routes.js';
import twilioSmsRoutes from './sms/twilio.sms.routes.js';

const router = Router();

router.use('/', twilioCallsRoutes);
router.use('/', twilioSmsRoutes);

export default router;
