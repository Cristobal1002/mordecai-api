import { paymentChannelRepository } from './payment-channel.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';

const DEFAULT_CHANNELS = [
  { code: 'link', label: 'Payment link', requiresReconciliation: false, sortOrder: 0 },
  { code: 'card', label: 'Debit/credit card', requiresReconciliation: false, sortOrder: 1 },
  { code: 'transfer', label: 'Bank transfer', requiresReconciliation: true, sortOrder: 2 },
  { code: 'zelle', label: 'Zelle', requiresReconciliation: true, sortOrder: 3 },
  { code: 'cash', label: 'Cash (physical point)', requiresReconciliation: true, sortOrder: 4 },
];

export const paymentChannelService = {
  list: async (tenantId, includeInactive = false) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const channels = includeInactive
      ? await paymentChannelRepository.findAllByTenant(tenantId)
      : await paymentChannelRepository.findByTenant(tenantId);

    if (channels.length === 0) {
      return DEFAULT_CHANNELS.map((c) => ({ ...c, id: null, tenantId, isSystemDefault: true }));
    }
    return channels;
  },

  getById: async (tenantId, channelId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const channel = await paymentChannelRepository.findById(channelId, tenantId);
    if (!channel) throw new NotFoundError('Payment channel');
    return channel;
  },

  create: async (tenantId, data) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const existing = await paymentChannelRepository.findByCode(tenantId, data.code);
    if (existing) {
      throw new ConflictError(`Payment channel with code "${data.code}" already exists`);
    }

    return await paymentChannelRepository.create({
      tenantId,
      code: data.code,
      label: data.label,
      requiresReconciliation: data.requiresReconciliation ?? false,
      instructionsTemplate: data.instructionsTemplate ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== false,
    });
  },

  update: async (tenantId, channelId, data) => {
    const existing = await paymentChannelRepository.findById(channelId, tenantId);
    if (!existing) throw new NotFoundError('Payment channel');

    if (data.code !== undefined && data.code !== existing.code) {
      const byCode = await paymentChannelRepository.findByCode(tenantId, data.code);
      if (byCode && byCode.id !== channelId) {
        throw new ConflictError(`Payment channel with code "${data.code}" already exists`);
      }
    }

    const payload = {};
    if (data.code !== undefined) payload.code = data.code;
    if (data.label !== undefined) payload.label = data.label;
    if (data.requiresReconciliation !== undefined) payload.requiresReconciliation = data.requiresReconciliation;
    if (data.instructionsTemplate !== undefined) payload.instructionsTemplate = data.instructionsTemplate;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    await paymentChannelRepository.update(channelId, tenantId, payload);
    return await paymentChannelRepository.findById(channelId, tenantId);
  },

  delete: async (tenantId, channelId) => {
    const existing = await paymentChannelRepository.findById(channelId, tenantId);
    if (!existing) throw new NotFoundError('Payment channel');

    await paymentChannelRepository.delete(channelId, tenantId);
    return { deleted: true, channelId };
  },

  seedDefaults: async (tenantId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const existing = await paymentChannelRepository.findByTenant(tenantId);
    if (existing.length > 0) return existing;

    const created = [];
    for (const ch of DEFAULT_CHANNELS) {
      const c = await paymentChannelRepository.create({
        tenantId,
        code: ch.code,
        label: ch.label,
        requiresReconciliation: ch.requiresReconciliation,
        sortOrder: ch.sortOrder,
        isActive: true,
      });
      created.push(c);
    }
    return created;
  },
};
