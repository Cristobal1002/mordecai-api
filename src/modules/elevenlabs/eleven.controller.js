import { logger } from '../../utils/logger.js';
import { saveElevenPostCallPayload } from '../twilio/twilio.storage.js';
import { normalizeElevenPostCallPayload } from './eleven.mapper.js';
import {
  createPaymentAgreementFromTool,
  syncInteractionFromPostCall,
} from './eleven.service.js';
import { verifyElevenLabsWebhook } from './eleven.webhook.js';

const getWebhookSignatureHeader = (req) =>
  req.get('ElevenLabs-Signature') || req.get('elevenlabs-signature') || '';

const getRawBody = (req) => req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

const parseToolPayload = (body) => {
  if (!body || typeof body !== 'object') return {};

  const conversationId =
    body.conversation_id || body.conversationId || body?.data?.conversation_id || null;

  const candidate =
    body.arguments ||
    body.input ||
    body.params ||
    body?.data?.tool_call?.arguments ||
    body?.data?.arguments ||
    body;
  const proposal = candidate.proposal || candidate;

  return {
    conversationId,
    tenantId: candidate.tenant_id || candidate.tenantId || null,
    caseId: candidate.case_id || candidate.caseId || null,
    interactionId: candidate.interaction_id || candidate.interactionId || null,
    automationId:
      candidate.automation_id ||
      candidate.automationId ||
      proposal?.automation_id ||
      proposal?.automationId ||
      null,
    proposal,
  };
};

export const elevenController = {
  postCall: async (req, res) => {
    const signatureHeader = getWebhookSignatureHeader(req);
    const toleranceSeconds =
      Number(process.env.ELEVENLABS_WEBHOOK_TOLERANCE_SEC) ||
      Number(process.env.ELEVENLABS_WEBHOOK_TOLERANCE_SECONDS) ||
      1800;

    const verification = verifyElevenLabsWebhook({
      signatureHeader,
      rawBody: getRawBody(req),
      secret: process.env.ELEVENLABS_WEBHOOK_SECRET,
      toleranceSeconds,
    });

    if (!verification.valid) {
      logger.warn(
        {
          reason: verification.reason,
          hasSignatureHeader: Boolean(signatureHeader),
        },
        'Rejected ElevenLabs post-call webhook'
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid ElevenLabs webhook signature',
      });
    }

    const normalizedPayload = normalizeElevenPostCallPayload(req.body);
    logger.info(
      {
        event: normalizedPayload.event,
        conversationId: normalizedPayload.conversationId,
        callSid: normalizedPayload.callSid,
        interactionId: normalizedPayload.interactionId,
        callDurationSecs: normalizedPayload.callDurationSecs,
        terminationReason: normalizedPayload.terminationReason,
      },
      'Accepted ElevenLabs post-call webhook'
    );

    let s3Key = null;
    try {
      s3Key = await saveElevenPostCallPayload(normalizedPayload);
    } catch (error) {
      logger.error({ error }, 'Failed to save ElevenLabs post-call payload to S3');
    }

    try {
      await syncInteractionFromPostCall({ normalizedPayload, s3Key });
    } catch (error) {
      logger.error({ error }, 'Failed to sync post-call payload to DB');
    }

    return res.status(200).json({
      success: true,
      conversationId: normalizedPayload.conversationId,
      s3Key,
    });
  },

  createPaymentAgreementTool: async (req, res) => {
    const expectedToolSecret = process.env.ELEVENLABS_TOOL_SECRET;
    const providedToolSecret = req.get('x-eleven-tool-secret') || req.get('x-tool-secret');
    if (expectedToolSecret && expectedToolSecret !== providedToolSecret) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_TOOL_SECRET',
        message: 'Invalid tool secret.',
      });
    }

    const parsedPayload = parseToolPayload(req.body);
    if (!parsedPayload.tenantId || !parsedPayload.caseId || !parsedPayload.proposal) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Missing tenant_id, case_id or proposal in tool payload.',
      });
    }

    const result = await createPaymentAgreementFromTool(parsedPayload);
    return res.status(200).json(result);
  },
};

