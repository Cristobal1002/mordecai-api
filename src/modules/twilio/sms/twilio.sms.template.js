const DEFAULT_MAX_SMS_LENGTH = 140;

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

const buildConciseLinkSmsBody = ({
  debtorName,
  tenantName,
  paymentLink,
  linkLabel = 'Link:',
  fallbackText = 'Reply to continue. STOP=opt out.',
}) => {
  const safeBrand = sanitizeAscii(tenantName || 'Collections').slice(0, 24) || 'Collections';
  const firstName = sanitizeAscii(debtorName || 'there').split(' ')[0] || 'there';

  if (paymentLink) {
    const primary = `${safeBrand}: Hi ${firstName}. ${linkLabel} ${paymentLink} STOP=opt out.`;
    if (primary.length <= DEFAULT_MAX_SMS_LENGTH) return primary;

    const shorter = `${safeBrand}: ${paymentLink} STOP=opt out.`;
    if (shorter.length <= DEFAULT_MAX_SMS_LENGTH) return shorter;

    if (String(paymentLink).length <= DEFAULT_MAX_SMS_LENGTH) {
      return String(paymentLink);
    }

    return trimToMaxLength(shorter, DEFAULT_MAX_SMS_LENGTH);
  }

  const noLink = `${safeBrand}: Hi ${firstName}. ${fallbackText}`;
  return trimToMaxLength(noLink, DEFAULT_MAX_SMS_LENGTH);
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
  customTemplate,
  paymentLink = '',
  tenantName = '',
}) => {
  const vars = {
    tenant_name: tenantName || '',
    debtor_name: debtorName || 'there',
    payment_link: paymentLink || '',
  };

  const renderedCustom = renderTemplate(customTemplate, vars);
  if (renderedCustom) {
    const compactCustom = trimToMaxLength(renderedCustom, DEFAULT_MAX_SMS_LENGTH);
    const customMeta = estimateSmsTransportMeta(compactCustom);
    const hasRequiredLink = !vars.payment_link || compactCustom.includes(vars.payment_link);

    if (customMeta.segments <= 1 && hasRequiredLink) {
      return compactCustom;
    }
  }

  return buildConciseLinkSmsBody({
    debtorName: vars.debtor_name,
    tenantName: vars.tenant_name,
    paymentLink: vars.payment_link,
  });
};

export { buildConciseLinkSmsBody };

