import { Router } from 'express';
import { elevenController } from './eleven.controller.js';

const router = Router();

router.post('/post-call', elevenController.postCall);
router.post('/tools/create-payment-agreement', elevenController.createPaymentAgreementTool);

export default router;

