const DEFAULT_CURRENCY = 'USD';
const DEFAULT_MAX_SMS_LENGTH = 320;

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

const trimToMaxLength = (text, maxLength = DEFAULT_MAX_SMS_LENGTH) => {
  const cleaned = String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
};

export const buildCollectionSmsBody = ({
  debtorName,
  amountDueCents,
  currency,
  daysPastDue,
  stageName,
  customTemplate,
}) => {
  const amount = toAmount(amountDueCents);
  const amountFormatted = formatAmount(amount, currency || DEFAULT_CURRENCY);
  const vars = {
    debtor_name: debtorName || 'there',
    amount_due: amountFormatted || 'your balance',
    days_past_due:
      Number.isFinite(Number(daysPastDue)) && Number(daysPastDue) >= 0
        ? String(daysPastDue)
        : 'N/A',
    stage_name: stageName || 'collection stage',
  };

  const renderedCustom = renderTemplate(customTemplate, vars);
  if (renderedCustom) {
    return trimToMaxLength(renderedCustom);
  }

  const fallback = `Hi ${vars.debtor_name}, this is Mordecai. Your balance ${vars.amount_due} is ${vars.days_past_due} days past due. Reply to discuss payment options.`;
  return trimToMaxLength(fallback);
};

