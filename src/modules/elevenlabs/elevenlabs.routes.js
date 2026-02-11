import { Router } from 'express';
import { elevenlabsController } from './elevenlabs.controller.js';

const router = Router();

// POST /api/v1/eleven/post-call
// Receives ElevenLabs post-call webhook payload.
router.post('/post-call', elevenlabsController.postCall);

export default router;

