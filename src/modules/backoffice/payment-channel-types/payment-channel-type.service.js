import { paymentChannelTypeRepository } from './payment-channel-type.repository.js';
import { NotFoundError, ConflictError } from '../../../errors/index.js';

export const paymentChannelTypeService = {
  list: async (includeDisabled = false) => {
    const where = includeDisabled ? {} : { isEnabled: true };
    return await paymentChannelTypeRepository.findAll({ where });
  },

  getById: async (id) => {
    const type = await paymentChannelTypeRepository.findById(id);
    if (!type) throw new NotFoundError('Payment channel type');
    return type;
  },

  getByCode: async (code) => {
    const type = await paymentChannelTypeRepository.findByCode(code);
    if (!type) throw new NotFoundError('Payment channel type');
    return type;
  },

  create: async (data) => {
    const existing = await paymentChannelTypeRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictError(`Payment channel type with code "${data.code}" already exists`);
    }

    return await paymentChannelTypeRepository.create({
      code: data.code,
      label: data.label,
      requiresReconciliation: data.requiresReconciliation ?? false,
      sortOrder: data.sortOrder ?? 0,
      configSchema: data.configSchema ?? { fields: [] },
      isEnabled: data.isEnabled !== false,
    });
  },

  update: async (id, data) => {
    const existing = await paymentChannelTypeRepository.findById(id);
    if (!existing) throw new NotFoundError('Payment channel type');

    if (data.code !== undefined && data.code !== existing.code) {
      const byCode = await paymentChannelTypeRepository.findByCode(data.code);
      if (byCode && byCode.id !== id) {
        throw new ConflictError(`Payment channel type with code "${data.code}" already exists`);
      }
    }

    const payload = {};
    if (data.code !== undefined) payload.code = data.code;
    if (data.label !== undefined) payload.label = data.label;
    if (data.requiresReconciliation !== undefined) payload.requiresReconciliation = data.requiresReconciliation;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.configSchema !== undefined) payload.configSchema = data.configSchema;
    if (data.isEnabled !== undefined) payload.isEnabled = data.isEnabled;

    await paymentChannelTypeRepository.update(id, payload);
    return await paymentChannelTypeRepository.findById(id);
  },

  delete: async (id) => {
    const existing = await paymentChannelTypeRepository.findById(id);
    if (!existing) throw new NotFoundError('Payment channel type');

    await paymentChannelTypeRepository.delete(id);
    return { deleted: true, id };
  },
};
