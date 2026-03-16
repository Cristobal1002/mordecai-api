import { paymentChannelRepository } from './payment-channel.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { paymentChannelTypeRepository } from '../backoffice/payment-channel-types/payment-channel-type.repository.js';
import { validateConfigAgainstSchema } from './config-validator.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../errors/index.js';

export const paymentChannelService = {
  list: async (tenantId, includeInactive = false) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const [channels, channelTypes] = await Promise.all([
      includeInactive
        ? paymentChannelRepository.findAllByTenant(tenantId)
        : paymentChannelRepository.findByTenant(tenantId),
      paymentChannelTypeRepository.findAll({ where: { isEnabled: true } }),
    ]);

    const byCode = new Map();
    for (const ch of channels) {
      const plain = ch.get ? ch.get({ plain: true }) : ch;
      byCode.set(plain.code, {
        ...plain,
        configSchema: plain.channelType?.configSchema ?? { fields: [] },
      });
    }

    return channelTypes.map((ct) => {
      const existing = byCode.get(ct.code);
      if (existing) return existing;
      return {
        id: null,
        tenantId,
        code: ct.code,
        label: ct.label,
        requiresReconciliation: ct.requiresReconciliation,
        sortOrder: ct.sortOrder,
        config: {},
        configSchema: ct.configSchema ?? { fields: [] },
        isSystemDefault: true,
      };
    });
  },

  getById: async (tenantId, channelId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const channel = await paymentChannelRepository.findById(channelId, tenantId);
    if (!channel) throw new NotFoundError('Payment channel');
    const plain = channel.get ? channel.get({ plain: true }) : channel;
    return {
      ...plain,
      configSchema: plain.channelType?.configSchema ?? { fields: [] },
    };
  },

  create: async (tenantId, data) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    let channelTypeId = data.channelTypeId;
    let code = data.code;
    let label = data.label;
    let requiresReconciliation = data.requiresReconciliation;
    let sortOrder = data.sortOrder;

    if (channelTypeId || code) {
      const ct = channelTypeId
        ? await paymentChannelTypeRepository.findById(channelTypeId)
        : await paymentChannelTypeRepository.findByCode(code);
      if (ct) {
        channelTypeId = ct.id;
        code = ct.code;
        label = label ?? ct.label;
        requiresReconciliation = requiresReconciliation ?? ct.requiresReconciliation;
        sortOrder = sortOrder ?? ct.sortOrder;
      }
    }

    if (!code) throw new ConflictError('code or channelTypeId is required');

    const existing = await paymentChannelRepository.findByCode(tenantId, code);
    if (existing) {
      throw new ConflictError(`Payment channel with code "${code}" already exists`);
    }

    const ctForSchema = channelTypeId
      ? await paymentChannelTypeRepository.findById(channelTypeId)
      : await paymentChannelTypeRepository.findByCode(code);
    const schema = ctForSchema?.configSchema ?? { fields: [] };
    if (data.config !== undefined) {
      const { valid, errors } = validateConfigAgainstSchema(data.config, schema);
      if (!valid) throw new BadRequestError(errors.join('; '));
    }
    if (code === 'transfer' && data.isActive !== false) {
      const banks = data.config?.banks;
      if (!Array.isArray(banks) || banks.length < 1) {
        throw new BadRequestError('Bank transfer channel requires at least one bank account when active');
      }
    }
    if (code === 'zelle' && data.isActive !== false) {
      const recipients = data.config?.recipients;
      if (!Array.isArray(recipients) || recipients.length < 1) {
        throw new BadRequestError('Zelle channel requires at least one recipient when active');
      }
    }
    if (code === 'cash' && data.isActive !== false) {
      const locations = data.config?.locations ?? data.config?.points;
      if (!Array.isArray(locations) || locations.length < 1) {
        throw new BadRequestError('Cash payment channel requires at least one location when active');
      }
    }
    if (code === 'check' && data.isActive !== false) {
      if (!data.config?.payeeName?.trim()) {
        throw new BadRequestError('Check channel requires payee name when active');
      }
      const methods = data.config?.deliveryMethods;
      if (!Array.isArray(methods) || methods.length < 1) {
        throw new BadRequestError('Check channel requires at least one delivery method when active');
      }
    }

    const created = await paymentChannelRepository.create({
      tenantId,
      channelTypeId: channelTypeId ?? null,
      code,
      label: label ?? code,
      requiresReconciliation: requiresReconciliation ?? false,
      instructionsTemplate: data.instructionsTemplate ?? null,
      config: data.config ?? {},
      sortOrder: sortOrder ?? 0,
      isActive: data.isActive !== false,
    });
    const channel = await paymentChannelRepository.findById(created.id, tenantId);
    const plain = channel.get ? channel.get({ plain: true }) : channel;
    return {
      ...plain,
      configSchema: plain.channelType?.configSchema ?? { fields: [] },
    };
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

    if (data.config !== undefined) {
      const schema = existing.channelType?.configSchema ?? { fields: [] };
      const { valid, errors } = validateConfigAgainstSchema(data.config, schema);
      if (!valid) {
        throw new BadRequestError(errors.join('; '));
      }
    }
    // Backend rule: if channel is active, require minimal config
    const willBeActive = data.isActive !== undefined ? data.isActive : existing.isActive;
    const code = data.code ?? existing.code;
    const config = data.config !== undefined ? data.config : existing.config;
    if (willBeActive && code === 'transfer') {
      const banks = config?.banks;
      if (!Array.isArray(banks) || banks.length < 1) {
        throw new BadRequestError('Bank transfer channel requires at least one bank account when active');
      }
    }
    if (willBeActive && code === 'zelle') {
      const recipients = config?.recipients;
      if (!Array.isArray(recipients) || recipients.length < 1) {
        throw new BadRequestError('Zelle channel requires at least one recipient when active');
      }
    }
    if (willBeActive && code === 'cash') {
      const locations = config?.locations ?? config?.points;
      if (!Array.isArray(locations) || locations.length < 1) {
        throw new BadRequestError('Cash payment channel requires at least one location when active');
      }
    }
    if (willBeActive && code === 'check') {
      if (!config?.payeeName?.trim()) {
        throw new BadRequestError('Check channel requires payee name when active');
      }
      const methods = config?.deliveryMethods;
      if (!Array.isArray(methods) || methods.length < 1) {
        throw new BadRequestError('Check channel requires at least one delivery method when active');
      }
    }

    const payload = {};
    if (data.code !== undefined) payload.code = data.code;
    if (data.label !== undefined) payload.label = data.label;
    if (data.requiresReconciliation !== undefined) payload.requiresReconciliation = data.requiresReconciliation;
    if (data.instructionsTemplate !== undefined) payload.instructionsTemplate = data.instructionsTemplate;
    if (data.config !== undefined) payload.config = data.config;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    await paymentChannelRepository.update(channelId, tenantId, payload);
    const channel = await paymentChannelRepository.findById(channelId, tenantId);
    const plain = channel.get ? channel.get({ plain: true }) : channel;
    return {
      ...plain,
      configSchema: plain.channelType?.configSchema ?? { fields: [] },
    };
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

    const channelTypes = await paymentChannelTypeRepository.findAll({ where: { isEnabled: true } });
    const created = [];
    for (const ct of channelTypes) {
      const c = await paymentChannelRepository.create({
        tenantId,
        channelTypeId: ct.id,
        code: ct.code,
        label: ct.label,
        requiresReconciliation: ct.requiresReconciliation,
        config: {},
        sortOrder: ct.sortOrder,
        isActive: true,
      });
      const channel = await paymentChannelRepository.findById(c.id, tenantId);
      const plain = channel.get ? channel.get({ plain: true }) : channel;
      created.push({
        ...plain,
        configSchema: plain.channelType?.configSchema ?? { fields: [] },
      });
    }
    return created;
  },
};
