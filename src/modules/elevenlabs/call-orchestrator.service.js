import {
  CaseAutomationState,
  CollectionEvent,
  DebtCase,
  Debtor,
  FlowPolicy,
  InteractionLog,
  Tenant,
} from '../../models/index.js';
import { resolvePolicyForCase } from '../collections/policy-resolver.service.js';
import { logger } from '../../utils/logger.js';
import {
  CALL_ACTIONS,
  CALL_STATES,
  getAllowedTransitions,
  isAllowedTransition,
  normalizeCallState,
} from './call-state-machine.js';

const PLAN_LABELS = Object.freeze({
  FULL: 'full payment',
  HALF: 'half now and remainder later',
  INSTALLMENTS_4: 'up to 4 installments',
});

const CHANNEL_LABELS = Object.freeze({
  email: 'email',
  sms: 'sms',
  both: 'both',
});

const DELIVERY_CHANNEL_VALUES = new Set(Object.keys(CHANNEL_LABELS));

const DISPUTE_KEYWORDS = [
  'already paid',
  'i paid',
  'paid already',
  'wrong debt',
  'wrong amount',
  'fraud',
  'not my debt',
  'not mine',
  'legal',
  'attorney',
  'do not contact',
  'stop calling',
];

const AFFIRMATIVE_PATTERNS = [
  /\byes\b/i,
  /\byep\b/i,
  /\byeah\b/i,
  /\bcorrect\b/i,
  /\bconfirm\b/i,
  /\bi am\b/i,
  /\bthat's right\b/i,
];

const NEGATIVE_PATTERNS = [
  /\bno\b/i,
  /\bnot\b/i,
  /\bwrong person\b/i,
  /\bnot me\b/i,
];

const CALLBACK_PATTERNS = [
  /\bcall me later\b/i,
  /\bcallback\b/i,
  /\banother time\b/i,
  /\bin \d+\s*(minute|minutes|hour|hours)\b/i,
];

const GOODBYE_PATTERNS = [
  /\bbye\b/i,
  /\bgoodbye\b/i,
  /\bthat(?:'s| is) all\b/i,
  /\bno thank you\b/i,
];

const PLAN_PATTERNS = [
  { code: 'FULL', pattern: /\bfull\b|\bone payment\b|\bpay all\b/i },
  { code: 'HALF', pattern: /\bhalf\b|\b50%?\b/i },
  { code: 'INSTALLMENTS_4', pattern: /\binstallments?\b|\b4 installments?\b|\bfour installments?\b/i },
];

const CHANNEL_PATTERNS = [
  { code: 'both', pattern: /\bboth\b/i },
  { code: 'email', pattern: /\bemail\b/i },
  { code: 'sms', pattern: /\bsms\b|\btext\b/i },
];

const getRulesFromResolvedPolicy = (resolvedPolicy) => {
  const rules = resolvedPolicy?.rules || {};
  const allowedPlans = Array.isArray(rules.allowed_plans) ? rules.allowed_plans : ['FULL', 'HALF', 'INSTALLMENTS'];
  const allowedPlanTypes = allowedPlans.map((plan) =>
    String(plan).toUpperCase() === 'INSTALLMENTS' ? 'INSTALLMENTS_4' : String(plan).toUpperCase()
  );
  const paymentChannelsRaw = Array.isArray(rules.payment_channels) ? rules.payment_channels : [];
  const paymentChannels = paymentChannelsRaw
    .map((channel) => String(channel).toLowerCase())
    .filter(Boolean);

  return {
    allowedPlanTypes: allowedPlanTypes.length ? allowedPlanTypes : ['FULL', 'HALF', 'INSTALLMENTS_4'],
    paymentChannels,
    stageName: String(resolvedPolicy?.stage?.name || '').trim(),
    stageTone: String(resolvedPolicy?.stage?.tone || '').trim(),
    minUpfrontPct: Number(rules.min_upfront_pct ?? 25),
    halfPct: Number(rules.half_pct ?? 50),
    maxInstallments: Number(rules.max_installments ?? 4),
  };
};

const resolveInteraction = async ({ tenantId, caseId, interactionId }) => {
  if (interactionId) {
    const byId = await InteractionLog.findOne({
      where: {
        id: interactionId,
        tenantId,
        debtCaseId: caseId,
        type: 'CALL',
      },
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
    if (byId) return byId;
  }

  return InteractionLog.findOne({
    where: {
      tenantId,
      debtCaseId: caseId,
      type: 'CALL',
    },
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
    order: [['createdAt', 'DESC']],
  });
};

const resolveAutomationIdForCase = async ({ debtCaseId }) => {
  const state = await CaseAutomationState.findOne({
    where: { debtCaseId, status: 'active' },
    order: [['updatedAt', 'DESC']],
  });
  return state?.automationId || null;
};

const createCallFsmEvent = async ({ automationId, debtCaseId, payload }) => {
  if (!automationId) return null;
  return CollectionEvent.create({
    automationId,
    debtCaseId,
    channel: 'call',
    eventType: 'call_fsm_transition',
    payload,
  });
};

const textHasPattern = (text, patterns = []) =>
  patterns.some((pattern) => pattern.test(text));

const normalizeText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const detectPlan = (text) => {
  for (const item of PLAN_PATTERNS) {
    if (item.pattern.test(text)) return item.code;
  }
  return null;
};

const detectChannel = (text) => {
  for (const item of CHANNEL_PATTERNS) {
    if (item.pattern.test(text)) return item.code;
  }
  return null;
};

const isDisputeMessage = (text) =>
  DISPUTE_KEYWORDS.some((keyword) => text.includes(keyword));

const detectIntent = ({ state, text, intentHint }) => {
  const hint = String(intentHint || '').trim().toLowerCase();
  if (hint) return hint;
  if (!text) return 'silence';
  if (isDisputeMessage(text)) return 'dispute_detected';
  if (textHasPattern(text, CALLBACK_PATTERNS)) return 'callback_requested';
  if (textHasPattern(text, GOODBYE_PATTERNS)) return 'goodbye';

  switch (state) {
    case CALL_STATES.VERIFY_IDENTITY:
      if (textHasPattern(text, AFFIRMATIVE_PATTERNS)) return 'identity_confirmed';
      if (textHasPattern(text, NEGATIVE_PATTERNS)) return 'identity_denied';
      return 'identity_unclear';
    case CALL_STATES.PLAN_SELECTION:
      if (detectPlan(text)) return 'plan_selected';
      return 'plan_unclear';
    case CALL_STATES.PAYMENT_METHOD:
      if (detectChannel(text)) return 'channel_selected';
      return 'channel_unclear';
    case CALL_STATES.CONFIRM_AGREEMENT:
      if (textHasPattern(text, AFFIRMATIVE_PATTERNS)) return 'agreement_confirmed';
      if (textHasPattern(text, NEGATIVE_PATTERNS)) return 'agreement_rejected';
      return 'agreement_unclear';
    case CALL_STATES.DISCLOSE_DEBT:
      return 'discuss_payment';
    case CALL_STATES.DISPUTE_CAPTURE:
      if (detectChannel(text)) return 'channel_selected';
      return 'dispute_details';
    default:
      return 'unknown';
  }
};

const humanizeAllowedPlans = (allowedPlans = []) =>
  allowedPlans
    .map((plan) => PLAN_LABELS[plan] || plan)
    .join(', ');

const computeTransition = ({
  state,
  intent,
  entities,
  debtorName,
  tenantName,
  balanceAmount,
  currency,
  rules,
}) => {
  const normalizedIntent = String(intent || '').toLowerCase();
  const selectedPlan = entities.planType || null;
  const selectedChannel = DELIVERY_CHANNEL_VALUES.has(
    String(entities.deliveryChannel || '').toLowerCase()
  )
    ? String(entities.deliveryChannel || '').toLowerCase()
    : null;

  if (normalizedIntent === 'goodbye' || normalizedIntent === 'callback_requested') {
    return {
      nextState: CALL_STATES.CLOSE,
      action: CALL_ACTIONS.END_CALL,
      speakBack:
        normalizedIntent === 'callback_requested'
          ? 'Understood. I will arrange a callback. Thank you.'
          : 'Thank you for your time. Have a good day.',
    };
  }

  if (normalizedIntent === 'dispute_detected') {
    if (state === CALL_STATES.DISPUTE_CAPTURE || state === CALL_STATES.EXECUTE_DISPUTE) {
      return {
        nextState: selectedChannel ? CALL_STATES.EXECUTE_DISPUTE : CALL_STATES.DISPUTE_CAPTURE,
        action: selectedChannel
          ? CALL_ACTIONS.CALL_CREATE_DISPUTE
          : CALL_ACTIONS.NONE,
        speakBack: selectedChannel
          ? 'Understood. I will register the dispute now.'
          : 'Understood. Which delivery channel should we use for the secure case link: email, sms, or both?',
      };
    }
    return {
      nextState: CALL_STATES.DISPUTE_CAPTURE,
      action: CALL_ACTIONS.NONE,
      speakBack:
        'Understood. I can register a dispute. Which delivery channel should we use: email, sms, or both?',
    };
  }

  switch (state) {
    case CALL_STATES.VERIFY_IDENTITY:
      if (normalizedIntent === 'identity_confirmed') {
        return {
          nextState: CALL_STATES.DISCLOSE_DEBT,
          action: CALL_ACTIONS.NONE,
          speakBack:
            `This is an attempt to collect a debt and any information obtained will be used for that purpose. ` +
            `Your current balance is ${balanceAmount} ${currency}. ` +
            `Would you like to discuss payment options now?`,
        };
      }
      if (normalizedIntent === 'identity_denied') {
        return {
          nextState: CALL_STATES.CLOSE,
          action: CALL_ACTIONS.END_CALL,
          speakBack:
            `Understood. I cannot discuss account details without identity verification for ${debtorName}. Goodbye.`,
        };
      }
      return {
        nextState: CALL_STATES.VERIFY_IDENTITY,
        action: CALL_ACTIONS.NONE,
        speakBack:
          `For privacy, I need to verify identity first. Am I speaking with ${debtorName}?`,
      };

    case CALL_STATES.DISCLOSE_DEBT:
      return {
        nextState: CALL_STATES.PLAN_SELECTION,
        action: CALL_ACTIONS.NONE,
        speakBack:
          `Available plans are: ${humanizeAllowedPlans(rules.allowedPlanTypes)}. Which option works for you?`,
      };

    case CALL_STATES.PLAN_SELECTION:
      if (selectedPlan && rules.allowedPlanTypes.includes(selectedPlan)) {
        return {
          nextState: CALL_STATES.PAYMENT_METHOD,
          action: CALL_ACTIONS.NONE,
          speakBack:
            `Great. We can proceed with ${PLAN_LABELS[selectedPlan] || selectedPlan}. ` +
            `Which delivery channel do you prefer for the secure link: email, sms, or both?`,
        };
      }
      return {
        nextState: CALL_STATES.PLAN_SELECTION,
        action: CALL_ACTIONS.NONE,
        speakBack:
          `Please choose one allowed plan: ${humanizeAllowedPlans(rules.allowedPlanTypes)}.`,
      };

    case CALL_STATES.PAYMENT_METHOD:
      if (selectedChannel) {
        return {
          nextState: CALL_STATES.CONFIRM_AGREEMENT,
          action: CALL_ACTIONS.NONE,
          speakBack:
            `I will use ${selectedChannel}. Please confirm if you want me to create the payment agreement now.`,
        };
      }
      return {
        nextState: CALL_STATES.PAYMENT_METHOD,
        action: CALL_ACTIONS.NONE,
        speakBack: 'Please choose a delivery channel: email, sms, or both.',
      };

    case CALL_STATES.CONFIRM_AGREEMENT:
      if (normalizedIntent === 'agreement_confirmed') {
        return {
          nextState: CALL_STATES.EXECUTE_AGREEMENT,
          action: CALL_ACTIONS.CALL_CREATE_PAYMENT_AGREEMENT,
          speakBack: 'Understood. I will create your payment agreement now.',
        };
      }
      if (normalizedIntent === 'agreement_rejected') {
        return {
          nextState: CALL_STATES.PLAN_SELECTION,
          action: CALL_ACTIONS.NONE,
          speakBack: 'No problem. Which plan would you like instead?',
        };
      }
      return {
        nextState: CALL_STATES.CONFIRM_AGREEMENT,
        action: CALL_ACTIONS.NONE,
        speakBack:
          'Please confirm to proceed. Should I create the payment agreement now?',
      };

    case CALL_STATES.EXECUTE_AGREEMENT:
      return {
        nextState: CALL_STATES.EXECUTE_AGREEMENT,
        action: CALL_ACTIONS.CALL_CREATE_PAYMENT_AGREEMENT,
        speakBack:
          'I am ready to create the payment agreement now. Please execute the tool.',
      };

    case CALL_STATES.DISPUTE_CAPTURE:
      if (selectedChannel) {
        return {
          nextState: CALL_STATES.EXECUTE_DISPUTE,
          action: CALL_ACTIONS.CALL_CREATE_DISPUTE,
          speakBack: 'Understood. I will register the dispute now.',
        };
      }
      return {
        nextState: CALL_STATES.DISPUTE_CAPTURE,
        action: CALL_ACTIONS.NONE,
        speakBack:
          'Please confirm delivery channel for the secure dispute link: email, sms, or both.',
      };

    case CALL_STATES.EXECUTE_DISPUTE:
      return {
        nextState: CALL_STATES.EXECUTE_DISPUTE,
        action: CALL_ACTIONS.CALL_CREATE_DISPUTE,
        speakBack:
          'I am ready to register the dispute now. Please execute the tool.',
      };

    case CALL_STATES.CLOSE:
    default:
      return {
        nextState: CALL_STATES.CLOSE,
        action: CALL_ACTIONS.END_CALL,
        speakBack: `Thank you for speaking with ${tenantName}. Goodbye.`,
      };
  }
};

const deriveEntities = ({ text, entities = {} }) => {
  const merged = { ...(entities && typeof entities === 'object' ? entities : {}) };
  const detectedPlan = detectPlan(text);
  if (!merged.planType && detectedPlan) merged.planType = detectedPlan;
  const detectedChannel = detectChannel(text);
  if (!merged.deliveryChannel && detectedChannel) merged.deliveryChannel = detectedChannel;
  return merged;
};

const resolveStateFromInteraction = (interaction, requestedState) => {
  const requested = normalizeCallState(requestedState);
  if (requested) return requested;
  const current =
    interaction?.aiData?.eleven?.call_state?.state ||
    interaction?.aiData?.call_state?.state ||
    null;
  return normalizeCallState(current) || CALL_STATES.VERIFY_IDENTITY;
};

const toDisplayAmount = (amountCents) => {
  const numeric = Number(amountCents || 0) / 100;
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
};

export const orchestrateCallStepFromTool = async ({
  tenantId,
  caseId,
  interactionId,
  currentState,
  userUtterance,
  intentHint,
  entities,
}) => {
  const interaction = await resolveInteraction({ tenantId, caseId, interactionId });
  if (!interaction) {
    return {
      ok: false,
      code: 'INTERACTION_NOT_FOUND',
      message: 'Call interaction context was not found.',
    };
  }

  const debtCase = interaction.debtCase;
  const debtor = debtCase?.debtor;
  if (!debtCase || !debtor) {
    return {
      ok: false,
      code: 'CASE_CONTEXT_NOT_FOUND',
      message: 'Debt case or debtor context missing for orchestration.',
    };
  }

  const tenant = await Tenant.findByPk(tenantId, { attributes: ['name'] });
  const tenantName = String(
    debtCase?.meta?.tenant_display_name ||
      debtCase?.meta?.tenant_name ||
      tenant?.name ||
      'collections team'
  ).trim();
  const resolvedPolicy = await resolvePolicyForCase(tenantId, debtCase);
  const rules = getRulesFromResolvedPolicy(resolvedPolicy);

  const normalizedState = resolveStateFromInteraction(interaction, currentState);
  const normalizedText = normalizeText(userUtterance).toLowerCase();
  const mergedEntities = deriveEntities({ text: normalizedText, entities });
  const intent = detectIntent({
    state: normalizedState,
    text: normalizedText,
    intentHint,
  });

  const transition = computeTransition({
    state: normalizedState,
    intent,
    entities: mergedEntities,
    debtorName: debtor.fullName || 'the account holder',
    tenantName,
    balanceAmount: toDisplayAmount(debtCase.amountDueCents),
    currency: debtCase.currency || 'USD',
    rules,
  });

  const nextState = isAllowedTransition(normalizedState, transition.nextState)
    ? transition.nextState
    : normalizedState;
  const shouldClose = nextState === CALL_STATES.CLOSE;
  const previousCallState = interaction?.aiData?.eleven?.call_state || {};

  await interaction.update({
    aiData: {
      ...(interaction.aiData || {}),
      eleven: {
        ...(interaction.aiData?.eleven || {}),
        call_state: {
          state: nextState,
          previous_state: normalizedState,
          last_intent: intent,
          last_action: transition.action,
          last_user_utterance: normalizeText(userUtterance),
          entities: mergedEntities,
          transition_count: Number(previousCallState.transition_count || 0) + 1,
          updated_at: new Date().toISOString(),
        },
      },
    },
  });

  const resolvedAutomationId = await resolveAutomationIdForCase({
    debtCaseId: debtCase.id,
  });
  await createCallFsmEvent({
    automationId: resolvedAutomationId,
    debtCaseId: debtCase.id,
    payload: {
      interaction_id: interaction.id,
      state_before: normalizedState,
      state_after: nextState,
      intent,
      action: transition.action,
      should_close: shouldClose,
    },
  });

  logger.info(
    {
      interactionId: interaction.id,
      debtCaseId: debtCase.id,
      stateBefore: normalizedState,
      stateAfter: nextState,
      intent,
      action: transition.action,
      shouldClose,
    },
    'ElevenLabs call FSM step orchestrated'
  );

  return {
    ok: true,
    interaction_id: interaction.id,
    current_state: normalizedState,
    next_state: nextState,
    intent,
    action: transition.action,
    should_close: shouldClose,
    speak_back: transition.speakBack,
    allowed_transitions: getAllowedTransitions(nextState),
    entities: mergedEntities,
    policy: {
      stage_name: rules.stageName || null,
      stage_tone: rules.stageTone || null,
      allowed_plan_types: rules.allowedPlanTypes,
      allowed_payment_channels: rules.paymentChannels,
      max_installments: rules.maxInstallments,
      min_upfront_pct: rules.minUpfrontPct,
      half_pct: rules.halfPct,
    },
  };
};
