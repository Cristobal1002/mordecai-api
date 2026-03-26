import { CALL_ACTIONS, CALL_STATES } from "../call-state-machine.js";
import { CALL_DIALOG_ACTIONS } from "../nlu/action-classifier.service.js";
import { isInstallmentsLikePlan } from "../policy/plan-catalog.service.js";

const toDisplayAmount = (amountCents) => {
  const numeric = Number(amountCents || 0) / 100;
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toFixed(2);
};

const humanizePlan = (planCode, planCatalog) => {
  const code = String(planCode || "")
    .trim()
    .toUpperCase();
  const plan = planCatalog?.plansByCode?.[code];
  if (plan?.label) return plan.label;
  if (code === "FULL") return "full amount in one payment";
  if (code === "HALF") return "half now and remainder later";
  if (isInstallmentsLikePlan(code)) {
    const maxInstallments = Number(planCatalog?.maxInstallments || 4);
    return `installments up to ${maxInstallments}`;
  }
  return code.toLowerCase();
};

const humanizeAllowedPlans = (planCatalog) => {
  const plans = Array.isArray(planCatalog?.allowedPlanTypes)
    ? planCatalog.allowedPlanTypes
    : [];
  return plans.map((code) => humanizePlan(code, planCatalog)).join(", ");
};

const buildDeliveryOptionsText = (allowedDeliveryChannels = []) => {
  if (
    !Array.isArray(allowedDeliveryChannels) ||
    allowedDeliveryChannels.length === 0
  ) {
    return "email, sms, or both";
  }
  return allowedDeliveryChannels.join(", ");
};

const normalizeFacts = (facts) =>
  facts && typeof facts === "object" && !Array.isArray(facts) ? facts : {};

const buildAgreementSummary = ({ slots, planCatalog, currency, facts = {} }) => {
  const committedPlan =
    normalizeFacts(facts.last_committed_plan) || normalizeFacts(facts.plan);
  const planSource =
    committedPlan.plan_type || committedPlan.planType ? committedPlan : slots;
  const planLabel = humanizePlan(planSource.plan_type, planCatalog);
  const upfrontAmount = toDisplayAmount(planSource.upfront_amount_cents);
  const installmentsChunk =
    planSource.installments_count && Number(planSource.installments_count) > 0
      ? `, installments ${planSource.installments_count}`
      : "";
  const deliveryChannel =
    planSource.delivery_channel || committedPlan.delivery_channel || "email";

  return `Plan ${planLabel}, upfront ${upfrontAmount} ${currency}${installmentsChunk}, delivery channel ${deliveryChannel}.`;
};

const resolveAgreementProgressState = ({ slots, planCatalog }) => {
  const planType = String(slots?.plan_type || "")
    .trim()
    .toUpperCase();
  const plan = planCatalog?.plansByCode?.[planType];

  if (!planType || !planCatalog?.allowedPlanTypes?.includes(planType)) {
    return CALL_STATES.PLAN_SELECTION;
  }

  if (!slots.upfront_amount_cents || Number(slots.upfront_amount_cents) <= 0) {
    return CALL_STATES.CAPTURE_UPFRONT;
  }

  if (
    (plan?.requiresInstallments || isInstallmentsLikePlan(planType)) &&
    (!slots.installments_count || Number(slots.installments_count) <= 0)
  ) {
    return CALL_STATES.CAPTURE_INSTALLMENTS;
  }

  if (!slots.delivery_channel) {
    return CALL_STATES.CAPTURE_DELIVERY_CHANNEL;
  }

  if (slots.agreement_confirmed !== true) {
    return CALL_STATES.CONFIRM_AGREEMENT;
  }

  return CALL_STATES.EXECUTE_AGREEMENT;
};

const buildClosingMessage = ({ tenantName, facts = {} }) => {
  const closingContext = String(facts?.closing_context || "").trim();

  if (closingContext === "agreement_created") {
    return `Thank you for your time today. Your secure link has been sent, and we're here if you need any help. Goodbye.`;
  }

  if (closingContext === "dispute_registered") {
    return `Thank you for explaining that today. We've recorded your dispute and the team will review it as soon as possible. Goodbye.`;
  }

  if (closingContext === "callback_requested") {
    return `Thank you for your time today. We'll follow up with you shortly. Goodbye.`;
  }

  return `Thank you for speaking with ${tenantName}. Take care and goodbye.`;
};

const buildPostDeliveryPrompt = ({ deliveryFacts = {} }) => {
  const successfulChannels = Array.isArray(deliveryFacts.successful_channels)
    ? deliveryFacts.successful_channels
    : [];
  const email = String(deliveryFacts.email || "").trim();

  if (successfulChannels.includes("email") && email) {
    return `I sent it to ${email}. Could you let me know if you received it?`;
  }

  if (successfulChannels.includes("email") && successfulChannels.includes("sms")) {
    return "I sent the secure link by email and by SMS. Could you let me know if you received it?";
  }

  if (successfulChannels.includes("email")) {
    return "I sent the secure link by email. Could you let me know if you received it?";
  }

  if (successfulChannels.includes("sms")) {
    return "I sent the secure link by SMS. Could you let me know if you received it?";
  }

  return "The secure link is ready. Do you need me to clarify anything before we close?";
};

const buildPostDisputePrompt = ({ deliveryFacts = {} }) => {
  const successfulChannels = Array.isArray(deliveryFacts.successful_channels)
    ? deliveryFacts.successful_channels
    : [];
  const email = String(deliveryFacts.email || "").trim();

  if (successfulChannels.includes("email") && email) {
    return `I sent the secure case link to ${email}. Could you let me know if you received it?`;
  }

  if (successfulChannels.includes("email") && successfulChannels.includes("sms")) {
    return "I sent the secure case link by email and by SMS. Could you let me know if you received it?";
  }

  if (successfulChannels.includes("email")) {
    return "I sent the secure case link by email. Could you let me know if you received it?";
  }

  if (successfulChannels.includes("sms")) {
    return "I sent the secure case link by SMS. Could you let me know if you received it?";
  }

  return "Your dispute is registered. Do you need me to clarify anything else before we close?";
};

const buildSentBySummary = (deliveryFacts = {}) => {
  const successfulChannels = Array.isArray(deliveryFacts.successful_channels)
    ? deliveryFacts.successful_channels
    : [];
  const email = String(deliveryFacts.email || "").trim();

  if (successfulChannels.includes("email") && successfulChannels.includes("sms")) {
    return email
      ? `I sent it to ${email} and by SMS.`
      : "I sent it by email and by SMS.";
  }

  if (successfulChannels.includes("email")) {
    return email ? `I sent it to ${email}.` : "I sent it by email.";
  }

  if (successfulChannels.includes("sms")) {
    return "I sent it by SMS.";
  }

  return "I have the secure link ready, but I don't see a successful delivery recorded yet.";
};

const buildBalanceAnswer = ({ balanceAmount, currency, state }) => {
  const followUp =
    state === CALL_STATES.POST_DELIVERY_CONFIRM ||
    state === CALL_STATES.POST_DISPUTE_CONFIRM
      ? " Could you let me know if you received the link?"
      : " Which option works best for you?";

  return `Your current balance is ${balanceAmount} ${currency}.${followUp}`;
};

const buildOptionsAnswer = ({ planCatalog, state }) => {
  const options = humanizeAllowedPlans(planCatalog);
  const followUp =
    state === CALL_STATES.POST_DELIVERY_CONFIRM ||
    state === CALL_STATES.POST_DISPUTE_CONFIRM
      ? " Do you need help with anything else about the link?"
      : " Which option works best for you?";

  return `Your available options are ${options}.${followUp}`;
};

const withBaseResult = (state) => ({
  nextState: state,
  toolAction: CALL_ACTIONS.NONE,
  speakBack: "",
  intentLabel: "unknown",
  flags: {
    requestAgreementSnapshot: false,
    commitAgreementProposal: false,
    commitDisputeProposal: false,
    resetAgreementFields: false,
    toolMismatch: false,
  },
});

export const reduceCallState = ({ state, action, slots, context }) => {
  const debtorName = context?.debtorName || "the account holder";
  const tenantName = context?.tenantName || "collections";
  const balanceAmount = toDisplayAmount(context?.balanceCents);
  const currency = context?.currency || "USD";
  const planCatalog = context?.planCatalog || {};
  const allowedDeliveryChannels = Array.isArray(
    context?.allowedDeliveryChannels,
  )
    ? context.allowedDeliveryChannels
    : [];
  const facts = normalizeFacts(context?.facts);
  const lastDeliveryResult = normalizeFacts(facts.last_delivery_result);
  const lastDisputeSummary = normalizeFacts(facts.last_dispute_summary);

  const result = withBaseResult(state);

  if (
    action === CALL_DIALOG_ACTIONS.REQUEST_CALLBACK ||
    slots?.callback_requested === true
  ) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack =
      "Understood. I'll arrange a callback for you. Thank you for your time today. Goodbye.";
    result.intentLabel = "callback_requested";
    result.flags.callbackRequested = true;
    return result;
  }

  if (action === CALL_DIALOG_ACTIONS.END_CALL || slots?.goodbye === true) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack = buildClosingMessage({ tenantName, facts });
    result.intentLabel = "goodbye";
    return result;
  }

  if (state === CALL_STATES.CLOSE) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack = buildClosingMessage({ tenantName, facts });
    result.intentLabel = "already_closed";
    return result;
  }

  if (state === CALL_STATES.VERIFY_IDENTITY) {
    if (
      action === CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_NO ||
      slots?.identity_verified === false
    ) {
      result.nextState = CALL_STATES.CLOSE;
      result.toolAction = CALL_ACTIONS.END_CALL;
      result.speakBack = `Understood. I can't discuss account details without identity verification for ${debtorName}. Thank you for your time. Goodbye.`;
      result.intentLabel = "identity_denied";
      return result;
    }

    if (
      action === CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_YES ||
      slots?.identity_verified === true
    ) {
      result.nextState = CALL_STATES.DISCLOSE_DEBT;
      result.speakBack =
        `This is an attempt to collect a debt and any information obtained will be used for that purpose. ` +
        `Your current balance is ${balanceAmount} ${currency}. ` +
        `Available plans are: ${humanizeAllowedPlans(planCatalog)}. Which option works for you?`;
      result.intentLabel = "identity_confirmed";
      return result;
    }

    result.nextState = CALL_STATES.VERIFY_IDENTITY;
    result.speakBack = `For privacy, I need to verify identity first. Am I speaking with ${debtorName}?`;
    result.intentLabel = "identity_pending";
    return result;
  }

  if (slots?.identity_verified !== true) {
    result.nextState = CALL_STATES.VERIFY_IDENTITY;
    result.speakBack = `For privacy, I need to verify identity first. Am I speaking with ${debtorName}?`;
    result.intentLabel = "identity_pending";
    return result;
  }

  if (action === CALL_DIALOG_ACTIONS.ASK_BALANCE) {
    result.nextState = state;
    result.speakBack = buildBalanceAnswer({ balanceAmount, currency, state });
    result.intentLabel = "balance_answered";
    return result;
  }

  if (action === CALL_DIALOG_ACTIONS.ASK_OPTIONS) {
    result.nextState = state;
    result.speakBack = buildOptionsAnswer({ planCatalog, state });
    result.intentLabel = "options_answered";
    return result;
  }

  if (state === CALL_STATES.POST_DELIVERY_CONFIRM) {
    if (action === CALL_DIALOG_ACTIONS.ASK_LINK_DESTINATION) {
      result.nextState = CALL_STATES.POST_DELIVERY_CONFIRM;
      result.speakBack = `${buildSentBySummary(lastDeliveryResult)} Could you let me know if you received it?`;
      result.intentLabel = "delivery_destination_answered";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.ASK_LINK_CHANNEL) {
      result.nextState = CALL_STATES.POST_DELIVERY_CONFIRM;
      result.speakBack = `${buildSentBySummary(lastDeliveryResult)} Could you let me know if you received it?`;
      result.intentLabel = "delivery_channel_answered";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.ASK_PLAN_SUMMARY) {
      result.nextState = CALL_STATES.POST_DELIVERY_CONFIRM;
      result.speakBack = `${buildAgreementSummary({
        slots,
        planCatalog,
        currency,
        facts,
      })} ${buildPostDeliveryPrompt({
        deliveryFacts: lastDeliveryResult,
      })}`;
      result.intentLabel = "plan_summary_answered";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.REPORT_LINK_NOT_RECEIVED) {
      result.nextState = CALL_STATES.POST_DELIVERY_CONFIRM;
      result.speakBack = `${buildSentBySummary(
        lastDeliveryResult,
      )} Please check your inbox, spam folder, or messages. If you still don't see it, I can arrange a callback.`;
      result.intentLabel = "delivery_not_received";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.CONFIRM_LINK_RECEIPT) {
      result.nextState = CALL_STATES.CLOSE;
      result.toolAction = CALL_ACTIONS.END_CALL;
      result.speakBack = buildClosingMessage({
        tenantName,
        facts: {
          ...facts,
          closing_context: facts.closing_context || "agreement_created",
        },
      });
      result.intentLabel = "delivery_received";
      return result;
    }

    result.nextState = CALL_STATES.POST_DELIVERY_CONFIRM;
    result.speakBack = buildPostDeliveryPrompt({
      deliveryFacts: lastDeliveryResult,
    });
    result.intentLabel = "post_delivery_follow_up";
    return result;
  }

  if (state === CALL_STATES.POST_DISPUTE_CONFIRM) {
    if (
      action === CALL_DIALOG_ACTIONS.ASK_LINK_DESTINATION ||
      action === CALL_DIALOG_ACTIONS.ASK_LINK_CHANNEL
    ) {
      result.nextState = CALL_STATES.POST_DISPUTE_CONFIRM;
      result.speakBack = `${buildSentBySummary(lastDeliveryResult)} Could you let me know if you received it?`;
      result.intentLabel = "dispute_delivery_answered";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.ASK_PLAN_SUMMARY) {
      result.nextState = CALL_STATES.POST_DISPUTE_CONFIRM;
      result.speakBack =
        lastDisputeSummary.reason
          ? `I registered your dispute with reason ${String(
              lastDisputeSummary.reason,
            )
              .toLowerCase()
              .replace(/_/g, " ")}. ${buildPostDisputePrompt({
              deliveryFacts: lastDeliveryResult,
            })}`
          : buildPostDisputePrompt({ deliveryFacts: lastDeliveryResult });
      result.intentLabel = "dispute_summary_answered";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.REPORT_LINK_NOT_RECEIVED) {
      result.nextState = CALL_STATES.POST_DISPUTE_CONFIRM;
      result.speakBack = `${buildSentBySummary(
        lastDeliveryResult,
      )} Please check your inbox, spam folder, or messages. If you still don't see it, I can arrange a callback for you.`;
      result.intentLabel = "dispute_delivery_not_received";
      return result;
    }

    if (action === CALL_DIALOG_ACTIONS.CONFIRM_LINK_RECEIPT) {
      result.nextState = CALL_STATES.CLOSE;
      result.toolAction = CALL_ACTIONS.END_CALL;
      result.speakBack = buildClosingMessage({
        tenantName,
        facts: {
          ...facts,
          closing_context: facts.closing_context || "dispute_registered",
        },
      });
      result.intentLabel = "dispute_delivery_received";
      return result;
    }

    result.nextState = CALL_STATES.POST_DISPUTE_CONFIRM;
    result.speakBack = buildPostDisputePrompt({
      deliveryFacts: lastDeliveryResult,
    });
    result.intentLabel = "post_dispute_follow_up";
    return result;
  }

  if (action === CALL_DIALOG_ACTIONS.ASK_PLAN_SUMMARY) {
    result.nextState = state;
    result.speakBack = `${buildAgreementSummary({
      slots,
      planCatalog,
      currency,
      facts,
    })} What would you like to do next?`;
    result.intentLabel = "plan_summary_answered";
    return result;
  }

  const disputeFlowRequested =
    action === CALL_DIALOG_ACTIONS.OPEN_DISPUTE ||
    action === CALL_DIALOG_ACTIONS.PROVIDE_DISPUTE_REASON ||
    slots?.dispute_detected === true ||
    [CALL_STATES.DISPUTE_CAPTURE, CALL_STATES.EXECUTE_DISPUTE].includes(state);

  if (disputeFlowRequested) {
    if (!slots?.dispute_reason) {
      result.nextState = CALL_STATES.DISPUTE_CAPTURE;
      result.speakBack =
        "Understood. I can register your dispute. Please share the main reason: paid already, wrong amount, wrong debtor, lease ended, legal review, or other.";
      result.intentLabel = "dispute_reason_pending";
      return result;
    }

    if (!slots?.delivery_channel) {
      result.nextState = CALL_STATES.DISPUTE_CAPTURE;
      result.speakBack = `Understood. Which delivery channel should we use: ${buildDeliveryOptionsText(
        allowedDeliveryChannels,
      )}?`;
      result.intentLabel = "dispute_channel_pending";
      return result;
    }

    result.nextState = CALL_STATES.EXECUTE_DISPUTE;
    result.toolAction = CALL_ACTIONS.CALL_CREATE_DISPUTE;
    result.speakBack = "Understood. I'll register the dispute now.";
    result.intentLabel = "dispute_ready_to_execute";
    result.flags.commitDisputeProposal = true;
    return result;
  }

  if (
    state === CALL_STATES.CONFIRM_AGREEMENT &&
    (action === CALL_DIALOG_ACTIONS.REJECT_AGREEMENT ||
      slots?.agreement_confirmed === false)
  ) {
    result.nextState = CALL_STATES.PLAN_SELECTION;
    result.speakBack = `No problem. Please choose the plan again: ${humanizeAllowedPlans(
      planCatalog,
    )}.`;
    result.intentLabel = "agreement_rejected";
    result.flags.resetAgreementFields = true;
    return result;
  }

  if (
    state === CALL_STATES.DISCLOSE_DEBT &&
    !slots?.plan_type &&
    action === CALL_DIALOG_ACTIONS.UNKNOWN
  ) {
    result.nextState = CALL_STATES.PLAN_SELECTION;
    result.speakBack = `Please choose one allowed plan: ${humanizeAllowedPlans(planCatalog)}.`;
    result.intentLabel = "plan_pending";
    return result;
  }

  const progressState = resolveAgreementProgressState({
    slots,
    planCatalog,
  });

  if (progressState === CALL_STATES.PLAN_SELECTION) {
    result.nextState = CALL_STATES.PLAN_SELECTION;
    result.speakBack = `Please choose one allowed plan: ${humanizeAllowedPlans(planCatalog)}.`;
    result.intentLabel = "plan_pending";
    return result;
  }

  if (progressState === CALL_STATES.CAPTURE_UPFRONT) {
    const plan =
      planCatalog?.plansByCode?.[String(slots?.plan_type || "").toUpperCase()];
    const minPct = Number(plan?.minUpfrontPct || 0);
    const minUpfrontAmount = Math.ceil(
      (Math.max(0, minPct) / 100) * Number(context?.balanceCents || 0),
    );
    result.nextState = CALL_STATES.CAPTURE_UPFRONT;
    result.speakBack =
      minUpfrontAmount > 0
        ? `Please confirm your upfront amount. Minimum is ${toDisplayAmount(minUpfrontAmount)} ${currency}.`
        : "Please confirm your upfront payment amount.";
    result.intentLabel = "upfront_pending";
    return result;
  }

  if (progressState === CALL_STATES.CAPTURE_INSTALLMENTS) {
    const plan =
      planCatalog?.plansByCode?.[String(slots?.plan_type || "").toUpperCase()];
    const maxInstallments = Number(
      plan?.maxInstallments || planCatalog?.maxInstallments || 4,
    );
    result.nextState = CALL_STATES.CAPTURE_INSTALLMENTS;
    result.speakBack = `How many installments do you prefer? Maximum is ${maxInstallments}.`;
    result.intentLabel = "installments_pending";
    return result;
  }

  if (progressState === CALL_STATES.CAPTURE_DELIVERY_CHANNEL) {
    result.nextState = CALL_STATES.CAPTURE_DELIVERY_CHANNEL;
    result.speakBack = `Please choose a delivery channel: ${buildDeliveryOptionsText(
      allowedDeliveryChannels,
    )}.`;
    result.intentLabel = "channel_pending";
    return result;
  }

  if (progressState === CALL_STATES.CONFIRM_AGREEMENT) {
    result.nextState = CALL_STATES.CONFIRM_AGREEMENT;
    result.speakBack =
      `${buildAgreementSummary({ slots, planCatalog, currency, facts })} ` +
      "Please confirm if you want me to create the payment agreement now.";
    result.intentLabel = "agreement_pending_confirmation";
    result.flags.requestAgreementSnapshot = true;
    return result;
  }

  if (progressState === CALL_STATES.EXECUTE_AGREEMENT) {
    if (
      ![CALL_STATES.CONFIRM_AGREEMENT, CALL_STATES.EXECUTE_AGREEMENT].includes(
        state,
      )
    ) {
      result.nextState = CALL_STATES.CONFIRM_AGREEMENT;
      result.speakBack =
        `${buildAgreementSummary({ slots, planCatalog, currency, facts })} ` +
        "Please confirm if you want me to create the payment agreement now.";
      result.intentLabel = "agreement_pending_confirmation";
      result.flags.requestAgreementSnapshot = true;
      return result;
    }

    result.nextState = CALL_STATES.EXECUTE_AGREEMENT;
    result.toolAction = CALL_ACTIONS.CALL_CREATE_PAYMENT_AGREEMENT;
    result.speakBack = "Understood. I'll create your payment agreement now.";
    result.intentLabel = "agreement_ready_to_execute";
    result.flags.commitAgreementProposal = true;
    return result;
  }

  result.nextState = CALL_STATES.CLOSE;
  result.toolAction = CALL_ACTIONS.END_CALL;
  result.speakBack = buildClosingMessage({ tenantName, facts });
  result.intentLabel = "close";
  return result;
};
