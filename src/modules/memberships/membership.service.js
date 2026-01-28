import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  Tenant,
  TenantUser,
  TenantInvitation,
  User,
} from '../../models/index.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../errors/index.js';
import { sequelize } from '../../config/database.js';
import { getAuthIdentity } from '../../utils/auth-identity.js';
import { userService } from '../users/user.service.js';

const enforceSingleTenant = process.env.ENFORCE_SINGLE_TENANT !== 'false';

const ensureTenantExists = async (tenantId, transaction) => {
  const options = transaction ? { transaction } : undefined;
  const tenant = await Tenant.findByPk(tenantId, options);
  if (!tenant) {
    throw new NotFoundError('Tenant');
  }
  return tenant;
};

const getMembership = async (tenantId, userId, transaction) => {
  const options = transaction ? { transaction } : undefined;
  return await TenantUser.findOne({
    where: { tenantId, userId },
    ...options,
  });
};

const requireAdminRole = async (tenantId, userId) => {
  const membership = await getMembership(tenantId, userId);
  if (!membership || membership.status !== 'active') {
    throw new ForbiddenError('You are not a member of this tenant.');
  }
  if (!['owner', 'admin'].includes(membership.role)) {
    throw new ForbiddenError('Admin privileges required.');
  }
  return membership;
};

const enforceSingleTenantRule = async (userId, tenantId, transaction) => {
  if (!enforceSingleTenant) {
    return;
  }

  const count = await TenantUser.count({
    where: {
      userId,
      status: 'active',
      ...(tenantId ? { tenantId: { [Op.ne]: tenantId } } : {}),
    },
    transaction,
  });

  if (count > 0) {
    throw new ConflictError('User already belongs to another tenant.');
  }
};

const promoteReplacementOwner = async (tenantId, currentOwnerId, transaction) => {
  const options = transaction ? { transaction } : undefined;
  const replacement = await TenantUser.findOne({
    where: {
      tenantId,
      userId: { [Op.ne]: currentOwnerId },
      status: 'active',
    },
    order: [
      ['role', 'ASC'],
      ['created_at', 'ASC'],
    ],
    ...options,
  });

  if (!replacement) {
    throw new BadRequestError('Owner cannot leave without another member.');
  }

  // Prefer admin over member
  const admin = await TenantUser.findOne({
    where: {
      tenantId,
      userId: { [Op.ne]: currentOwnerId },
      status: 'active',
      role: 'admin',
    },
    ...options,
  });

  const nextOwner = admin || replacement;
  await nextOwner.update({ role: 'owner' }, options);
  return nextOwner;
};

export const membershipService = {
  listMembers: async (tenantId, req) => {
    const identity = getAuthIdentity(req);
    if (!identity.sub) {
      throw new ForbiddenError('Unauthorized');
    }

    const user = await userService.ensureUserFromAuth(identity);
    await requireAdminRole(tenantId, user.id);

    const members = await TenantUser.findAll({
      where: { tenantId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'status'],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    return members;
  },

  inviteMember: async (tenantId, data, req) => {
    const identity = getAuthIdentity(req);
    if (!identity.sub) {
      throw new ForbiddenError('Unauthorized');
    }

    const requester = await userService.ensureUserFromAuth(identity);
    await requireAdminRole(tenantId, requester.id);
    await ensureTenantExists(tenantId);

    const email = String(data.email).trim().toLowerCase();
    const role = data.role || 'member';

    if (role === 'owner') {
      throw new BadRequestError('Cannot invite owner.');
    }

    const existingInvite = await TenantInvitation.findOne({
      where: {
        tenantId,
        email,
        status: 'pending',
      },
    });
    if (existingInvite) {
      return existingInvite;
    }

    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      const existingMembership = await getMembership(tenantId, existingUser.id);
      if (existingMembership) {
        throw new ConflictError('User is already a member of this tenant.');
      }

      await enforceSingleTenantRule(existingUser.id, tenantId);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return await TenantInvitation.create({
      tenantId,
      email,
      role,
      token,
      status: 'pending',
      expiresAt,
      createdBy: requester.id,
    });
  },

  acceptInvitation: async (token, req) => {
    const identity = getAuthIdentity(req);
    if (!identity.sub) {
      throw new ForbiddenError('Unauthorized');
    }

    const invitation = await TenantInvitation.findOne({
      where: { token, status: 'pending' },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await invitation.update({ status: 'expired' });
      throw new BadRequestError('Invitation expired.');
    }

    if (
      identity.email &&
      identity.email.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      throw new ForbiddenError('Invitation does not match your email.');
    }

    return await sequelize.transaction(async (transaction) => {
      const user = await userService.ensureUserFromAuth(identity, transaction);
      await enforceSingleTenantRule(user.id, invitation.tenantId, transaction);

      const existing = await getMembership(
        invitation.tenantId,
        user.id,
        transaction
      );

      if (existing) {
        if (existing.status !== 'active') {
          await existing.update({ status: 'active' }, { transaction });
        }
      } else {
        await TenantUser.create(
          {
            tenantId: invitation.tenantId,
            userId: user.id,
            role: invitation.role,
            status: 'active',
          },
          { transaction }
        );
      }

      await invitation.update({ status: 'accepted' }, { transaction });
      return { accepted: true, tenantId: invitation.tenantId };
    });
  },

  updateMember: async (tenantId, userId, data, req) => {
    const identity = getAuthIdentity(req);
    const requester = await userService.ensureUserFromAuth(identity);
    const requesterMembership = await requireAdminRole(tenantId, requester.id);

    const membership = await getMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundError('Membership');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenError('Owner role cannot be changed.');
    }

    if (data.role && data.role === 'owner') {
      throw new BadRequestError('Cannot assign owner role.');
    }

    if (requesterMembership.role !== 'owner' && data.role === 'admin') {
      throw new ForbiddenError('Only owner can grant admin role.');
    }

    const updates = {};
    if (data.role) {
      updates.role = data.role;
    }
    if (data.status) {
      updates.status = data.status;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestError('No changes provided.');
    }

    await membership.update(updates);
    return membership;
  },

  removeMember: async (tenantId, userId, req) => {
    const identity = getAuthIdentity(req);
    const requester = await userService.ensureUserFromAuth(identity);
    const requesterMembership = await requireAdminRole(tenantId, requester.id);

    const membership = await getMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundError('Membership');
    }

    if (membership.role === 'owner') {
      if (requesterMembership.userId !== membership.userId) {
        throw new ForbiddenError('Only the owner can remove themselves.');
      }

      await sequelize.transaction(async (transaction) => {
        await promoteReplacementOwner(tenantId, membership.userId, transaction);
        await membership.destroy({ transaction });
      });

      return { removed: true, ownershipTransferred: true };
    }

    if (requesterMembership.role !== 'owner' && membership.role === 'admin') {
      throw new ForbiddenError('Only owner can remove an admin.');
    }

    await membership.destroy();
    return { removed: true };
  },
};
