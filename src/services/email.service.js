/**
 * Email service - sends transactional emails via AWS SES v2
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from '../utils/logger.js';
import {
  renderTeamInvitation,
  renderPasswordRecovery,
  renderCollectionsNotification,
  renderOtpVerification,
} from '../email-templates/index.js';

const getClient = () => {
  const region = (process.env.AWS_REGION || 'us-east-1').trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const config = { region };
  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey };
  }
  return new SESv2Client(config);
};

const getFromAddress = () => {
  const addr = process.env.SES_FROM_EMAIL || process.env.OTP_FROM_EMAIL;
  if (addr) return addr;
  return 'noreply@mordecai.ai';
};

/**
 * Send OTP verification email (debtors - pay link verification)
 * @param {string} to - Recipient email
 * @param {string} code - 6-digit OTP code
 * @param {string} [companyName] - Tenant/company name for personalization
 */
export async function sendOtpEmail(to, code, companyName = 'Mordecai') {
  const { subject, html } = renderOtpVerification({
    code,
    companyName,
    expiresInMinutes: 15,
  });
  return sendTemplatedEmail({ to, subject, html });
}

/**
 * Send email from template
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html - HTML body
 * @param {string} [opts.replyTo] - Reply-To address
 */
export async function sendTemplatedEmail({ to, subject, html, replyTo }) {
  const client = getClient();
  const from = getFromAddress();

  const content = {
    Simple: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  };

  const params = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: content,
  };
  if (replyTo) {
    params.ReplyToAddresses = [replyTo];
  }

  const command = new SendEmailCommand(params);

  try {
    await client.send(command);
    logger.info({ to: to.replace(/(.{2}).*(@.*)/, '$1***$2'), subject }, 'Templated email sent');
    return true;
  } catch (err) {
    logger.warn({ err, to: to.replace(/(.{2}).*(@.*)/, '$1***$2'), subject }, 'Failed to send templated email');
    throw err;
  }
}

/**
 * Send team invitation email
 * @param {Object} opts
 * @param {string} opts.to - Invitee email
 * @param {string} opts.inviterName - Name of person who sent invite
 * @param {string} opts.tenantName - Company/team name
 * @param {string} opts.acceptUrl - Full URL to accept invitation (e.g. https://app.example.com/invitations/TOKEN)
 * @param {number} [opts.expiresInDays] - Days until link expires
 */
export async function sendInvitationEmail({ to, inviterName, tenantName, acceptUrl, expiresInDays = 7 }) {
  const { subject, html } = renderTeamInvitation({
    inviteeEmail: to,
    inviterName,
    tenantName,
    acceptUrl,
    expiresInDays,
  });
  return sendTemplatedEmail({ to, subject, html });
}

/**
 * Send password recovery email (for custom reset flows)
 * @param {Object} opts
 * @param {string} opts.to - User email
 * @param {string} [opts.code] - Reset code (manual entry)
 * @param {string} [opts.resetUrl] - Reset link URL
 * @param {string} [opts.companyName] - Company name
 * @param {number} [opts.expiresInMinutes] - Code/link expiry
 */
export async function sendPasswordRecoveryEmail({
  to,
  code,
  resetUrl,
  companyName = 'Mordecai',
  expiresInMinutes = 60,
}) {
  const { subject, html } = renderPasswordRecovery({
    email: to,
    code,
    resetUrl,
    companyName,
    expiresInMinutes,
  });
  return sendTemplatedEmail({ to, subject, html });
}

/**
 * Send collections/portfolio notification to debtor
 * @param {Object} opts - Same variables as renderCollectionsNotification
 */
export async function sendCollectionsNotificationEmail({ to, ...vars }) {
  const { subject, html } = renderCollectionsNotification(vars);
  return sendTemplatedEmail({ to, subject, html });
}
