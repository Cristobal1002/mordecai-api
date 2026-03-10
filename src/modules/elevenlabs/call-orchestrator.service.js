import {
  CaseAutomationState,
  CollectionEvent,
  DebtCase,
  Debtor,
  FlowPolicy,
  InteractionLog,
  Tenant,
} from "../../models/index.js";
import { resolvePolicyForCase } from "../collections/policy-resolver.service.js";
import { logger } from "../../utils/logger.js";
import {
  CALL_ACTIONS,
  CALL_STATES,
  getAllowedTransitions,
  isAllowedTransition,
  normalizeCallState,
} from "./call-state-machine.js";
import { classifyCallAction } from "./nlu/action-classifier.service.js";
import { extractSlotPatch } from "./nlu/slot-extractor.service.js";
import {
  DEFAULT_CALL_SLOTS,
  applyAgreementDefaults,
  buildAgreementProposalFromSlots,
  buildDisputeProposalFromSlots,
  countSlotOverwrites,
  deriveSlotPatchFromAction,
  hasMeaningfulProposal,
  mergeCallSlots,
  proposalsAreEqual,
  sanitizeCallSlots,
} from "./dialog/slot-manager.service.js";
import { reduceCallState } from "./dialog/call-reducer.service.js";
import { getPlanCatalogFromResolvedPolicy } from "./policy/plan-catalog.service.js";

const ACTION_CONFIDENCE_THRESHOLD =
  Number(process.env.CALL_ACTION_CONFIDENCE_THRESHOLD) || 0.6;

const DEFAULT_TELEMETRY = Object.freeze({
  transition_count: 0,
  loop_count: 0,
  invalid_transition_count: 0,
  slot_overwrite_count: 0,
  low_confidence_count: 0,
  fallback_llm_count: 0,
  tool_mismatch_count: 0,
  avg_nlu_confidence: 0,
  loop_rate: 0,
  slot_overwrite_rate: 0,
  fallback_llm_rate: 0,
  tool_mismatch_rate: 0,
});

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const toRate = (count, total) => {
  if (!total || total <= 0) return 0;
  const numeric = Number(count) / Number(total);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)) : 0;
};

const resolveInteraction = async ({ tenantId, caseId, interactionId }) => {
  if (interactionId) {
    const byId = await InteractionLog.findOne({
      where: {
        id: interactionId,
        tenantId,
        debtCaseId: caseId,
        type: "CALL",
      },
      include: [
        {
          model: DebtCase,
          as: "debtCase",
          include: [
            { model: Debtor, as: "debtor" },
            { model: FlowPolicy, as: "flowPolicy" },
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
      type: "CALL",
    },
    include: [
      {
        model: DebtCase,
        as: "debtCase",
        include: [
          { model: Debtor, as: "debtor" },
          { model: FlowPolicy, as: "flowPolicy" },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

const resolveAutomationIdForCase = async ({ debtCaseId }) => {
  const state = await CaseAutomationState.findOne({
    where: { debtCaseId, status: "active" },
    order: [["updatedAt", "DESC"]],
  });
  return state?.automationId || null;
};

const createCallFsmEvent = async ({ automationId, debtCaseId, payload }) => {
  if (!automationId) return null;
  return CollectionEvent.create({
    automationId,
    debtCaseId,
    channel: "call",
    eventType: "call_fsm_transition",
    payload,
  });
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

const resolveDeliveryChannelsForDebtor = (debtor) => {
  const hasEmail = Boolean(
    String(debtor?.email || "").trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(debtor?.email || "").trim()),
  );
  const hasPhone = Boolean(String(debtor?.phone || "").trim());
  if (hasEmail && hasPhone) return ["email", "sms", "both"];
  if (hasEmail) return ["email"];
  if (hasPhone) return ["sms"];
  return [];
};

const resolvePreviousCallState = (interaction) => {
  const callState = interaction?.aiData?.eleven?.call_state || {};
  const previousSlots =
    callState?.slots && typeof callState.slots === "object"
      ? callState.slots
      : {};
  const previousTelemetry =
    callState?.telemetry && typeof callState.telemetry === "object"
      ? callState.telemetry
      : {};
  const previousProposalSnapshot =
    callState?.proposal_snapshot &&
    typeof callState.proposal_snapshot === "object"
      ? callState.proposal_snapshot
      : {};
  const previousProposalCommitted =
    callState?.proposal_committed &&
    typeof callState.proposal_committed === "object"
      ? callState.proposal_committed
      : {};

  return {
    callState,
    previousSlots: { ...DEFAULT_CALL_SLOTS, ...previousSlots },
    previousTelemetry: { ...DEFAULT_TELEMETRY, ...previousTelemetry },
    previousProposalSnapshot,
    previousProposalCommitted,
  };
};

const updateProposalSnapshots = ({
  nowIso,
  previousProposalSnapshot,
  previousProposalCommitted,
  agreementDraft,
  disputeDraft,
  reducer,
  slots,
}) => {
  let proposalSnapshot = {
    agreement: previousProposalSnapshot?.agreement || null,
    dispute: previousProposalSnapshot?.dispute || null,
    version: Number(previousProposalSnapshot?.version || 0),
    updated_at: previousProposalSnapshot?.updated_at || null,
  };

  if (
    hasMeaningfulProposal(disputeDraft) &&
    !proposalsAreEqual(proposalSnapshot.dispute, disputeDraft)
  ) {
    proposalSnapshot = {
      ...proposalSnapshot,
      dispute: disputeDraft,
      version: proposalSnapshot.version + 1,
      updated_at: nowIso,
    };
  }

  if (
    reducer?.flags?.requestAgreementSnapshot &&
    hasMeaningfulProposal(agreementDraft) &&
    !proposalsAreEqual(proposalSnapshot.agreement, agreementDraft)
  ) {
    proposalSnapshot = {
      ...proposalSnapshot,
      agreement: agreementDraft,
      version: proposalSnapshot.version + 1,
      updated_at: nowIso,
    };
  }

  if (reducer?.flags?.resetAgreementFields) {
    proposalSnapshot = {
      ...proposalSnapshot,
      agreement: null,
      version: proposalSnapshot.version + 1,
      updated_at: nowIso,
    };
  }

  let proposalCommitted = {
    agreement: previousProposalCommitted?.agreement || null,
    dispute: previousProposalCommitted?.dispute || null,
    version: Number(previousProposalCommitted?.version || 0),
    committed_at: previousProposalCommitted?.committed_at || null,
    source: previousProposalCommitted?.source || null,
  };

  if (reducer?.flags?.commitAgreementProposal) {
    const agreementToCommit =
      proposalSnapshot.agreement || agreementDraft || null;
    if (
      hasMeaningfulProposal(agreementToCommit) &&
      !proposalsAreEqual(proposalCommitted.agreement, agreementToCommit)
    ) {
      proposalCommitted = {
        ...proposalCommitted,
        agreement: agreementToCommit,
        version: proposalCommitted.version + 1,
        committed_at: nowIso,
        source: "orchestrator",
      };
    }
  }

  if (reducer?.flags?.commitDisputeProposal) {
    const disputeToCommit = proposalSnapshot.dispute || disputeDraft || null;
    if (
      hasMeaningfulProposal(disputeToCommit) &&
      !proposalsAreEqual(proposalCommitted.dispute, disputeToCommit)
    ) {
      proposalCommitted = {
        ...proposalCommitted,
        dispute: disputeToCommit,
        version: proposalCommitted.version + 1,
        committed_at: nowIso,
        source: "orchestrator",
      };
    }
  }

  if (slots?.dispute_detected !== true && proposalSnapshot.dispute) {
    proposalSnapshot = {
      ...proposalSnapshot,
      dispute: null,
      version: proposalSnapshot.version + 1,
      updated_at: nowIso,
    };
  }

  return { proposalSnapshot, proposalCommitted };
};

const computeTelemetry = ({
  previousTelemetry,
  actionDecision,
  slotOverwrites,
  stateBefore,
  stateAfter,
  invalidTransition,
  toolAction,
  reducer,
}) => {
  const transitionCount = Number(previousTelemetry.transition_count || 0) + 1;
  const loopCount =
    Number(previousTelemetry.loop_count || 0) +
    (stateBefore === stateAfter ? 1 : 0);
  const invalidTransitionCount =
    Number(previousTelemetry.invalid_transition_count || 0) +
    (invalidTransition ? 1 : 0);
  const slotOverwriteCount =
    Number(previousTelemetry.slot_overwrite_count || 0) +
    Number(slotOverwrites || 0);
  const lowConfidenceCount =
    Number(previousTelemetry.low_confidence_count || 0) +
    (Number(actionDecision?.confidence || 0) < ACTION_CONFIDENCE_THRESHOLD
      ? 1
      : 0);
  const fallbackLlmCount =
    Number(previousTelemetry.fallback_llm_count || 0) +
    (actionDecision?.source === "llm_fallback" ? 1 : 0);

  const hasToolMismatch =
    reducer?.flags?.toolMismatch ||
    Boolean(
      invalidTransition &&
        reducer?.toolAction &&
        reducer.toolAction !== CALL_ACTIONS.NONE,
    );
  const toolMismatchCount =
    Number(previousTelemetry.tool_mismatch_count || 0) +
    (hasToolMismatch ? 1 : 0);

  const previousTransitions = Number(previousTelemetry.transition_count || 0);
  const previousAverage = Number(previousTelemetry.avg_nlu_confidence || 0);
  const avgNluConfidence =
    (previousAverage * previousTransitions +
      Number(actionDecision?.confidence || 0)) /
    transitionCount;

  return {
    transition_count: transitionCount,
    loop_count: loopCount,
    invalid_transition_count: invalidTransitionCount,
    slot_overwrite_count: slotOverwriteCount,
    low_confidence_count: lowConfidenceCount,
    fallback_llm_count: fallbackLlmCount,
    tool_mismatch_count: toolMismatchCount,
    avg_nlu_confidence: Number(avgNluConfidence.toFixed(4)),
    loop_rate: toRate(loopCount, transitionCount),
    slot_overwrite_rate: toRate(slotOverwriteCount, transitionCount),
    fallback_llm_rate: toRate(fallbackLlmCount, transitionCount),
    tool_mismatch_rate: toRate(toolMismatchCount, transitionCount),
  };
};

const buildPolicyResponse = ({
  planCatalog,
  resolvedPolicy,
  allowedDeliveryChannels,
}) => {
  const allowedPaymentChannels = Array.isArray(
    resolvedPolicy?.rules?.payment_channels,
  )
    ? resolvedPolicy.rules.payment_channels
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    : [];

  return {
    stage_name: String(resolvedPolicy?.stage?.name || "").trim() || null,
    stage_tone:
      String(resolvedPolicy?.stage?.tone || "").trim() ||
      String(resolvedPolicy?.tone || "").trim() ||
      null,
    allowed_plan_types: planCatalog.allowedPlanTypes,
    allowed_payment_channels: allowedPaymentChannels,
    allowed_delivery_channels: allowedDeliveryChannels,
    max_installments: planCatalog.maxInstallments,
    min_upfront_pct: planCatalog.minUpfrontPct,
    half_pct: planCatalog.halfPct,
  };
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
  const interaction = await resolveInteraction({
    tenantId,
    caseId,
    interactionId,
  });
  if (!interaction) {
    return {
      ok: false,
      code: "INTERACTION_NOT_FOUND",
      message: "Call interaction context was not found.",
    };
  }

  const debtCase = interaction.debtCase;
  const debtor = debtCase?.debtor;
  if (!debtCase || !debtor) {
    return {
      ok: false,
      code: "CASE_CONTEXT_NOT_FOUND",
      message: "Debt case or debtor context missing for orchestration.",
    };
  }

  const tenant = await Tenant.findByPk(tenantId, { attributes: ["name"] });
  const tenantName = String(
    debtCase?.meta?.tenant_display_name ||
      debtCase?.meta?.tenant_name ||
      tenant?.name ||
      "collections team",
  ).trim();

  const resolvedPolicy = await resolvePolicyForCase(tenantId, debtCase);
  const planCatalog = getPlanCatalogFromResolvedPolicy(resolvedPolicy);
  const allowedDeliveryChannels = resolveDeliveryChannelsForDebtor(debtor);
  const normalizedState = resolveStateFromInteraction(
    interaction,
    currentState,
  );

  const {
    callState: previousCallState,
    previousSlots,
    previousTelemetry,
    previousProposalSnapshot,
    previousProposalCommitted,
  } = resolvePreviousCallState(interaction);

  const actionDecision = classifyCallAction({
    state: normalizedState,
    intentHint,
    entities,
  });

  const slotPatchFromExtractor = extractSlotPatch({
    entities,
    utterance: userUtterance,
    currentState: normalizedState,
    allowedPlanTypes: planCatalog.allowedPlanTypes,
    allowedDeliveryChannels,
  });
  const slotPatchFromAction = deriveSlotPatchFromAction(actionDecision.action);

  let mergedSlots = mergeCallSlots({
    previousSlots,
    patch: { ...slotPatchFromExtractor, ...slotPatchFromAction },
  });
  mergedSlots = sanitizeCallSlots({ slots: mergedSlots });
  mergedSlots = applyAgreementDefaults({
    slots: mergedSlots,
    planCatalog,
    balanceCents: Number(debtCase.amountDueCents || 0),
    allowedDeliveryChannels,
  });

  const reducer = reduceCallState({
    state: normalizedState,
    action: actionDecision.action,
    slots: mergedSlots,
    previousSlots,
    context: {
      debtorName: debtor.fullName || "the account holder",
      tenantName,
      balanceCents: Number(debtCase.amountDueCents || 0),
      currency: debtCase.currency || "USD",
      planCatalog,
      allowedDeliveryChannels,
    },
  });

  if (reducer?.flags?.resetAgreementFields) {
    mergedSlots = sanitizeCallSlots({
      slots: {
        ...mergedSlots,
        plan_type: null,
        upfront_amount_cents: null,
        installments_count: null,
        delivery_channel: null,
        agreement_confirmed: null,
      },
    });
  }

  const proposedNextState = reducer.nextState;
  const invalidTransition = !isAllowedTransition(
    normalizedState,
    proposedNextState,
  );
  const nextState = invalidTransition ? normalizedState : proposedNextState;
  const toolAction = invalidTransition ? CALL_ACTIONS.NONE : reducer.toolAction;
  const shouldClose = nextState === CALL_STATES.CLOSE;
  const nowIso = new Date().toISOString();

  const agreementDraft = hasMeaningfulProposal(
    buildAgreementProposalFromSlots(mergedSlots),
  )
    ? buildAgreementProposalFromSlots(mergedSlots)
    : null;
  const disputeDraft = hasMeaningfulProposal(
    buildDisputeProposalFromSlots(mergedSlots),
  )
    ? buildDisputeProposalFromSlots(mergedSlots)
    : null;
  const proposalDrafts = {
    agreement: agreementDraft,
    dispute: disputeDraft,
    updated_at: nowIso,
  };

  const { proposalSnapshot, proposalCommitted } = updateProposalSnapshots({
    nowIso,
    previousProposalSnapshot,
    previousProposalCommitted,
    agreementDraft,
    disputeDraft,
    reducer,
    slots: mergedSlots,
  });

  const slotOverwrites = countSlotOverwrites({
    previousSlots,
    nextSlots: mergedSlots,
  });

  const telemetry = computeTelemetry({
    previousTelemetry,
    actionDecision,
    slotOverwrites,
    stateBefore: normalizedState,
    stateAfter: nextState,
    invalidTransition,
    toolAction,
    reducer,
  });

  await interaction.update({
    aiData: {
      ...(interaction.aiData || {}),
      eleven: {
        ...(interaction.aiData?.eleven || {}),
        call_state: {
          ...previousCallState,
          state: nextState,
          previous_state: normalizedState,
          last_intent: reducer.intentLabel,
          last_action: toolAction,
          last_user_utterance: normalizeText(userUtterance),
          slots: mergedSlots,
          entities: {
            ...(entities && typeof entities === "object" ? entities : {}),
            ...slotPatchFromExtractor,
            ...slotPatchFromAction,
          },
          nlu: {
            action: actionDecision.action,
            confidence: Number(actionDecision.confidence || 0),
            source: actionDecision.source || "none",
            threshold: ACTION_CONFIDENCE_THRESHOLD,
            intent_hint: String(intentHint || "").trim() || null,
          },
          proposal_drafts: proposalDrafts,
          proposal_snapshot: proposalSnapshot,
          proposal_committed: proposalCommitted,
          telemetry,
          transition_count: telemetry.transition_count,
          updated_at: nowIso,
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
      dialog_action: actionDecision.action,
      dialog_action_confidence: Number(actionDecision.confidence || 0),
      dialog_action_source: actionDecision.source || "none",
      intent: reducer.intentLabel,
      action: toolAction,
      should_close: shouldClose,
      invalid_transition_blocked: invalidTransition,
      telemetry: {
        transition_count: telemetry.transition_count,
        loop_rate: telemetry.loop_rate,
        slot_overwrite_rate: telemetry.slot_overwrite_rate,
        fallback_llm_rate: telemetry.fallback_llm_rate,
        tool_mismatch_rate: telemetry.tool_mismatch_rate,
        avg_nlu_confidence: telemetry.avg_nlu_confidence,
      },
    },
  });

  logger.info(
    {
      interactionId: interaction.id,
      debtCaseId: debtCase.id,
      stateBefore: normalizedState,
      stateAfter: nextState,
      dialogAction: actionDecision.action,
      dialogActionConfidence: actionDecision.confidence,
      toolAction,
      shouldClose,
      invalidTransition,
    },
    "ElevenLabs call FSM step orchestrated",
  );

  return {
    ok: true,
    interaction_id: interaction.id,
    current_state: normalizedState,
    next_state: nextState,
    state_changed: normalizedState !== nextState,
    dialog_action: actionDecision.action,
    dialog_action_confidence: Number(actionDecision.confidence || 0),
    dialog_action_source: actionDecision.source || "none",
    intent: reducer.intentLabel,
    action: toolAction,
    should_close: shouldClose,
    speak_back: reducer.speakBack,
    allowed_transitions: getAllowedTransitions(nextState),
    entities: mergedSlots,
    slots: mergedSlots,
    proposal_drafts: proposalDrafts,
    proposal_snapshot: proposalSnapshot,
    proposal_committed: proposalCommitted,
    telemetry,
    policy: buildPolicyResponse({
      planCatalog,
      resolvedPolicy,
      allowedDeliveryChannels,
    }),
  };
};
