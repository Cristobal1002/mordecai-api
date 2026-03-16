import { TenantSubscription, PmsUnit, TenantUser } from '../../models/index.js';
import {
  MINIMUM_MONTHLY_CENTS,
  CALLS_PLAN_CENTS,
  WHITE_LABEL_CENTS,
  EXTRA_SEAT_CENTS,
  INCLUDED_SEATS,
} from '../../config/billing.config.js';

/**
 * Lógica interna de cálculo de factura.
 * Si customRatePerUnitCents tiene valor, usa rate flat para todas las unidades.
 * @private
 */
function calculateBill({
  unitCount,
  callsPlan,
  whiteLabelEnabled,
  extraSeats,
  customRatePerUnitCents,
}) {
  const callsPlanCents = CALLS_PLAN_CENTS[callsPlan] ?? CALLS_PLAN_CENTS.none;
  const whiteLabelCents = whiteLabelEnabled ? WHITE_LABEL_CENTS : 0;
  const seatsCents = Math.max(0, extraSeats) * EXTRA_SEAT_CENTS;

  let baseCents;
  let minimumApplied = false;
  let tiers = [];

  if (customRatePerUnitCents != null && customRatePerUnitCents > 0) {
    baseCents = unitCount * customRatePerUnitCents;
    baseCents = Math.max(baseCents, MINIMUM_MONTHLY_CENTS);
    if (baseCents === MINIMUM_MONTHLY_CENTS && unitCount > 0) {
      minimumApplied = true;
    }
    tiers = [
      {
        label: 'Custom rate',
        units: unitCount,
        rateCents: customRatePerUnitCents,
        subtotalCents: unitCount * customRatePerUnitCents,
      },
    ].filter((t) => t.units > 0);
  } else {
    const tier1 = Math.min(unitCount, 500);
    const tier2 = Math.max(0, Math.min(unitCount - 500, 1000));
    const tier3 = Math.max(0, Math.min(unitCount - 1500, 3500));
    const tier4 = Math.max(0, unitCount - 5000);

    const rawBase =
      tier1 * 150 + tier2 * 125 + tier3 * 100 + tier4 * 90;
    baseCents = Math.max(rawBase, MINIMUM_MONTHLY_CENTS);
    minimumApplied = rawBase < MINIMUM_MONTHLY_CENTS;

    tiers = [
      { label: 'First 500 units', units: tier1, rateCents: 150, subtotalCents: tier1 * 150 },
      { label: 'Units 501–1,500', units: tier2, rateCents: 125, subtotalCents: tier2 * 125 },
      { label: 'Units 1,501–5,000', units: tier3, rateCents: 100, subtotalCents: tier3 * 100 },
      { label: 'Units 5,000+', units: tier4, rateCents: 90, subtotalCents: tier4 * 90 },
    ].filter((t) => t.units > 0);
  }

  const totalCents = baseCents + callsPlanCents + whiteLabelCents + seatsCents;

  return {
    unitCount,
    baseCents,
    minimumApplied,
    tiers,
    callsPlanCents,
    whiteLabelCents,
    seatsCents,
    totalCents,
  };
}

export const billingService = {
  getUsageSummary: async (tenantId) => {
    const unitCountVal = await PmsUnit.count({ where: { tenantId } });

    const currentSeats = await TenantUser.count({
      where: { tenantId, status: 'active' },
    });

    const [subscription] = await TenantSubscription.findOrCreate({
      where: { tenantId },
      defaults: { status: 'trialing', callsPlan: 'none' },
    });

    const bill = calculateBill({
      unitCount: unitCountVal,
      callsPlan: subscription.callsPlan ?? 'none',
      whiteLabelEnabled: subscription.whiteLabelEnabled ?? false,
      extraSeats: subscription.extraSeats ?? 0,
      customRatePerUnitCents: subscription.customRatePerUnitCents,
    });

    return {
      unitCount: unitCountVal,
      currentSeats,
      includedSeats: INCLUDED_SEATS,
      extraSeats: subscription.extraSeats ?? 0,
      subscription: {
        callsPlan: subscription.callsPlan ?? 'none',
        whiteLabelEnabled: subscription.whiteLabelEnabled ?? false,
        extraSeats: subscription.extraSeats ?? 0,
        status: subscription.status ?? 'trialing',
        trialEndsAt: subscription.trialEndsAt,
      },
      bill,
    };
  },

  updateSubscription: async (tenantId, data) => {
    const existing = await TenantSubscription.findOne({
      where: { tenantId },
    });

    const updates = {};
    if (data.callsPlan !== undefined) updates.callsPlan = data.callsPlan;
    if (data.whiteLabelEnabled !== undefined) updates.whiteLabelEnabled = data.whiteLabelEnabled;
    if (data.extraSeats !== undefined) updates.extraSeats = Math.max(0, data.extraSeats);
    if (data.status !== undefined) updates.status = data.status;
    if (data.notes !== undefined) updates.notes = data.notes;

    if (existing) {
      await existing.update(updates);
    } else {
      await TenantSubscription.create({
        tenantId,
        ...updates,
      });
    }

    return billingService.getUsageSummary(tenantId);
  },
};
