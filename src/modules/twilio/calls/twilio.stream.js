import { logger } from '../../../utils/logger.js';
import { attachTwilioPipelineEngine } from '../engines/pipeline.engine.js';
import { attachTwilioRealtimeEngine } from '../engines/realtime.engine.js';

const resolveEngine = () => (process.env.TWILIO_ENGINE || 'realtime').toLowerCase();

export const attachTwilioStreamServer = (server) => {
  const engine = resolveEngine();

  if (engine === 'eleven_register') {
    logger.info(
      { engine },
      'Attaching Twilio stream engine (no-op, handled by ElevenLabs register_call)'
    );
    return null;
  }

  if (engine === 'realtime') {
    logger.info({ engine }, 'Attaching Twilio stream engine');
    return attachTwilioRealtimeEngine(server);
  }

  if (engine === 'pipeline') {
    logger.info({ engine }, 'Attaching Twilio stream engine');
    return attachTwilioPipelineEngine(server);
  }

  logger.warn(
    { engine, fallback: 'realtime' },
    'Unknown TWILIO_ENGINE value, falling back to realtime'
  );
  return attachTwilioRealtimeEngine(server);
};
