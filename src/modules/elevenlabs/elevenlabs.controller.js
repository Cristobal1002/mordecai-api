import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { saveElevenPostCallPayload } from '../twilio/twilio.storage.js';

const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 60 * 30;

const parseSignatureHeader = (headerValue) => {
  if (!headerValue) return {};
  return headerValue.split(',').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey || rawValue.length === 0) return acc;
    acc[rawKey.trim()] = rawValue.join('=').trim();
    return acc;
  }, {});
};

const safeCompareHex = (left, right) => {
  if (!left || !right || left.length !== right.length) return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyElevenlabsSignature = (req) => {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }

  const headerValue = req.get('ElevenLabs-Signature') || req.get('elevenlabs-signature');
  const parsedHeader = parseSignatureHeader(headerValue);
  const timestamp = parsedHeader.t || parsedHeader.timestamp;
  const candidates = [parsedHeader.v0, parsedHeader.v1].filter(Boolean);

  if (!timestamp || candidates.length === 0) {
    return { ok: false, reason: 'missing_signature_parts' };
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = Number(process.env.ELEVENLABS_WEBHOOK_TOLERANCE_SECONDS);
  const maxSkewSeconds =
    Number.isFinite(tolerance) && tolerance >= 0
      ? tolerance
      : DEFAULT_SIGNATURE_TOLERANCE_SECONDS;

  if (Math.abs(now - Number(timestamp)) > maxSkewSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const valid = candidates.some((candidate) => safeCompareHex(expectedSignature, candidate));
  if (!valid) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return { ok: true };
};

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
    const verification = verifyElevenlabsSignature(req);
    if (!verification.ok) {
      logger.warn(
        {
          reason: verification.reason,
          hasSignatureHeader: Boolean(
            req.get('ElevenLabs-Signature') || req.get('elevenlabs-signature')
          ),
        },
        'Rejected ElevenLabs post-call webhook'
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid ElevenLabs webhook signature',
      });
    }

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
