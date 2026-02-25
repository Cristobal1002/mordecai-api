import { TenantMessageTemplate, TenantMessageAttachment } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const templateRepository = {
  // Message templates
  findTemplatesByTenant: async (tenantId, options = {}) => {
    try {
      return await TenantMessageTemplate.findAll({
        where: { tenantId },
        order: [['channel', 'ASC'], ['name', 'ASC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding message templates');
      throw error;
    }
  },

  findTemplateById: async (id, tenantId, options = {}) => {
    try {
      return await TenantMessageTemplate.findOne({
        where: { id, tenantId },
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error finding message template');
      throw error;
    }
  },

  createTemplate: async (data, options = {}) => {
    try {
      return await TenantMessageTemplate.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating message template');
      throw error;
    }
  },

  updateTemplate: async (id, tenantId, data, options = {}) => {
    try {
      const [count] = await TenantMessageTemplate.update(data, {
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating message template');
      throw error;
    }
  },

  deleteTemplate: async (id, tenantId, options = {}) => {
    try {
      const count = await TenantMessageTemplate.destroy({
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error deleting message template');
      throw error;
    }
  },

  // Attachments
  findAttachmentsByTenant: async (tenantId, options = {}) => {
    try {
      return await TenantMessageAttachment.findAll({
        where: { tenantId },
        order: [['name', 'ASC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding message attachments');
      throw error;
    }
  },

  findAttachmentById: async (id, tenantId, options = {}) => {
    try {
      return await TenantMessageAttachment.findOne({
        where: { id, tenantId },
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error finding message attachment');
      throw error;
    }
  },

  createAttachment: async (data, options = {}) => {
    try {
      return await TenantMessageAttachment.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating message attachment');
      throw error;
    }
  },

  updateAttachment: async (id, tenantId, data, options = {}) => {
    try {
      const [count] = await TenantMessageAttachment.update(data, {
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating message attachment');
      throw error;
    }
  },

  deleteAttachment: async (id, tenantId, options = {}) => {
    try {
      const count = await TenantMessageAttachment.destroy({
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error deleting message attachment');
      throw error;
    }
  },
};
