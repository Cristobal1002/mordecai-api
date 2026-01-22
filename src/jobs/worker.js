import { Worker } from 'bullmq';
import { loadDatabase } from '../loaders/sequelize.load.js';
import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { redisConnection } from '../queues/redis.js';
import { CASE_ACTIONS_QUEUE, JOB_TYPES } from '../queues/case-actions.queue.js';
import { DebtCase, Debtor, FlowPolicy, InteractionLog } from '../models/index.js';

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;
const cooldownMinutes = Number(process.env.WORKER_COOLDOWN_MINUTES) || 360;

const processCallCase = async ({ tenantId, caseId }) => {
  const debtCase = await DebtCase.findOne({
    where: { id: caseId, tenantId },
    include: [
      { model: Debtor, as: 'debtor' },
      { model: FlowPolicy, as: 'flowPolicy' },
    ],
  });

  if (!debtCase) {
    throw new Error('Debt case not found');
  }

  const now = new Date();
  const nextActionAt = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

  const transaction = await sequelize.transaction();
  try {
    const log = await InteractionLog.create(
      {
        tenantId,
        debtCaseId: debtCase.id,
        debtorId: debtCase.debtorId,
        type: 'CALL',
        status: 'queued',
        startedAt: now,
      },
      { transaction }
    );

    await log.update(
      {
        status: 'completed',
        outcome: 'NO_ANSWER',
        endedAt: now,
      },
      { transaction }
    );

    await debtCase.update(
      {
        status: 'IN_PROGRESS',
        lastContactedAt: now,
        nextActionAt,
      },
      { transaction }
    );

    await transaction.commit();

    return { caseId: debtCase.id, logId: log.id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const start = async () => {
  await loadDatabase();

  if (!sequelize) {
    logger.warn('Worker aborted: database is not initialized.');
    return;
  }

  const worker = new Worker(
    CASE_ACTIONS_QUEUE,
    async (job) => {
      if (job.name === JOB_TYPES.CALL_CASE) {
        return processCallCase(job.data);
      }
      logger.warn({ jobName: job.name }, 'Unknown job type received');
      return null;
    },
    {
      connection: redisConnection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Job failed');
  });

  const shutdown = async () => {
    logger.info('Worker shutting down');
    await worker.close();
    await redisConnection.quit();
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((error) => {
  logger.error({ error }, 'Worker failed to start');
  process.exit(1);
});
