import crypto from 'crypto';
import {
  DebtCase,
  Debtor,
  FlowPolicy,
  InteractionLog,
  PaymentAgreement,
  CaseDispute,
  CaseAutomationState,
  CollectionEvent,
  Tenant,
} from '../../models/index.js';
import { resolvePolicyForCase } from '../collections/policy-resolver.service.js';
import { buildPaymentInstructions } from '../pay/payment-instructions.service.js';
import {
  appendPaymentLinkAttribution,
  getOrCreatePaymentLinkUrl,
} from '../pay/payment-link-resolver.service.js';
import { sendSesEmail } from '../email/ses/ses.email.client.js';
import { sendTwilioSms } from '../twilio/sms/twilio.sms.client.js';
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
  FULL: 'full amount in one payment',
  HALF: 'percentage payment now and remainder later',
  INSTALLMENTS: 'installments plan',
  INSTALLMENTS_4: 'up to 4 installments with minimum upfront',
  full: 'full amount in one payment',
  half: '50% now and remainder later',
  installments_4: 'up to 4 installments with minimum 25% upfront',
};

const PAYMENT_CHANNEL_LABELS = {
  link: 'payment link',
  card: 'debit/credit card',
  transfer: 'bank transfer',
  zelle: 'zelle',
  cash: 'cash (physical point)',
  check: 'check (mail/drop-off)',
};

const DISPUTE_REASON_ALIASES = {
  PAID_ALREADY: new Set([
    'paid',
    'paid_already',
    'already_paid',
    'payment_made',
    'settled',
  ]),
  WRONG_AMOUNT: new Set([
    'wrong_amount',
    'incorrect_amount',
    'amount_wrong',
    'incorrect_balance',
  ]),
  WRONG_DEBTOR: new Set([
    'wrong_debtor',
    'wrong_person',
    'not_mine',
    'not_me',
    'identity_issue',
    'fraud',
  ]),
  LEASE_ENDED: new Set(['lease_ended', 'moved_out', 'no_longer_tenant']),
  UNDER_LEGAL_REVIEW: new Set(['legal', 'under_legal_review', 'attorney', 'court']),
  PROMISE_OFFLINE: new Set(['promise_offline', 'offline_promise']),
  DO_NOT_CONTACT: new Set(['do_not_contact', 'stop_contact', 'stop_calling']),
  OTHER: new Set(['other']),
};

const DISPUTE_REASON_VALUES = new Set(Object.keys(DISPUTE_REASON_ALIASES));
const UUID_V4_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalizeEmailCandidate = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return null;
  return isValidEmail(email) ? email : null;
};

const maskEmail = (value) => {
  const email = normalizeEmailCandidate(value);
  if (!email) return '';
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '';
  const localMasked =
    local.length <= 2 ? `${local.charAt(0) || ''}***` : `${local.slice(0, 2)}***`;
  return `${localMasked}@${domain}`;
};

/**
 * Resolve or create a PaymentLink and return the URL.
 * URL format: {base}/p/{token} — does not expose agreement ID.
 */
const createPaymentLinkAndGetUrl = async ({ tenantId, debtCaseId, paymentAgreementId }) =>
  getOrCreatePaymentLinkUrl({
    tenantId,
    debtCaseId,
    paymentAgreementId,
  });

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

const normalizePlanCodes = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => String(item).toUpperCase())
    .filter(Boolean);
};

const normalizeChannelCodes = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => String(item).toLowerCase())
    .filter(Boolean);
};

const truncateString = (value, maxLength = 4000) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

const buildPaymentInstructionSummary = (instructions = []) => {
  const chunks = [];
  for (const channel of instructions) {
    const channelParts = [];
    if (channel.reference?.value) {
      channelParts.push(`${channel.reference.label || 'Reference'}: ${channel.reference.value}`);
    }
    const fields = Array.isArray(channel.fields) ? channel.fields : [];
    for (const field of fields.slice(0, 8)) {
      if (!field?.label || !field?.value) continue;
      channelParts.push(`${field.label}: ${field.value}`);
    }
    if (channelParts.length === 0) continue;
    chunks.push(`${channel.label || channel.code}: ${channelParts.join('; ')}`);
  }
  return truncateString(chunks.join(' | '), 5000);
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

const resolvePreferredDeliveryChannel = (proposal = {}) => {
  const candidateRaw =
    proposal?.delivery_channel ||
    proposal?.deliveryChannel ||
    proposal?.preferred_delivery_channel ||
    proposal?.preferredDeliveryChannel ||
    proposal?.send_via ||
    proposal?.sendVia ||
    proposal?.channel ||
    null;

  const candidate = String(candidateRaw || '')
    .trim()
    .toLowerCase();

  if (!candidate) return null;
  if (['email', 'mail'].includes(candidate)) return 'email';
  if (['sms', 'text', 'text_message'].includes(candidate)) return 'sms';
  if (['both', 'all', 'email_sms', 'sms_email'].includes(candidate)) return 'both';
  return null;
};

const normalizeDisputeReason = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (DISPUTE_REASON_VALUES.has(raw)) return raw;

  const normalizedLower = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!normalizedLower) return 'OTHER';

  for (const [reason, aliases] of Object.entries(DISPUTE_REASON_ALIASES)) {
    if (aliases.has(normalizedLower)) return reason;
  }

  return 'OTHER';
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return defaultValue;
};

const normalizeUuid = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return UUID_V4_LIKE.test(text) ? text : null;
};

const resolveAutomationIdForCase = async ({ debtCaseId, automationId = null }) => {
  const directAutomationId = normalizeUuid(automationId);
  if (directAutomationId) return directAutomationId;

  if (automationId && !directAutomationId) {
    logger.warn(
      { automationId },
      'Ignoring non-UUID automation_id from tool payload; falling back to active state'
    );
  }

  const state = await CaseAutomationState.findOne({
    where: { debtCaseId, status: 'active' },
    order: [['updatedAt', 'DESC']],
  });
  return state?.automationId || null;
};

const createCollectionEvent = async ({
  automationId,
  debtCaseId,
  channel,
  eventType,
  payload = {},
}) => {
  if (!automationId) return null;
  return CollectionEvent.create({
    automationId,
    debtCaseId,
    channel,
    eventType,
    payload,
  });
};

const createLinkDeliveryInteractionLog = async ({
  tenantId,
  debtCaseId,
  debtorId,
  type,
  status,
  providerRef = null,
  summary = null,
  outcome = null,
  error = {},
  aiData = {},
}) =>
  InteractionLog.create({
    tenantId,
    debtCaseId,
    debtorId,
    type,
    direction: 'OUTBOUND',
    channelProvider: type === 'SMS' ? 'twilio' : 'ses',
    status,
    providerRef,
    summary,
    outcome,
    startedAt: new Date(),
    endedAt: new Date(),
    aiData,
    error,
  });

const buildAgreementSmsBody = ({ debtorName, tenantName, paymentLinkUrl }) =>
  `Hi ${debtorName}, thanks for speaking with ${tenantName}. ` +
  `Here is your secure case link to complete payment or upload dispute evidence: ${paymentLinkUrl}`;

const buildAgreementEmailSubject = (tenantName) =>
  `${tenantName} - Your secure payment link`;

const buildAgreementEmailText = ({ debtorName, tenantName, paymentLinkUrl }) =>
  [
    `Hello ${debtorName},`,
    '',
    `Thanks for speaking with ${tenantName}.`,
    'Use your secure case link below to review your account, complete payment, or upload dispute evidence:',
    paymentLinkUrl,
    '',
    'If you need help, reply to this email.',
  ].join('\n');

const buildAgreementEmailHtml = ({ debtorName, tenantName, paymentLinkUrl }) => `
  <p>Hello ${debtorName},</p>
  <p>Thanks for speaking with ${tenantName}.</p>
  <p>Use your secure case link below to review your account, complete payment, or upload dispute evidence:</p>
  <p><a href="${paymentLinkUrl}">${paymentLinkUrl}</a></p>
  <p>If you need help, reply to this email.</p>
`;

const buildDisputeSmsBody = ({ debtorName, tenantName, paymentLinkUrl }) =>
  `Hi ${debtorName}, we registered your dispute with ${tenantName}. ` +
  `Use this secure link to upload evidence and track updates: ${paymentLinkUrl}`;

const buildDisputeEmailSubject = (tenantName) =>
  `${tenantName} - Your dispute was registered`;

const buildDisputeEmailText = ({ debtorName, tenantName, paymentLinkUrl }) =>
  [
    `Hello ${debtorName},`,
    '',
    `We registered your dispute with ${tenantName}.`,
    'Use your secure case link below to upload evidence and follow the dispute status:',
    paymentLinkUrl,
    '',
    'If you need help, reply to this email.',
  ].join('\n');

const buildDisputeEmailHtml = ({ debtorName, tenantName, paymentLinkUrl }) => `
  <p>Hello ${debtorName},</p>
  <p>We registered your dispute with ${tenantName}.</p>
  <p>Use your secure case link below to upload evidence and follow the dispute status:</p>
  <p><a href="${paymentLinkUrl}">${paymentLinkUrl}</a></p>
  <p>If you need help, reply to this email.</p>
`;

const sendCaseLinkSms = async ({
  tenantId,
  debtCaseId,
  debtor,
  paymentLinkUrl,
  tenantName,
  automationId,
  context = 'agreement',
  agreementId = null,
  disputeId = null,
}) => {
  const entityKey = context === 'dispute' ? 'dispute_id' : 'agreement_id';
  const entityValue = context === 'dispute' ? disputeId : agreementId;
  const summaryBodyBuilder =
    context === 'dispute' ? buildDisputeSmsBody : buildAgreementSmsBody;
  const successEventType =
    context === 'dispute' ? 'dispute_link_sent' : 'payment_link_sent';
  const failedEventType =
    context === 'dispute' ? 'dispute_link_failed' : 'payment_link_failed';

  const to = String(debtor?.phone || '').trim();
  if (!to) {
    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'sms',
      eventType: failedEventType,
      payload: {
        reason: 'missing_phone',
        [entityKey]: entityValue,
      },
    });
    return { ok: false, channel: 'sms', reason: 'missing_phone' };
  }

  const body = summaryBodyBuilder({
    debtorName: debtor.fullName || 'there',
    tenantName,
    paymentLinkUrl,
  });

  try {
    const provider = await sendTwilioSms({ to, body });
    const log = await createLinkDeliveryInteractionLog({
      tenantId,
      debtCaseId,
      debtorId: debtor.id,
      type: 'SMS',
      status: 'sent',
      providerRef: provider.messageSid,
      summary: body.slice(0, 500),
      aiData: {
        payment_link_url: paymentLinkUrl,
        [entityKey]: entityValue,
        context: `${context}_link_delivery`,
      },
    });

    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'sms',
      eventType: successEventType,
      payload: {
        interactionLogId: log.id,
        [entityKey]: entityValue,
        to,
        providerRef: provider.messageSid,
      },
    });

    return {
      ok: true,
      channel: 'sms',
      interactionLogId: log.id,
      providerRef: provider.messageSid,
    };
  } catch (error) {
    const message = error?.message || 'SMS payment link delivery failed';
    await createLinkDeliveryInteractionLog({
      tenantId,
      debtCaseId,
      debtorId: debtor.id,
      type: 'SMS',
      status: 'failed',
      outcome: 'FAILED',
      summary: 'Payment link delivery failed by SMS.',
      error: { message },
      aiData: {
        payment_link_url: paymentLinkUrl,
        [entityKey]: entityValue,
        context: `${context}_link_delivery`,
      },
    });
    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'sms',
      eventType: failedEventType,
      payload: {
        [entityKey]: entityValue,
        reason: message,
      },
    });
    return { ok: false, channel: 'sms', reason: message };
  }
};

const sendCaseLinkEmail = async ({
  tenantId,
  debtCaseId,
  debtor,
  deliveryEmail,
  paymentLinkUrl,
  tenantName,
  automationId,
  context = 'agreement',
  agreementId = null,
  disputeId = null,
}) => {
  const entityKey = context === 'dispute' ? 'dispute_id' : 'agreement_id';
  const entityValue = context === 'dispute' ? disputeId : agreementId;
  const subjectBuilder =
    context === 'dispute' ? buildDisputeEmailSubject : buildAgreementEmailSubject;
  const textBuilder = context === 'dispute' ? buildDisputeEmailText : buildAgreementEmailText;
  const htmlBuilder = context === 'dispute' ? buildDisputeEmailHtml : buildAgreementEmailHtml;
  const successEventType =
    context === 'dispute' ? 'dispute_link_sent' : 'payment_link_sent';
  const failedEventType =
    context === 'dispute' ? 'dispute_link_failed' : 'payment_link_failed';

  const to = normalizeEmailCandidate(deliveryEmail) || normalizeEmailCandidate(debtor?.email);
  if (!to) {
    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'email',
      eventType: failedEventType,
      payload: {
        reason: deliveryEmail ? 'invalid_delivery_email' : 'missing_email',
        [entityKey]: entityValue,
      },
    });
    return {
      ok: false,
      channel: 'email',
      reason: deliveryEmail ? 'invalid_delivery_email' : 'missing_email',
    };
  }

  const subject = subjectBuilder(tenantName);
  const text = textBuilder({
    debtorName: debtor.fullName || 'there',
    tenantName,
    paymentLinkUrl,
  });
  const html = htmlBuilder({
    debtorName: debtor.fullName || 'there',
    tenantName,
    paymentLinkUrl,
  });

  try {
    const sesTags = [
      { name: 'tenant_id', value: String(tenantId) },
      { name: 'debt_case_id', value: String(debtCaseId) },
      { name: 'channel', value: 'email' },
    ];
    if (entityValue) {
      sesTags.push({ name: entityKey, value: String(entityValue) });
    }

    const provider = await sendSesEmail({
      to,
      subject,
      text,
      html,
      tags: sesTags,
    });

    const log = await createLinkDeliveryInteractionLog({
      tenantId,
      debtCaseId,
      debtorId: debtor.id,
      type: 'EMAIL',
      status: 'sent',
      providerRef: provider.messageId,
      summary: text.slice(0, 500),
      aiData: {
        payment_link_url: paymentLinkUrl,
        [entityKey]: entityValue,
        context: `${context}_link_delivery`,
      },
    });

    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'email',
      eventType: successEventType,
      payload: {
        interactionLogId: log.id,
        [entityKey]: entityValue,
        to,
        providerRef: provider.messageId,
      },
    });

    return {
      ok: true,
      channel: 'email',
      interactionLogId: log.id,
      providerRef: provider.messageId,
    };
  } catch (error) {
    const message = error?.message || 'Email payment link delivery failed';
    await createLinkDeliveryInteractionLog({
      tenantId,
      debtCaseId,
      debtorId: debtor.id,
      type: 'EMAIL',
      status: 'failed',
      outcome: 'FAILED',
      summary: 'Payment link delivery failed by email.',
      error: { message },
      aiData: {
        payment_link_url: paymentLinkUrl,
        [entityKey]: entityValue,
        context: `${context}_link_delivery`,
      },
    });
    await createCollectionEvent({
      automationId,
      debtCaseId,
      channel: 'email',
      eventType: failedEventType,
      payload: {
        [entityKey]: entityValue,
        reason: message,
      },
    });
    return { ok: false, channel: 'email', reason: message };
  }
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
  const allowedPlanCodes = normalizePlanCodes(resolvedPolicy?.rules?.allowed_plans);
  const allowedPaymentChannelCodes = normalizeChannelCodes(
    resolvedPolicy?.rules?.payment_channels
  );
  const tenant = await Tenant.findByPk(interaction.tenantId, {
    attributes: ['id', 'name'],
  });

  const paymentInstructions = await buildPaymentInstructions({
    tenantId: interaction.tenantId,
    debtCaseId: debtCase.id,
    casePublicId: debtCase.casePublicId ?? debtCase.case_public_id ?? '',
    debtorId: debtor.id,
    pmsLeaseId: debtCase.pmsLeaseId ?? debtCase.pms_lease_id ?? null,
  });

  const filteredPaymentInstructions =
    allowedPaymentChannelCodes.length > 0
      ? paymentInstructions.filter((item) =>
          allowedPaymentChannelCodes.includes(String(item.code || '').toLowerCase())
        )
      : paymentInstructions;

  const paymentInstructionsSummary = buildPaymentInstructionSummary(
    filteredPaymentInstructions
  );
  const paymentInstructionsJson = truncateString(
    JSON.stringify(filteredPaymentInstructions),
    4000
  );

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

  const complianceInstructions = [
    'Before disclosing any balance or payment details, verify you are speaking with the intended debtor.',
    `Ask: "Am I speaking with ${debtor.fullName}?"`,
    'If identity is not confirmed, do not disclose debt information and politely end the call or request callback with the debtor.',
  ].join(' ');

  const fallbackOpeningMessage = `Hi, this is Ivanna from ${tenantDisplayName}. For privacy, I can only discuss account details with the account holder. Am I speaking with ${debtor.fullName}?`;
  const resolvedOpeningMessage = openingMessage || fallbackOpeningMessage;

  const allowedPlanSelection = normalizeSelectionValues(
    allowedPlanCodes,
    PAYMENT_OPTION_LABELS
  );
  const allowedChannelSelection = normalizeSelectionValues(
    allowedPaymentChannelCodes,
    PAYMENT_CHANNEL_LABELS
  );

  const dynamicVariables = {
    tenant_id: String(interaction.tenantId),
    case_id: String(debtCase.id),
    debtor_id: String(debtor.id),
    interaction_id: String(interaction.id),
    customer_name: debtor.fullName,
    debtor_email: String(debtor.email || '').trim(),
    debtor_email_masked: maskEmail(debtor.email),
    balance_amount_cents: String(debtCase.amountDueCents),
    balance_amount: centsToDisplayAmount(debtCase.amountDueCents),
    currency: debtCase.currency || 'USD',
    call_sid: twilioCallSid || '',
    stage_name: resolvedPolicy?.stage?.name || '',
    stage_tone: resolvedPolicy?.stage?.tone || resolvedPolicy?.tone || 'professional',
    stage_min_days_past_due:
      resolvedPolicy?.stage?.minDaysPastDue != null
        ? String(resolvedPolicy.stage.minDaysPastDue)
        : '',
    stage_max_days_past_due:
      resolvedPolicy?.stage?.maxDaysPastDue != null
        ? String(resolvedPolicy.stage.maxDaysPastDue)
        : '',
    allowed_plans:
      allowedPlanSelection.ids || String(flowRules.allowedPlanTypes.join(',')),
    allowed_plans_human: allowedPlanSelection.human,
    allowed_payment_channels:
      allowedChannelSelection.ids ||
      String(allowedPaymentChannelCodes.join(',')),
    allowed_payment_channels_human: allowedChannelSelection.human,
    payment_channels_context: paymentInstructionsSummary,
    payment_channels_context_json: paymentInstructionsJson,
    max_installments: String(flowRules.maxInstallments),
    min_upfront_pct: String(flowRules.minUpfrontPct),
    half_pct: String(flowRules.halfPct),
    custom_instructions: String(customInstructions || '').slice(0, 2000),
    compliance_instructions: complianceInstructions,
    identity_verification_required: 'true',
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
  automationId,
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

  const resolvedAutomationId = await resolveAutomationIdForCase({
    debtCaseId: debtCase.id,
    automationId,
  });
  await createCollectionEvent({
    automationId: resolvedAutomationId,
    debtCaseId: debtCase.id,
    channel: 'call',
    eventType: 'agreement_created',
    payload: {
      agreement_id: agreement.id,
      interaction_id: interactionId || null,
      conversation_id: conversationId || null,
      plan_type: validation.planType,
    },
  });

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

  const requestedChannel = resolvePreferredDeliveryChannel(proposal);
  const requestedDeliveryEmail = normalizeEmailCandidate(
    proposal?.delivery_email ||
      proposal?.deliveryEmail ||
      proposal?.email ||
      proposal?.recipient_email ||
      proposal?.recipientEmail
  );
  const effectiveDeliveryEmail =
    requestedDeliveryEmail || normalizeEmailCandidate(debtCase.debtor?.email);
  const hasEmail = Boolean(effectiveDeliveryEmail);
  const hasPhone = Boolean(String(debtCase.debtor?.phone || '').trim());
  let deliveryChannels = [];

  if (requestedChannel === 'email') {
    deliveryChannels = hasEmail ? ['email'] : hasPhone ? ['sms'] : [];
  } else if (requestedChannel === 'sms') {
    deliveryChannels = hasPhone ? ['sms'] : hasEmail ? ['email'] : [];
  } else if (requestedChannel === 'both') {
    deliveryChannels = [hasEmail ? 'email' : null, hasPhone ? 'sms' : null].filter(Boolean);
  } else {
    deliveryChannels = hasEmail ? ['email'] : hasPhone ? ['sms'] : [];
  }

  const tenantDisplayName = String(
    debtCase.meta?.tenant_display_name || debtCase.meta?.tenant_name || 'Mordecai'
  );
  const deliveryResults = [];

  for (const channel of deliveryChannels) {
    const attributedLink = appendPaymentLinkAttribution(
      paymentLinkUrl,
      channel,
      resolvedAutomationId
    );
    if (channel === 'email') {
      // eslint-disable-next-line no-await-in-loop
      deliveryResults.push(
        await sendCaseLinkEmail({
          tenantId,
          debtCaseId: debtCase.id,
          debtor: debtCase.debtor,
          deliveryEmail: effectiveDeliveryEmail,
          paymentLinkUrl: attributedLink,
          tenantName: tenantDisplayName,
          automationId: resolvedAutomationId,
          context: 'agreement',
          agreementId: agreement.id,
        })
      );
      continue;
    }
    if (channel === 'sms') {
      // eslint-disable-next-line no-await-in-loop
      deliveryResults.push(
        await sendCaseLinkSms({
          tenantId,
          debtCaseId: debtCase.id,
          debtor: debtCase.debtor,
          paymentLinkUrl: attributedLink,
          tenantName: tenantDisplayName,
          automationId: resolvedAutomationId,
          context: 'agreement',
          agreementId: agreement.id,
        })
      );
    }
  }

  const successfulDeliveries = deliveryResults.filter((result) => result.ok);
  const failedDeliveries = deliveryResults.filter((result) => !result.ok);
  const sentByEmail = successfulDeliveries.some((result) => result.channel === 'email');
  const sentBySms = successfulDeliveries.some((result) => result.channel === 'sms');
  const maskedDeliveryEmail = maskEmail(effectiveDeliveryEmail);
  let speakBack =
    'Perfect. Your agreement is registered and your secure payment link is ready. I can resend it by email or SMS.';
  if (sentByEmail && sentBySms) {
    speakBack = maskedDeliveryEmail
      ? `Perfect. I sent your secure link by email to ${maskedDeliveryEmail} and by SMS. Please confirm you received it.`
      : 'Perfect. I sent your secure link by email and by SMS. Please confirm you received it.';
  } else if (sentByEmail) {
    speakBack = maskedDeliveryEmail
      ? `Perfect. I sent your secure link to ${maskedDeliveryEmail}. Please confirm you received it.`
      : 'Perfect. I sent your secure link by email. Please confirm you received it.';
  } else if (sentBySms) {
    speakBack =
      'Perfect. I sent your secure link by SMS. Please confirm you received it.';
  }

  return {
    ok: true,
    agreement_id: agreement.id,
    payment_link_url: paymentLinkUrl,
    email_sent: sentByEmail,
    sms_sent: sentBySms,
    link_delivery: {
      requested_channel: requestedChannel,
      attempted_channels: deliveryChannels,
      successful_channels: successfulDeliveries.map((d) => d.channel),
      email_masked: maskedDeliveryEmail || null,
      failed_channels: failedDeliveries.map((d) => ({
        channel: d.channel,
        reason: d.reason || null,
      })),
    },
    case_status: caseStatus,
    speak_back: speakBack,
  };
};

export const createDisputeFromTool = async ({
  tenantId,
  caseId,
  interactionId,
  conversationId,
  automationId,
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

  const reason = normalizeDisputeReason(
    proposal?.reason || proposal?.dispute_reason || proposal?.disputeReason || 'OTHER'
  );
  const notes = truncateString(
    proposal?.notes || proposal?.summary || proposal?.details || '',
    2000
  );
  const evidenceUrlsRaw =
    proposal?.evidence_urls || proposal?.evidenceUrls || proposal?.evidence_url || [];
  const evidenceUrls = (Array.isArray(evidenceUrlsRaw) ? evidenceUrlsRaw : [evidenceUrlsRaw])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  let dispute = await CaseDispute.findOne({
    where: { tenantId, debtCaseId: debtCase.id, status: 'OPEN' },
    order: [['createdAt', 'DESC']],
  });

  let disputeCreated = false;
  if (!dispute) {
    dispute = await CaseDispute.create({
      tenantId,
      debtCaseId: debtCase.id,
      status: 'OPEN',
      reason,
      notes: notes || null,
      evidenceUrls,
      openedBy: null,
      openedAt: new Date(),
    });
    disputeCreated = true;
  }

  const resolvedAutomationId = await resolveAutomationIdForCase({
    debtCaseId: debtCase.id,
    automationId,
  });

  await createCollectionEvent({
    automationId: resolvedAutomationId,
    debtCaseId: debtCase.id,
    channel: 'call',
    eventType: disputeCreated ? 'dispute_created' : 'dispute_already_open',
    payload: {
      dispute_id: dispute.id,
      interaction_id: interactionId || null,
      conversation_id: conversationId || null,
      reason: dispute.reason,
    },
  });

  await debtCase.update({
    meta: {
      ...(debtCase.meta || {}),
      last_dispute_id: dispute.id,
      last_dispute_reason: dispute.reason,
      last_dispute_opened_at: new Date().toISOString(),
      last_negotiation_channel: 'CALL_AI',
    },
  });

  const requestedChannel = resolvePreferredDeliveryChannel(proposal);
  const requestedDeliveryEmail = normalizeEmailCandidate(
    proposal?.delivery_email ||
      proposal?.deliveryEmail ||
      proposal?.email ||
      proposal?.recipient_email ||
      proposal?.recipientEmail
  );
  const effectiveDeliveryEmail =
    requestedDeliveryEmail || normalizeEmailCandidate(debtCase.debtor?.email);
  const hasEmail = Boolean(effectiveDeliveryEmail);
  const hasPhone = Boolean(String(debtCase.debtor?.phone || '').trim());
  let deliveryChannels = [];

  if (requestedChannel === 'email') {
    deliveryChannels = hasEmail ? ['email'] : hasPhone ? ['sms'] : [];
  } else if (requestedChannel === 'sms') {
    deliveryChannels = hasPhone ? ['sms'] : hasEmail ? ['email'] : [];
  } else if (requestedChannel === 'both') {
    deliveryChannels = [hasEmail ? 'email' : null, hasPhone ? 'sms' : null].filter(Boolean);
  } else {
    deliveryChannels = hasEmail ? ['email'] : hasPhone ? ['sms'] : [];
  }

  const paymentLinkUrl = await createPaymentLinkAndGetUrl({
    tenantId,
    debtCaseId: debtCase.id,
    paymentAgreementId: debtCase?.meta?.last_agreement_id || null,
  });

  const tenantDisplayName = String(
    debtCase.meta?.tenant_display_name || debtCase.meta?.tenant_name || 'Mordecai'
  );
  const shouldSendLink = parseBoolean(
    proposal?.send_link || proposal?.sendLink || proposal?.include_link,
    true
  );
  const deliveryResults = [];

  if (shouldSendLink) {
    for (const channel of deliveryChannels) {
      const attributedLink = appendPaymentLinkAttribution(
        paymentLinkUrl,
        channel,
        resolvedAutomationId
      );
      if (channel === 'email') {
        // eslint-disable-next-line no-await-in-loop
        deliveryResults.push(
          await sendCaseLinkEmail({
            tenantId,
            debtCaseId: debtCase.id,
            debtor: debtCase.debtor,
            deliveryEmail: effectiveDeliveryEmail,
            paymentLinkUrl: attributedLink,
            tenantName: tenantDisplayName,
            automationId: resolvedAutomationId,
            context: 'dispute',
            disputeId: dispute.id,
          })
        );
        continue;
      }

      if (channel === 'sms') {
        // eslint-disable-next-line no-await-in-loop
        deliveryResults.push(
          await sendCaseLinkSms({
            tenantId,
            debtCaseId: debtCase.id,
            debtor: debtCase.debtor,
            paymentLinkUrl: attributedLink,
            tenantName: tenantDisplayName,
            automationId: resolvedAutomationId,
            context: 'dispute',
            disputeId: dispute.id,
          })
        );
      }
    }
  }

  const successfulDeliveries = deliveryResults.filter((result) => result.ok);
  const failedDeliveries = deliveryResults.filter((result) => !result.ok);
  const sentByEmail = successfulDeliveries.some((result) => result.channel === 'email');
  const sentBySms = successfulDeliveries.some((result) => result.channel === 'sms');
  const maskedDeliveryEmail = maskEmail(effectiveDeliveryEmail);

  let speakBack =
    'Understood. I registered your dispute and paused negotiation while the team reviews your case.';
  if (shouldSendLink && sentByEmail && sentBySms) {
    speakBack = maskedDeliveryEmail
      ? `Understood. I registered your dispute and sent your secure case link to ${maskedDeliveryEmail} and by SMS.`
      : 'Understood. I registered your dispute and sent your secure case link by email and SMS.';
  } else if (shouldSendLink && sentByEmail) {
    speakBack = maskedDeliveryEmail
      ? `Understood. I registered your dispute and sent your secure case link to ${maskedDeliveryEmail}.`
      : 'Understood. I registered your dispute and sent your secure case link by email.';
  } else if (shouldSendLink && sentBySms) {
    speakBack =
      'Understood. I registered your dispute and sent your secure case link by SMS.';
  } else if (shouldSendLink && deliveryChannels.length === 0) {
    speakBack =
      'Understood. I registered your dispute, but I could not send a link because contact details are missing.';
  }

  return {
    ok: true,
    dispute_id: dispute.id,
    dispute_status: dispute.status,
    dispute_reason: dispute.reason,
    payment_link_url: paymentLinkUrl,
    email_sent: sentByEmail,
    sms_sent: sentBySms,
    link_delivery: {
      requested_channel: requestedChannel,
      attempted_channels: shouldSendLink ? deliveryChannels : [],
      successful_channels: successfulDeliveries.map((d) => d.channel),
      email_masked: maskedDeliveryEmail || null,
      failed_channels: failedDeliveries.map((d) => ({
        channel: d.channel,
        reason: d.reason || null,
      })),
    },
    speak_back: speakBack,
  };
};
