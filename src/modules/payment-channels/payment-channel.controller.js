import { paymentChannelService } from './payment-channel.service.js';

export const paymentChannelController = {
  list: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const includeInactive = req.query.includeInactive === 'true';
      const result = await paymentChannelService.list(tenantId, includeInactive);
      res.ok(result, 'Payment channels retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { tenantId, channelId } = req.params;
      const result = await paymentChannelService.getById(tenantId, channelId);
      res.ok(result, 'Payment channel retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await paymentChannelService.create(tenantId, req.body);
      res.created(result, 'Payment channel created successfully');
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const { tenantId, channelId } = req.params;
      const result = await paymentChannelService.update(tenantId, channelId, req.body);
      res.ok(result, 'Payment channel updated successfully');
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const { tenantId, channelId } = req.params;
      const result = await paymentChannelService.delete(tenantId, channelId);
      res.ok(result, 'Payment channel deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  seedDefaults: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await paymentChannelService.seedDefaults(tenantId);
      res.ok(result, 'Default payment channels seeded successfully');
    } catch (error) {
      next(error);
    }
  },
};
