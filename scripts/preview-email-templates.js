/**
 * Preview email templates in the browser
 * Run: node scripts/preview-email-templates.js
 * Then open: mordecai-api/email-preview/*.html in your browser
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  renderTeamInvitation,
  renderPasswordRecovery,
  renderCollectionsNotification,
  renderOtpVerification,
} from '../src/email-templates/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', 'email-preview');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const templates = [
  {
    name: 'otp-verification',
    fn: renderOtpVerification,
    vars: {
      code: '847293',
      companyName: 'Protiempo Property Management',
      expiresInMinutes: 15,
    },
  },
  {
    name: 'team-invitation',
    fn: renderTeamInvitation,
    vars: {
      inviteeEmail: 'user@example.com',
      inviterName: 'María García',
      tenantName: 'Protiempo Property Management',
      acceptUrl: 'https://app.mordecai.ai/invitations/abc123token',
      expiresInDays: 7,
    },
  },
  {
    name: 'password-recovery',
    fn: renderPasswordRecovery,
    vars: {
      email: 'user@example.com',
      resetUrl: 'https://app.mordecai.ai/reset-password?token=xyz',
      code: null,
      companyName: 'Mordecai AI',
      expiresInMinutes: 60,
    },
  },
  {
    name: 'password-recovery-with-code',
    fn: renderPasswordRecovery,
    vars: {
      email: 'user@example.com',
      resetUrl: null,
      code: '847293',
      companyName: 'Mordecai AI',
      expiresInMinutes: 60,
    },
  },
  {
    name: 'collections-notification-early',
    fn: renderCollectionsNotification,
    vars: {
      debtorName: 'Juan Pérez',
      companyName: 'Protiempo',
      amountDue: '450.00',
      currency: 'USD',
      daysPastDue: 5,
      dueDate: '01/15/2025',
      paymentUrl: 'https://pay.mordecai.ai/p/abc123',
      message: 'We hope you\'re doing well. Please review your balance at your earliest convenience.',
      stage: 'early',
    },
  },
  {
    name: 'collections-notification-mid',
    fn: renderCollectionsNotification,
    vars: {
      debtorName: 'Juan Pérez',
      companyName: 'Protiempo',
      amountDue: '450.00',
      currency: 'USD',
      daysPastDue: 15,
      dueDate: '01/15/2025',
      paymentUrl: 'https://pay.mordecai.ai/p/abc123',
      stage: 'mid',
    },
  },
  {
    name: 'collections-notification-late',
    fn: renderCollectionsNotification,
    vars: {
      debtorName: 'Juan Pérez',
      companyName: 'Protiempo',
      amountDue: '450.00',
      currency: 'USD',
      daysPastDue: 45,
      dueDate: '01/15/2025',
      paymentUrl: 'https://pay.mordecai.ai/p/abc123',
      stage: 'late',
    },
  },
];

console.log('Rendering email templates...\n');

for (const t of templates) {
  const { subject, html } = t.fn(t.vars);
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject} - Preview</title>
  <style>
    body { font-family: system-ui; padding: 20px; background: #1a1a1a; margin: 0; }
    .meta { background: #2a2a2a; color: #aaa; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .meta strong { color: #fff; }
    .preview { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <div class="meta">
    <strong>Template:</strong> ${t.name} &nbsp;|&nbsp;
    <strong>Subject:</strong> ${subject}
  </div>
  <div class="preview">
    ${html}
  </div>
</body>
</html>`;

  const filepath = path.join(outputDir, `${t.name}.html`);
  fs.writeFileSync(filepath, fullHtml, 'utf8');
  console.log(`  ✓ ${t.name}.html  (subject: ${subject})`);
}

console.log(`\nDone! Open the files in: ${outputDir}`);
console.log('Example: open email-preview/team-invitation.html');
