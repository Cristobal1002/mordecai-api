import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { summarizeCall } from '../openai.client.js';
import { saveTwilioCallSummary } from '../twilio.storage.js';

const STREAM_PATH = `/api/${config.app.apiVersion}/twilio/stream`;
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

const DEFAULT_DEBTOR_NAME =
  process.env.TWILIO_DEBTOR_NAME ||
  process.env.DEBTOR_NAME ||
  'Andres Cristobal Sosa';

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

const DEFAULT_INSTRUCTIONS = [
  'You are a debt negotiation agent for Mordecai AI.',
  'The debtor owes $5,000.',
  `You are speaking with ${DEFAULT_DEBTOR_NAME}.`,
  'Do not ask for the debtor name or identity confirmation.',
  'Do not say you are an AI.',
  'Respond in English only.',
  'Be concise, professional, and empathetic.',
  'If user audio is unclear, ask one short clarifying question.',
].join(' ');

const DEFAULT_OPENING_PROMPT =
  `Greet ${DEFAULT_DEBTOR_NAME} briefly, mention the $5,000 balance, ` +
  'and ask if now is a good time to discuss repayment options.';

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const buildRealtimeUrl = () => {
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';
  return `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`;
};

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

const attachTranscript = (state, speaker, text) => {
  const cleaned = text?.trim();
  if (!cleaned) return;
  state.transcript.push({
    speaker,
    text: cleaned,
    ts: new Date().toISOString(),
  });
};

const flushAssistantBuffer = (state) => {
  const text = state.assistantBuffer.trim();
  if (!text) return;
  if (text === state.lastAssistantText) {
    state.assistantBuffer = '';
    return;
  }
  attachTranscript(state, 'assistant', text);
  state.lastAssistantText = text;
  state.assistantBuffer = '';
};

const buildSummaryPayload = (state) => ({
  callSid: state.callSid,
  streamSid: state.streamSid,
  startedAt: state.startedAt,
  endedAt: state.endedAt,
  openAiSessionId: state.openAiSessionId,
  transcript: state.transcript,
  events: state.events,
  final_state: state.finalState,
  outcome: state.outcome,
  summary: state.summary,
});

export const attachTwilioRealtimeEngine = (server) => {
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
      openAiSessionId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      transcript: [],
      events: [],
      finalState: 'OPENING',
      outcome: 'UNKNOWN',
      summary: null,
      assistantBuffer: '',
      lastAssistantText: '',
      isUserSpeaking: false,
      pendingAudio: [],
      finalized: false,
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('Missing OPENAI_API_KEY for realtime engine');
      ws.close(1011, 'Missing OpenAI key');
      return;
    }

    const openAiWs = new WebSocket(buildRealtimeUrl(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    const sendToOpenAi = (payload) => {
      if (openAiWs.readyState !== WebSocket.OPEN) return;
      openAiWs.send(JSON.stringify(payload));
    };

    const sendAudioToOpenAi = (audioBase64) => {
      if (!audioBase64) return;
      if (openAiWs.readyState !== WebSocket.OPEN) {
        state.pendingAudio.push(audioBase64);
        if (state.pendingAudio.length > 500) state.pendingAudio.shift();
        return;
      }
      sendToOpenAi({
        type: 'input_audio_buffer.append',
        audio: audioBase64,
      });
    };

    const sendAudioToTwilio = (audioBase64) => {
      if (!audioBase64 || !state.streamSid) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          event: 'media',
          streamSid: state.streamSid,
          media: { payload: audioBase64 },
        })
      );
    };

    const summarize = async () => {
      try {
        const summaryPayload = {
          model: process.env.OPENAI_LLM_MODEL || 'gpt-4o',
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
              schema: buildSummarySchema(),
              strict: true,
            },
          },
        };

        const summaryText = await summarizeCall(summaryPayload);
        if (!summaryText) return;
        const parsed = JSON.parse(summaryText);
        state.summary = parsed.summary || state.summary;
        state.finalState = parsed.final_state || state.finalState;
        state.outcome = parsed.outcome || state.outcome;
        state.events = parsed.events || state.events;
      } catch (error) {
        logger.error(
          { err: error, errorMessage: error?.message },
          'Failed to generate call summary'
        );
      }
    };

    const finalize = async (reason) => {
      if (state.finalized) return;
      state.finalized = true;
      state.endedAt = new Date().toISOString();
      flushAssistantBuffer(state);

      await summarize();

      try {
        await saveTwilioCallSummary(buildSummaryPayload(state));
      } catch (error) {
        logger.error({ error }, 'Failed to save Twilio call summary');
      }

      logger.info(
        { callSid: state.callSid, streamSid: state.streamSid, reason },
        'Twilio stream finalized'
      );

      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close(1000, 'call_complete');
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'call_complete');
      }
    };

    openAiWs.on('open', () => {
      const instructions =
        process.env.OPENAI_REALTIME_INSTRUCTIONS || DEFAULT_INSTRUCTIONS;
      const openingPrompt =
        process.env.OPENAI_REALTIME_OPENING_PROMPT || DEFAULT_OPENING_PROMPT;

      sendToOpenAi({
        type: 'session.update',
        session: {
          instructions,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: process.env.OPENAI_REALTIME_VOICE || 'alloy',
          turn_detection: {
            type: 'server_vad',
            create_response: true,
            interrupt_response: true,
          },
          input_audio_transcription: {
            model:
              process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ||
              'gpt-4o-transcribe',
            language: process.env.OPENAI_STT_LANGUAGE || 'en',
          },
        },
      });

      sendToOpenAi({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: openingPrompt,
        },
      });

      for (const audioBase64 of state.pendingAudio) {
        sendAudioToOpenAi(audioBase64);
      }
      state.pendingAudio = [];
    });

    openAiWs.on('message', (data) => {
      const message = parseJson(data.toString());
      if (!message) return;

      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          state.openAiSessionId = message.session?.id || state.openAiSessionId;
          break;
        case 'input_audio_buffer.speech_started':
          state.isUserSpeaking = true;
          sendToOpenAi({ type: 'response.cancel' });
          if (state.streamSid && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                event: 'clear',
                streamSid: state.streamSid,
              })
            );
          }
          break;
        case 'input_audio_buffer.speech_stopped':
          state.isUserSpeaking = false;
          break;
        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = message.transcript || message.text || '';
          attachTranscript(state, 'user', transcript);
          break;
        }
        case 'response.audio.delta': {
          const audioBase64 =
            message.delta ||
            message.audio ||
            message.response?.audio?.delta ||
            null;
          if (!state.isUserSpeaking) {
            sendAudioToTwilio(audioBase64);
          }
          break;
        }
        case 'response.audio_transcript.delta':
        case 'response.text.delta': {
          const delta = message.delta || message.text || '';
          state.assistantBuffer += delta;
          break;
        }
        case 'response.done':
          flushAssistantBuffer(state);
          break;
        default:
          break;
      }
    });

    openAiWs.on('error', (error) => {
      logger.error(
        { err: error, errorMessage: error?.message },
        'OpenAI realtime socket error'
      );
    });

    openAiWs.on('close', (code, reason) => {
      logger.info(
        { code, reason: reason?.toString() },
        'OpenAI realtime socket closed'
      );
    });

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
        return;
      }

      if (message.event === 'media') {
        sendAudioToOpenAi(message.media?.payload);
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

