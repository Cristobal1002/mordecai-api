import { flowPolicyRepository } from './flow-policy.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { sequelize } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../errors/index.js';

const rangesOverlap = (minA, maxA, minB, maxB) => {
  const maxAValue = maxA === null || maxA === undefined ? Number.POSITIVE_INFINITY : maxA;
  const maxBValue = maxB === null || maxB === undefined ? Number.POSITIVE_INFINITY : maxB;
  return minA <= maxBValue && minB <= maxAValue;
};

export const flowPolicyService = {
  listByTenant: async (tenantId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    return await flowPolicyRepository.findByTenant(tenantId);
  },

  create: async (tenantId, data) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    const minDaysPastDue = Number(data.minDaysPastDue);
    const maxDaysPastDue =
      data.maxDaysPastDue === null || data.maxDaysPastDue === undefined
        ? null
        : Number(data.maxDaysPastDue);

    return await sequelize.transaction(async (transaction) => {
      const existingPolicies = await flowPolicyRepository.findByTenant(tenantId, transaction);

      if (
        maxDaysPastDue === null &&
        existingPolicies.some((policy) => policy.maxDaysPastDue === null)
      ) {
        throw new ConflictError('Only one open-ended policy is allowed for this tenant');
      }

      const hasOverlap = existingPolicies.some((policy) =>
        rangesOverlap(
          minDaysPastDue,
          maxDaysPastDue,
          policy.minDaysPastDue,
          policy.maxDaysPastDue
        )
      );

      if (hasOverlap) {
        throw new ConflictError('Flow policy range overlaps with an existing policy');
      }

      return await flowPolicyRepository.create(
        {
          tenantId,
          name: data.name,
          minDaysPastDue,
          maxDaysPastDue,
          channels: data.channels,
          tone: data.tone,
          rules: data.rules,
          isActive: data.isActive,
        },
        transaction
      );
    });
  },
};
