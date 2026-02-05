const buildVoiceResponse = (message) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
</Response>`;

export const twilioController = {
  voice: (_req, res) => {
    const message =
      process.env.TWILIO_VOICE_TEST_MESSAGE ||
      'Hello. This is a test call from the dialer.';

    // Temporary TwiML response for initial end-to-end testing.
    // Replace with <Start><Stream ... /></Start> once realtime streaming is ready.
    res.type('text/xml');
    return res.status(200).send(buildVoiceResponse(message));
  },
};
