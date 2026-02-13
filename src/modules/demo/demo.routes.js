import { Router } from 'express';
import { demoController } from './demo.controller.js';

const router = Router();

router.post('/start-call', demoController.startCall);

export default router;
