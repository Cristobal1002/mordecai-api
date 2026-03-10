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

const buildAgreementSummary = ({ slots, planCatalog, currency }) => {
  const planLabel = humanizePlan(slots.plan_type, planCatalog);
  const upfrontAmount = toDisplayAmount(slots.upfront_amount_cents);
  const installmentsChunk =
    slots.installments_count && Number(slots.installments_count) > 0
      ? `, installments ${slots.installments_count}`
      : "";
  return `Plan ${planLabel}, upfront ${upfrontAmount} ${currency}${installmentsChunk}, delivery channel ${slots.delivery_channel}.`;
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

  const result = {
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
  };

  if (
    action === CALL_DIALOG_ACTIONS.REQUEST_CALLBACK ||
    slots?.callback_requested === true
  ) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack = "Understood. I will arrange a callback. Thank you.";
    result.intentLabel = "callback_requested";
    return result;
  }

  if (action === CALL_DIALOG_ACTIONS.END_CALL || slots?.goodbye === true) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack = `Thank you for speaking with ${tenantName}. Goodbye.`;
    result.intentLabel = "goodbye";
    return result;
  }

  // Once a call is closed, always keep it closed and ask runtime to end call.
  if (state === CALL_STATES.CLOSE) {
    result.nextState = CALL_STATES.CLOSE;
    result.toolAction = CALL_ACTIONS.END_CALL;
    result.speakBack = `Thank you for speaking with ${tenantName}. Goodbye.`;
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
      result.speakBack = `Understood. I cannot discuss account details without identity verification for ${debtorName}. Goodbye.`;
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
    result.speakBack = "Understood. I will register the dispute now.";
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
      `${buildAgreementSummary({ slots, planCatalog, currency })} ` +
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
        `${buildAgreementSummary({ slots, planCatalog, currency })} ` +
        "Please confirm if you want me to create the payment agreement now.";
      result.intentLabel = "agreement_pending_confirmation";
      result.flags.requestAgreementSnapshot = true;
      return result;
    }

    result.nextState = CALL_STATES.EXECUTE_AGREEMENT;
    result.toolAction = CALL_ACTIONS.CALL_CREATE_PAYMENT_AGREEMENT;
    result.speakBack = "Understood. I will create your payment agreement now.";
    result.intentLabel = "agreement_ready_to_execute";
    result.flags.commitAgreementProposal = true;
    return result;
  }

  result.nextState = CALL_STATES.CLOSE;
  result.toolAction = CALL_ACTIONS.END_CALL;
  result.speakBack = `Thank you for speaking with ${tenantName}. Goodbye.`;
  result.intentLabel = "close";
  return result;
};
