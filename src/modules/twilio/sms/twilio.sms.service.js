import { CollectionEvent, InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import {
  buildCollectionSmsBody,
  estimateSmsTransportMeta,
  isColombiaDestinationPhone,
} from './twilio.sms.template.js';
import { sendTwilioSms } from './twilio.sms.client.js';
import { getOrCreatePaymentLinkUrl } from '../../pay/payment-link-resolver.service.js';
import { resolveChannelTemplate } from '../../templates/template-resolution.service.js';

const parseBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const SMS_CO_STRICT_MODE = parseBooleanFlag(process.env.SMS_CO_STRICT_MODE, false);
const SMS_CO_DISABLE_LINK = parseBooleanFlag(process.env.SMS_CO_DISABLE_LINK, false);

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
  const isColombiaDestination = isColombiaDestinationPhone(to);
  const strictColombiaMode = SMS_CO_STRICT_MODE && isColombiaDestination;
  const includePaymentLink = !(strictColombiaMode && SMS_CO_DISABLE_LINK);

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

  // Always ensure a payment link (with ?source=sms&aid= for click attribution)
  const paymentLink = await getOrCreatePaymentLinkUrl({
    tenantId,
    debtCaseId,
    paymentAgreementId: debtCase?.meta?.last_agreement_id || null,
    source: 'sms',
    automationId,
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
    amountDueCents: debtCase?.amountDueCents,
    currency: debtCase?.currency,
    daysPastDue: debtCase?.daysPastDue,
    stageName: stage?.name,
    customTemplate,
    meta: debtCase?.meta || {},
    dueDate: debtCase?.dueDate || '',
    paymentLink,
    tenantName: tenant?.name || '',
    destinationPhone: to,
    strictColombiaMode,
    includePaymentLink,
  });
  const smsMeta = estimateSmsTransportMeta(body);

  let interaction = null;

  try {
    logger.info(
      {
        tenantId,
        debtCaseId,
        automationId: automationId || null,
        destinationCountry: isColombiaDestination ? 'CO' : 'OTHER',
        strictColombiaMode,
        includePaymentLink,
        smsEncoding: smsMeta.encoding,
        smsSegments: smsMeta.segments,
        smsLength: smsMeta.length,
      },
      'Dispatching collection SMS'
    );

    interaction = await createInteractionLog({
      tenantId,
      debtCaseId,
      debtorId,
      status: 'queued',
      aiData: {
        destination_country: isColombiaDestination ? 'CO' : 'OTHER',
        strict_colombia_mode: strictColombiaMode,
        include_payment_link: includePaymentLink,
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
        destinationCountry: isColombiaDestination ? 'CO' : 'OTHER',
        strictColombiaMode,
        includePaymentLink,
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
