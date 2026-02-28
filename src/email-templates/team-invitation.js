/**
 * Team invitation email template
 * Variables: { inviteeEmail, inviterName, tenantName, acceptUrl, expiresInDays }
 */
export function renderTeamInvitation(vars = {}) {
  const {
    inviteeEmail = '',
    inviterName = 'A team member',
    tenantName = 'the team',
    acceptUrl = '#',
    expiresInDays = 7,
  } = vars;

  const subject = `You're invited to join ${tenantName}`;

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
                You're invited
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                <strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(tenantName)}</strong> on Mordecai.
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Click the button below to accept the invitation and get started. This link expires in ${expiresInDays} days.
              </p>
              <p style="margin: 0 0 32px;">
                <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; padding: 14px 28px; background-color: #9C77F5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  Accept invitation
                </a>
              </p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${escapeHtml(acceptUrl)}" style="color: #9C77F5; word-break: break-all;">${escapeHtml(acceptUrl)}</a>
              </p>
              <p style="margin: 24px 0 0; font-size: 13px; color: #9ca3af;">
                If you didn't expect this invitation, you can safely ignore this email.
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
