import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { registerTwilioCallWithElevenLabs } from './elevenlabs.client.js';

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

const resolveEngine = () => (process.env.TWILIO_ENGINE || 'realtime').toLowerCase();

const pickNumber = (req, key, fallback = null) =>
  req.body?.[key] || req.query?.[key] || fallback;

const pickValue = (req, keys, fallback = null) => {
  for (const key of keys) {
    const value = req.body?.[key] ?? req.query?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
};

const resolveDirection = (value) =>
  String(value || 'outbound-api').toLowerCase().includes('inbound')
    ? 'inbound'
    : 'outbound';

const buildCallContext = (req) => {
  // Temporary source: request params/query + env fallback.
  // Next step: resolve by case_id/debtor_id from DB.
  return {
    customerName: pickValue(
      req,
      ['customer_name', 'debtor_name', 'name'],
      process.env.TWILIO_DEBTOR_NAME || process.env.DEBTOR_NAME || 'Andres Cristobal Sosa'
    ),
    balanceAmount: pickValue(
      req,
      ['balance_amount', 'balance', 'amount_due'],
      process.env.TWILIO_BALANCE_AMOUNT || '5000'
    ),
    tenantId: pickValue(req, ['tenant_id'], process.env.TWILIO_TENANT_ID || ''),
    caseId: pickValue(req, ['case_id', 'debtor_id'], ''),
  };
};

const buildElevenDynamicVariables = (req) => {
  const context = buildCallContext(req);
  return {
    customer_name: context.customerName,
    balance_amount: context.balanceAmount,
    tenant_id: context.tenantId,
    case_id: context.caseId,
    call_sid: req.body?.CallSid || '',
  };
};

const buildElevenRegisterParams = (req) => ({
  apiKey: process.env.ELEVENLABS_API_KEY,
  agentId: process.env.ELEVENLABS_AGENT_ID,
  fromNumber: pickNumber(req, 'From', process.env.TWILIO_FROM_NUMBER || null),
  toNumber: pickNumber(
    req,
    'To',
    process.env.TWILIO_TO_NUMBER || process.env.TWILIO_TO || null
  ),
  callSid: req.body?.CallSid || null,
  direction: resolveDirection(req.body?.Direction || req.query?.Direction),
  dynamicVariables: buildElevenDynamicVariables(req),
});

const ensureElevenConfig = (params) => {
  const missing = [];
  if (!params.apiKey) missing.push('ELEVENLABS_API_KEY');
  if (!params.agentId) missing.push('ELEVENLABS_AGENT_ID');
  if (!params.fromNumber) missing.push('From/TWILIO_FROM_NUMBER');
  if (!params.toNumber) missing.push('To/TWILIO_TO_NUMBER');
  return missing;
};

const buildVoiceResponse = (streamUrl) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;
};

export const twilioController = {
  voice: async (req, res) => {
    const engine = resolveEngine();

    if (engine === 'eleven_register') {
      const params = buildElevenRegisterParams(req);
      const missing = ensureElevenConfig(params);
      if (missing.length > 0) {
        return res.status(500).json({
          success: false,
          message: `Missing configuration for ElevenLabs engine: ${missing.join(
            ', '
          )}`,
        });
      }

      try {
        const twiml = await registerTwilioCallWithElevenLabs(params);
        res.type('text/xml');
        return res.status(200).send(twiml);
      } catch (error) {
        logger.error(
          {
            err: error,
            errorMessage: error?.message,
            status: error?.response?.status,
            elevenData: error?.response?.data,
          },
          'Failed to register Twilio call with ElevenLabs'
        );
        return res.status(502).json({
          success: false,
          message: 'Failed to obtain TwiML from ElevenLabs register_call.',
        });
      }
    }

    const streamUrl = buildStreamUrl();
    if (!streamUrl) {
      return res.status(500).json({
        success: false,
        message:
          'Missing TWILIO_STREAM_URL or TWILIO_WEBHOOK_BASE_URL for Twilio streaming.',
      });
    }

    res.type('text/xml');
    return res.status(200).send(buildVoiceResponse(streamUrl));
  },
};
