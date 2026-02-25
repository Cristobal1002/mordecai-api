import { Router } from 'express';
import { templateController } from './template.controller.js';
import {
  listTemplatesValidator,
  getTemplateValidator,
  createTemplateValidator,
  updateTemplateValidator,
  deleteTemplateValidator,
  listAttachmentsValidator,
  getAttachmentValidator,
  createAttachmentValidator,
  updateAttachmentValidator,
  deleteAttachmentValidator,
} from './template.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router({ mergeParams: true });

// Templates
router.get(
  '/:tenantId/templates',
  requireAuth(),
  listTemplatesValidator,
  validateRequest,
  templateController.listTemplates
);
router.get(
  '/:tenantId/templates/:templateId',
  requireAuth(),
  getTemplateValidator,
  validateRequest,
  templateController.getTemplate
);
router.post(
  '/:tenantId/templates',
  requireAuth(),
  createTemplateValidator,
  validateRequest,
  templateController.createTemplate
);
router.put(
  '/:tenantId/templates/:templateId',
  requireAuth(),
  updateTemplateValidator,
  validateRequest,
  templateController.updateTemplate
);
router.delete(
  '/:tenantId/templates/:templateId',
  requireAuth(),
  deleteTemplateValidator,
  validateRequest,
  templateController.deleteTemplate
);

// Attachments (must be before /:templateId to avoid "attachments" matching templateId)
router.get(
  '/:tenantId/attachments',
  requireAuth(),
  listAttachmentsValidator,
  validateRequest,
  templateController.listAttachments
);
router.get(
  '/:tenantId/attachments/:attachmentId',
  requireAuth(),
  getAttachmentValidator,
  validateRequest,
  templateController.getAttachment
);
router.post(
  '/:tenantId/attachments',
  requireAuth(),
  createAttachmentValidator,
  validateRequest,
  templateController.createAttachment
);
router.put(
  '/:tenantId/attachments/:attachmentId',
  requireAuth(),
  updateAttachmentValidator,
  validateRequest,
  templateController.updateAttachment
);
router.delete(
  '/:tenantId/attachments/:attachmentId',
  requireAuth(),
  deleteAttachmentValidator,
  validateRequest,
  templateController.deleteAttachment
);

export default router;
