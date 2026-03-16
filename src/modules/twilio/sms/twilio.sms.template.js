const DEFAULT_CURRENCY = 'USD';
const DEFAULT_MAX_SMS_LENGTH = 320;
const COLOMBIA_STRICT_MAX_SMS_LENGTH = 140;

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

export const isColombiaDestinationPhone = (value) => {
  const normalized = normalizePhone(value);
  return normalized.startsWith('+57') || normalized.startsWith('57');
};

const toAmount = (amountDueCents) => {
  const parsed = Number(amountDueCents);
  if (!Number.isFinite(parsed)) return null;
  return parsed / 100;
};

const formatAmount = (amount, currency = DEFAULT_CURRENCY) => {
  if (amount == null || !Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const renderTemplate = (template, variables) => {
  if (typeof template !== 'string' || !template.trim()) return null;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

const sanitizeAscii = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trimToMaxLength = (text, maxLength = DEFAULT_MAX_SMS_LENGTH) => {
  const cleaned = String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
};

const buildStrictColombiaBody = ({
  debtorName,
  tenantName,
  paymentLink,
  includePaymentLink,
}) => {
  const safeBrand = sanitizeAscii(tenantName || 'Collections').slice(0, 24) || 'Collections';
  const firstName = sanitizeAscii(debtorName || 'there').split(' ')[0] || 'there';

  if (includePaymentLink && paymentLink) {
    const primary = `${safeBrand}: Hi ${firstName}. Link: ${paymentLink} STOP=opt out.`;
    if (primary.length <= COLOMBIA_STRICT_MAX_SMS_LENGTH) return primary;

    const shorter = `${safeBrand}: ${paymentLink} STOP=opt out.`;
    if (shorter.length <= COLOMBIA_STRICT_MAX_SMS_LENGTH) return shorter;

    if (String(paymentLink).length <= COLOMBIA_STRICT_MAX_SMS_LENGTH) {
      return String(paymentLink);
    }

    return trimToMaxLength(shorter, COLOMBIA_STRICT_MAX_SMS_LENGTH);
  }

  const noLink = `${safeBrand}: Hi ${firstName}. Reply to this SMS to continue. STOP=opt out.`;
  return trimToMaxLength(noLink, COLOMBIA_STRICT_MAX_SMS_LENGTH);
};

const GSM_7_BASIC_CHARS = new Set(
  [
    '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r',
    'Å', 'å', 'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', ' ', '!',
    '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', '0',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
    '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ',
    'Ü', '§', '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
    'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä',
    'ö', 'ñ', 'ü', 'à',
  ]
);

const GSM_7_EXTENDED_CHARS = new Set(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export const estimateSmsTransportMeta = (text) => {
  const source = String(text || '');
  const length = source.length;

  let isGsm7 = true;
  let gsm7Units = 0;

  for (const ch of source) {
    if (GSM_7_BASIC_CHARS.has(ch)) {
      gsm7Units += 1;
      continue;
    }
    if (GSM_7_EXTENDED_CHARS.has(ch)) {
      gsm7Units += 2;
      continue;
    }
    isGsm7 = false;
    break;
  }

  if (isGsm7) {
    return {
      encoding: 'GSM-7',
      length,
      segments: gsm7Units <= 160 ? 1 : Math.ceil(gsm7Units / 153),
      units: gsm7Units,
    };
  }

  const codePointLength = Array.from(source).length;
  return {
    encoding: 'UCS-2',
    length,
    segments: codePointLength <= 70 ? 1 : Math.ceil(codePointLength / 67),
    units: codePointLength,
  };
};

export const buildCollectionSmsBody = ({
  debtorName,
  amountDueCents,
  currency,
  daysPastDue,
  stageName,
  customTemplate,
  meta = {},
  dueDate = '',
  paymentLink = '',
  tenantName = '',
  destinationPhone = '',
  strictColombiaMode = false,
  includePaymentLink = true,
}) => {
  const amount = toAmount(amountDueCents);
  const amountFormatted = formatAmount(amount, currency || DEFAULT_CURRENCY);
  const vars = {
    tenant_name: tenantName || '',
    debtor_name: debtorName || 'there',
    amount_due: amountFormatted || 'your balance',
    days_past_due:
      Number.isFinite(Number(daysPastDue)) && Number(daysPastDue) >= 0
        ? String(daysPastDue)
        : 'N/A',
    stage_name: stageName || 'collection stage',
    due_date: dueDate || '',
    payment_link: paymentLink || '',
    property_name: meta.property_name || meta.propertyName || '',
    unit_number: meta.unit_number || meta.unitNumber || '',
    lease_number: meta.lease_number || meta.leaseNumber || meta.lease_id || '',
  };
  const isColombiaDestination = isColombiaDestinationPhone(destinationPhone);
  const useStrictColombiaMode = strictColombiaMode && isColombiaDestination;

  if (useStrictColombiaMode) {
    return buildStrictColombiaBody({
      debtorName: vars.debtor_name,
      tenantName: vars.tenant_name,
      paymentLink: includePaymentLink ? vars.payment_link : '',
      includePaymentLink,
    });
  }

  const renderedCustom = renderTemplate(customTemplate, vars);
  if (renderedCustom) {
    return trimToMaxLength(renderedCustom);
  }

  const linkPart = includePaymentLink && vars.payment_link
    ? ` View your account and pay here: ${vars.payment_link}`
    : '';
  const tenantDisplay = vars.tenant_name || 'your collections team';
  const fallback = `Hi ${vars.debtor_name}, this is ${tenantDisplay} regarding your account.${linkPart} Reply to discuss payment options.`;
  return trimToMaxLength(fallback);
};

