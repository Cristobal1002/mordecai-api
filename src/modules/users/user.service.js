import { User, TenantUser } from '../../models/index.js';

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
    const existing = await userService.findByCognitoSub(
      identity.sub,
      transaction
    );
    if (existing) {
      return existing;
    }
    return await userService.createFromAuth(identity, transaction);
  },

  countActiveMemberships: async (userId, transaction) => {
    const options = transaction ? { transaction } : undefined;
    return await TenantUser.count({
      where: { userId, status: 'active' },
      ...options,
    });
  },
};
