/**
 * Resolves or creates a payment link URL for a debt case.
 * Used when sending SMS/email so the debtor always gets a link to see their account and pay.
 *
 * URLs use short_token (8 chars) when available to save SMS characters, e.g. /p/abc12XyZ
 *
 * For channel attribution (SMS vs Email link clicks), pass source and automationId.
 * By default the URL includes ?source=sms|email&aid=automationId so pay.mordecai.ai can
 * attribute clicks. Callers may disable attribution for SMS deliverability-sensitive flows.
 */
import crypto from 'crypto';
import { Op } from 'sequelize';
import { PaymentLink } from '../../models/index.js';

const PAYMENTS_BASE_URL = (process.env.PAYMENTS_BASE_URL || 'https://pay.mordecai.ai').replace(/\/$/, '');
const DEFAULT_EXPIRY_HOURS = 72;
const SHORT_TOKEN_LENGTH = 8;
const SHORT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generate a URL-safe short token (alphanumeric, 8 chars) */
function generateShortToken() {
  let s = '';
  for (let i = 0; i < SHORT_TOKEN_LENGTH; i++) {
    s += SHORT_TOKEN_CHARS[crypto.randomInt(0, SHORT_TOKEN_CHARS.length)];
  }
  return s;
}

/** Ensure the link has a short_token; backfill if missing. Returns the token to use in URL. */
async function ensureShortToken(link) {
  if (link.shortToken) return link.shortToken;
  for (let attempt = 0; attempt < 5; attempt++) {
    const st = generateShortToken();
    const existing = await PaymentLink.findOne({ where: { shortToken: st } });
    if (!existing) {
      await link.update({ shortToken: st });
      return st;
    }
  }
  return link.token; // fallback to full token on collision
}

/**
 * Append attribution params for channel tracking (?source=sms|email&aid=automationId).
 * Callers use this when sending links so we can attribute clicks on pay.mordecai.ai.
 * @param {string} baseUrl
 * @param {string} [source] - 'sms' | 'email'
 * @param {string} [automationId] - UUID for Activity attribution
 */
export function appendPaymentLinkAttribution(baseUrl, source, automationId) {
  if (!baseUrl || typeof baseUrl !== 'string') return baseUrl;
  const params = new URLSearchParams();
  if (source && ['sms', 'email'].includes(String(source).toLowerCase())) {
    params.set('source', String(source).toLowerCase());
  }
  if (automationId && UUID_REGEX.test(String(automationId))) {
    params.set('aid', automationId);
  }
  const qs = params.toString();
  if (!qs) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${qs}`;
}

/**
 * Get or create a payment link for a debt case. Returns the full URL.
 * Reuses an existing valid link if one exists; otherwise creates a new one.
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.debtCaseId
 * @param {string} [opts.paymentAgreementId] - Optional, if there's an agreement
 * @param {string} [opts.source] - 'sms' | 'email' for click attribution
 * @param {string} [opts.automationId] - Automation UUID for Activity attribution
 * @param {boolean} [opts.includeAttribution=true] - Append source/aid params to the URL
 * @returns {Promise<string>} Full URL e.g. https://pay.mordecai.ai/p/{token}
 */
export async function getOrCreatePaymentLinkUrl({
  tenantId,
  debtCaseId,
  paymentAgreementId = null,
  source,
  automationId,
  includeAttribution = true,
} = {}) {
  const minExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // at least 24h left

  const existing = await PaymentLink.findOne({
    where: {
      tenantId,
      debtCaseId,
      status: 'PENDING',
      expiresAt: { [Op.gt]: minExpiry },
    },
    order: [['createdAt', 'DESC']],
  });

  let urlToken;
  if (existing) {
    urlToken = await ensureShortToken(existing);
  } else {
    const token = crypto.randomUUID();
    let shortToken = generateShortToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await PaymentLink.findOne({ where: { shortToken } });
      if (!clash) break;
      shortToken = generateShortToken();
    }
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);
    await PaymentLink.create({
      tenantId,
      debtCaseId,
      paymentAgreementId,
      token,
      shortToken,
      status: 'PENDING',
      expiresAt,
    });
    urlToken = shortToken;
  }

  const baseUrl = `${PAYMENTS_BASE_URL}/p/${urlToken}`;
  return includeAttribution
    ? appendPaymentLinkAttribution(baseUrl, source, automationId)
    : baseUrl;
}
