/**
 * Collections / portfolio notification email templates
 * Used when sending emails to debtors as part of automations.
 *
 * Variables: { debtorName, companyName, amountDue, currency, daysPastDue, dueDate, paymentUrl, message }
 * Optional: { stage } = 'early' | 'mid' | 'late' for tone variations
 */
export function renderCollectionsNotification(vars = {}) {
  const {
    debtorName = 'Resident',
    companyName = 'Property Management',
    amountDue = '0',
    currency = 'USD',
    daysPastDue = 0,
    dueDate = '',
    paymentUrl = null,
    message = null,
    stage = 'mid',
  } = vars;

  const subject = `Account reminder from ${companyName}`;

  const stageCopy = {
    early: {
      tone: 'friendly',
      intro: 'This is a friendly reminder about your account balance.',
      cta: 'View your balance and payment options',
    },
    mid: {
      tone: 'professional',
      intro: 'We would like to remind you about your outstanding balance.',
      cta: 'Review your account and payment options',
    },
    late: {
      tone: 'firm',
      intro: 'Your account has an outstanding balance that requires immediate attention.',
      cta: 'View balance and arrange payment',
    },
  };

  const copy = stageCopy[stage] || stageCopy.mid;

  const amountLine = amountDue
    ? `<p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #1a1a1a;">Balance due: ${escapeHtml(currency)} ${escapeHtml(amountDue)}</p>`
    : '';

  const dpdLine =
    daysPastDue > 0
      ? `<p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">${daysPastDue} days past due${dueDate ? ` · Due date: ${escapeHtml(dueDate)}` : ''}</p>`
      : '';

  const customMessage = message
    ? `<p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4a4a4a;">${escapeHtml(message)}</p>`
    : '';

  const ctaBlock = paymentUrl
    ? `
              <p style="margin: 24px 0;">
                <a href="${escapeHtml(paymentUrl)}" style="display: inline-block; padding: 14px 28px; background-color: #9C77F5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  ${copy.cta}
                </a>
              </p>
            `
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fb; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a;">
                Account reminder
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Hello ${escapeHtml(debtorName)},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                ${copy.intro}
              </p>
              ${amountLine}
              ${dpdLine}
              ${customMessage}
              ${ctaBlock}
              <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
                If you have questions or have already made a payment, please contact us.
              </p>
              <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af;">
                — ${escapeHtml(companyName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, html };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
