import { DebtCase, Debtor, FlowPolicy, InteractionLog, Tenant } from '../../models/index.js';
import { createVoiceContextSignature } from '../twilio/context-signature.js';

const DEFAULT_RULES = {
  min_upfront_pct: 25,
  half_pct: 50,
  max_installments: 4,
};

const buildChannels = () => ({
  sms: true,
  email: true,
  call: true,
  whatsapp: false,
});

const parseAmountUsdToCents = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return Math.round(normalized * 100);
};

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

const getTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const voiceUrl = process.env.TWILIO_VOICE_URL;
  const contextHmacSecret = process.env.CALL_CONTEXT_HMAC_SECRET;

  if (!accountSid || !authToken || !fromNumber || !voiceUrl || !contextHmacSecret) {
    throw new Error(
      'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_VOICE_URL, or CALL_CONTEXT_HMAC_SECRET'
    );
  }

  return {
    accountSid,
    authToken,
    fromNumber,
    voiceUrl,
    contextHmacSecret,
    signatureVersion: process.env.CALL_CONTEXT_SIGNATURE_VERSION || '1',
    ttlSeconds: Number(process.env.CALL_CONTEXT_TTL_SECONDS) || 600,
  };
};

const createTwilioCall = async ({ to, from, voiceUrl, accountSid, authToken }) => {
  const params = new URLSearchParams({
    To: to,
    From: from,
    Url: voiceUrl,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twilio call failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  return json.sid;
};

const resolveDemoTenant = async () => {
  const tenantIdFromEnv = process.env.DEMO_TENANT_ID;
  if (tenantIdFromEnv) {
    const existingById = await Tenant.findByPk(tenantIdFromEnv);
    if (existingById) return existingById;
  }

  const demoTenantName = process.env.DEMO_TENANT_NAME || 'Mordecai Demo Tenant';
  const [tenant] = await Tenant.findOrCreate({
    where: { name: demoTenantName },
    defaults: {
      timezone: 'America/New_York',
      status: 'active',
      settings: { demo: true },
    },
  });

  return tenant;
};

const ensureFlowPolicies = async (tenantId) => {
  const existing = await FlowPolicy.findAll({
    where: { tenantId, isActive: true },
    order: [['minDaysPastDue', 'ASC']],
  });

  if (existing.length >= 3) return existing;

  const presets = [
    { name: 'Demo 1-5 days', min: 1, max: 5, tone: 'friendly' },
    { name: 'Demo 6-20 days', min: 6, max: 20, tone: 'professional' },
    { name: 'Demo 21+ days', min: 21, max: null, tone: 'firm' },
  ];

  const created = [];
  for (const preset of presets) {
    const [policy] = await FlowPolicy.findOrCreate({
      where: {
        tenantId,
        minDaysPastDue: preset.min,
        maxDaysPastDue: preset.max,
      },
      defaults: {
        name: preset.name,
        channels: buildChannels(),
        tone: preset.tone,
        rules: DEFAULT_RULES,
        isActive: true,
      },
    });
    created.push(policy);
  }

  return created;
};

const selectFlowPolicy = (flowPolicies, daysPastDue) => {
  const sorted = [...flowPolicies].sort(
    (left, right) => Number(left.minDaysPastDue) - Number(right.minDaysPastDue)
  );

  const match = sorted.find((policy) => {
    const min = Number(policy.minDaysPastDue);
    const max =
      policy.maxDaysPastDue === null || policy.maxDaysPastDue === undefined
        ? Number.POSITIVE_INFINITY
        : Number(policy.maxDaysPastDue);
    return daysPastDue >= min && daysPastDue <= max;
  });

  return match || sorted[0] || null;
};

const buildSignedVoiceUrl = ({
  baseVoiceUrl,
  interactionId,
  tenantId,
  caseId,
  contextHmacSecret,
  signatureVersion,
  ttlSeconds,
}) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createVoiceContextSignature({
    interactionId,
    tenantId,
    caseId,
    exp,
    version: signatureVersion,
    secret: contextHmacSecret,
  });

  const url = new URL(baseVoiceUrl);
  url.searchParams.set('il', interactionId);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('v', signatureVersion);
  url.searchParams.set('sig', sig);
  return url.toString();
};

const validateStartCallPayload = (payload = {}) => {
  const name = String(payload.name || '').trim();
  const phone = normalizePhone(payload.phone);
  const amountCents = parseAmountUsdToCents(payload.amountUsd);
  const daysPastDue = Number(payload.daysPastDue ?? 12);

  if (!name) return { ok: false, message: 'name is required' };
  if (!phone || phone.length < 8) return { ok: false, message: 'phone must be valid E.164' };
  if (!amountCents) return { ok: false, message: 'amountUsd must be a positive number' };
  if (!Number.isFinite(daysPastDue) || daysPastDue < 0) {
    return { ok: false, message: 'daysPastDue must be >= 0' };
  }

  return {
    ok: true,
    normalized: {
      name,
      phone,
      email: payload.email ? String(payload.email).trim() : null,
      amountCents,
      daysPastDue: Math.round(daysPastDue),
      dueDate: payload.dueDate || null,
      options: Array.isArray(payload.options) ? payload.options : [],
      channels: Array.isArray(payload.channels) ? payload.channels : [],
      useCase: payload.useCase ? String(payload.useCase).trim() : '',
    },
  };
};

export const startDemoCall = async (payload) => {
  const validation = validateStartCallPayload(payload);
  if (!validation.ok) {
    return { ok: false, status: 400, message: validation.message };
  }

  const input = validation.normalized;
  const tenant = await resolveDemoTenant();
  const flowPolicies = await ensureFlowPolicies(tenant.id);
  const flowPolicy = selectFlowPolicy(flowPolicies, input.daysPastDue);

  if (!flowPolicy) {
    return {
      ok: false,
      status: 500,
      message: 'Could not resolve a flow policy for demo call.',
    };
  }

  const [debtor] = await Debtor.findOrCreate({
    where: { tenantId: tenant.id, phone: input.phone },
    defaults: {
      fullName: input.name,
      email: input.email,
      metadata: {
        source: 'demo-ui',
      },
    },
  });

  if (debtor.fullName !== input.name || (input.email && debtor.email !== input.email)) {
    await debtor.update({
      fullName: input.name,
      email: input.email || debtor.email,
      metadata: {
        ...(debtor.metadata || {}),
        source: 'demo-ui',
      },
    });
  }

  const debtCase = await DebtCase.create({
    tenantId: tenant.id,
    debtorId: debtor.id,
    flowPolicyId: flowPolicy.id,
    amountDueCents: input.amountCents,
    currency: 'USD',
    daysPastDue: input.daysPastDue,
    dueDate: input.dueDate,
    status: 'IN_PROGRESS',
    nextActionAt: new Date(),
    meta: {
      source: 'demo-ui',
      customer_name: input.name,
      balance_amount: String(input.amountCents / 100),
      balance_amount_cents: String(input.amountCents),
      options: input.options,
      channels: input.channels,
      use_case: input.useCase,
    },
  });

  const interaction = await InteractionLog.create({
    tenantId: tenant.id,
    debtCaseId: debtCase.id,
    debtorId: debtor.id,
    type: 'CALL',
    direction: 'OUTBOUND',
    channelProvider: 'twilio',
    status: 'queued',
    startedAt: new Date(),
  });

  const twilioConfig = getTwilioConfig();
  const signedVoiceUrl = buildSignedVoiceUrl({
    baseVoiceUrl: twilioConfig.voiceUrl,
    interactionId: interaction.id,
    tenantId: tenant.id,
    caseId: debtCase.id,
    contextHmacSecret: twilioConfig.contextHmacSecret,
    signatureVersion: twilioConfig.signatureVersion,
    ttlSeconds: twilioConfig.ttlSeconds,
  });

  try {
    // TODO(mordecai): revisar arquitectura de disparo de llamadas.
    // Hoy el demo llama Twilio directamente desde API para respuesta inmediata.
    // En una fase futura decidir si unificamos este flujo en workers (cola) o lo mantenemos en backend.
    const callSid = await createTwilioCall({
      to: input.phone,
      from: twilioConfig.fromNumber,
      voiceUrl: signedVoiceUrl,
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
    });

    await interaction.update({
      providerRef: callSid,
      status: 'in_progress',
      channelProvider: 'twilio',
    });

    return {
      ok: true,
      status: 201,
      data: {
        callSid,
        tenantId: tenant.id,
        debtorId: debtor.id,
        debtCaseId: debtCase.id,
        interactionId: interaction.id,
        to: input.phone,
        amountDueCents: input.amountCents,
      },
    };
  } catch (error) {
    await interaction.update({
      status: 'failed',
      outcome: 'FAILED',
      endedAt: new Date(),
      error: {
        message: error?.message || 'Twilio call failed',
      },
    });

    return {
      ok: false,
      status: 502,
      message: error?.message || 'Failed to create Twilio call',
    };
  }
};
