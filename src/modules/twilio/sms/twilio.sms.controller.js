import { InteractionLog } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';

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
      }

      await interaction.update(updateData);
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Twilio SMS status handler failed');
      return next(error);
    }
  },
};

