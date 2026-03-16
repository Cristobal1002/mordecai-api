import { Router } from 'express';
import { paymentChannelController } from './payment-channel.controller.js';
import {
  listChannelsValidator,
  getChannelValidator,
  createChannelValidator,
  updateChannelValidator,
  deleteChannelValidator,
  seedDefaultsValidator,
} from './payment-channel.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router({ mergeParams: true });

router.get(
  '/:tenantId/payment-channels',
  requireAuth(),
  listChannelsValidator,
  validateRequest,
  paymentChannelController.list
);
router.post(
  '/:tenantId/payment-channels/seed-defaults',
  requireAuth(),
  seedDefaultsValidator,
  validateRequest,
  paymentChannelController.seedDefaults
);
router.get(
  '/:tenantId/payment-channels/:channelId',
  requireAuth(),
  getChannelValidator,
  validateRequest,
  paymentChannelController.getById
);
router.post(
  '/:tenantId/payment-channels',
  requireAuth(),
  createChannelValidator,
  validateRequest,
  paymentChannelController.create
);
router.put(
  '/:tenantId/payment-channels/:channelId',
  requireAuth(),
  updateChannelValidator,
  validateRequest,
  paymentChannelController.update
);
router.delete(
  '/:tenantId/payment-channels/:channelId',
  requireAuth(),
  deleteChannelValidator,
  validateRequest,
  paymentChannelController.delete
);

export default router;
