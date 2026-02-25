/**
 * Resolves or creates a payment link URL for a debt case.
 * Used when sending SMS/email so the debtor always gets a link to see their account and pay.
 */
import crypto from 'crypto';
import { Op } from 'sequelize';
import { PaymentLink } from '../../models/index.js';

const PAYMENTS_BASE_URL = (process.env.PAYMENTS_BASE_URL || 'https://pay.mordecai.ai').replace(/\/$/, '');
const DEFAULT_EXPIRY_HOURS = 72;

/**
 * Get or create a payment link for a debt case. Returns the full URL.
 * Reuses an existing valid link if one exists; otherwise creates a new one.
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.debtCaseId
 * @param {string} [opts.paymentAgreementId] - Optional, if there's an agreement
 * @returns {Promise<string>} Full URL e.g. https://pay.mordecai.ai/p/{token}
 */
export async function getOrCreatePaymentLinkUrl({ tenantId, debtCaseId, paymentAgreementId = null }) {
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

  if (existing) {
    return `${PAYMENTS_BASE_URL}/p/${existing.token}`;
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);

  await PaymentLink.create({
    tenantId,
    debtCaseId,
    paymentAgreementId,
    token,
    status: 'PENDING',
    expiresAt,
  });

  return `${PAYMENTS_BASE_URL}/p/${token}`;
}
