/**
 * Rentvine mapper — transforma respuestas del PMS al modelo canónico.
 * tenants/search returns array of { contact: { contactID, name, email, phone, address, ... } }.
 */
export const rentvineMapper = {
  /**
   * Map one tenants/search item to canonical debtor for pms_debtors.
   */
  mapTenantContactToCanonicalDebtor(item) {
    const c = item?.contact;
    if (!c) return null;
    const address = {
      line1: c.address ?? null,
      line2: c.address2 ?? null,
      city: c.city ?? null,
      state: c.stateID ?? null,
      postalCode: c.postalCode ?? null,
      country: c.countryID ?? null,
    };
    return {
      externalId: String(c.contactID ?? c.contactId ?? ''),
      displayName: c.name?.trim() || 'Unknown',
      type: 'person',
      email: c.email?.trim() || null,
      phone: c.phone?.trim() || null,
      address,
      language: null,
      timezone: null,
      doNotContact: c.isActive === '0',
      doNotCall: false,
      meta: {},
      lastExternalUpdatedAt: c.dateTimeModified ? new Date(c.dateTimeModified) : null,
    };
  },

  toCanonicalUnit(raw) {
    if (!raw) return null;
    return {
      externalId: raw.id?.toString(),
      name: raw.name ?? raw.unit_number,
      propertyId: raw.property_id?.toString(),
      metadata: raw,
    };
  },

  toCanonicalTenant(raw) {
    if (!raw) return null;
    return {
      externalId: raw.id?.toString(),
      fullName: raw.full_name ?? raw.name ?? raw.email,
      email: raw.email,
      phone: raw.phone,
      unitId: raw.unit_id?.toString(),
      metadata: raw,
    };
  },

  toCanonicalBalance(raw) {
    if (!raw) return null;
    return {
      amount: Number(raw.balance ?? raw.amount ?? 0),
      dueDate: raw.due_date ?? raw.as_of_date,
      externalId: raw.id?.toString(),
      metadata: raw,
    };
  },

  /**
   * Map portfolio to canonical for pms_portfolios.
   * Accepts:
   * - portfolios/search: { portfolio: { portfolioID, name }, statementSetting } (Rentvine nested format)
   * - Flat: { portfolioID, name }
   * - leases/export item.portfolio: { portfolioID, name }
   */
  mapPortfolioToCanonical(item) {
    const p = item?.portfolio ?? item;
    const pid = p?.portfolioID ?? p?.portfolioId ?? p?.id;
    if (pid == null || pid === '') return null;
    return {
      externalId: String(pid),
      name: (p?.name ?? '').trim() || null,
    };
  },

  /**
   * Map one leases/export item to canonical lease for pms_leases.
   * Item: { lease, balances, unpaidCharges, property, unit, portfolio }.
   * Links to debtor via lease.tenants[0].contactID (same as debtors externalId from tenants/search).
   */
  mapLeaseExportItemToCanonical(item) {
    const lease = item?.lease;
    if (!lease?.leaseID) return null;

    const primaryTenant = Array.isArray(lease.tenants) ? lease.tenants.find((t) => t.isActive) || lease.tenants[0] : null;
    const debtorExternalId = primaryTenant?.contactID != null ? String(primaryTenant.contactID) : null;
    if (!debtorExternalId) return null;

    const closedDate = lease.closedDate ? String(lease.closedDate).trim() : null;
    const moveOut = lease.moveOutDate ? String(lease.moveOutDate).trim() : null;
    const today = new Date().toISOString().slice(0, 10);
    const status = closedDate ? 'ended' : moveOut && moveOut < today ? 'ended' : 'active';
    const isActive = status === 'active';

    const property = item?.property;
    const unit = item?.unit;

    return {
      externalId: String(lease.leaseID),
      debtorExternalId,
      leaseNumber: lease.code?.trim() || String(lease.leaseID),
      status,
      isActive,
      propertyExternalId: property?.propertyID != null ? String(property.propertyID) : undefined,
      unitExternalId: unit?.unitID != null ? String(unit.unitID) : undefined,
      moveInDate: lease.moveInDate ? String(lease.moveInDate).trim() : null,
      moveOutDate: moveOut || null,
      lastExternalUpdatedAt: lease.dateTimeModified ? new Date(lease.dateTimeModified) : null,
    };
  },

  /**
   * Extract balance from leases/export item for ArBalance.
   * Uses balances.unpaidTotalAmount → balanceCents.
   * Also maps pastDueTotalAmount, pastDueRentAmount, unpaidRentAmount for Vencido KPI.
   */
  mapLeaseExportBalance(item, leaseExternalId) {
    const lease = item?.lease;
    const balances = item?.balances;
    if (!lease?.leaseID || !balances) return null;
    const externalId = leaseExternalId ?? String(lease.leaseID);
    const unpaidTotal = parseFloat(balances.unpaidTotalAmount, 10);
    if (Number.isNaN(unpaidTotal) || unpaidTotal < 0) return null;
    const balanceCents = Math.round(unpaidTotal * 100);
    const pastDueTotal = parseFloat(balances.pastDueTotalAmount, 10);
    const pastDueRent = parseFloat(balances.pastDueRentAmount, 10);
    const unpaidRent = parseFloat(balances.unpaidRentAmount, 10);
    return {
      leaseExternalId: externalId,
      balanceCents,
      asOfDate: new Date().toISOString().slice(0, 10),
      pastDueTotalCents: !Number.isNaN(pastDueTotal) && pastDueTotal >= 0 ? Math.round(pastDueTotal * 100) : null,
      pastDueRentCents: !Number.isNaN(pastDueRent) && pastDueRent >= 0 ? Math.round(pastDueRent * 100) : null,
      unpaidRentCents: !Number.isNaN(unpaidRent) && unpaidRent >= 0 ? Math.round(unpaidRent * 100) : null,
    };
  },

  /**
   * Map leases/export item.property to canonical property for pms_properties.
   * Adds portfolioExternalId from item.portfolio when present.
   */
  mapLeaseExportProperty(item) {
    const p = item?.property;
    const port = item?.portfolio;
    if (!p?.propertyID) return null;
    return {
      externalId: String(p.propertyID),
      name: p.name?.trim() || null,
      portfolioExternalId: port?.portfolioID != null ? String(port.portfolioID) : undefined,
      address: {
        line1: p.address ?? (p.streetNumber && p.streetName ? `${p.streetNumber} ${p.streetName}` : null),
        line2: p.address2 ?? null,
        city: p.city ?? null,
        state: p.stateID ?? null,
        postalCode: p.postalCode ?? null,
        country: p.countryID ?? null,
      },
    };
  },

  /**
   * Map leases/export item.unit to canonical unit for pms_units (needs propertyExternalId from same item).
   */
  mapLeaseExportUnit(item) {
    const u = item?.unit;
    const p = item?.property;
    if (!u?.unitID) return null;
    return {
      externalId: String(u.unitID),
      propertyExternalId: p?.propertyID != null ? String(p.propertyID) : undefined,
      unitNumber: u.name?.trim() || u.unit_number || String(u.unitID),
    };
  },

  /**
   * Map leases/export item.unpaidCharges[] to canonical charges for ar_charges.
   * Each charge: external_id = transactionID, leaseExternalId = lease.leaseID, amount/openAmount in cents.
   * MVP: dueDate from charge or datePosted (posted-date aging until Rentvine sends dueDate).
   */
  mapLeaseExportUnpaidCharges(item) {
    const lease = item?.lease;
    const rawCharges = item?.unpaidCharges;
    if (!lease?.leaseID || !Array.isArray(rawCharges)) return [];
    const leaseExternalId = String(lease.leaseID);
    const out = [];
    for (const c of rawCharges) {
      const externalId = c.transactionID != null ? String(c.transactionID) : c.id != null ? String(c.id) : null;
      if (!externalId) continue;
      const amount = parseFloat(c.amount, 10);
      if (Number.isNaN(amount) || amount < 0) continue;
      const amountPaid = parseFloat(c.amountPaid ?? c.amountApplied ?? 0, 10);
      const openAmount = Math.max(0, amount - (Number.isNaN(amountPaid) ? 0 : amountPaid));
      const amountCents = Math.round(amount * 100);
      const openAmountCents = Math.round(openAmount * 100);
      const datePosted = c.datePosted ?? c.postDate ?? c.date ?? null;
      const dueDate = c.dueDate ?? datePosted;
      const postDate = datePosted ? String(datePosted).slice(0, 10) : null;
      const dueDateOnly = dueDate ? String(dueDate).slice(0, 10) : postDate;
      if (!dueDateOnly) continue;
      const chargeType = c.isRent === true || c.isRent === '1' ? 'rent' : (c.accountName?.trim() || 'fee');
      out.push({
        externalId,
        leaseExternalId,
        chargeType: chargeType.slice(0, 64),
        amountCents,
        openAmountCents,
        currency: 'USD',
        dueDate: dueDateOnly,
        postDate,
        description: c.description?.trim() || null,
        lastExternalUpdatedAt: c.dateTimeModified ? new Date(c.dateTimeModified) : null,
      });
    }
    return out;
  },

  /**
   * Map accounting/transactions/search item (payment, transactionTypeID=2) to canonical payment.
   * Uses unit.unitID → leaseExternalId via unitToLeaseMap (built from leases/export).
   */
  mapTransactionToCanonicalPayment(item, unitToLeaseMap) {
    const t = item?.transaction;
    const unit = item?.unit;
    if (!t?.transactionID) return null;
    const amount = parseFloat(t.amount, 10);
    if (Number.isNaN(amount) || amount <= 0) return null;
    const amountCents = Math.round(amount * 100);
    const datePosted = t.datePosted ?? t.date ?? null;
    const paidAt = datePosted ? new Date(datePosted) : new Date();
    const unitId = unit?.unitID != null ? String(unit.unitID) : null;
    const leaseExternalId = unitId && unitToLeaseMap ? unitToLeaseMap.get(unitId) : null;
    return {
      externalId: String(t.transactionID),
      leaseExternalId: leaseExternalId ?? undefined,
      amountCents,
      currency: 'USD',
      paidAt,
      paymentMethod: t.paymentMethod ?? (t.description?.includes('Portal') ? 'portal' : null),
      lastExternalUpdatedAt: t.dateTimeModified ? new Date(t.dateTimeModified) : null,
    };
  },

  /**
   * Build unitID → leaseID map from leases/export items.
   * Prefers active leases (no closedDate, moveOutDate in future).
   */
  buildUnitToLeaseMap(leaseExportItems) {
    const map = new Map();
    const today = new Date().toISOString().slice(0, 10);
    for (const item of leaseExportItems || []) {
      const lease = item?.lease;
      const unit = item?.unit;
      if (!lease?.leaseID || !unit?.unitID) continue;
      const unitId = String(unit.unitID);
      const leaseId = String(lease.leaseID);
      const closedDate = lease.closedDate ? String(lease.closedDate).trim() : null;
      const moveOut = lease.moveOutDate ? String(lease.moveOutDate).trim() : null;
      const isActive = !closedDate && (!moveOut || moveOut >= today);
      const existing = map.get(unitId);
      if (!existing || (isActive && !existing.isActive)) {
        map.set(unitId, { leaseId, isActive });
      }
    }
    const result = new Map();
    for (const [unitId, { leaseId }] of map) {
      result.set(unitId, leaseId);
    }
    return result;
  },
};
