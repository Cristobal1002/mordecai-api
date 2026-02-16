import axios from 'axios';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';
const REGISTER_CALL_PATH = '/v1/convai/twilio/register-call';

const extractTwiml = (data) => {
  if (typeof data === 'string') return data;
  if (typeof data?.twiml === 'string') return data.twiml;
  if (typeof data?.twiml_response === 'string') return data.twiml_response;
  if (typeof data?.response === 'string') return data.response;
  return null;
};

export const registerTwilioCallWithElevenLabs = async ({
  apiKey,
  agentId,
  fromNumber,
  toNumber,
  callSid,
  direction,
  dynamicVariables,
}) => {
  const response = await axios.post(
    `${ELEVENLABS_BASE_URL}${REGISTER_CALL_PATH}`,
    {
      agent_id: agentId,
      agent_phone_number_id: null,
      from_number: fromNumber,
      to_number: toNumber,
      call_sid: callSid,
      direction,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables || {},
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const twiml = extractTwiml(response.data);
  if (!twiml) {
    throw new Error('ElevenLabs register_call did not return TwiML');
  }

  return twiml;
};
