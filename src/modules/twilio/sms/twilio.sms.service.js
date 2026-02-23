import { CollectionEvent, InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import { buildCollectionSmsBody } from './twilio.sms.template.js';
import { sendTwilioSms } from './twilio.sms.client.js';

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
    channel: 'sms',
    eventType,
    payload,
  });
};

const createInteractionLog = async ({
  tenantId,
  debtCaseId,
  debtorId,
  status = 'queued',
}) => {
  return InteractionLog.create({
    tenantId,
    debtCaseId,
    debtorId,
    type: 'SMS',
    status,
    channelProvider: 'twilio',
    direction: 'OUTBOUND',
    startedAt: new Date(),
  });
};

export const sendCollectionSms = async ({
  tenantId,
  automationId,
  state,
  debtCase,
  debtor,
  stage,
}) => {
  const debtCaseId = debtCase?.id || state?.debtCaseId;
  const debtorId = debtor?.id || debtCase?.debtorId || null;
  const to = debtor?.phone;

  if (!to) {
    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'sms_skipped_invalid_contact',
      payload: {
        reason: 'missing_phone',
      },
    });

    return {
      ok: false,
      channel: 'sms',
      outcome: 'sms_invalid_contact',
      message: 'Debtor phone is missing.',
    };
  }

  const customTemplate =
    stage?.rules?.sms_template ||
    stage?.rules?.smsTemplate ||
    stage?.rules?.custom_instructions ||
    null;
  const body = buildCollectionSmsBody({
    debtorName: debtor?.fullName,
    amountDueCents: debtCase?.amountDueCents,
    currency: debtCase?.currency,
    daysPastDue: debtCase?.daysPastDue,
    stageName: stage?.name,
    customTemplate,
  });

  let interaction = null;

  try {
    interaction = await createInteractionLog({
      tenantId,
      debtCaseId,
      debtorId,
      status: 'queued',
    });

    const providerResult = await sendTwilioSms({ to, body });

    await interaction.update({
      status: 'sent',
      providerRef: providerResult.messageSid,
      summary: body,
      endedAt: new Date(),
    });

    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'sms_sent',
      payload: {
        interactionLogId: interaction.id,
        messageSid: providerResult.messageSid,
        to,
        preview: body.slice(0, 160),
        providerStatus: providerResult.status,
      },
    });

    return {
      ok: true,
      channel: 'sms',
      outcome: 'sms_sent',
      interactionLogId: interaction.id,
      providerRef: providerResult.messageSid,
    };
  } catch (error) {
    logger.error(
      { err: error, tenantId, debtCaseId, automationId },
      'Failed to send collection SMS'
    );

    if (interaction) {
      await interaction.update({
        status: 'failed',
        outcome: 'FAILED',
        endedAt: new Date(),
        error: {
          message: error?.message || 'SMS dispatch failed',
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
      eventType: 'sms_failed',
      payload: {
        interactionLogId: interaction?.id || null,
        reason: error?.message || 'SMS dispatch failed',
      },
    });

    return {
      ok: false,
      channel: 'sms',
      outcome: 'sms_failed',
      message: error?.message || 'SMS dispatch failed',
    };
  }
};
