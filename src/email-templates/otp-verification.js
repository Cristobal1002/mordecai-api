/**
 * OTP verification email for debtors
 * Used when debtor requests verification to access pay link / account details
 *
 * Variables: { code, companyName, expiresInMinutes }
 */
export function renderOtpVerification(vars = {}) {
  const {
    code = '123456',
    companyName = 'Mordecai',
    expiresInMinutes = 15,
  } = vars;

  const subject = `Your verification code: ${code}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fb; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a;">
                Verification code
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Your verification code for ${escapeHtml(companyName)} is:
              </p>
              <p style="font-size: 28px; font-weight: 600; letter-spacing: 8px; margin: 24px 0; font-family: monospace; color: #1a1a1a;">
                ${escapeHtml(String(code))}
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
                This code expires in ${expiresInMinutes} minutes.
              </p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                If you didn't request this code, you can safely ignore this email.
              </p>
              <p style="margin: 24px 0 0; font-size: 13px; color: #9ca3af;">
                — ${escapeHtml(companyName)}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
          Powered by Mordecai
        </p>
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
