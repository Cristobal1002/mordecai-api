import crypto from 'crypto';
import {
  PaymentLink,
  TenantBranding,
  Tenant,
  DebtCase,
  Debtor,
  PaymentAgreement,
  PmsLease,
  PmsUnit,
  CollectionEvent,
} from '../../models/index.js';
import { resolveBranding } from '../../config/branding-defaults.js';
import { resolveLogoUrl } from '../../utils/s3-upload.js';
import { maskEmail } from '../../utils/mask-email.js';
import { signPaySession, verifyPaySession } from './pay-jwt.js';
import { sendTwilioSms } from '../twilio/sms/twilio.sms.client.js';
import { sendOtpEmail } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { buildPaymentInstructions } from './payment-instructions.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve token (UUID or short_token) to PaymentLink.
 * Supports both /p/abc12xyz and /p/550e8400-e29b-41d4-a716-446655440000
 */
async function resolvePaymentLink(token, options = {}) {
  if (!token || typeof token !== 'string') return null;
  const isUuid = UUID_REGEX.test(token.trim());
  const where = isUuid ? { token: token.trim() } : { shortToken: token.trim() };
  return PaymentLink.findOne({
    where,
    ...options,
  });
}

const normalizeForVerify = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getLastWord = (fullName) => {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
};

export const payService = {
  /**
   * GET /pay/:token — First touch. Registers click, returns branding only.
   */
  getByToken: async (token, req) => {
    const link = await resolvePaymentLink(token, {
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: DebtCase, as: 'debtCase', include: [{ model: Debtor, as: 'debtor', attributes: ['email', 'phone'] }] },
      ],
    });

    if (!link) return { status: 404 };
    if (link.status === 'BLOCKED') return { status: 423, link };
    if (link.status === 'PAID') return { status: 410, link };
    if (link.status === 'EXPIRED' || (link.expiresAt && new Date(link.expiresAt) < new Date())) {
      if (link.status !== 'EXPIRED') await link.update({ status: 'EXPIRED' });
      return { status: 410, link };
    }

    // Register first click (with channel attribution: ?source=sms | ?source=email, ?aid=automationId)
    const clickSource = (req.query?.source || req.query?.utm_source || '').toString().toLowerCase().slice(0, 32);
    const validSource = ['sms', 'email'].includes(clickSource) ? clickSource : null;
    const aid = (req.query?.aid || '').toString().trim();
    const automationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aid) ? aid : null;

    if (!link.clickedAt) {
      await link.update({
        clickedAt: new Date(),
        clickSource: validSource,
        clickIp: req.ip || req.connection?.remoteAddress || null,
        clickUserAgent: req.get('user-agent') || null,
      });
      // Emit link_clicked for Activity (compliance audit) when we have automation context
      if (automationId && link.debtCaseId) {
        try {
          await CollectionEvent.create({
            automationId,
            debtCaseId: link.debtCaseId,
            channel: validSource || 'link',
            eventType: 'link_clicked',
            payload: {
              paymentLinkId: link.id,
              source: validSource,
              ip: req.ip || req.connection?.remoteAddress || null,
              userAgent: req.get('user-agent') || null,
            },
          });
        } catch (e) {
          logger.warn({ err: e, debtCaseId: link.debtCaseId, automationId }, 'Failed to emit link_clicked event');
        }
      }
    }

    const branding = await TenantBranding.findOne({ where: { tenantId: link.tenantId } });
    const tenant = link.tenant || (await Tenant.findByPk(link.tenantId, { attributes: ['id', 'name'] }));
    const resolved = resolveBranding(branding, tenant);
    const logoUrl = resolved.logoUrl ? await resolveLogoUrl(resolved.logoUrl) : null;
    const debtorEmail = link.debtCase?.debtor?.email;
    const maskedEmailVal = debtorEmail ? maskEmail(debtorEmail) : null;
    const hasEmail = Boolean(debtorEmail?.trim());
    const hasPhone = Boolean(link.debtCase?.debtor?.phone?.trim());

    return {
      status: 200,
      payload: {
        status: link.status,
        maskedEmail: maskedEmailVal,
        hasEmail,
        hasPhone,
        branding: {
          companyName: resolved.companyName,
          logoUrl,
          primaryColor: resolved.primaryColor,
          secondaryColor: resolved.secondaryColor,
          supportEmail: resolved.supportEmail,
          supportPhone: resolved.supportPhone,
          supportHours: resolved.supportHours,
          footerText: resolved.footerText,
          showPoweredBy: resolved.showPoweredBy,
          legalDisclaimerOverride: resolved.legalDisclaimerOverride,
          otpDeliveryLabelOverride: resolved.otpDeliveryLabelOverride,
        },
      },
    };
  },

  /**
   * POST /pay/:token/verify — Verify identity by last name + unit number.
   * On success: status → VERIFIED, returns short-lived JWT for /details.
   */
  verify: async (token, body) => {
    const { lastName, unitNumber } = body || {};
    const link = await resolvePaymentLink(token, {
      include: [
        { model: DebtCase, as: 'debtCase', include: [{ model: Debtor, as: 'debtor' }] },
      ],
    });

    if (!link) return { status: 404 };
    if (link.status === 'BLOCKED') return { status: 423 };
    if (link.status === 'PAID') return { status: 410 };
    if (link.status === 'EXPIRED' || (link.expiresAt && new Date(link.expiresAt) < new Date())) {
      if (link.status !== 'EXPIRED') await link.update({ status: 'EXPIRED' });
      return { status: 410 };
    }
    if (link.status === 'VERIFIED') {
      const paySessionToken = signPaySession(link.token);
      const urlToken = link.shortToken || link.token;
      return { status: 200, payload: { verified: true, token: urlToken, paySessionToken } };
    }

    const maxAttempts = 5;
    if (link.verificationAttempts >= maxAttempts) {
      await link.update({ status: 'BLOCKED' });
      return { status: 429, message: 'Too many verification attempts' };
    }

    const debtor = link.debtCase?.debtor;
    if (!debtor) return { status: 500, message: 'Case data incomplete' };

    const storedLastName =
      debtor.metadata?.last_name ??
      debtor.metadata?.lastName ??
      getLastWord(debtor.fullName);

    let storedUnit =
      link.debtCase?.meta?.unit_number ??
      link.debtCase?.meta?.unitNumber ??
      debtor.metadata?.unit ??
      '';
    if (!storedUnit) {
      const pmsLeaseId = link.debtCase?.meta?.pms_lease_id ?? link.debtCase?.meta?.pmsLeaseId;
      if (pmsLeaseId) {
        const lease = await PmsLease.findByPk(pmsLeaseId, {
          include: [{ model: PmsUnit, as: 'pmsUnit', attributes: ['unitNumber'] }],
        });
        storedUnit = lease?.pmsUnit?.unitNumber ?? '';
      }
    }

    const inputLast = normalizeForVerify(lastName);
    const inputUnit = normalizeForVerify(unitNumber);
    const storedLast = normalizeForVerify(storedLastName);
    const storedUnitNorm = normalizeForVerify(storedUnit);

    await link.increment('verificationAttempts');

    if (inputLast !== storedLast || inputUnit !== storedUnitNorm) {
      return { status: 401, message: 'Verification failed' };
    }

    await link.update({
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verificationMethod: 'LEASE_DATA',
    });

    const paySessionToken = signPaySession(link.token);
    const urlToken = link.shortToken || link.token;
    return {
      status: 200,
      payload: { verified: true, token: urlToken, paySessionToken },
    };
  },

  /**
   * GET /pay/:token/details — Requires paySessionToken (JWT) in Authorization header.
   * Returns full case/agreement data for checkout.
   */
  getDetails: async (token, authHeader) => {
    const decoded = verifyPaySession(authHeader?.replace(/^Bearer\s+/i, '')?.trim());
    if (!decoded) return { status: 401, message: 'Invalid or expired session' };

    const link = await resolvePaymentLink(token, {
      include: [
        {
          model: DebtCase,
          as: 'debtCase',
          attributes: ['id', 'casePublicId', 'amountDueCents', 'currency', 'daysPastDue', 'dueDate', 'meta'],
          include: [
            { model: Debtor, as: 'debtor', attributes: ['id', 'fullName', 'email', 'phone'] },
          ],
        },
        {
          model: PaymentAgreement,
          as: 'paymentAgreement',
          required: false,
          attributes: ['id', 'totalAmountCents', 'downPaymentCents', 'installments', 'status', 'type'],
        },
      ],
    });

    if (!link) return { status: 404 };
    if (decoded.payToken !== link.token) return { status: 401, message: 'Invalid or expired session' };
    if (link.status !== 'VERIFIED' && link.status !== 'PENDING') {
      if (link.status === 'PAID') return { status: 410 };
      if (link.status === 'EXPIRED' || link.status === 'BLOCKED') return { status: 410 };
    }

    const dc = link.debtCase;
    const debtor = dc?.debtor;
    const agreement = link.paymentAgreement;

    const paymentInstructions = await buildPaymentInstructions({
      tenantId: link.tenantId,
      debtCaseId: dc?.id,
      casePublicId: dc?.casePublicId ?? null,
      debtorId: debtor?.id,
      pmsLeaseId: dc?.meta?.pms_lease_id ?? dc?.meta?.pmsLeaseId ?? null,
    });

    const payload = {
      residentName: debtor?.fullName ?? null,
      amountDueCents: dc?.amountDueCents ?? 0,
      currency: dc?.currency ?? 'USD',
      daysPastDue: dc?.daysPastDue ?? 0,
      dueDate: dc?.dueDate ?? null,
      unitNumber: dc?.meta?.unit_number ?? dc?.meta?.unitNumber ?? debtor?.metadata?.unit ?? null,
      propertyName: dc?.meta?.property_name ?? dc?.meta?.propertyName ?? null,
      agreement: agreement
        ? {
            id: agreement.id,
            totalAmountCents: agreement.totalAmountCents,
            downPaymentCents: agreement.downPaymentCents,
            installments: agreement.installments,
            status: agreement.status,
            type: agreement.type,
          }
        : null,
      paymentInstructions,
    };

    return { status: 200, payload };
  },

  /**
   * POST /pay/:token/otp/send — Send OTP to debtor's email (preferred) or phone. Identity verification.
   */
  sendOtp: async (token) => {
    const link = await resolvePaymentLink(token, {
      include: [
        { model: DebtCase, as: 'debtCase', include: [{ model: Debtor, as: 'debtor' }] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
    });

    if (!link) return { status: 404 };
    if (link.status === 'BLOCKED') return { status: 423 };
    if (link.status === 'PAID') return { status: 410 };
    if (link.status === 'EXPIRED' || (link.expiresAt && new Date(link.expiresAt) < new Date())) {
      if (link.status !== 'EXPIRED') await link.update({ status: 'EXPIRED' });
      return { status: 410 };
    }
    if (link.status === 'VERIFIED') {
      const paySessionToken = signPaySession(link.token);
      const urlToken = link.shortToken || link.token;
      return { status: 200, payload: { verified: true, token: urlToken, paySessionToken } };
    }

    const debtor = link.debtCase?.debtor;
    const email = debtor?.email?.trim();
    const phone = debtor?.phone?.trim();
    if (!email && !phone) return { status: 400, message: 'No email or phone on file for this account' };

    const maxOtpAttempts = 5;
    if (link.otpAttempts >= maxOtpAttempts) {
      await link.update({ status: 'BLOCKED' });
      return { status: 429, message: 'Too many OTP attempts' };
    }

    const branding = await TenantBranding.findOne({ where: { tenantId: link.tenantId } });
    const tenant = link.tenant || (await Tenant.findByPk(link.tenantId, { attributes: ['id', 'name'] }));
    const resolved = resolveBranding(branding, tenant);
    const companyName = resolved.companyName || 'Mordecai';

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    let sendTo = null;
    let maskedDestination = null;

    if (email) {
      try {
        await sendOtpEmail(email, code, companyName);
        sendTo = email;
        maskedDestination = maskEmail(email);
      } catch (err) {
        logger.warn({ err, token }, 'Pay OTP email send failed, trying SMS fallback');
        if (phone) {
          try {
            await sendTwilioSms({
              to: phone,
              body: `Your verification code is: ${code}. It expires in 15 minutes.`,
            });
            sendTo = phone;
            maskedDestination = 'your phone';
          } catch (smsErr) {
            logger.warn({ err: smsErr, token }, 'Pay OTP SMS fallback failed');
            return { status: 503, message: 'Failed to send verification code' };
          }
        } else {
          return { status: 503, message: 'Failed to send verification code' };
        }
      }
    } else {
      try {
        await sendTwilioSms({
          to: phone,
          body: `Your verification code is: ${code}. It expires in 15 minutes.`,
        });
        sendTo = phone;
        maskedDestination = 'your phone';
      } catch (err) {
        logger.warn({ err, token }, 'Pay OTP send failed');
        return { status: 503, message: 'Failed to send verification code' };
      }
    }

    await link.update({
      otpCodeHash: hash,
      otpExpiresAt,
      otpSentTo: sendTo,
      otpAttempts: (link.otpAttempts || 0) + 1,
    });

    return { status: 200, payload: { sent: true, expiresIn: 900, maskedDestination } };
  },

  /**
   * POST /pay/:token/otp/verify — Verify OTP code. On success: VERIFIED + paySessionToken.
   */
  verifyOtp: async (token, body) => {
    const { code } = body || {};
    const link = await resolvePaymentLink(token);

    if (!link) return { status: 404 };
    if (link.status === 'BLOCKED') return { status: 423 };
    if (link.status === 'PAID') return { status: 410 };
    if (link.status === 'EXPIRED' || (link.expiresAt && new Date(link.expiresAt) < new Date())) {
      if (link.status !== 'EXPIRED') await link.update({ status: 'EXPIRED' });
      return { status: 410 };
    }
    if (link.status === 'VERIFIED') {
      const paySessionToken = signPaySession(link.token);
      const urlToken = link.shortToken || link.token;
      return { status: 200, payload: { verified: true, token: urlToken, paySessionToken } };
    }

    const maxOtpAttempts = 5;
    if (link.otpAttempts >= maxOtpAttempts) {
      await link.update({ status: 'BLOCKED' });
      return { status: 429, message: 'Too many OTP attempts' };
    }

    if (!link.otpCodeHash || !link.otpExpiresAt) {
      return { status: 400, message: 'No OTP sent. Request one first.' };
    }
    if (new Date(link.otpExpiresAt) < new Date()) {
      return { status: 400, message: 'OTP expired. Request a new one.' };
    }

    const inputHash = crypto.createHash('sha256').update(String(code ?? '').trim()).digest('hex');
    if (inputHash !== link.otpCodeHash) {
      await link.increment('otpAttempts');
      return { status: 401, message: 'Invalid verification code' };
    }

    await link.update({
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verificationMethod: 'OTP',
      otpCodeHash: null,
      otpExpiresAt: null,
    });

    const paySessionToken = signPaySession(link.token);
    const urlToken = link.shortToken || link.token;
    return {
      status: 200,
      payload: { verified: true, token: urlToken, paySessionToken },
    };
  },
};
