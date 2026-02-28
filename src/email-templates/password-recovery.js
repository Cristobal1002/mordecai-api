/**
 * Password recovery / credentials reset email template
 * Used for custom reset flows or as reference for Cognito message customization.
 *
 * Cognito note: If using AWS Cognito ForgotPassword, the email is sent by Cognito.
 * Configure templates in: Cognito Console → User Pool → Message customizations
 * Placeholders: {####} = code, {username} = email
 *
 * This template is for:
 * - Custom password reset (if you implement your own flow)
 * - Reference when configuring Cognito
 *
 * Variables: { email, resetUrl, code, companyName, expiresInMinutes }
 * Use either resetUrl (link) OR code (manual entry).
 */
export function renderPasswordRecovery(vars = {}) {
  const {
    email = '',
    resetUrl = null,
    code = null,
    companyName = 'Mordecai',
    expiresInMinutes = 60,
  } = vars;

  const subject = `Reset your password - ${companyName}`;

  const codeBlock = code
    ? `
              <p style="font-size: 24px; font-weight: 600; letter-spacing: 6px; margin: 20px 0; font-family: monospace;">${escapeHtml(String(code))}</p>
              <p style="font-size: 14px; color: #6b7280;">This code expires in ${expiresInMinutes} minutes.</p>
            `
    : '';

  const linkBlock = resetUrl
    ? `
              <p style="margin: 24px 0;">
                <a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 14px 28px; background-color: #9C77F5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  Reset password
                </a>
              </p>
              <p style="font-size: 14px; color: #6b7280;">This link expires in ${expiresInMinutes} minutes.</p>
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
                Reset your password
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                You requested a password reset for your ${escapeHtml(companyName)} account.
              </p>
              ${codeBlock}
              ${linkBlock}
              <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
                If you didn't request this, you can safely ignore this email. Your password will not be changed.
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
