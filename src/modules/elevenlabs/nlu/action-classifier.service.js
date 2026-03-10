import { CALL_STATES } from "../call-state-machine.js";

export const CALL_DIALOG_ACTIONS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  VERIFY_IDENTITY_YES: "VERIFY_IDENTITY_YES",
  VERIFY_IDENTITY_NO: "VERIFY_IDENTITY_NO",
  SELECT_PLAN: "SELECT_PLAN",
  PROVIDE_UPFRONT_AMOUNT: "PROVIDE_UPFRONT_AMOUNT",
  PROVIDE_INSTALLMENTS_COUNT: "PROVIDE_INSTALLMENTS_COUNT",
  SELECT_DELIVERY_CHANNEL: "SELECT_DELIVERY_CHANNEL",
  PROVIDE_DELIVERY_EMAIL: "PROVIDE_DELIVERY_EMAIL",
  CONFIRM_AGREEMENT: "CONFIRM_AGREEMENT",
  REJECT_AGREEMENT: "REJECT_AGREEMENT",
  OPEN_DISPUTE: "OPEN_DISPUTE",
  PROVIDE_DISPUTE_REASON: "PROVIDE_DISPUTE_REASON",
  REQUEST_CALLBACK: "REQUEST_CALLBACK",
  END_CALL: "END_CALL",
});

const ACTION_ALIAS_MAP = Object.freeze({
  verify_identity_yes: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_YES,
  identity_verified: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_YES,
  identity_confirmed: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_YES,
  verify_identity_no: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_NO,
  identity_denied: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_NO,
  wrong_person: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_NO,
  select_plan: CALL_DIALOG_ACTIONS.SELECT_PLAN,
  plan_selected: CALL_DIALOG_ACTIONS.SELECT_PLAN,
  provide_upfront_amount: CALL_DIALOG_ACTIONS.PROVIDE_UPFRONT_AMOUNT,
  provide_upfront: CALL_DIALOG_ACTIONS.PROVIDE_UPFRONT_AMOUNT,
  provide_installments_count: CALL_DIALOG_ACTIONS.PROVIDE_INSTALLMENTS_COUNT,
  provide_installments: CALL_DIALOG_ACTIONS.PROVIDE_INSTALLMENTS_COUNT,
  select_delivery_channel: CALL_DIALOG_ACTIONS.SELECT_DELIVERY_CHANNEL,
  delivery_channel_selected: CALL_DIALOG_ACTIONS.SELECT_DELIVERY_CHANNEL,
  provide_delivery_email: CALL_DIALOG_ACTIONS.PROVIDE_DELIVERY_EMAIL,
  confirm_agreement: CALL_DIALOG_ACTIONS.CONFIRM_AGREEMENT,
  agreement_confirmed: CALL_DIALOG_ACTIONS.CONFIRM_AGREEMENT,
  reject_agreement: CALL_DIALOG_ACTIONS.REJECT_AGREEMENT,
  agreement_rejected: CALL_DIALOG_ACTIONS.REJECT_AGREEMENT,
  open_dispute: CALL_DIALOG_ACTIONS.OPEN_DISPUTE,
  dispute_detected: CALL_DIALOG_ACTIONS.OPEN_DISPUTE,
  provide_dispute_reason: CALL_DIALOG_ACTIONS.PROVIDE_DISPUTE_REASON,
  request_callback: CALL_DIALOG_ACTIONS.REQUEST_CALLBACK,
  callback_requested: CALL_DIALOG_ACTIONS.REQUEST_CALLBACK,
  end_call: CALL_DIALOG_ACTIONS.END_CALL,
  goodbye: CALL_DIALOG_ACTIONS.END_CALL,
});

const normalizeActionToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return null;
};

const toConfidence = (value, fallback = 0.8) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
};

const resolveMappedAction = (candidate) => {
  const normalized = normalizeActionToken(candidate);
  if (!normalized) return null;
  return ACTION_ALIAS_MAP[normalized] || null;
};

const pickStructuredActionCandidate = (intentHint, entities = {}) => {
  const sources = [
    intentHint,
    entities?.action,
    entities?.intent,
    entities?.intent_name,
    entities?.intentName,
    entities?.dialog_action,
    entities?.dialogAction,
    entities?.user_action,
    entities?.userAction,
  ];

  for (const item of sources) {
    const resolved = resolveMappedAction(item);
    if (resolved) return resolved;
  }

  return null;
};

export const classifyCallAction = ({ state, intentHint, entities = {} }) => {
  const structuredAction = pickStructuredActionCandidate(intentHint, entities);
  if (structuredAction) {
    return {
      action: structuredAction,
      confidence: toConfidence(
        entities?.action_confidence ??
          entities?.intent_confidence ??
          entities?.confidence,
        0.9,
      ),
      source: intentHint ? "intent_hint" : "entities",
    };
  }

  const llmFallbackAction = resolveMappedAction(
    entities?.llm_action ?? entities?.llmAction ?? entities?.fallback_action,
  );
  if (llmFallbackAction) {
    return {
      action: llmFallbackAction,
      confidence: toConfidence(
        entities?.llm_confidence ?? entities?.confidence,
        0.7,
      ),
      source: "llm_fallback",
    };
  }

  const callbackRequested = parseBoolean(
    entities?.callback_requested ?? entities?.callbackRequested,
  );
  if (callbackRequested === true) {
    return {
      action: CALL_DIALOG_ACTIONS.REQUEST_CALLBACK,
      confidence: 0.92,
      source: "entity_flag",
    };
  }

  const goodbye = parseBoolean(
    entities?.goodbye ?? entities?.end_call ?? entities?.endCall,
  );
  if (goodbye === true) {
    return {
      action: CALL_DIALOG_ACTIONS.END_CALL,
      confidence: 0.92,
      source: "entity_flag",
    };
  }

  const disputeDetected = parseBoolean(
    entities?.dispute_detected ??
      entities?.disputeDetected ??
      entities?.is_dispute,
  );
  if (disputeDetected === true) {
    return {
      action: CALL_DIALOG_ACTIONS.OPEN_DISPUTE,
      confidence: 0.9,
      source: "entity_flag",
    };
  }

  if (state === CALL_STATES.VERIFY_IDENTITY) {
    const identityVerified = parseBoolean(
      entities?.identity_verified ??
        entities?.identityVerified ??
        entities?.is_identity_verified,
    );
    if (identityVerified === true) {
      return {
        action: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_YES,
        confidence: 0.88,
        source: "entity_flag",
      };
    }
    if (identityVerified === false) {
      return {
        action: CALL_DIALOG_ACTIONS.VERIFY_IDENTITY_NO,
        confidence: 0.88,
        source: "entity_flag",
      };
    }
  }

  const agreementConfirmed = parseBoolean(
    entities?.agreement_confirmed ??
      entities?.agreementConfirmed ??
      entities?.confirmation,
  );
  if (agreementConfirmed === true) {
    return {
      action: CALL_DIALOG_ACTIONS.CONFIRM_AGREEMENT,
      confidence: 0.86,
      source: "entity_flag",
    };
  }
  if (agreementConfirmed === false) {
    return {
      action: CALL_DIALOG_ACTIONS.REJECT_AGREEMENT,
      confidence: 0.86,
      source: "entity_flag",
    };
  }

  if (entities?.plan_type || entities?.planType) {
    return {
      action: CALL_DIALOG_ACTIONS.SELECT_PLAN,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  if (
    entities?.upfront_amount_cents ||
    entities?.upfrontAmountCents ||
    entities?.upfront_amount
  ) {
    return {
      action: CALL_DIALOG_ACTIONS.PROVIDE_UPFRONT_AMOUNT,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  if (entities?.installments_count || entities?.installmentsCount) {
    return {
      action: CALL_DIALOG_ACTIONS.PROVIDE_INSTALLMENTS_COUNT,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  if (
    entities?.delivery_channel ||
    entities?.deliveryChannel ||
    entities?.channel
  ) {
    return {
      action: CALL_DIALOG_ACTIONS.SELECT_DELIVERY_CHANNEL,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  if (entities?.delivery_email || entities?.deliveryEmail || entities?.email) {
    return {
      action: CALL_DIALOG_ACTIONS.PROVIDE_DELIVERY_EMAIL,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  if (entities?.dispute_reason || entities?.disputeReason || entities?.reason) {
    return {
      action: CALL_DIALOG_ACTIONS.PROVIDE_DISPUTE_REASON,
      confidence: 0.8,
      source: "entity_slot",
    };
  }

  return {
    action: CALL_DIALOG_ACTIONS.UNKNOWN,
    confidence: 0.25,
    source: "none",
  };
};
