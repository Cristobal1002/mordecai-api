#!/usr/bin/env node
/**
 * Dev script: Generate a paySessionToken for a payment link token.
 * Use this to bypass OTP verification and go directly to /p/[token]/details.
 *
 * Usage:
 *   cd mordecai-api && node scripts/dev-pay-session.js <token>
 *
 * Where <token> is the value from the URL /p/TOKEN (can be shortToken or full UUID).
 *
 * Then:
 * 1. Open DevTools > Application > Session Storage
 * 2. Add key: mordecai_pay_session
 * 3. Add value: (the JSON output by this script)
 * 4. Navigate to /p/TOKEN/details
 */
import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../src/config/database.js';
import { initModels } from '../src/models/index.js';
import { signPaySession } from '../src/modules/pay/pay-jwt.js';
import { PaymentLink } from '../src/models/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const tokenArg = process.argv[2];
  if (!tokenArg) {
    console.error('Usage: node scripts/dev-pay-session.js <token>');
    console.error('  <token> = the value from /p/TOKEN in the URL (shortToken or UUID)');
    process.exit(1);
  }

  const token = tokenArg.trim();
  const isUuid = UUID_REGEX.test(token);
  const where = isUuid ? { token } : { shortToken: token };

  await sequelize.authenticate();
  initModels(sequelize);

  const link = await PaymentLink.findOne({ where });
  if (!link) {
    console.error('Payment link not found for token:', token);
    process.exit(1);
  }

  const urlToken = link.shortToken || link.token;
  const paySessionToken = signPaySession(link.token);
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const sessionValue = JSON.stringify({
    token: urlToken,
    paySessionToken,
    expiresAt,
  });

  console.log('\n--- Session Storage value (copy this) ---\n');
  console.log(sessionValue);
  console.log('\n--- Instructions ---\n');
  console.log('1. Open your browser and go to: /p/' + urlToken);
  console.log('2. Open DevTools (F12) > Application > Session Storage');
  console.log('3. Add: Key = mordecai_pay_session, Value = (the JSON above)');
  console.log('4. Navigate to: /p/' + urlToken + '/details');
  console.log('\nOr paste this in the console to set it automatically:\n');
  console.log(
    "sessionStorage.setItem('mordecai_pay_session', " + JSON.stringify(sessionValue) + "); location.href='/p/" + urlToken + "/details';"
  );
  console.log('');

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
