import { paymentChannelTypeService } from './payment-channel-type.service.js';

export const paymentChannelTypeController = {
  list: async (req, res, next) => {
    try {
      const includeDisabled = req.query.includeDisabled === 'true';
      const result = await paymentChannelTypeService.list(includeDisabled);
      res.ok(result, 'Payment channel types retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await paymentChannelTypeService.getById(id);
      res.ok(result, 'Payment channel type retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const result = await paymentChannelTypeService.create(req.body);
      res.created(result, 'Payment channel type created successfully');
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await paymentChannelTypeService.update(id, req.body);
      res.ok(result, 'Payment channel type updated successfully');
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      await paymentChannelTypeService.delete(id);
      res.ok({ deleted: true, id }, 'Payment channel type deleted successfully');
    } catch (error) {
      next(error);
    }
  },
};
