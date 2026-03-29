import { InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import {
  resolveTwilioWebhookUrl,
  validateTwilioRequestWithJsonBody,
} from '../twilio-request-signature.util.js';

const MAX_SHORT_LINK_CLICKS = 40;

const parseLinkClickPayload = (rawBody, parsedBody) => {
  if (parsedBody && typeof parsedBody === 'object') return parsedBody;
  try {
    return JSON.parse(String(rawBody || '{}'));
  } catch {
    return null;
  }
};

const mapSmsStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (['delivered', 'sent'].includes(normalized)) return 'delivered';
  if (['failed', 'undelivered'].includes(normalized)) return 'failed';
  if (['queued', 'accepted', 'scheduled', 'sending'].includes(normalized)) return 'in_progress';
  return normalized || 'unknown';
};

export const twilioSmsController = {
  statusCallback: async (req, res, next) => {
    try {
      const messageSid = req.body?.MessageSid || null;
      const messageStatus = req.body?.MessageStatus || null;
      const errorCode = req.body?.ErrorCode || null;
      const errorMessage = req.body?.ErrorMessage || null;

      if (!messageSid) {
        return res.status(400).json({
          success: false,
          message: 'Missing MessageSid in Twilio status callback',
        });
      }

      const interaction = await InteractionLog.findOne({
        where: {
          providerRef: messageSid,
          type: 'SMS',
        },
      });

      if (!interaction) {
        logger.warn({ messageSid }, 'Twilio SMS status callback received for unknown MessageSid');
        return res.status(200).json({ success: true, message: 'ignored' });
      }

      const mappedStatus = mapSmsStatus(messageStatus);
      const isFinal = mappedStatus === 'delivered' || mappedStatus === 'failed';

      const updateData = {
        status: mappedStatus,
        aiData: {
          ...(interaction.aiData || {}),
          twilio_status: messageStatus || null,
          twilio_error_code: errorCode,
          twilio_error_message: errorMessage,
        },
      };

      if (isFinal) {
        updateData.endedAt = new Date();
      }

      if (mappedStatus === 'failed') {
        updateData.outcome = 'FAILED';
        updateData.error = {
          ...(interaction.error || {}),
          errorCode,
          errorMessage,
          providerStatus: messageStatus,
        };
        logger.warn(
          {
            interactionId: interaction.id,
            messageSid,
            messageStatus,
            errorCode,
            errorMessage,
          },
          'Twilio SMS delivery reported failure'
        );
      }

      await interaction.update(updateData);
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Twilio SMS status handler failed');
      return next(error);
    }
  },

  /**
   * Twilio Link Shortening — click / preview events (JSON POST).
   * Configure the same public URL in Twilio → shortening domain → Click tracking callback URL.
   */
  linkClickCallback: async (req, res, next) => {
    try {
      const rawBody =
        typeof req.rawBody === 'string'
          ? req.rawBody
          : Buffer.isBuffer(req.rawBody)
            ? req.rawBody.toString('utf8')
            : '';

      const skipSig =
        process.env.TWILIO_SKIP_LINK_CLICK_SIGNATURE === 'true' ||
        process.env.TWILIO_SKIP_LINK_CLICK_SIGNATURE === '1';

      if (!skipSig) {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const signature = req.get('X-Twilio-Signature') || req.get('x-twilio-signature');
        const url = resolveTwilioWebhookUrl(req);
        if (
          !validateTwilioRequestWithJsonBody(authToken, signature, url, rawBody)
        ) {
          logger.warn(
            { url: url.replace(/\?.*/, '?…') },
            'Twilio link-click webhook: invalid or missing signature'
          );
          return res.status(403).send('Forbidden');
        }
      }

      const payload = parseLinkClickPayload(rawBody, req.body);
      if (!payload || typeof payload !== 'object') {
        return res.status(400).send('Bad Request');
      }

      const smsSid = payload.sms_sid || payload.SmsSid || null;
      const eventType = payload.event_type || null;
      const link = payload.link || null;
      const clickTime = payload.click_time || null;
      const userAgent = payload.user_agent || null;
      const to = payload.to || null;
      const from = payload.from || null;

      if (!smsSid) {
        return res.status(400).send('Missing sms_sid');
      }

      const clickRecord = {
        receivedAt: new Date().toISOString(),
        event_type: eventType,
        link,
        click_time: clickTime,
        user_agent: userAgent,
        to,
        from,
        messaging_service_sid: payload.messaging_service_sid || null,
      };

      const interaction = await InteractionLog.findOne({
        where: {
          providerRef: smsSid,
          type: 'SMS',
        },
      });

      if (!interaction) {
        logger.info(
          { smsSid, eventType, linkPreview: link ? String(link).slice(0, 80) : null },
          'Twilio link-click: no InteractionLog for Message SID (ignored)'
        );
        return res.status(200).type('text/plain').send('OK');
      }

      const prev = interaction.aiData || {};
      const list = Array.isArray(prev.twilio_short_link_clicks)
        ? [...prev.twilio_short_link_clicks]
        : [];
      list.push(clickRecord);
      const trimmed =
        list.length > MAX_SHORT_LINK_CLICKS
          ? list.slice(-MAX_SHORT_LINK_CLICKS)
          : list;

      const previewClicks = (prev.twilio_short_link_preview_count || 0) + (eventType === 'preview' ? 1 : 0);
      const realClicks = (prev.twilio_short_link_click_count || 0) + (eventType === 'click' ? 1 : 0);

      await interaction.update({
        aiData: {
          ...prev,
          twilio_short_link_clicks: trimmed,
          twilio_short_link_last_event_at: clickRecord.receivedAt,
          twilio_short_link_preview_count: previewClicks,
          twilio_short_link_click_count: realClicks,
        },
      });

      logger.info(
        {
          interactionId: interaction.id,
          debtCaseId: interaction.debtCaseId,
          eventType,
          click_time: clickTime,
        },
        'Twilio shortened link engagement recorded'
      );

      return res.status(200).type('text/plain').send('OK');
    } catch (error) {
      logger.error({ error }, 'Twilio link-click handler failed');
      return next(error);
    }
  },
};

