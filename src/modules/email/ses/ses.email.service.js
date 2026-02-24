import { CollectionEvent, InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import { sendSesEmail } from './ses.email.client.js';
import { renderCollectionEmail } from './ses.email.template.js';

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
    const rendered = renderCollectionEmail({ debtCase, debtor, stage });
    interaction = await createInteractionLog({
      tenantId,
      debtCaseId,
      debtorId,
      status: 'queued',
    });

    const providerResult = await sendSesEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
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

