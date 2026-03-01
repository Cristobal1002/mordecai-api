import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

const TEMPLATE_KEY = process.env.SES_DEFAULT_TEMPLATE || 'collection-default';
const DEFAULT_CURRENCY = 'USD';

let renderer = null;

const getRenderer = () => {
  if (renderer) return renderer;
  renderer = nunjucks.configure(TEMPLATES_DIR, {
    autoescape: true,
    noCache: process.env.NODE_ENV !== 'production',
    trimBlocks: true,
    lstripBlocks: true,
  });
  return renderer;
};

const toCurrency = (amountDueCents, currency = DEFAULT_CURRENCY) => {
  const cents = Number(amountDueCents);
  if (!Number.isFinite(cents)) return null;
  const amount = cents / 100;

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

const trimSpaces = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const renderString = (template, variables) => {
  if (typeof template !== 'string' || !template.trim()) return null;
  return trimSpaces(getRenderer().renderString(template, variables));
};

const renderFile = (templatePath, variables) =>
  trimSpaces(getRenderer().render(templatePath, variables));

const resolveTemplateName = (stageRules = {}) => {
  const customName =
    stageRules.email_template_key ||
    stageRules.email_template_id ||
    stageRules.emailTemplateKey ||
    null;

  return String(customName || TEMPLATE_KEY).trim() || 'collection-default';
};

export const buildCollectionEmailVariables = ({
  debtCase,
  debtor,
  stage,
  tenant,
  custom = {},
}) => {
  const currency = debtCase?.currency || DEFAULT_CURRENCY;
  const amountDue = toCurrency(debtCase?.amountDueCents, currency) || `0.00 ${currency}`;
  const daysPastDue = Number.isFinite(Number(debtCase?.daysPastDue))
    ? String(debtCase.daysPastDue)
    : 'N/A';

  const meta = debtCase?.meta || {};
  return {
    tenant_name: tenant?.name || '',
    debtor_name: debtor?.fullName || 'there',
    debtor_email: debtor?.email || '',
    amount_due: amountDue,
    amount_due_cents: Number(debtCase?.amountDueCents || 0),
    currency,
    days_past_due: daysPastDue,
    due_date: debtCase?.dueDate || '',
    stage_name: stage?.name || 'collection stage',
    payment_link: custom.paymentLink || debtCase?.paymentLinkUrl || '',
    case_id: debtCase?.id || '',
    property_name: meta.property_name || meta.propertyName || '',
    unit_number: meta.unit_number || meta.unitNumber || '',
    lease_number: meta.lease_number || meta.leaseNumber || meta.lease_id || '',
    ...custom,
  };
};

export const renderCollectionEmail = ({
  debtCase,
  debtor,
  stage,
  tenant,
  messageTemplate = null,
  custom = {},
}) => {
  const stageRules = stage?.rules || {};
  const variables = buildCollectionEmailVariables({ debtCase, debtor, stage, tenant, custom });
  const templateName = resolveTemplateName(stageRules);

  const templateSubject = messageTemplate?.subject || null;
  const templateText = messageTemplate?.bodyText || null;
  const templateHtml = messageTemplate?.bodyHtml || null;

  const subjectTemplate =
    templateSubject ||
    stageRules.email_subject_template ||
    stageRules.emailSubjectTemplate ||
    null;
  const htmlTemplate =
    templateHtml ||
    stageRules.email_html_template ||
    stageRules.emailHtmlTemplate ||
    null;
  const textTemplate =
    templateText ||
    stageRules.email_text_template ||
    stageRules.emailTextTemplate ||
    null;

  const hasTenantTemplate = Boolean(templateText || templateHtml);

  const subject = renderString(subjectTemplate, variables)
    || (hasTenantTemplate ? `Payment reminder from ${variables.tenant_name || 'your collections team'}` : null)
    || renderFile(`collections/${templateName}.subject.njk`, variables);

  const html = renderString(htmlTemplate, variables)
    || (hasTenantTemplate && templateText
      ? `<p>${renderString(templateText, variables)}</p>`
      : null)
    || renderFile(`collections/${templateName}.html.njk`, variables);

  const text = renderString(textTemplate, variables)
    || (hasTenantTemplate ? renderString(templateText, variables) : null)
    || renderFile(`collections/${templateName}.txt.njk`, variables);

  return { subject, html, text, templateName, variables };
};

