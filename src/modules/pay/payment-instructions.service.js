/**
 * Builds debtor-facing payment instructions from tenant payment channels.
 * Computes referenceValue from referenceTemplate using case context.
 */
import { paymentChannelRepository } from '../payment-channels/payment-channel.repository.js';
import { PmsLease } from '../../models/index.js';

const PLACEHOLDERS = ['caseId', 'casePublicId', 'debtorId', 'tenantId', 'leaseExternalId'];

/**
 * Resolve lease external ID from debt case meta (pms_lease_id).
 */
async function resolveLeaseExternalId(tenantId, pmsLeaseId) {
  if (!pmsLeaseId) return null;
  const lease = await PmsLease.findOne({
    where: { id: pmsLeaseId },
    attributes: ['externalId'],
  });
  return lease?.externalId ?? null;
}

/**
 * Compute reference value from template.
 * Template supports: {caseId}, {casePublicId}, {debtorId}, {tenantId}, {leaseExternalId}
 * Recommended for memo: {casePublicId} (short, e.g. MC-4F2K9Q)
 */
function computeReferenceValue(template, context) {
  if (!template || typeof template !== 'string') return '';
  let out = template;
  for (const key of PLACEHOLDERS) {
    const val = context[key] ?? '';
    out = out.replace(new RegExp(`\\{${key}\\}`, 'gi'), String(val));
  }
  return out;
}

/**
 * Build debtor-facing field for display (value + copyable flag).
 * Only include fields with scope=debtor or scope undefined (tenant_admin only = exclude).
 * For select with optionLabels, display the friendly label to debtor.
 * For boolean with reminderWhenTrue and value true: show as Reminder, not checkbox.
 */
function buildDebtorField(fieldSchema, value) {
  const scope = fieldSchema.scope ?? 'debtor';
  if (scope === 'tenant_admin') return null; // Don't show to debtor
  if (fieldSchema.type === 'boolean') {
    if (value !== true) return null; // Don't show false booleans to debtor
    if (fieldSchema.reminderWhenTrue) {
      return {
        key: fieldSchema.key,
        label: 'Reminder',
        value: fieldSchema.reminderWhenTrue,
        copyable: false,
        sensitive: false,
        isReminder: true,
      };
    }
    return null; // Boolean without reminderWhenTrue: don't show
  }
  let v = value ?? '';
  if (fieldSchema.type === 'select' && fieldSchema.optionLabels && v) {
    v = fieldSchema.optionLabels[v] ?? v;
  }
  return {
    key: fieldSchema.key,
    label: fieldSchema.label,
    value: String(v),
    copyable: fieldSchema.copyable === true,
    sensitive: fieldSchema.sensitive === true,
  };
}

/**
 * Build payment instructions for a debt case.
 * @param {Object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.debtCaseId
 * @param {string} [opts.casePublicId] - short ID (e.g. MC-4F2K9Q), recommended for memo
 * @param {string} opts.debtorId
 * @param {string} [opts.leaseExternalId] - optional, resolved from meta if not provided
 * @param {string} [opts.pmsLeaseId] - from debt_case.meta.pms_lease_id
 * @returns {Promise<Array>} channels with debtor-facing content
 */
export async function buildPaymentInstructions({
  tenantId,
  debtCaseId,
  casePublicId = null,
  debtorId,
  leaseExternalId = null,
  pmsLeaseId = null,
}) {
  const context = {
    caseId: debtCaseId ?? '',
    casePublicId: casePublicId ?? '',
    debtorId: debtorId ?? '',
    tenantId: tenantId ?? '',
    leaseExternalId: leaseExternalId ?? '',
  };

  if (pmsLeaseId && !leaseExternalId) {
    context.leaseExternalId = await resolveLeaseExternalId(tenantId, pmsLeaseId) ?? '';
  }

  const channels = await paymentChannelRepository.findByTenant(tenantId);
  const result = [];

  for (const ch of channels) {
    const plain = ch.get ? ch.get({ plain: true }) : ch;
    const schema = plain.channelType?.configSchema ?? { fields: [] };
    const config = plain.config ?? {};

    const code = plain.code ?? ch.code;

    // Skip link channel if no URL configured
    if (code === 'link' && !config.url) continue;
    // Skip card - typically no manual instructions (processor handles it)
    if (code === 'card') continue;

    const refBlock = schema.reference;
    // Tenant can override template via config.referenceOverride (e.g. LEASE-{leaseExternalId})
    const template =
      config.referenceOverride?.template ??
      refBlock?.template;
    const referenceValue = template
      ? computeReferenceValue(template, context)
      : null;

    const debtorFields = [];

    // Skip if no meaningful config (transfer needs banks, zelle needs email/phone, cash needs points)
    if (code === 'transfer') {
      const banks = config.banks;
      if (!Array.isArray(banks) || banks.length === 0) continue;
    }
    if (code === 'zelle') {
      const recipients = config.recipients;
      if (!Array.isArray(recipients) || recipients.length === 0) continue;
    }
    if (code === 'cash') {
      const locations = config.locations ?? config.points;
      if (!Array.isArray(locations) || locations.length === 0) continue;
    }
    if (code === 'check') {
      if (!config.payeeName || !config.deliveryMethods?.length) continue;
    }

    // Flatten config to debtor-facing fields based on schema
    // For array fields (banks, recipients, locations): show primary first, then others under "More accounts"
    if (schema.fields) {
      for (const field of schema.fields) {
        if (field.type === 'array') {
          const raw = config[field.key] ?? (field.key === 'locations' ? config.points : undefined);
          const arr = Array.isArray(raw) ? raw : [];
          const itemFields = field.itemFields ?? [];
          // Sort: primary first (isPrimary/isDefault true), then rest. Debtor sees only primary.
          const sorted = [...arr].sort((a, b) => {
            const aPrimary = a.isPrimary || a.isDefault;
            const bPrimary = b.isPrimary || b.isDefault;
            if (aPrimary && !bPrimary) return -1;
            if (!aPrimary && bPrimary) return 1;
            return 0;
          });
          const primary = sorted.find((item) => item.isPrimary || item.isDefault) ?? sorted[0];
          const toShow = primary ? [primary] : [];
          for (let i = 0; i < toShow.length; i++) {
            const item = toShow[i] || {};
            const prefix = sorted.length > 1 ? `#${i + 1} ` : '';
            for (const sub of itemFields) {
              if (sub.scope === 'tenant_admin') continue;
              const val = item[sub.key];
              const shouldInclude = sub.type === 'boolean' ? val === true : val != null && val !== '';
              if (shouldInclude) {
                const built = buildDebtorField(
                  { ...sub, label: `${prefix}${sub.label}` },
                  val
                );
                if (built) {
                  debtorFields.push({
                    ...built,
                    groupIndex: i,
                    groupLabel: sorted.length > 1 ? `${field.label} ${i + 1}` : null,
                    isPrimary: item.isPrimary || item.isDefault,
                  });
                }
              }
            }
            // For cash locations or check deliveryMethods: add "Open in Maps" link
            if ((field.key === 'locations' && code === 'cash') || (field.key === 'deliveryMethods' && code === 'check')) {
              const parts = [
                item.addressLine1,
                item.addressLine2,
                item.city,
                item.state,
                item.zip,
              ].filter(Boolean);
              if (parts.length >= 3) {
                const addressStr = parts.join(', ');
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;
                debtorFields.push({
                  key: '_mapsUrl',
                  label: 'Open in Maps',
                  value: mapsUrl,
                  copyable: false,
                  isMapsLink: true,
                });
              }
            }
          }
          if (sorted.length > 1) {
            const moreLabel = field.key === 'recipients' ? 'recipient(s)' : field.key === 'locations' ? 'location(s)' : field.key === 'deliveryMethods' ? 'delivery method(s)' : 'account(s)';
            debtorFields.push({
              key: `_more${field.key}`,
              label: `More ${field.key}`,
              value: `${sorted.length - 1} additional ${moreLabel} available`,
              copyable: false,
              moreCount: sorted.length - 1,
            });
          }
        } else {
          if (field.scope === 'tenant_admin') continue;
          // For check: memoHint shown in reference block, not as separate field
          if (field.key === 'memoHint' && code === 'check') continue;
          const val = config[field.key];
          if (val != null && val !== '') {
            const built = buildDebtorField(field, val);
            if (built) debtorFields.push(built);
          }
        }
      }
    }

    const refBlockData =
      refBlock && (refBlock.required || referenceValue)
        ? {
            value: referenceValue,
            label: refBlock.label ?? 'Memo / Reference',
            helpText: refBlock.helpText ?? null,
            copyable: true,
            memoHint: code === 'check' ? (config.memoHint || null) : null,
          }
        : null;

    result.push({
      code: plain.code ?? code,
      label: plain.label ?? schema.label ?? code,
      requiresReconciliation: plain.requiresReconciliation ?? false,
      fields: debtorFields,
      reference: refBlockData,
    });
  }

  return result;
}
