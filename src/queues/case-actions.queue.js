import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';

export const CASE_ACTIONS_QUEUE = 'case-actions';

export const JOB_TYPES = {
  CALL_CASE: 'CALL_CASE',
};

export const caseActionsQueue = new Queue(CASE_ACTIONS_QUEUE, {
  connection: redisConnection,
});
