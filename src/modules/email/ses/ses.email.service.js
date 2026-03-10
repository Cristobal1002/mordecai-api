import { CollectionEvent, InteractionLog, Tenant } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import { sendSesEmail } from './ses.email.client.js';
import { renderCollectionEmail } from './ses.email.template.js';
import { getOrCreatePaymentLinkUrl } from '../../pay/payment-link-resolver.service.js';
import { resolveChannelTemplate } from '../../templates/template-resolution.service.js';

const createCollectionEvent = async ({
  automationId,
  debtCaseId,
  eventType,
  payload,
}) => {
  if (!automationId) return null;
  return CollectionEvent.create({
    automationId,
    debtCaseId,
    channel: 'email',
    eventType,
    payload,
  });
};

const createInteractionLog = async ({
  tenantId,
  debtCaseId,
  debtorId,
  status = 'queued',
}) =>
  InteractionLog.create({
    tenantId,
    debtCaseId,
    debtorId,
    type: 'EMAIL',
    status,
    channelProvider: 'ses',
    direction: 'OUTBOUND',
    startedAt: new Date(),
  });

const summarizeText = (text, maxLength = 500) => {
  const clean = String(text || '').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3)}...`;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fallbackHtmlFromText = ({ subject, text, tenantName }) => {
  const safeSubject = escapeHtml(subject || 'Collections notification');
  const safeTenantName = escapeHtml(tenantName || 'Collections');
  const safeText = escapeHtml(text || '').replace(/\n/g, '<br />');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f1117;color:#f8f9fb;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1d29;border:1px solid #2a2f3f;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px;border-bottom:1px solid #2a2f3f;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;color:#f8f9fb;">${safeTenantName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#d1d5db;line-height:1.6;">
                ${safeText || 'Collections notification'}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #2a2f3f;color:#9ca3af;font-size:12px;">
                This message was generated automatically by ${safeTenantName}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const sendCollectionEmail = async ({
  tenantId,
  automationId,
  state,
  debtCase,
  debtor,
  stage,
}) => {
  const debtCaseId = debtCase?.id || state?.debtCaseId;
  const debtorId = debtor?.id || debtCase?.debtorId || null;
  const to = String(debtor?.email || '').trim();

  if (!to) {
    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'email_skipped_invalid_contact',
      payload: {
        reason: 'missing_email',
      },
    });

    return {
      ok: false,
      channel: 'email',
      outcome: 'email_invalid_contact',
      message: 'Debtor email is missing.',
    };
  }

  let interaction = null;

  try {
    const emailTemplate = await resolveChannelTemplate({
      tenantId,
      channel: 'email',
      stage: stage || null,
    });
    if (!emailTemplate.template) {
      await createCollectionEvent({
        automationId,
        debtCaseId,
        eventType: 'email_skipped_missing_template',
        payload: {
          reason:
            emailTemplate.reason === 'stage_template_not_found'
              ? 'Email template configured in stage was not found or is inactive'
              : 'Email template is not configured for this stage',
          templateReason: emailTemplate.reason,
        },
      });
      return {
        ok: false,
        channel: 'email',
        outcome: 'email_missing_template',
        message: 'Email template is missing',
      };
    }

    const tenant = tenantId ? await Tenant.findByPk(tenantId, { attributes: ['name'] }) : null;
    const paymentLink = await getOrCreatePaymentLinkUrl({
      tenantId,
      debtCaseId,
      paymentAgreementId: debtCase?.meta?.last_agreement_id || null,
    });
    const rendered = renderCollectionEmail({
      debtCase,
      debtor,
      stage,
      tenant,
      messageTemplate: emailTemplate.template,
      custom: { paymentLink },
    });
    const renderedHtml = String(rendered.html || '').trim();
    const htmlBody =
      renderedHtml ||
      fallbackHtmlFromText({
        subject: rendered.subject,
        text: rendered.text,
        tenantName: tenant?.name,
      });

    if (!renderedHtml) {
      logger.warn(
        { tenantId, debtCaseId, templateName: rendered.templateName },
        'Rendered collection email had no HTML body. Using fallback branded HTML wrapper.'
      );
    }

    interaction = await createInteractionLog({
      tenantId,
      debtCaseId,
      debtorId,
      status: 'queued',
    });

    const providerResult = await sendSesEmail({
      to,
      subject: rendered.subject,
      html: htmlBody,
      text: rendered.text,
      tags: [
        { name: 'tenant_id', value: String(tenantId) },
        { name: 'debt_case_id', value: String(debtCaseId) },
        { name: 'interaction_id', value: String(interaction.id) },
        { name: 'channel', value: 'email' },
      ],
    });

    await interaction.update({
      status: 'sent',
      providerRef: providerResult.messageId,
      summary: summarizeText(rendered.text),
      endedAt: new Date(),
      aiData: {
        ...(interaction.aiData || {}),
        email: {
          template: rendered.templateName,
          subject: rendered.subject,
        },
      },
    });

    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'email_sent',
      payload: {
        interactionLogId: interaction.id,
        messageId: providerResult.messageId,
        to,
        subject: rendered.subject,
        template: rendered.templateName,
      },
    });

    return {
      ok: true,
      channel: 'email',
      outcome: 'email_sent',
      interactionLogId: interaction.id,
      providerRef: providerResult.messageId,
    };
  } catch (error) {
    logger.error(
      { err: error, tenantId, debtCaseId, automationId },
      'Failed to send collection email'
    );

    if (interaction) {
      await interaction.update({
        status: 'failed',
        outcome: 'FAILED',
        endedAt: new Date(),
        error: {
          message: error?.message || 'Email dispatch failed',
        },
      });
    } else if (tenantId && debtCaseId && debtorId) {
      await createInteractionLog({
        tenantId,
        debtCaseId,
        debtorId,
        status: 'failed',
      });
    }

    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'email_failed',
      payload: {
        interactionLogId: interaction?.id || null,
        reason: error?.message || 'Email dispatch failed',
      },
    });

    return {
      ok: false,
      channel: 'email',
      outcome: 'email_failed',
      message: error?.message || 'Email dispatch failed',
    };
  }
};

