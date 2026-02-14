/**
 * Rentvine mapper — transforma respuestas del PMS al modelo canónico.
 */
export const rentvineMapper = {
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
};
