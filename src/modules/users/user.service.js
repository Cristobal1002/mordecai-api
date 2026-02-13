import { User, TenantUser, Tenant } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const userService = {
  findByCognitoSub: async (cognitoSub, transaction) => {
    const options = transaction ? { transaction } : undefined;
    return await User.findOne({ where: { cognitoSub }, ...options });
  },

  findByEmail: async (email, transaction) => {
    const options = transaction ? { transaction } : undefined;
    return await User.findOne({ where: { email }, ...options });
  },

  createFromAuth: async (identity, transaction) => {
    const options = transaction ? { transaction } : undefined;
    return await User.create(
      {
        cognitoSub: identity.sub,
        email: identity.email,
        fullName: identity.fullName || null,
        phone: identity.phone || null,
        status: 'active',
      },
      options
    );
  },

  ensureUserFromAuth: async (identity, transaction) => {
    if (!identity) {
      return null;
    }

    const options = transaction ? { transaction } : undefined;
    let existing = null;

    if (identity.email) {
      existing = await userService.findByEmail(identity.email, transaction);
    }
    if (!existing && identity.sub) {
      existing = await userService.findByCognitoSub(identity.sub, transaction);
    }

    if (existing) {
      const updates = {};
      if (
        identity.fullName &&
        (!existing.fullName || String(existing.fullName).trim() === '')
      ) {
        updates.fullName = identity.fullName.trim();
      }
      if (
        identity.phone &&
        (!existing.phone || String(existing.phone).trim() === '')
      ) {
        updates.phone = identity.phone.trim();
      }
      logger.info(
        { identity, existingFullName: existing.fullName, existingPhone: existing.phone, updates },
        '[User] ensureUserFromAuth: existing user, updates'
      );
      if (Object.keys(updates).length > 0) {
        await existing.update(updates, options);
      }
      return existing;
    }

    logger.info({ identity }, '[User] ensureUserFromAuth: creating new user');
    return await userService.createFromAuth(identity, transaction);
  },

  getUserByAuth: async (identity, transaction) => {
    if (!identity) {
      return null;
    }

    const options = transaction ? { transaction } : undefined;

    if (identity.sub) {
      const bySub = await User.findOne({
        where: { cognitoSub: identity.sub },
        ...options,
      });
      if (bySub) {
        return bySub;
      }
    }

    if (identity.email) {
      return await User.findOne({ where: { email: identity.email }, ...options });
    }

    return null;
  },

  listMemberships: async (userId, transaction) => {
    if (!userId) {
      return [];
    }
    const options = transaction ? { transaction } : undefined;
    return await TenantUser.findAll({
      where: { userId, status: 'active' },
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
      ...options,
    });
  },

  countActiveMemberships: async (userId, transaction) => {
    const options = transaction ? { transaction } : undefined;
    return await TenantUser.count({
      where: { userId, status: 'active' },
      ...options,
    });
  },

  updateProfile: async (identity, data) => {
    const user = await userService.getUserByAuth(identity);
    if (!user) return null;

    const updates = {};
    if (data.fullName !== undefined && String(data.fullName).trim()) {
      updates.fullName = data.fullName.trim();
    }
    if (data.phone !== undefined) {
      updates.phone = data.phone ? String(data.phone).trim() : null;
    }

    if (Object.keys(updates).length === 0) return user;
    await user.update(updates);
    return user;
  },
};
