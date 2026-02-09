import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { saveTwilioCallSummary } from './twilio.storage.js';
import {
  mulawToPcm16,
  pcm16ToMulaw,
  pcm16ToWav,
  resamplePcm16,
  rmsLevel,
  wavToPcm16,
} from './audio/codec.js';
import {
  streamChatResponse,
  summarizeCall,
  synthesizeSpeech,
  transcribeAudio,
} from './openai.client.js';

const STREAM_PATH = `/api/${config.app.apiVersion}/twilio/stream`;

const TWILIO_SAMPLE_RATE = 8000;
const TWILIO_FRAME_BYTES = 160;
const TWILIO_FRAME_MS = 20;

const DEFAULT_DEBTOR_NAME =
  process.env.TWILIO_DEBTOR_NAME ||
  process.env.DEBTOR_NAME ||
  'Andres Cristobal Sosa';

const DEFAULT_INSTRUCTIONS = [
  'You are a debt negotiation agent for Mordecai AI.',
  'The debtor owes $5,000.',
  `You are speaking with ${DEFAULT_DEBTOR_NAME}.`,
  'Do not ask for the debtor name or identity confirmation; assume identity is confirmed.',
  'Do not say you are an AI or say "this is a Mordecai call".',
  'Be concise, professional, and empathetic.',
  'Use the name once in the initial greeting, then avoid repeating it.',
  'Do not include markdown, labels, or stage headings in your replies.',
  'Respond in English only.',
  'If the user response is unclear, ask one short clarifying question.',
  'Follow negotiation states and record outcomes.',
].join(' ');

const buildOpeningPrompt = () =>
  process.env.OPENAI_LLM_OPENING_PROMPT ||
  `Greet ${DEFAULT_DEBTOR_NAME} briefly. ` +
  'Mention the $5,000 balance and ask if now is a good time to discuss repayment options. ' +
  'Do not mention the company name or that this is an AI.';

const DEFAULT_STATES = [
  'OPENING',
  'VERIFY_IDENTITY',
  'DISCOVER_SITUATION',
  'OFFER_PLAN',
  'HANDLE_OBJECTION',
  'CONFIRM_COMMITMENT',
  'CLOSING',
];

const DEFAULT_OUTCOMES = [
  'PROMISE_TO_PAY',
  'PARTIAL_PAYMENT',
  'REFUSED',
  'CALLBACK_REQUESTED',
  'DO_NOT_CALL',
  'WRONG_NUMBER',
  'NO_ANSWER',
  'UNKNOWN',
];

const STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe';
const STT_LANGUAGE = process.env.OPENAI_STT_LANGUAGE || 'en';
const STT_STREAM = process.env.OPENAI_STT_STREAM !== 'false';
const LLM_MODEL = process.env.OPENAI_LLM_MODEL || 'gpt-4o';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';
const TTS_FORMAT = process.env.OPENAI_TTS_FORMAT || 'pcm';
const TTS_SAMPLE_RATE = Number(process.env.OPENAI_TTS_SAMPLE_RATE) || 24000;

const STT_CHUNK_MS = Number(process.env.TWILIO_STT_CHUNK_MS) || 600;
const STT_MIN_MS = Number(process.env.TWILIO_STT_MIN_MS) || 150;
const VAD_THRESHOLD = Number(process.env.TWILIO_VAD_THRESHOLD) || 500;
const VAD_SILENCE_MS = Number(process.env.TWILIO_VAD_SILENCE_MS) || 600;
const BARGE_IN_MS = Number(process.env.TWILIO_BARGE_IN_MS) || 200;
const TEXT_CHUNK_MIN_CHARS = Number(process.env.TWILIO_TTS_CHUNK_MIN_CHARS) || 120;
const UTTERANCE_TIMEOUT_MS =
  Number(process.env.TWILIO_UTTERANCE_TIMEOUT_MS) || 800;

const parseJson = (payload) => {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSystemPrompt = () =>
  process.env.OPENAI_LLM_SYSTEM_PROMPT ||
  `${DEFAULT_INSTRUCTIONS} Valid states: ${DEFAULT_STATES.join(
    ', '
  )}. Outcomes: ${DEFAULT_OUTCOMES.join(', ')}.`;

const STATE_REGEX = new RegExp(`\\b(${DEFAULT_STATES.join('|')})\\b`, 'gi');

const buildResponseInput = (messages) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const sanitizeAssistantText = (text) => {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(STATE_REGEX, '');
  cleaned = cleaned.replace(/Outcome:\s*[A-Z_]+/gi, '');
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\n{2,}/g, '\n');
  return cleaned.trim();
};

const attachTranscript = (state, speaker, text) => {
  const cleaned = text?.trim();
  if (!cleaned) return;
  state.transcript.push({
    speaker,
    text: cleaned,
    ts: new Date().toISOString(),
  });
};

const buildSummaryPayload = (state) => ({
  callSid: state.callSid,
  streamSid: state.streamSid,
  startedAt: state.startedAt,
  endedAt: state.endedAt,
  transcript: state.transcript,
  events: state.events,
  final_state: state.finalState,
  outcome: state.outcome,
  summary: state.summary,
});

const buildSummarySchema = () => ({
  type: 'object',
  additionalProperties: false,
  required: ['final_state', 'outcome', 'summary', 'events'],
  properties: {
    final_state: { type: 'string', enum: DEFAULT_STATES },
    outcome: { type: 'string', enum: DEFAULT_OUTCOMES },
    summary: { type: 'string' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount_cents', 'date', 'note'],
        properties: {
          type: { type: 'string' },
          amount_cents: { type: ['integer', 'null'] },
          date: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
});

const splitAssistantChunk = (buffer) => {
  if (buffer.length < TEXT_CHUNK_MIN_CHARS) return null;

  const match = buffer.match(/[\s\S]*?[.!?](\s|$)/);
  if (!match) return null;

  return match[0].trim();
};

export const attachTwilioStreamServer = (server) => {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      logger.info(
        {
          pathname,
          ip: request.socket?.remoteAddress,
          headers: {
            host: request.headers?.host,
            upgrade: request.headers?.upgrade,
            connection: request.headers?.connection,
            forwardedFor: request.headers?.['x-forwarded-for'],
          },
        },
        'Incoming upgrade request'
      );
      if (pathname !== STREAM_PATH) return;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to upgrade WebSocket request');
    }
  });

  wss.on('connection', (ws, request) => {
    const state = {
      callSid: null,
      streamSid: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      transcript: [],
      events: [],
      finalState: 'OPENING',
      outcome: 'UNKNOWN',
      summary: null,
      assistantBuffer: '',
      assistantFullText: '',
      userBuffer: '',
      speechMs: 0,
      silenceMs: 0,
      pendingSpeechPcm: [],
      pendingSpeechMs: 0,
      sttChain: Promise.resolve(),
      llmChain: Promise.resolve(),
      ttsChain: Promise.resolve(),
      ttsQueue: [],
      isTtsPlaying: false,
      ttsGeneration: 0,
      isUserSpeaking: false,
      finalizeTimer: null,
      openingSent: false,
      finalized: false,
    };

    const messages = [{ role: 'system', content: buildSystemPrompt() }];

    const sendAudioToTwilio = (mulawBuffer, generationId) => {
      if (!mulawBuffer || !state.streamSid) return;
      if (ws.readyState !== WebSocket.OPEN) return;

      const total = mulawBuffer.length;
      const payloads = [];
      for (let offset = 0; offset < total; offset += TWILIO_FRAME_BYTES) {
        payloads.push(mulawBuffer.slice(offset, offset + TWILIO_FRAME_BYTES));
      }

      state.ttsChain = state.ttsChain.then(async () => {
        for (const chunk of payloads) {
          if (generationId !== state.ttsGeneration || state.isUserSpeaking) break;
          const payload = chunk.toString('base64');
          ws.send(
            JSON.stringify({
              event: 'media',
              streamSid: state.streamSid,
              media: { payload },
            })
          );
          await sleep(TWILIO_FRAME_MS);
        }
      }).catch((error) => {
        logger.error(
          { err: error, errorMessage: error?.message },
          'TTS send chain failed'
        );
      });
    };

    const cancelTts = () => {
      state.ttsGeneration += 1;
      state.ttsQueue = [];
      state.isTtsPlaying = false;
    };

    const queueTts = (text) => {
      if (!text) return;
      state.ttsQueue.push(text);
      if (!state.isTtsPlaying) {
        state.isTtsPlaying = true;
        processTtsQueue();
      }
    };

    const processTtsQueue = async () => {
      const chunk = state.ttsQueue.shift();
      if (!chunk) {
        state.isTtsPlaying = false;
        return;
      }

      const generationId = state.ttsGeneration;
      try {
        const audioBuffer = await synthesizeSpeech(chunk, {
          model: TTS_MODEL,
          voice: TTS_VOICE,
          responseFormat: TTS_FORMAT,
        });

        if (generationId !== state.ttsGeneration || state.isUserSpeaking) {
          state.isTtsPlaying = false;
          return;
        }

        let pcmBuffer = audioBuffer;
        let sampleRate = TTS_SAMPLE_RATE;

        if (TTS_FORMAT === 'wav') {
          const wav = wavToPcm16(audioBuffer);
          pcmBuffer = wav.pcm;
          sampleRate = wav.sampleRate;
        }

        const resampled = resamplePcm16(pcmBuffer, sampleRate, TWILIO_SAMPLE_RATE);
        const mulaw = pcm16ToMulaw(resampled);
        sendAudioToTwilio(mulaw, generationId);
      } catch (error) {
        logger.error(
          { err: error, errorMessage: error?.message },
          'Failed to synthesize speech'
        );
      } finally {
        state.isTtsPlaying = false;
        processTtsQueue();
      }
    };

    const handleAssistantResponse = async () => {
      state.assistantBuffer = '';
      state.assistantFullText = '';

      const payload = {
        model: LLM_MODEL,
        stream: true,
        input: buildResponseInput(messages),
      };

      await streamChatResponse(payload, async (delta) => {
        if (!delta) return;
        state.assistantBuffer += delta;
        state.assistantFullText += delta;

        const chunk = splitAssistantChunk(state.assistantBuffer);
        if (chunk) {
          state.assistantBuffer = state.assistantBuffer.slice(chunk.length).trimStart();
          const cleanedChunk = sanitizeAssistantText(chunk);
          if (cleanedChunk) {
            queueTts(cleanedChunk);
          }
        }
      });

      if (state.assistantBuffer.trim()) {
        const cleanedChunk = sanitizeAssistantText(state.assistantBuffer.trim());
        if (cleanedChunk) {
          queueTts(cleanedChunk);
        }
        state.assistantBuffer = '';
      }

      const cleanedFull = sanitizeAssistantText(state.assistantFullText);
      if (cleanedFull) {
        attachTranscript(state, 'assistant', cleanedFull);
        messages.push({ role: 'assistant', content: cleanedFull });
      }
    };

    const scheduleFinalize = () => {
      if (state.finalizeTimer) clearTimeout(state.finalizeTimer);
      state.finalizeTimer = setTimeout(() => {
        state.finalizeTimer = null;
        finalizeUserUtterance();
      }, UTTERANCE_TIMEOUT_MS);
    };

    const finalizeUserUtterance = () => {
      if (state.finalizeTimer) {
        clearTimeout(state.finalizeTimer);
        state.finalizeTimer = null;
      }
      state.sttChain = state.sttChain.then(() => {
        const utterance = state.userBuffer.trim();
        if (!utterance) return;
        const wordCount = utterance.split(/\s+/).filter(Boolean).length;
        if (wordCount < 2) {
          logger.debug({ wordCount, utterance }, 'Skipping utterance (too short)');
          state.userBuffer = '';
          return;
        }
        state.userBuffer = '';
        attachTranscript(state, 'user', utterance);
        messages.push({ role: 'user', content: utterance });
        state.llmChain = state.llmChain.then(handleAssistantResponse).catch((error) => {
          logger.error(
            { err: error, errorMessage: error?.message },
            'LLM response failed'
          );
        });
      });
    };

    const enqueueTranscription = (pcmBuffer) => {
      if (!pcmBuffer.length) return;
      const durationMs = (pcmBuffer.length / 2 / TWILIO_SAMPLE_RATE) * 1000;
      if (durationMs < STT_MIN_MS) {
        logger.debug(
          { durationMs: Math.round(durationMs) },
          'Skipping STT chunk (too short)'
        );
        return;
      }
      const wav = pcm16ToWav(pcmBuffer, TWILIO_SAMPLE_RATE, 1);

      state.sttChain = state.sttChain
        .then(async () => {
          const text = await transcribeAudio(wav, {
            model: STT_MODEL,
            language: STT_LANGUAGE,
            stream: STT_STREAM,
          });
          if (text?.trim()) {
            state.userBuffer = `${state.userBuffer} ${text}`.trim();
            scheduleFinalize();
          }
        })
        .catch((error) => {
          logger.error({ err: error, errorMessage: error?.message }, 'STT chunk failed');
        });
    };

    const flushSpeechBuffer = () => {
      if (!state.pendingSpeechPcm.length) return;
      const pcmBuffer = Buffer.concat(state.pendingSpeechPcm);
      state.pendingSpeechPcm = [];
      state.pendingSpeechMs = 0;
      enqueueTranscription(pcmBuffer);
    };

    const handleAudioFrame = (mulawBuffer) => {
      const frameMs = mulawBuffer.length / 8;
      const pcmBuffer = mulawToPcm16(mulawBuffer);
      const level = rmsLevel(pcmBuffer);
      const isSpeech = level >= VAD_THRESHOLD;

      if (isSpeech) {
        state.speechMs += frameMs;
        state.silenceMs = 0;
        state.pendingSpeechPcm.push(pcmBuffer);
        state.pendingSpeechMs += frameMs;
      } else {
        state.silenceMs += frameMs;
        state.speechMs = 0;
      }

      if (isSpeech && state.speechMs >= BARGE_IN_MS) {
        state.isUserSpeaking = true;
        cancelTts();
      }

      if (state.pendingSpeechMs >= STT_CHUNK_MS) {
        flushSpeechBuffer();
      }

      if (!isSpeech && state.silenceMs >= VAD_SILENCE_MS) {
        state.isUserSpeaking = false;
        flushSpeechBuffer();
        finalizeUserUtterance();
      }
    };

    const finalize = async (reason) => {
      if (state.finalized) return;
      state.finalized = true;
      state.endedAt = new Date().toISOString();
      flushSpeechBuffer();
      finalizeUserUtterance();

      try {
        const summarySchema = buildSummarySchema();
        const summaryPayload = {
          model: LLM_MODEL,
          input: [
            {
              role: 'system',
              content:
                'You summarize debt negotiation calls into JSON. Use the provided schema only.',
            },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  transcript: state.transcript,
                  events: state.events,
                },
                null,
                2
              ),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'call_summary',
              schema: summarySchema,
              strict: true,
            },
          },
        };

        const summaryText = await summarizeCall(summaryPayload);
        if (summaryText) {
          try {
            const summary = JSON.parse(summaryText);
            state.summary = summary.summary || null;
            state.finalState = summary.final_state || state.finalState;
            state.outcome = summary.outcome || state.outcome;
            state.events = summary.events || state.events;
          } catch (error) {
            logger.warn({ error }, 'Failed to parse summary JSON');
          }
        }
      } catch (error) {
        logger.error(
          { err: error, errorMessage: error?.message },
          'Failed to generate call summary'
        );
      }

      try {
        const payload = buildSummaryPayload(state);
        await saveTwilioCallSummary(payload);
      } catch (error) {
        logger.error({ error }, 'Failed to save Twilio call summary');
      }

      logger.info(
        { callSid: state.callSid, streamSid: state.streamSid, reason },
        'Twilio stream finalized'
      );

      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'call_complete');
      }
    };

    ws.on('message', (data) => {
      const message = parseJson(data.toString());
      if (!message) return;

      if (message.event === 'start') {
        state.callSid = message.start?.callSid || state.callSid;
        state.streamSid = message.start?.streamSid || state.streamSid;
        state.startedAt = new Date().toISOString();
        logger.info(
          { callSid: state.callSid, streamSid: state.streamSid },
          'Twilio stream started'
        );
        if (!state.openingSent) {
          state.openingSent = true;
          const openingPrompt = buildOpeningPrompt();
          messages.push({ role: 'user', content: openingPrompt });
          state.llmChain = state.llmChain.then(handleAssistantResponse).catch((error) => {
            logger.error(
              { err: error, errorMessage: error?.message },
              'LLM response failed'
            );
          });
        }
        return;
      }

      if (message.event === 'media') {
        const payload = message.media?.payload;
        if (!payload) return;
        const mulawBuffer = Buffer.from(payload, 'base64');
        handleAudioFrame(mulawBuffer);
        return;
      }

      if (message.event === 'stop') {
        finalize('twilio_stop');
      }
    });

    ws.on('close', () => finalize('twilio_socket_closed'));
    ws.on('error', (error) => {
      logger.error({ error }, 'Twilio stream websocket error');
      finalize('twilio_socket_error');
    });

    logger.info(
      { path: STREAM_PATH, ip: request.socket?.remoteAddress },
      'Twilio stream websocket connected'
    );
  });

  return wss;
};
