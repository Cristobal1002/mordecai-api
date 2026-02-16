import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { verifyVoiceContextSignature } from './context-signature.js';
import {
  registerCallForInteraction,
  resolveInteractionContext,
} from '../elevenlabs/eleven.service.js';

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildStreamUrl = () => {
  const directUrl = process.env.TWILIO_STREAM_URL;
  if (directUrl) return directUrl;

  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!baseUrl) return null;

  const wsBase = baseUrl.replace(/^http/i, 'ws');
  return `${wsBase}/api/${config.app.apiVersion}/twilio/stream`;
};

const buildVoiceResponse = (streamUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;

const validateSignedInteractionContext = ({ interaction, query }) => {
  const signatureSecret = process.env.CALL_CONTEXT_HMAC_SECRET;
  if (!signatureSecret) return { valid: true };

  const interactionId = query.il || query.interaction_id;
  const signature = query.sig;
  const exp = query.exp;
  const version = query.v || '1';
  const caseId = interaction?.debtCaseId || interaction?.debtCase?.id;

  return verifyVoiceContextSignature({
    interactionId,
    tenantId: interaction?.tenantId,
    caseId,
    exp,
    version,
    signature,
    secret: signatureSecret,
  });
};

const handleElevenRegisterVoice = async (req, res) => {
  const interactionId = req.query.il || req.query.interaction_id;
  if (!interactionId) {
    return res.status(400).json({
      success: false,
      message: 'Missing interaction context. Expected query params: il, exp, v, sig.',
    });
  }

  const interaction = await resolveInteractionContext(interactionId);
  if (!interaction) {
    return res.status(404).json({
      success: false,
      message: `Interaction log not found for id=${interactionId}`,
    });
  }

  const signatureValidation = validateSignedInteractionContext({
    interaction,
    query: req.query || {},
  });
  if (!signatureValidation.valid) {
    logger.warn(
      { interactionId, reason: signatureValidation.reason },
      'Rejected Twilio voice request with invalid context signature'
    );
    return res.status(401).json({
      success: false,
      message: 'Invalid signed interaction context.',
    });
  }

  const callSid = req.body?.CallSid || req.query.call_sid || null;
  const twilioFrom = req.body?.From || null;
  const twilioTo = req.body?.To || interaction?.debtCase?.debtor?.phone || null;

  const { twiml } = await registerCallForInteraction({
    interactionId,
    twilioCallSid: callSid,
    twilioFrom,
    twilioTo,
  });

  res.type('text/xml');
  return res.status(200).send(twiml);
};

export const twilioController = {
  voice: async (req, res, next) => {
    try {
      const engine = (process.env.TWILIO_ENGINE || 'realtime').toLowerCase();
      if (engine === 'eleven_register') {
        return await handleElevenRegisterVoice(req, res);
      }

      const streamUrl = buildStreamUrl();
      if (!streamUrl) {
        return res.status(500).json({
          success: false,
          message: 'Missing TWILIO_STREAM_URL or TWILIO_WEBHOOK_BASE_URL for Twilio streaming.',
        });
      }

      res.type('text/xml');
      return res.status(200).send(buildVoiceResponse(streamUrl));
    } catch (error) {
      logger.error({ error }, 'Twilio voice handler failed');
      return next(error);
    }
  },
};

