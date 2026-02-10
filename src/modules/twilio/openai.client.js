import { logger } from '../../utils/logger.js';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';

const getApiKey = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  return key;
};

const buildHeaders = () => ({
  Authorization: `Bearer ${getApiKey()}`,
});

const parseSseStream = async (stream, onEvent) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const debug = process.env.OPENAI_STREAM_DEBUG === 'true';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');

    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      if (!chunk) continue;

      const lines = chunk.split('\n');
      let eventType = null;
      const dataLines = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice('event:'.length).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }

      const payload = dataLines.join('\n');
      if (!payload) continue;
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload);
        if (!parsed.type && eventType) {
          parsed.type = eventType;
        }
        if (debug && parsed?.type) {
          logger.debug({ type: parsed.type }, 'OpenAI stream event');
        }
        await onEvent(parsed);
      } catch (error) {
        logger.warn({ error, payload }, 'Failed to parse SSE payload');
      }
    }
  }
};

export const transcribeAudio = async (wavBuffer, options) => {
  const model = options?.model || 'gpt-4o-transcribe';
  const language = options?.language;
  const prompt = options?.prompt;
  const stream = options?.stream === true;

  const formData = new FormData();
  formData.append('model', model);
  formData.append('response_format', 'json');
  if (stream) formData.append('stream', 'true');
  if (language) formData.append('language', language);
  if (prompt) formData.append('prompt', prompt);
  formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');

  const response = await fetch(`${OPENAI_BASE_URL}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${errorBody}`);
  }

  if (stream) {
    if (!response.body) {
      throw new Error('Transcription stream is empty');
    }
    let transcript = '';
    await parseSseStream(response.body, async (event) => {
      if (event.type === 'transcript.text.delta') {
        transcript += event.delta || '';
      }
      if (event.type === 'transcript.text.done') {
        transcript += event.text || '';
      }
    });
    return transcript;
  }

  const json = await response.json();
  return json.text || '';
};

export const streamChatResponse = async (payload, onDelta) => {
  const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM response failed: ${response.status} ${errorBody}`);
  }

  if (!response.body) {
    throw new Error('LLM response stream is empty');
  }

  let hasOutput = false;
  let sawDelta = false;
  await parseSseStream(response.body, async (event) => {
    if (event.type === 'response.output_text.delta') {
      const delta = event.delta || '';
      if (delta) {
        hasOutput = true;
        sawDelta = true;
        await onDelta(delta);
      }
    }
    if (event.type === 'response.output_text.done') {
      const text = event.text || '';
      if (text && !sawDelta) {
        hasOutput = true;
        await onDelta(text);
      }
    }
  });

  if (!hasOutput) {
    logger.warn({ model: payload?.model }, 'LLM response contained no output text');
  }
};

export const synthesizeSpeech = async (text, options) => {
  const payload = {
    model: options?.model || 'gpt-4o-mini-tts',
    voice: options?.voice || 'alloy',
    input: text,
    response_format: options?.responseFormat || 'pcm',
  };

  const response = await fetch(`${OPENAI_BASE_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`TTS failed: ${response.status} ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const summarizeCall = async (payload) => {
  const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Summary failed: ${response.status} ${errorBody}`);
  }

  const json = await response.json();
  const outputText = json.output?.[0]?.content?.[0]?.text;
  return outputText || '';
};
