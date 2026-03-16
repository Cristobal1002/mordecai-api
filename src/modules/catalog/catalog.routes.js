import { Router } from 'express';
import { catalogController } from './catalog.controller.js';
import {
  createSoftwareValidator,
  getSetupStepsValidator,
  listSoftwaresValidator,
} from './catalog.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// POST /api/v1/catalog/softwares (backoffice; sin auth por ahora)
router.post(
  '/softwares',
  createSoftwareValidator,
  validateRequest,
  catalogController.create
);

// GET /api/v1/catalog/softwares
router.get(
  '/softwares',
  listSoftwaresValidator,
  validateRequest,
  catalogController.listSoftwares
);

// GET /api/v1/catalog/softwares/:softwareKey/setup-steps
router.get(
  '/softwares/:softwareKey/setup-steps',
  getSetupStepsValidator,
  validateRequest,
  catalogController.getSetupSteps
);

export default router;
