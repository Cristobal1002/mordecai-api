/**
 * Backoffice routes - NO AUTH (internal/admin use)
 * Payment channel types: create, update, delete channel types for the catalog.
 */
import { Router } from 'express';
import { paymentChannelTypeController } from './payment-channel-type.controller.js';
import {
  listTypesValidator,
  getTypeValidator,
  createTypeValidator,
  updateTypeValidator,
  deleteTypeValidator,
} from './payment-channel-type.validator.js';
import { validateRequest } from '../../../middlewares/validate-request.middleware.js';

const router = Router();

router.get('/', listTypesValidator, validateRequest, paymentChannelTypeController.list);
router.get('/:id', getTypeValidator, validateRequest, paymentChannelTypeController.getById);
router.post('/', createTypeValidator, validateRequest, paymentChannelTypeController.create);
router.put('/:id', updateTypeValidator, validateRequest, paymentChannelTypeController.update);
router.delete('/:id', deleteTypeValidator, validateRequest, paymentChannelTypeController.delete);

export default router;
