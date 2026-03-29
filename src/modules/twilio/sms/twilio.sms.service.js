import { CollectionEvent, InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import { buildCollectionSmsBody, estimateSmsTransportMeta } from './twilio.sms.template.js';
import { sendTwilioSms } from './twilio.sms.client.js';
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
  aiData = {},
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
    aiData,
  });
};

export const sendCollectionSms = async ({
  tenantId,
  automationId,
  state,
  debtCase,
  debtor,
  stage,
  tenant,
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

  const paymentLink = await getOrCreatePaymentLinkUrl({
    tenantId,
    debtCaseId,
    paymentAgreementId: debtCase?.meta?.last_agreement_id || null,
    source: 'sms',
    automationId,
    includeAttribution: false,
  });

  const smsTemplate = await resolveChannelTemplate({
    tenantId,
    channel: 'sms',
    stage: stage || null,
  });
  const customTemplate = smsTemplate.template?.bodyText
    ? String(smsTemplate.template.bodyText).trim()
    : '';

  if (!customTemplate) {
    await createCollectionEvent({
      automationId,
      debtCaseId,
      eventType: 'sms_skipped_missing_template',
      payload: {
        reason:
          smsTemplate.reason === 'stage_template_not_found'
            ? 'SMS template configured in stage was not found or is inactive'
            : 'SMS template is not configured for this stage',
        templateReason: smsTemplate.reason,
      },
    });

    return {
      ok: false,
      channel: 'sms',
      outcome: 'sms_missing_template',
      message: 'SMS template is missing',
    };
  }

  const body = buildCollectionSmsBody({
    debtorName: debtor?.fullName,
    customTemplate,
    paymentLink,
    tenantName: tenant?.name || '',
  });
  const smsMeta = estimateSmsTransportMeta(body);

  let interaction = null;

  try {
    logger.info(
      {
        tenantId,
        debtCaseId,
        automationId: automationId || null,
        smsEncoding: smsMeta.encoding,
        smsSegments: smsMeta.segments,
        smsLength: smsMeta.length,
        smsHasHttpLink: /\bhttps?:\/\//i.test(body),
        smsBodyPreview: body.slice(0, 120),
      },
      'Dispatching collection SMS'
    );

    interaction = await createInteractionLog({
      tenantId,
      debtCaseId,
      debtorId,
      status: 'queued',
      aiData: {
        delivery_profile: 'concise_link',
        payment_link_enabled: true,
        payment_link_attribution: 'disabled_for_sms',
        template_reason: smsTemplate.reason || null,
        estimated_encoding: smsMeta.encoding,
        estimated_segments: smsMeta.segments,
        estimated_units: smsMeta.units,
      },
    });

    const providerResult = await sendTwilioSms({ to, body });

    await interaction.update({
      status: 'sent',
      providerRef: providerResult.messageSid,
      summary: body,
      endedAt: new Date(),
      aiData: {
        ...(interaction.aiData || {}),
        provider_status: providerResult.status || null,
      },
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
        encoding: smsMeta.encoding,
        estimatedSegments: smsMeta.segments,
        estimatedUnits: smsMeta.units,
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
      {
        err: error,
        tenantId,
        debtCaseId,
        automationId,
        smsEncoding: smsMeta.encoding,
        smsSegments: smsMeta.segments,
      },
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
        encoding: smsMeta.encoding,
        estimatedSegments: smsMeta.segments,
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
