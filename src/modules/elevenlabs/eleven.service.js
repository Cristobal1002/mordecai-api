import crypto from 'crypto';
import {
  DebtCase,
  Debtor,
  FlowPolicy,
  InteractionLog,
  PaymentAgreement,
  PaymentLink,
  Tenant,
} from '../../models/index.js';
import { resolvePolicyForCase } from '../collections/policy-resolver.service.js';
import { logger } from '../../utils/logger.js';
import { registerTwilioCallInElevenLabs } from './eleven.client.js';

const SUPPORTED_INTERACTION_OUTCOMES = new Set([
  'CONNECTED',
  'NO_ANSWER',
  'VOICEMAIL',
  'FAILED',
  'PROMISE_TO_PAY',
  'PAYMENT_PLAN',
  'PAID',
  'REFUSED',
  'CALLBACK_REQUESTED',
]);

const centsToDisplayAmount = (amountCents) => {
  const amount = Number(amountCents || 0) / 100;
  if (!Number.isFinite(amount)) return '0';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const PAYMENT_OPTION_LABELS = {
  full: 'full amount in one payment',
  half: '50% now and remainder later',
  installments_4: 'up to 4 installments with minimum 25% upfront',
};

const PAYMENT_CHANNEL_LABELS = {
  link: 'payment link',
  card: 'debit/credit card',
  transfer: 'bank transfer',
  cash: 'cash (physical point)',
};

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

/**
 * Create a PaymentLink record and return the URL.
 * URL format: {base}/p/{token} — does not expose agreement ID.
 */
const createPaymentLinkAndGetUrl = async ({ tenantId, debtCaseId, paymentAgreementId }) => {
  const { PaymentLink } = await import('../../models/index.js');
  const crypto = await import('crypto');
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await PaymentLink.create({
    tenantId,
    debtCaseId,
    paymentAgreementId: paymentAgreementId ?? null,
    token,
    status: 'PENDING',
    expiresAt,
  });

  const baseUrl = (process.env.PAYMENTS_BASE_URL || 'https://pay.mordecai.ai').replace(/\/$/, '');
  return `${baseUrl}/p/${token}`;
};

const parseAmountCents = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  // If the value is lower than 10000 and has decimals, assume dollars.
  if (Math.abs(numeric) < 1000000 && !Number.isInteger(numeric)) {
    return Math.round(numeric * 100);
  }

  return Math.round(numeric);
};

const normalizeDynamicVariableValue = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const normalizeSelectionValues = (value, labelsMap = {}) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const ids = rawItems.map((item) => String(item)).filter(Boolean);
  const human = ids.map((id) => labelsMap[id] || id);

  return {
    ids: ids.join(','),
    human: human.join(', '),
  };
};

const buildCaseMetadataDynamicVariables = (meta = {}) => {
  const keys = [
    'notes',
    'lease_id',
    'balance_type',
    'last_payment_date',
    'property_id',
    'unit_number',
    'language',
    'use_case',
    'opening_message',
    'tenant_name',
    'tenant_display_name',
  ];

  const acc = keys.reduce((result, key) => {
    const normalized = normalizeDynamicVariableValue(meta[key]);
    if (!normalized) return result;
    result[key] = normalized;
    return result;
  }, {});

  const paymentOptions = normalizeSelectionValues(meta.options, PAYMENT_OPTION_LABELS);
  if (paymentOptions.ids) {
    acc.payment_options = paymentOptions.ids;
    acc.payment_options_human = paymentOptions.human;
  }

  const paymentChannels = normalizeSelectionValues(meta.channels, PAYMENT_CHANNEL_LABELS);
  if (paymentChannels.ids) {
    acc.payment_channels = paymentChannels.ids;
    acc.payment_channels_human = paymentChannels.human;
  }

  return acc;
};

/** Build validation-style rules from resolved policy (single source for v1 and v2). */
const getRulesFromResolvedPolicy = (resolvedPolicy) => {
  const r = resolvedPolicy?.rules || {};
  const allowed = r.allowed_plans || ['FULL', 'HALF', 'INSTALLMENTS'];
  const allowedPlanTypes = allowed.map((p) =>
    String(p).toUpperCase() === 'INSTALLMENTS' ? 'INSTALLMENTS_4' : String(p).toUpperCase()
  );
  return {
    minUpfrontPct: Number(r.min_upfront_pct ?? 25),
    halfPct: Number(r.half_pct ?? 50),
    maxInstallments: Number(r.max_installments ?? 4),
    allowedPlanTypes: allowedPlanTypes.length ? allowedPlanTypes : ['FULL', 'HALF', 'INSTALLMENTS_4'],
  };
};

const validateProposalAgainstRules = ({ proposal, balanceCents, rules }) => {
  const planType = String(proposal?.plan_type || '').toUpperCase();
  const upfrontAmountCents = parseAmountCents(proposal?.upfront_amount_cents);
  const installmentsCount = Number(proposal?.installments_count || 0);

  if (!planType) {
    return { ok: false, code: 'MISSING_PLAN_TYPE', message: 'plan_type is required.' };
  }

  const allowed = rules.allowedPlanTypes ?? ['FULL', 'HALF', 'INSTALLMENTS_4'];
  if (!allowed.includes(planType)) {
    return {
      ok: false,
      code: 'INVALID_PLAN_TYPE',
      message: `plan_type must be one of: ${allowed.join(', ')}.`,
    };
  }

  if (!upfrontAmountCents || upfrontAmountCents <= 0) {
    return {
      ok: false,
      code: 'INVALID_UPFRONT_AMOUNT',
      message: 'upfront_amount_cents must be greater than zero.',
    };
  }

  if (planType === 'FULL' && upfrontAmountCents < balanceCents) {
    return {
      ok: false,
      code: 'RULE_VIOLATION',
      message: 'FULL plan requires paying the full remaining balance.',
      allowed_options: { min_upfront_amount_cents: balanceCents },
    };
  }

  if (planType === 'HALF') {
    const minHalf = Math.ceil((rules.halfPct / 100) * balanceCents);
    if (upfrontAmountCents < minHalf) {
      return {
        ok: false,
        code: 'RULE_VIOLATION',
        message: `HALF plan requires at least ${rules.halfPct}% upfront.`,
        allowed_options: { min_upfront_amount_cents: minHalf },
      };
    }
  }

  if (planType === 'INSTALLMENTS_4') {
    const minUpfront = Math.ceil((rules.minUpfrontPct / 100) * balanceCents);
    if (upfrontAmountCents < minUpfront) {
      return {
        ok: false,
        code: 'RULE_VIOLATION',
        message: `Minimum upfront is ${rules.minUpfrontPct}% for this flow policy.`,
        allowed_options: {
          min_upfront_amount_cents: minUpfront,
          max_installments: rules.maxInstallments,
        },
      };
    }

    if (!installmentsCount || installmentsCount > rules.maxInstallments) {
      return {
        ok: false,
        code: 'RULE_VIOLATION',
        message: `Installments count must be between 1 and ${rules.maxInstallments}.`,
        allowed_options: {
          min_upfront_amount_cents: minUpfront,
          max_installments: rules.maxInstallments,
        },
      };
    }
  }

  return { ok: true, planType, upfrontAmountCents, installmentsCount };
};

const resolveCaseStatusFromOutcome = (currentStatus, outcome) => {
  if (!outcome) return null;

  // Keep payment statuses when already negotiated.
  if (['PAYMENT_PLAN', 'PROMISE_TO_PAY', 'PAID'].includes(currentStatus)) {
    return null;
  }

  switch (outcome) {
    case 'PAID':
      return 'PAID';
    case 'PAYMENT_PLAN':
      return 'PAYMENT_PLAN';
    case 'PROMISE_TO_PAY':
      return 'PROMISE_TO_PAY';
    case 'REFUSED':
      return 'REFUSED';
    case 'NO_ANSWER':
    case 'VOICEMAIL':
      return 'NO_ANSWER';
    case 'CONNECTED':
      return 'CONTACTED';
    default:
      return null;
  }
};

export const resolveInteractionContext = async (interactionId) =>
  InteractionLog.findOne({
    where: { id: interactionId },
    include: [
      {
        model: DebtCase,
        as: 'debtCase',
        include: [
          { model: Debtor, as: 'debtor' },
          { model: FlowPolicy, as: 'flowPolicy' },
        ],
      },
    ],
  });

export const registerCallForInteraction = async ({
  interactionId,
  twilioCallSid,
  twilioFrom,
  twilioTo,
  extraDynamicVariables = {},
}) => {
  const interaction = await resolveInteractionContext(interactionId);
  if (!interaction) {
    throw new Error(`Interaction log not found for id=${interactionId}`);
  }

  const debtCase = interaction.debtCase;
  const debtor = debtCase?.debtor;
  if (!debtCase || !debtor) {
    throw new Error(`Interaction ${interactionId} has no debt case/debtor context`);
  }

  const demoSource = debtCase?.meta?.source === 'demo-ui';
  const agentId =
    (demoSource ? process.env.ELEVENLABS_AGENT_ID_DEMO : null) ||
    process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    throw new Error('Missing ELEVENLABS_AGENT_ID env var');
  }

  const resolvedPolicy = await resolvePolicyForCase(interaction.tenantId, debtCase);
  const flowRules = getRulesFromResolvedPolicy(resolvedPolicy);
  const tenant = await Tenant.findByPk(interaction.tenantId, {
    attributes: ['id', 'name'],
  });

  const customInstructions = resolvedPolicy?.rules?.custom_instructions ?? '';
  const openingMessageFromRules = resolvedPolicy?.rules?.opening_message ?? '';
  const tenantDisplayNameFromRules = resolvedPolicy?.rules?.tenant_display_name ?? '';
  const metaForVariables = {
    ...(debtCase.meta || {}),
    channels: debtCase.meta?.channels ?? resolvedPolicy?.rules?.payment_channels,
  };
  const openingMessage = String(
    metaForVariables.opening_message || openingMessageFromRules || ''
  )
    .trim()
    .slice(0, 2000);
  const tenantDisplayName = String(
    metaForVariables.tenant_name ||
      metaForVariables.tenant_display_name ||
      tenantDisplayNameFromRules ||
      tenant?.name ||
      ''
  )
    .trim()
    .slice(0, 200);
  if (!tenantDisplayName) {
    throw new Error(
      'Missing tenant display name for ElevenLabs context (tenant_name is required).'
    );
  }

  const fallbackOpeningMessage = `Hi ${debtor.fullName}, I'm Ivanna from ${tenantDisplayName}. I'm calling about your ${centsToDisplayAmount(
    debtCase.amountDueCents
  )} dollar balance. Is now a good time to review payment options?`;
  const resolvedOpeningMessage = openingMessage || fallbackOpeningMessage;

  const dynamicVariables = {
    tenant_id: String(interaction.tenantId),
    case_id: String(debtCase.id),
    debtor_id: String(debtor.id),
    interaction_id: String(interaction.id),
    customer_name: debtor.fullName,
    balance_amount_cents: String(debtCase.amountDueCents),
    balance_amount: centsToDisplayAmount(debtCase.amountDueCents),
    currency: debtCase.currency || 'USD',
    call_sid: twilioCallSid || '',
    max_installments: String(flowRules.maxInstallments),
    min_upfront_pct: String(flowRules.minUpfrontPct),
    custom_instructions: String(customInstructions || '').slice(0, 2000),
    opening_message: resolvedOpeningMessage,
    initial_message: resolvedOpeningMessage,
    tenant_name: tenantDisplayName,
    tenant_display_name: tenantDisplayName,
    ...buildCaseMetadataDynamicVariables(metaForVariables),
    ...extraDynamicVariables,
  };

  const payload = {
    agent_id: agentId,
    from_number: twilioFrom || process.env.TWILIO_FROM_NUMBER || '',
    to_number: twilioTo || debtor.phone || '',
    direction: 'outbound',
    conversation_initiation_client_data: {
      user_id: twilioTo || debtor.phone || '',
      source_info: {
        source: process.env.ELEVENLABS_SOURCE || 'twilio',
        version: 'v1',
      },
      dynamic_variables: dynamicVariables,
    },
  };

  if (!payload.from_number || !payload.to_number) {
    throw new Error('Missing from_number/to_number required by ElevenLabs register-call');
  }

  const twiml = await registerTwilioCallInElevenLabs(payload);

  await interaction.update({
    status: 'in_progress',
    startedAt: interaction.startedAt || new Date(),
    channelProvider: 'ELEVENLABS_TWILIO',
    providerRef: twilioCallSid || interaction.providerRef || null,
    aiData: {
      ...(interaction.aiData || {}),
      eleven_register_payload: payload,
    },
  });

  return { twiml, interaction, payload };
};

export const syncInteractionFromPostCall = async ({ normalizedPayload, s3Key }) => {
  const interactionId = normalizedPayload.interactionId;
  let interaction = null;

  if (interactionId) {
    interaction = await InteractionLog.findOne({
      where: { id: interactionId },
      include: [{ model: DebtCase, as: 'debtCase' }],
    });
  }

  if (!interaction && normalizedPayload.conversationId) {
    interaction = await InteractionLog.findOne({
      where: { providerRef: normalizedPayload.conversationId },
      include: [{ model: DebtCase, as: 'debtCase' }],
      order: [['updatedAt', 'DESC']],
    });
  }

  if (!interaction) {
    logger.warn(
      { interactionId, conversationId: normalizedPayload.conversationId },
      'Could not match ElevenLabs post-call payload to interaction log'
    );
    return null;
  }

  const interactionOutcome = SUPPORTED_INTERACTION_OUTCOMES.has(normalizedPayload.outcome)
    ? normalizedPayload.outcome
    : null;

  await interaction.update({
    status: 'completed',
    channelProvider: 'ELEVENLABS_TWILIO',
    providerRef: normalizedPayload.conversationId || interaction.providerRef,
    outcome: interactionOutcome || interaction.outcome,
    startedAt: normalizedPayload.startedAt || interaction.startedAt,
    endedAt: normalizedPayload.endedAt || new Date(),
    transcript: JSON.stringify(normalizedPayload.transcript || []),
    summary: normalizedPayload.summary || interaction.summary,
    aiData: {
      ...(interaction.aiData || {}),
      eleven: {
        conversation_id: normalizedPayload.conversationId,
        call_sid: normalizedPayload.callSid,
        dynamic_variables: normalizedPayload.dynamicVariables,
        metadata: normalizedPayload.raw?.data?.metadata || null,
        analysis: normalizedPayload.raw?.data?.analysis || null,
        s3_key: s3Key || null,
      },
    },
  });

  if (interaction.debtCase) {
    const nextCaseStatus = resolveCaseStatusFromOutcome(
      interaction.debtCase.status,
      interactionOutcome
    );

    await interaction.debtCase.update({
      ...(nextCaseStatus ? { status: nextCaseStatus } : {}),
      lastContactedAt: normalizedPayload.endedAt || new Date(),
      ...(interactionOutcome === 'CALLBACK_REQUESTED'
        ? {
            nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            meta: {
              ...(interaction.debtCase.meta || {}),
              callback_requested: true,
            },
          }
        : {}),
    });
  }

  return interaction;
};

export const createPaymentAgreementFromTool = async ({
  tenantId,
  caseId,
  interactionId,
  conversationId,
  proposal,
}) => {
  const debtCase = await DebtCase.findOne({
    where: { id: caseId, tenantId },
    include: [{ model: Debtor, as: 'debtor' }],
  });

  if (!debtCase) {
    return {
      ok: false,
      code: 'CASE_NOT_FOUND',
      message: 'Debt case not found for the provided tenant_id and case_id.',
    };
  }

  const resolvedPolicy = await resolvePolicyForCase(tenantId, debtCase);
  const rules = getRulesFromResolvedPolicy(resolvedPolicy);
  const validation = validateProposalAgainstRules({
    proposal,
    balanceCents: Number(debtCase.amountDueCents),
    rules,
  });

  if (!validation.ok) return validation;

  const agreementType = validation.planType === 'INSTALLMENTS_4' ? 'INSTALLMENTS' : 'PROMISE_TO_PAY';
  const firstDueDate = toDateOnly(proposal?.first_due_date);
  const agreement = await PaymentAgreement.create({
    tenantId,
    debtCaseId: debtCase.id,
    type: agreementType,
    status: 'ACCEPTED',
    totalAmountCents: Number(debtCase.amountDueCents),
    downPaymentCents: validation.upfrontAmountCents,
    installments:
      agreementType === 'INSTALLMENTS' ? Math.max(1, validation.installmentsCount || 1) : null,
    startDate: agreementType === 'INSTALLMENTS' ? firstDueDate : null,
    promiseDate: agreementType === 'PROMISE_TO_PAY' ? firstDueDate : null,
    provider: 'NONE',
    createdBy: 'AI',
    terms: {
      plan_type: validation.planType,
      proposal,
      conversation_id: conversationId || null,
      interaction_id: interactionId || null,
      rules_snapshot: rules,
      status: 'LINK_SENT',
    },
  });

  const paymentLinkUrl = await createPaymentLinkAndGetUrl({
    tenantId,
    debtCaseId: debtCase.id,
    paymentAgreementId: agreement.id,
  });
  await agreement.update({ paymentLinkUrl });

  const caseStatus = agreementType === 'INSTALLMENTS' ? 'PAYMENT_PLAN' : 'PROMISE_TO_PAY';
  await debtCase.update({
    status: caseStatus,
    paymentLinkUrl,
    lastContactedAt: new Date(),
    meta: {
      ...(debtCase.meta || {}),
      last_negotiation_channel: 'CALL_AI',
      last_agreement_id: agreement.id,
      payment_link_sent_at: new Date().toISOString(),
    },
  });

  if (debtCase.debtor?.email) {
    await InteractionLog.create({
      tenantId,
      debtCaseId: debtCase.id,
      debtorId: debtCase.debtor.id,
      type: 'EMAIL',
      direction: 'OUTBOUND',
      channelProvider: 'SYSTEM',
      status: 'sent',
      outcome: caseStatus === 'PAYMENT_PLAN' ? 'PAYMENT_PLAN' : 'PROMISE_TO_PAY',
      summary: 'Payment link sent to debtor email.',
      aiData: {
        payment_link_url: paymentLinkUrl,
        agreement_id: agreement.id,
      },
    });
  }

  return {
    ok: true,
    agreement_id: agreement.id,
    payment_link_url: paymentLinkUrl,
    email_sent: Boolean(debtCase.debtor?.email),
    case_status: caseStatus,
    speak_back:
      'Perfect. I sent your secure payment link to your email so you can complete the payment.',
  };
};
