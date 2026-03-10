const DEFAULT_ALLOWED_PLANS = Object.freeze(["FULL", "HALF", "INSTALLMENTS"]);

const toFiniteNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toPositiveInteger = (value, fallback) => {
  const numeric = Math.trunc(toFiniteNumber(value, fallback));
  return numeric > 0 ? numeric : fallback;
};

export const normalizePlanCode = (value) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!raw) return null;
  if (raw === "INSTALLMENTS") return "INSTALLMENTS_4";
  return raw;
};

export const isInstallmentsLikePlan = (planCode) =>
  String(planCode || "")
    .trim()
    .toUpperCase()
    .includes("INSTALLMENT");

const buildPlanDefinition = ({
  code,
  minUpfrontPct,
  halfPct,
  maxInstallments,
}) => {
  if (code === "FULL") {
    return {
      code,
      kind: "FULL",
      label: "full amount in one payment",
      agreementType: "PROMISE_TO_PAY",
      requiresInstallments: false,
      minUpfrontPct: 100,
      maxInstallments: 1,
    };
  }

  if (code === "HALF") {
    return {
      code,
      kind: "HALF",
      label: "half now and remainder later",
      agreementType: "PROMISE_TO_PAY",
      requiresInstallments: false,
      minUpfrontPct: halfPct,
      maxInstallments: 1,
    };
  }

  if (isInstallmentsLikePlan(code)) {
    return {
      code,
      kind: "INSTALLMENTS",
      label: `installments up to ${maxInstallments}`,
      agreementType: "INSTALLMENTS",
      requiresInstallments: true,
      minUpfrontPct,
      maxInstallments,
    };
  }

  return {
    code,
    kind: "GENERIC",
    label: code.toLowerCase(),
    agreementType: "PROMISE_TO_PAY",
    requiresInstallments: false,
    minUpfrontPct,
    maxInstallments: 1,
  };
};

export const getPlanCatalogFromResolvedPolicy = (resolvedPolicy) => {
  const rules = resolvedPolicy?.rules || {};
  const minUpfrontPct = toFiniteNumber(rules.min_upfront_pct, 25);
  const halfPct = toFiniteNumber(rules.half_pct, 50);
  const maxInstallments = toPositiveInteger(rules.max_installments, 4);

  const allowedFromRules = Array.isArray(rules.allowed_plans)
    ? rules.allowed_plans
    : DEFAULT_ALLOWED_PLANS;

  const allowedPlanTypes = allowedFromRules
    .map((item) => normalizePlanCode(item))
    .filter(Boolean);

  const uniqueAllowedPlanTypes = Array.from(new Set(allowedPlanTypes));
  const fallbackPlanTypes =
    uniqueAllowedPlanTypes.length > 0
      ? uniqueAllowedPlanTypes
      : DEFAULT_ALLOWED_PLANS.map((item) => normalizePlanCode(item));

  const plansByCode = fallbackPlanTypes.reduce((result, code) => {
    result[code] = buildPlanDefinition({
      code,
      minUpfrontPct,
      halfPct,
      maxInstallments,
    });
    return result;
  }, {});

  return {
    minUpfrontPct,
    halfPct,
    maxInstallments,
    allowedPlanTypes: fallbackPlanTypes,
    plansByCode,
  };
};
