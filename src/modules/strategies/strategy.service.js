import { strategyRepository } from './strategy.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { sequelize } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';

function rangesOverlap(minA, maxA, minB, maxB) {
  const maxAVal = maxA == null ? Number.POSITIVE_INFINITY : maxA;
  const maxBVal = maxB == null ? Number.POSITIVE_INFINITY : maxB;
  return minA <= maxBVal && minB <= maxAVal;
}

function stagesOverlap(stages, minDays, maxDays, excludeStageId = null) {
  return stages.some((s) => {
    if (excludeStageId && s.id === excludeStageId) return false;
    if (!s.isActive) return false;
    return rangesOverlap(minDays, maxDays, s.minDaysPastDue, s.maxDaysPastDue);
  });
}

export const strategyService = {
  listByTenant: async (tenantId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');
    return await strategyRepository.findByTenant(tenantId);
  },

  getById: async (tenantId, strategyId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');
    const strategy = await strategyRepository.findById(strategyId, tenantId);
    if (!strategy) throw new NotFoundError('Strategy');
    return strategy;
  },

  create: async (tenantId, data) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    return await strategyRepository.create({
      tenantId,
      name: data.name,
      description: data.description ?? null,
      isActive: data.isActive !== false,
      globalRules: data.globalRules ?? {},
      maxAttemptsPerWeek: data.maxAttemptsPerWeek ?? null,
      cooldownHours: data.cooldownHours ?? null,
      allowedTimeWindow: data.allowedTimeWindow ?? null,
      stopOnPromise: data.stopOnPromise !== false,
      stopOnPayment: data.stopOnPayment !== false,
    });
  },

  update: async (tenantId, strategyId, data) => {
    const existing = await strategyRepository.findById(strategyId, tenantId);
    if (!existing) throw new NotFoundError('Strategy');

    const payload = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.globalRules !== undefined) payload.globalRules = data.globalRules;
    if (data.maxAttemptsPerWeek !== undefined) payload.maxAttemptsPerWeek = data.maxAttemptsPerWeek;
    if (data.cooldownHours !== undefined) payload.cooldownHours = data.cooldownHours;
    if (data.allowedTimeWindow !== undefined) payload.allowedTimeWindow = data.allowedTimeWindow;
    if (data.stopOnPromise !== undefined) payload.stopOnPromise = data.stopOnPromise;
    if (data.stopOnPayment !== undefined) payload.stopOnPayment = data.stopOnPayment;

    await strategyRepository.update(strategyId, tenantId, payload);
    return await strategyRepository.findById(strategyId, tenantId);
  },

  createStage: async (tenantId, strategyId, data) => {
    const strategy = await strategyRepository.findById(strategyId, tenantId);
    if (!strategy) throw new NotFoundError('Strategy');

    const minDays = Number(data.minDaysPastDue);
    const maxDays = data.maxDaysPastDue == null ? null : Number(data.maxDaysPastDue);
    if (maxDays != null && maxDays < minDays) {
      throw new ConflictError('maxDaysPastDue must be >= minDaysPastDue');
    }

    const existingStages = await strategyRepository.findStagesByStrategyId(strategyId);
    if (stagesOverlap(existingStages, minDays, maxDays)) {
      throw new ConflictError('Stage range overlaps with an existing stage in this strategy');
    }

    return await sequelize.transaction(async (t) => {
      return await strategyRepository.createStage(
        {
          strategyId,
          name: data.name,
          minDaysPastDue: minDays,
          maxDaysPastDue: maxDays,
          channels: data.channels ?? {},
          messagingConfig: data.messagingConfig ?? {},
          tone: data.tone ?? 'professional',
          rules: data.rules ?? {},
          isActive: true,
        },
        { transaction: t }
      );
    });
  },

  updateStage: async (tenantId, strategyId, stageId, data) => {
    const strategy = await strategyRepository.findById(strategyId, tenantId);
    if (!strategy) throw new NotFoundError('Strategy');

    const stage = await strategyRepository.findStageById(stageId);
    if (!stage || stage.strategyId !== strategyId) throw new NotFoundError('Stage');

    const minDays = data.minDaysPastDue != null ? Number(data.minDaysPastDue) : stage.minDaysPastDue;
    const maxDays =
      data.maxDaysPastDue !== undefined && data.maxDaysPastDue !== null
        ? Number(data.maxDaysPastDue)
        : stage.maxDaysPastDue;
    if (maxDays != null && maxDays < minDays) {
      throw new ConflictError('maxDaysPastDue must be >= minDaysPastDue');
    }

    const existingStages = await strategyRepository.findStagesByStrategyId(strategyId);
    if (stagesOverlap(existingStages, minDays, maxDays, stageId)) {
      throw new ConflictError('Stage range overlaps with an existing stage in this strategy');
    }

    const payload = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.minDaysPastDue !== undefined) payload.minDaysPastDue = minDays;
    if (data.maxDaysPastDue !== undefined) payload.maxDaysPastDue = maxDays;
    if (data.channels !== undefined) payload.channels = data.channels;
    if (data.messagingConfig !== undefined) payload.messagingConfig = data.messagingConfig;
    if (data.tone !== undefined) payload.tone = data.tone;
    if (data.rules !== undefined) payload.rules = data.rules;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    await strategyRepository.updateStage(stageId, payload);
    return await strategyRepository.findStageById(stageId);
  },

  deleteStage: async (tenantId, strategyId, stageId) => {
    const strategy = await strategyRepository.findById(strategyId, tenantId);
    if (!strategy) throw new NotFoundError('Strategy');

    const stage = await strategyRepository.findStageById(stageId);
    if (!stage || stage.strategyId !== strategyId) throw new NotFoundError('Stage');

    const count = await strategyRepository.softDeleteStage(stageId);
    if (count === 0) throw new NotFoundError('Stage');
    return { deleted: true, stageId };
  },
};
