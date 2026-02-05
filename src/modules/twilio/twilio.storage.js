import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger.js';

const getS3Client = () => {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error('Missing AWS_REGION env var');
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const config = { region };
  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey };
  }

  return new S3Client(config);
};

const getBucketName = () => {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing S3_BUCKET_NAME env var');
  }
  return bucket;
};

const buildCallSummaryKey = (callSid, startedAt) => {
  const safeCallSid = callSid || 'unknown-call';
  const timestamp = startedAt
    ? new Date(startedAt).toISOString().replace(/[:.]/g, '-')
    : new Date().toISOString().replace(/[:.]/g, '-');
  return `twilio/calls/${safeCallSid}/summary-${timestamp}.json`;
};

export const saveTwilioCallSummary = async (payload) => {
  const bucket = getBucketName();
  const s3Client = getS3Client();
  const key = buildCallSummaryKey(payload.callSid, payload.startedAt);
  const body = JSON.stringify(payload, null, 2);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );

  logger.info({ key, callSid: payload.callSid }, 'Twilio call summary saved to S3');
  return key;
};
