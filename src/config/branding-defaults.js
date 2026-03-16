/**
 * Mordecai default branding — used when tenant has no TenantBranding configured.
 * Clean, minimal look for the payment page.
 */
export const MORDECAI_DEFAULT_BRANDING = {
  companyName: 'Mordecai',
  logoUrl: null,
  primaryColor: '#9C77F5',
  secondaryColor: '#F3F4F6',
  supportEmail: null,
  supportPhone: null,
  supportHours: null,
  footerText: null,
  showPoweredBy: true,
  legalDisclaimerOverride: null,
  otpDeliveryLabelOverride: null,
};

/**
 * Resolve branding for a tenant. Returns tenant branding if configured,
 * otherwise Mordecai defaults. Merges partial tenant branding with defaults.
 * @param {object|null} tenantBranding - TenantBranding instance or null
 * @param {object} [tenant] - Optional tenant for fallback company name
 * @returns {object} Branding object for payment page
 */
export function resolveBranding(tenantBranding, tenant = null) {
  if (!tenantBranding) {
    return {
      ...MORDECAI_DEFAULT_BRANDING,
      companyName: tenant?.name || MORDECAI_DEFAULT_BRANDING.companyName,
    };
  }
  const plain = tenantBranding.get ? tenantBranding.get({ plain: true }) : tenantBranding;
  return {
    companyName: plain.companyName || tenant?.name || MORDECAI_DEFAULT_BRANDING.companyName,
    logoUrl: plain.logoUrl ?? MORDECAI_DEFAULT_BRANDING.logoUrl,
    primaryColor: plain.primaryColor || MORDECAI_DEFAULT_BRANDING.primaryColor,
    secondaryColor: plain.secondaryColor || MORDECAI_DEFAULT_BRANDING.secondaryColor,
    supportEmail: plain.supportEmail ?? MORDECAI_DEFAULT_BRANDING.supportEmail,
    supportPhone: plain.supportPhone ?? MORDECAI_DEFAULT_BRANDING.supportPhone,
    supportHours: plain.supportHours ?? MORDECAI_DEFAULT_BRANDING.supportHours,
    footerText: plain.footerText ?? MORDECAI_DEFAULT_BRANDING.footerText,
    showPoweredBy: plain.showPoweredBy ?? MORDECAI_DEFAULT_BRANDING.showPoweredBy,
    legalDisclaimerOverride: plain.legalDisclaimerOverride ?? MORDECAI_DEFAULT_BRANDING.legalDisclaimerOverride,
    otpDeliveryLabelOverride: plain.otpDeliveryLabelOverride ?? MORDECAI_DEFAULT_BRANDING.otpDeliveryLabelOverride,
  };
}
