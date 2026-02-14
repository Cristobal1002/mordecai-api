const toIsoFromUnixSeconds = (seconds) => {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric * 1000).toISOString();
};

const toIsoFromStartAndOffset = (startUnixSeconds, offsetSeconds) => {
  const start = Number(startUnixSeconds);
  const offset = Number(offsetSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(offset)) return null;
  return new Date((start + offset) * 1000).toISOString();
};

const normalizeOutcome = (analysisOutcome) => {
  if (!analysisOutcome) return null;
  const value = String(analysisOutcome).toLowerCase();

  if (value.includes('success') || value.includes('connected')) return 'CONNECTED';
  if (value.includes('voicemail')) return 'VOICEMAIL';
  if (value.includes('fail') || value.includes('error')) return 'FAILED';
  if (value.includes('promise')) return 'PROMISE_TO_PAY';
  if (value.includes('payment_plan') || value.includes('plan')) return 'PAYMENT_PLAN';
  if (value.includes('paid')) return 'PAID';
  if (value.includes('callback')) return 'CALLBACK_REQUESTED';
  if (value.includes('refused')) return 'REFUSED';
  if (value.includes('no_answer') || value.includes('no answer')) return 'NO_ANSWER';

  return null;
};

const normalizeTranscript = (rawTranscript = [], startUnixSeconds) =>
  rawTranscript
    .map((turn) => {
      const text = (turn?.original_message || turn?.message || '').trim();
      if (!text) return null;

      return {
        speaker: turn?.role === 'agent' ? 'assistant' : 'user',
        text,
        ts: toIsoFromStartAndOffset(startUnixSeconds, turn?.time_in_call_secs) || null,
        interrupted: Boolean(turn?.interrupted),
      };
    })
    .filter(Boolean);

export const normalizeElevenPostCallPayload = (rawEvent) => {
  const raw = rawEvent?.raw?.data ? rawEvent.raw : rawEvent;
  const data = raw?.data || {};
  const metadata = data?.metadata || {};
  const analysis = data?.analysis || {};
  const dynamicVariables = data?.conversation_initiation_client_data?.dynamic_variables || {};

  const conversationId = data?.conversation_id || rawEvent?.conversationId || null;
  const callSid =
    rawEvent?.callSid ||
    metadata?.phone_call?.call_sid ||
    dynamicVariables?.call_sid ||
    dynamicVariables?.system__call_sid ||
    null;

  const startedAt = toIsoFromUnixSeconds(metadata?.start_time_unix_secs);
  const acceptedAt = toIsoFromUnixSeconds(metadata?.accepted_time_unix_secs);
  const transcript = normalizeTranscript(data?.transcript, metadata?.start_time_unix_secs);

  const normalized = {
    source: 'elevenlabs',
    event: raw?.type || rawEvent?.event || 'post_call_transcription',
    receivedAt: new Date().toISOString(),
    conversationId,
    callSid,
    agentId: data?.agent_id || rawEvent?.agentId || null,
    tenantId: dynamicVariables?.tenant_id || rawEvent?.tenantId || null,
    caseId: dynamicVariables?.case_id || rawEvent?.caseId || null,
    interactionId: dynamicVariables?.interaction_id || null,
    dynamicVariables,
    summary: analysis?.transcript_summary || rawEvent?.summary || null,
    transcript,
    startedAt,
    acceptedAt,
    endedAt:
      startedAt && Number.isFinite(Number(metadata?.call_duration_secs))
        ? new Date(
            new Date(startedAt).getTime() + Number(metadata.call_duration_secs) * 1000
          ).toISOString()
        : null,
    callDurationSecs: Number.isFinite(Number(metadata?.call_duration_secs))
      ? Number(metadata.call_duration_secs)
      : null,
    terminationReason: metadata?.termination_reason || null,
    outcome: normalizeOutcome(analysis?.call_successful),
    raw,
  };

  return normalized;
};

