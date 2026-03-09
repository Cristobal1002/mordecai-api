/**
 * Billing pricing configuration.
 * All price values in cents. NEVER hardcode prices in services — import from here.
 */

/** Minimum monthly fee (cents) */
export const MINIMUM_MONTHLY_CENTS = 30_000; // $300

/** Marginal pricing tiers: [max_units_in_tier, rate_cents_per_unit] */
export const UNIT_TIERS = [
  { maxUnits: 500, rateCents: 150, label: 'First 500 units' },
  { maxUnits: 1000, rateCents: 125, label: 'Units 501–1,500' },
  { maxUnits: 3500, rateCents: 100, label: 'Units 1,501–5,000' },
  { maxUnits: Infinity, rateCents: 90, label: 'Units 5,000+' },
];

/** AI Calls plan add-on (cents/month) */
export const CALLS_PLAN_CENTS = {
  none: 0,
  starter: 14_900,   // $149
  growth: 29_900,    // $299
  pro: 59_900,       // $599
};

/** White-label add-on (cents/month) */
export const WHITE_LABEL_CENTS = 14_900; // $149

/** Extra seat add-on (cents/month per seat) */
export const EXTRA_SEAT_CENTS = 3_500; // $35

/** Base included seats */
export const INCLUDED_SEATS = 2;
