import { config } from '../../config/index.js';

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

const buildVoiceResponse = (streamUrl, greeting) => {
  const greetingBlock = greeting
    ? `<Say voice="alice">${escapeXml(greeting)}</Say>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingBlock}
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;
};

export const twilioController = {
  voice: (_req, res) => {
    const streamUrl = buildStreamUrl();
    if (!streamUrl) {
      return res.status(500).json({
        success: false,
        message:
          'Missing TWILIO_STREAM_URL or TWILIO_WEBHOOK_BASE_URL for Twilio streaming.',
      });
    }

    const greeting =
      process.env.TWILIO_VOICE_GREETING ||
      process.env.TWILIO_VOICE_TEST_MESSAGE ||
      '';

    res.type('text/xml');
    return res.status(200).send(buildVoiceResponse(streamUrl, greeting));
  },
};
