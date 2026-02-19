/**
 * Collections Engine v2 - Tick: evaluate active automations, update case states, create events.
 * Called by a recurring job (e.g. every 15 min). Does not send channels yet; only state + events.
 */
import { Op } from 'sequelize';
import {
  CollectionAutomation,
  CollectionStrategy,
  CaseAutomationState,
  CollectionEvent,
} from '../../models/index.js';
import { logger } from '../../utils/logger.js';

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
        await state.update({
          lastAttemptAt: now,
          nextActionAt,
          attemptsWeekCount: attemptsWeekCount + 1,
          lastOutcome: 'tick_eligible',
          lastOutcomeAt: now,
        });

        await CollectionEvent.create({
          automationId: automation.id,
          debtCaseId: state.debtCaseId,
          channel: null,
          eventType: 'scheduled',
          payload: {
            nextActionAt: nextActionAt.toISOString(),
            attemptsWeekCount: attemptsWeekCount + 1,
          },
        });

        totalProcessed++;
        totalEvents++;
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
