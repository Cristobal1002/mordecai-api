import { templateService } from './template.service.js';

export const templateController = {
  listTemplates: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { channel } = req.query;
      const result = await templateService.listTemplates(tenantId, channel);
      res.ok(result, 'Templates retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getTemplate: async (req, res, next) => {
    try {
      const { tenantId, templateId } = req.params;
      const result = await templateService.getTemplate(tenantId, templateId);
      res.ok(result, 'Template retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  createTemplate: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await templateService.createTemplate(tenantId, req.body);
      res.created(result, 'Template created successfully');
    } catch (error) {
      next(error);
    }
  },

  updateTemplate: async (req, res, next) => {
    try {
      const { tenantId, templateId } = req.params;
      const result = await templateService.updateTemplate(tenantId, templateId, req.body);
      res.ok(result, 'Template updated successfully');
    } catch (error) {
      next(error);
    }
  },

  deleteTemplate: async (req, res, next) => {
    try {
      const { tenantId, templateId } = req.params;
      const result = await templateService.deleteTemplate(tenantId, templateId);
      res.ok(result, 'Template deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  listAttachments: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await templateService.listAttachments(tenantId);
      res.ok(result, 'Attachments retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getAttachment: async (req, res, next) => {
    try {
      const { tenantId, attachmentId } = req.params;
      const result = await templateService.getAttachment(tenantId, attachmentId);
      res.ok(result, 'Attachment retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  createAttachment: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await templateService.createAttachment(tenantId, req.body);
      res.created(result, 'Attachment created successfully');
    } catch (error) {
      next(error);
    }
  },

  updateAttachment: async (req, res, next) => {
    try {
      const { tenantId, attachmentId } = req.params;
      const result = await templateService.updateAttachment(tenantId, attachmentId, req.body);
      res.ok(result, 'Attachment updated successfully');
    } catch (error) {
      next(error);
    }
  },

  deleteAttachment: async (req, res, next) => {
    try {
      const { tenantId, attachmentId } = req.params;
      const result = await templateService.deleteAttachment(tenantId, attachmentId);
      res.ok(result, 'Attachment deleted successfully');
    } catch (error) {
      next(error);
    }
  },
};
