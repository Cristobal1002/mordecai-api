/**
 * Mask email for display (never show full email to user).
 * Local part: first 2 chars + *** if length >= 3
 * Domain: first char + *** + TLD visible
 * e.g. adrianroque@gmail.com → ad***@g***.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***@***.***';

  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const tldMatch = domain.match(/\.([a-z]{2,})$/i);
  const tld = tldMatch ? tldMatch[1] : 'com';
  const domainBase = tldMatch ? domain.slice(0, -tld.length - 1) : domain;

  const localMasked = local.length >= 3 ? local.slice(0, 2) + '***' : local.slice(0, 1) + '***';
  const domainMasked = domainBase.length >= 1 ? domainBase.slice(0, 1) + '***' : '***';

  return `${localMasked}@${domainMasked}.${tld}`;
}
