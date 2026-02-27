/**
 * Backoffice routes - NO AUTH
 * Internal/admin endpoints for catalog management.
 */
import { Router } from 'express';
import paymentChannelTypeRoutes from './payment-channel-types/payment-channel-type.routes.js';

const router = Router();

router.use('/payment-channel-types', paymentChannelTypeRoutes);

export default router;
