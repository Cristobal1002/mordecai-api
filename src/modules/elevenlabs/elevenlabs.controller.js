import { logger } from '../../utils/logger.js';
import { saveElevenPostCallPayload } from '../twilio/twilio.storage.js';

const normalizeTranscript = (rawTranscript) => {
  if (!rawTranscript) return null;
  if (typeof rawTranscript === 'string') return rawTranscript;
  if (Array.isArray(rawTranscript)) return rawTranscript;
  if (Array.isArray(rawTranscript?.messages)) return rawTranscript.messages;
  if (Array.isArray(rawTranscript?.turns)) return rawTranscript.turns;
  return rawTranscript;
};

const buildNormalizedPayload = (req) => {
  const body = req.body || {};
  const data = body?.data || {};
  const event = body?.type || body?.event || data?.type || data?.event || null;
  const metadata = data?.metadata || body?.metadata || {};

  return {
    source: 'elevenlabs',
    event,
    receivedAt: new Date().toISOString(),
    conversationId:
      data?.conversation_id ||
      data?.conversationId ||
      body?.conversation_id ||
      body?.conversationId ||
      null,
    callSid:
      metadata?.call_sid ||
      metadata?.callSid ||
      data?.call_sid ||
      data?.callSid ||
      body?.call_sid ||
      body?.callSid ||
      null,
    agentId: data?.agent_id || data?.agentId || body?.agent_id || body?.agentId || null,
    tenantId: metadata?.tenant_id || metadata?.tenantId || data?.tenant_id || null,
    caseId: metadata?.case_id || metadata?.caseId || data?.case_id || null,
    dynamicVariables:
      data?.dynamic_variables ||
      data?.dynamicVariables ||
      metadata?.dynamic_variables ||
      {},
    summary: data?.summary || body?.summary || null,
    transcript: normalizeTranscript(
      data?.transcript ||
        data?.conversation_transcript ||
        body?.transcript ||
        body?.conversation_transcript
    ),
    raw: body,
  };
};

export const elevenlabsController = {
  postCall: async (req, res) => {
    const normalized = buildNormalizedPayload(req);

    try {
      const key = await saveElevenPostCallPayload(normalized);
      return res.status(200).json({
        success: true,
        message: 'ElevenLabs post-call webhook received',
        key,
      });
    } catch (error) {
      logger.error(
        { err: error, errorMessage: error?.message },
        'Failed to persist ElevenLabs post-call webhook'
      );
      return res.status(500).json({
        success: false,
        message: 'Failed to persist ElevenLabs post-call webhook.',
      });
    }
  },
};

