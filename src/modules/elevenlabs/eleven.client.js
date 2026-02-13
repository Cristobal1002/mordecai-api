import axios from 'axios';

const ELEVEN_BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
const REGISTER_CALL_PATH =
  process.env.ELEVENLABS_REGISTER_CALL_PATH || '/v1/convai/twilio/register-call';

const getApiKey = () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY env var');
  }
  return apiKey;
};

const extractTwiml = (payload) => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('<Response')) return trimmed;

    try {
      const parsed = JSON.parse(trimmed);
      return extractTwiml(parsed);
    } catch (_error) {
      return null;
    }
  }

  if (typeof payload === 'object') {
    return (
      payload.twiml ||
      payload.twiML ||
      payload.response ||
      payload?.data?.twiml ||
      payload?.data?.twiML ||
      null
    );
  }

  return null;
};

export const registerTwilioCallInElevenLabs = async (payload) => {
  const response = await axios.post(`${ELEVEN_BASE_URL}${REGISTER_CALL_PATH}`, payload, {
    headers: {
      'xi-api-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    timeout: Number(process.env.ELEVENLABS_HTTP_TIMEOUT_MS) || 15000,
    responseType: 'text',
  });

  const twiml = extractTwiml(response.data);
  if (!twiml) {
    throw new Error('ElevenLabs register-call response did not include TwiML');
  }

  return twiml;
};

