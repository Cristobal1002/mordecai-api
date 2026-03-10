import { CALL_STATES } from "../call-state-machine.js";
import { normalizePlanCode } from "../policy/plan-catalog.service.js";

const DELIVERY_CHANNEL_VALUES = new Set(["email", "sms", "both"]);

const DISPUTE_REASON_ALIASES = Object.freeze({
  PAID_ALREADY: new Set([
    "paid",
    "paid_already",
    "already_paid",
    "payment_made",
    "settled",
  ]),
  WRONG_AMOUNT: new Set([
    "wrong_amount",
    "incorrect_amount",
    "amount_wrong",
    "incorrect_balance",
  ]),
  WRONG_DEBTOR: new Set([
    "wrong_debtor",
    "wrong_person",
    "not_mine",
    "not_me",
    "identity_issue",
    "fraud",
  ]),
  LEASE_ENDED: new Set(["lease_ended", "moved_out", "no_longer_tenant"]),
  UNDER_LEGAL_REVIEW: new Set([
    "legal",
    "under_legal_review",
    "attorney",
    "court",
  ]),
  PROMISE_OFFLINE: new Set(["promise_offline", "offline_promise"]),
  DO_NOT_CONTACT: new Set(["do_not_contact", "stop_contact", "stop_calling"]),
  OTHER: new Set(["other"]),
});

const DISPUTE_REASON_VALUES = new Set(Object.keys(DISPUTE_REASON_ALIASES));

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

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

const toPositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

const normalizeEmail = (value) => {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const parseAmountToCents = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return Math.round(value);
    return Math.round(value * 100);
  }

  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;

  if (/[.,]\d{1,2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/,/g, ".");
    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100);
  }

  const numeric = Number(cleaned.replace(/[.,]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
};

const normalizeDeliveryChannel = (value, allowedDeliveryChannels = []) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (!DELIVERY_CHANNEL_VALUES.has(raw)) return null;
  if (
    Array.isArray(allowedDeliveryChannels) &&
    allowedDeliveryChannels.length > 0 &&
    !allowedDeliveryChannels.includes(raw)
  ) {
    return null;
  }
  return raw;
};

const normalizeDisputeReason = (value) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (DISPUTE_REASON_VALUES.has(raw)) return raw;

  const normalizedLower = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!normalizedLower) return null;

  for (const [reason, aliases] of Object.entries(DISPUTE_REASON_ALIASES)) {
    if (aliases.has(normalizedLower)) return reason;
  }

  return null;
};

const extractEmailFromText = (text) => {
  const match = String(text || "").match(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  );
  return match ? normalizeEmail(match[0]) : null;
};

const extractAmountCentsFromText = ({ text, currentState }) => {
  if (
    ![
      CALL_STATES.CAPTURE_UPFRONT,
      CALL_STATES.CONFIRM_AGREEMENT,
      CALL_STATES.PLAN_SELECTION,
    ].includes(currentState)
  ) {
    return null;
  }

  const normalized = String(text || "").toLowerCase();
  if (!normalized) return null;

  const amountMatch = normalized.match(
    /(\$?\s*\d{1,3}(?:[,\.\s]\d{3})*(?:[.,]\d{1,2})?|\$?\s*\d+(?:[.,]\d{1,2})?)/,
  );
  if (!amountMatch) return null;

  const candidate = amountMatch[1].replace(/\s/g, "");
  const parsed = parseAmountToCents(candidate);
  if (!parsed || parsed <= 0) return null;

  if (normalized.includes("cent")) return parsed;
  if (candidate.includes(".") || candidate.includes(",")) return parsed;
  if (parsed < 10000) return parsed * 100;
  return parsed;
};

const extractInstallmentsCountFromText = (text) => {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return null;

  const direct = normalized.match(/(\d+)\s*(installments?|cuotas?)/i);
  if (direct?.[1]) return toPositiveInteger(direct[1]);

  if (normalized.includes("four installments")) return 4;
  if (normalized.includes("three installments")) return 3;
  if (normalized.includes("two installments")) return 2;
  if (normalized.includes("one installment")) return 1;

  return null;
};

const mergeEntitySources = (entities = {}) => {
  const rawEntities = entities && typeof entities === "object" ? entities : {};
  const nestedSlots =
    rawEntities?.slots && typeof rawEntities.slots === "object"
      ? rawEntities.slots
      : {};
  return {
    ...rawEntities,
    ...nestedSlots,
  };
};

export const extractSlotPatch = ({
  entities = {},
  utterance,
  currentState,
  allowedPlanTypes = [],
  allowedDeliveryChannels = [],
}) => {
  const source = mergeEntitySources(entities);
  const normalizedUtterance = normalizeText(utterance);
  const patch = {};

  const planType = normalizePlanCode(source.plan_type ?? source.planType);
  if (
    planType &&
    (allowedPlanTypes.length === 0 || allowedPlanTypes.includes(planType))
  ) {
    patch.plan_type = planType;
  }

  const deliveryChannel = normalizeDeliveryChannel(
    source.delivery_channel ?? source.deliveryChannel ?? source.channel,
    allowedDeliveryChannels,
  );
  if (deliveryChannel) patch.delivery_channel = deliveryChannel;

  const deliveryEmailFromSource = normalizeEmail(
    source.delivery_email ?? source.deliveryEmail ?? source.email,
  );
  if (deliveryEmailFromSource) {
    patch.delivery_email = deliveryEmailFromSource;
  } else {
    const deliveryEmailFromText = extractEmailFromText(normalizedUtterance);
    if (deliveryEmailFromText) patch.delivery_email = deliveryEmailFromText;
  }

  const upfrontAmount = parseAmountToCents(
    source.upfront_amount_cents ??
      source.upfrontAmountCents ??
      source.upfront_amount,
  );
  if (upfrontAmount && upfrontAmount > 0) {
    patch.upfront_amount_cents = upfrontAmount;
  } else {
    const amountFromText = extractAmountCentsFromText({
      text: normalizedUtterance,
      currentState,
    });
    if (amountFromText && amountFromText > 0) {
      patch.upfront_amount_cents = amountFromText;
    }
  }

  const installmentsCount = toPositiveInteger(
    source.installments_count ?? source.installmentsCount,
  );
  if (installmentsCount) {
    patch.installments_count = installmentsCount;
  } else {
    const installmentsFromText =
      extractInstallmentsCountFromText(normalizedUtterance);
    if (installmentsFromText) patch.installments_count = installmentsFromText;
  }

  const disputeReason = normalizeDisputeReason(
    source.dispute_reason ?? source.disputeReason ?? source.reason,
  );
  if (disputeReason) patch.dispute_reason = disputeReason;

  const disputeDetected = parseBoolean(
    source.dispute_detected ?? source.disputeDetected ?? source.is_dispute,
  );
  if (disputeDetected !== null) patch.dispute_detected = disputeDetected;

  const callbackRequested = parseBoolean(
    source.callback_requested ?? source.callbackRequested,
  );
  if (callbackRequested !== null) patch.callback_requested = callbackRequested;

  const goodbye = parseBoolean(
    source.goodbye ?? source.end_call ?? source.endCall,
  );
  if (goodbye !== null) patch.goodbye = goodbye;

  const agreementConfirmed = parseBoolean(
    source.agreement_confirmed ??
      source.agreementConfirmed ??
      source.confirmation,
  );
  if (agreementConfirmed !== null)
    patch.agreement_confirmed = agreementConfirmed;

  return patch;
};
