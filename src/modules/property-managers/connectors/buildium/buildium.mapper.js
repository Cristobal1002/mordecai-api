/**
 * Buildium mapper — transforma respuestas del PMS al modelo canónico.
 */
export const buildiumMapper = {
  toCanonicalUnit(raw) {
    if (!raw) return null;
    return {
      externalId: raw.Id?.toString(),
      name: raw.Name ?? raw.UnitNumber,
      propertyId: raw.PropertyId?.toString(),
      metadata: raw,
    };
  },

  toCanonicalTenant(raw) {
    if (!raw) return null;
    return {
      externalId: raw.Id?.toString(),
      fullName: [raw.FirstName, raw.LastName].filter(Boolean).join(' ') || raw.Email,
      email: raw.Email,
      phone: raw.Phone,
      unitId: raw.UnitId?.toString(),
      metadata: raw,
    };
  },

  toCanonicalBalance(raw) {
    if (!raw) return null;
    return {
      amount: Number(raw.Balance ?? raw.Amount ?? 0),
      dueDate: raw.DueDate ?? raw.AsOfDate,
      externalId: raw.Id?.toString(),
      metadata: raw,
    };
  },
};
