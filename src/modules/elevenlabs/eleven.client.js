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

const looksLikeTwiml = (value) =>
  typeof value === 'string' && /<Response[\s>]/i.test(String(value).trim());

const findTwimlInObject = (payload, depth = 0) => {
  if (!payload || depth > 5) return null;

  if (typeof payload === 'string') {
    return extractTwiml(payload);
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findTwimlInObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload !== 'object') return null;

  const preferredKeys = [
    'twiml',
    'twiML',
    'twilio_twiml',
    'twiml_response',
    'xml',
    'response',
    'body',
    'data',
  ];

  for (const key of preferredKeys) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if (looksLikeTwiml(value)) return String(value).trim();
    const nested = findTwimlInObject(value, depth + 1);
    if (nested) return nested;
  }

  for (const value of Object.values(payload)) {
    if (looksLikeTwiml(value)) return String(value).trim();
    const nested = findTwimlInObject(value, depth + 1);
    if (nested) return nested;
  }

  return null;
};

const extractTwiml = (payload) => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    // ElevenLabs can return raw TwiML with optional XML declaration.
    // Accept both `<Response...>` and `<?xml ...?><Response...>`.
    if (looksLikeTwiml(trimmed)) return trimmed;

    try {
      const parsed = JSON.parse(trimmed);
      return extractTwiml(parsed);
    } catch (_error) {
      return null;
    }
  }

  if (typeof payload === 'object') {
    return findTwimlInObject(payload);
  }

  return null;
};

export const registerTwilioCallInElevenLabs = async (payload) => {
  let response;
  try {
    response = await axios.post(`${ELEVEN_BASE_URL}${REGISTER_CALL_PATH}`, payload, {
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.ELEVENLABS_HTTP_TIMEOUT_MS) || 15000,
      responseType: 'text',
    });
  } catch (error) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    const details =
      typeof body === 'string'
        ? body.slice(0, 1000)
        : JSON.stringify(body || {}).slice(0, 1000);
    throw new Error(
      `ElevenLabs register-call failed${status ? ` (${status})` : ''}: ${details}`
    );
  }

  const twiml = extractTwiml(response.data);
  if (!twiml) {
    const contentType =
      response?.headers?.['content-type'] || response?.headers?.['Content-Type'] || 'unknown';
    const bodyPreview =
      typeof response?.data === 'string'
        ? response.data.slice(0, 1000)
        : JSON.stringify(response?.data || {}).slice(0, 1000);
    throw new Error(
      `ElevenLabs register-call response did not include TwiML (status=${response?.status}, content-type=${contentType}). Body preview: ${bodyPreview}`
    );
  }

  return twiml;
};

