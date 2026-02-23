/**
 * Collections Engine v2 - Tick: evaluate active automations, update case states, dispatch channels, create events.
 * Called by a recurring job (e.g. every 15 min).
 */
import { Op } from 'sequelize';
import {
  CollectionAutomation,
  CollectionStrategy,
  CollectionStage,
  CaseAutomationState,
  CollectionEvent,
  DebtCase,
  Debtor,
} from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import {
  addCaseActionJob,
  CASE_ACTION_JOB_TYPES,
} from '../../queues/case-actions.queue.js';

const TICK_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseTimeWindow(windowStr) {
  if (!windowStr || typeof windowStr !== 'string') return null;
  const parts = windowStr.split('-').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const [start, end] = parts.map((p) => {
    const [h, m] = p.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  });
  return { startMinutes: start, endMinutes: end };
}

function isInTimeWindow(now, window) {
  if (!window) return true;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (window.startMinutes <= window.endMinutes) {
    return minutes >= window.startMinutes && minutes <= window.endMinutes;
  }
  return minutes >= window.startMinutes || minutes <= window.endMinutes;
}

const CHANNEL_ORDER = ['call', 'sms', 'email', 'whatsapp'];

const resolveDispatchChannels = (channels = {}) =>
  CHANNEL_ORDER.filter((channel) => channels[channel] === true);

/**
 * Run one tick: process all active automations and their due cases.
 */
export async function runCollectionTick() {
  const now = new Date();
  const automations = await CollectionAutomation.findAll({
    where: { status: 'active' },
    include: [{ model: CollectionStrategy, as: 'strategy', required: true }],
  });

  let totalProcessed = 0;
  let totalEvents = 0;

  for (const automation of automations) {
    try {
      const strategy = automation.strategy;
      const cooldownHours = strategy.cooldownHours ?? 24;
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      const timeWindow = parseTimeWindow(strategy.allowedTimeWindow);
      const maxAttemptsPerWeek = strategy.maxAttemptsPerWeek ?? 999;
      const stopOnPromise = strategy.stopOnPromise !== false;
      const stopOnPayment = strategy.stopOnPayment !== false;

      const dueStates = await CaseAutomationState.findAll({
        where: {
          automationId: automation.id,
          status: 'active',
          nextActionAt: { [Op.lte]: now, [Op.ne]: null },
        },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            include: [{ model: Debtor, as: 'debtor', required: false }],
          },
          {
            model: CollectionStage,
            as: 'currentStage',
            required: false,
          },
        ],
        limit: 100,
      });

      for (const state of dueStates) {
        if (!isInTimeWindow(now, timeWindow)) continue;

        let attemptsWeekCount = state.attemptsWeekCount ?? 0;
        if (state.lastAttemptAt && now - new Date(state.lastAttemptAt) > WEEK_MS) {
          attemptsWeekCount = 0;
        }
        if (attemptsWeekCount >= maxAttemptsPerWeek) continue;

        if (stopOnPromise && state.promiseDueDate) {
          const due = new Date(state.promiseDueDate);
          if (due > now) continue;
        }

        if (state.lastAttemptAt && now - new Date(state.lastAttemptAt) < cooldownMs) continue;

        const nextActionAt = new Date(now.getTime() + cooldownMs);
        const stage = state.currentStage || null;
        const dispatchChannels = resolveDispatchChannels(stage?.channels || {});
        const outcomes = [];

        if (dispatchChannels.length === 0) {
          await CollectionEvent.create({
            automationId: automation.id,
            debtCaseId: state.debtCaseId,
            channel: null,
            eventType: 'dispatch_skipped_no_channel',
            payload: {
              stageId: stage?.id || null,
              channels: stage?.channels || {},
              reason: 'No channel enabled in stage',
            },
          });
          outcomes.push('dispatch_skipped_no_channel');
        } else {
          for (const dispatchChannel of dispatchChannels) {
            if (dispatchChannel === 'call') {
              const jobId = await addCaseActionJob(CASE_ACTION_JOB_TYPES.CALL_CASE, {
                tenantId: automation.tenantId,
                caseId: state.debtCaseId,
                automationId: automation.id,
                stateId: state.id,
              });

              if (!jobId) {
                outcomes.push('call_dispatch_queue_unavailable');
                await CollectionEvent.create({
                  automationId: automation.id,
                  debtCaseId: state.debtCaseId,
                  channel: 'call',
                  eventType: 'call_dispatch_queue_unavailable',
                  payload: {
                    reason: 'REDIS queue unavailable (missing REDIS_URL or queue init failed)',
                  },
                });
              } else {
                outcomes.push('call_queued');
                await CollectionEvent.create({
                  automationId: automation.id,
                  debtCaseId: state.debtCaseId,
                  channel: 'call',
                  eventType: 'call_queued',
                  payload: {
                    jobId,
                  },
                });
              }
              continue;
            }

            if (dispatchChannel === 'sms') {
              const jobId = await addCaseActionJob(CASE_ACTION_JOB_TYPES.SMS_CASE, {
                tenantId: automation.tenantId,
                caseId: state.debtCaseId,
                automationId: automation.id,
                stateId: state.id,
              });

              if (!jobId) {
                outcomes.push('sms_dispatch_queue_unavailable');
                await CollectionEvent.create({
                  automationId: automation.id,
                  debtCaseId: state.debtCaseId,
                  channel: 'sms',
                  eventType: 'sms_dispatch_queue_unavailable',
                  payload: {
                    reason: 'REDIS queue unavailable (missing REDIS_URL or queue init failed)',
                  },
                });
              } else {
                outcomes.push('sms_queued');
                await CollectionEvent.create({
                  automationId: automation.id,
                  debtCaseId: state.debtCaseId,
                  channel: 'sms',
                  eventType: 'sms_queued',
                  payload: {
                    jobId,
                  },
                });
              }
              continue;
            }

            outcomes.push('dispatch_skipped_not_implemented');
            await CollectionEvent.create({
              automationId: automation.id,
              debtCaseId: state.debtCaseId,
              channel: dispatchChannel,
              eventType: 'dispatch_skipped_not_implemented',
              payload: {
                stageId: stage?.id || null,
                reason: `Channel "${dispatchChannel}" not implemented`,
              },
            });
          }
        }

        const outcome =
          outcomes.length > 0 ? outcomes.join(',') : 'tick_eligible';

        await state.update({
          lastAttemptAt: now,
          nextActionAt,
          attemptsWeekCount: attemptsWeekCount + 1,
          lastOutcome: outcome,
          lastOutcomeAt: now,
        });

        totalProcessed++;
        totalEvents += Math.max(outcomes.length, 1);
      }

      await automation.update({
        lastEvaluatedAt: now,
        nextTickAt: new Date(now.getTime() + TICK_INTERVAL_MS),
      });
    } catch (err) {
      logger.error({ err, automationId: automation.id }, 'Collection tick: error processing automation');
    }
  }

  if (totalProcessed > 0) {
    logger.info(
      { totalProcessed, totalEvents, automationsCount: automations.length },
      'Collection tick completed'
    );
  }
  return { processed: totalProcessed, events: totalEvents, automations: automations.length };
}
