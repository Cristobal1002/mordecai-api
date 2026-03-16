/**
 * Get or create a payment link for local testing.
 * Outputs: http://localhost:8080/p/{token}
 *
 * Usage:
 *   node scripts/get-local-payment-link.js                    # Uses first debt case in DB
 *   node scripts/get-local-payment-link.js <debt-case-id>    # Uses specific debt case
 *
 * Prerequisites:
 *   - DB with at least one debt case (run scripts/demo/seed_demo_data.sh if needed)
 *   - Debtor must have email or phone for OTP verification
 */
import 'dotenv/config';
import { loadDatabase } from '../src/loaders/sequelize.load.js';
import { DebtCase } from '../src/models/index.js';
import { getOrCreatePaymentLinkUrl } from '../src/modules/pay/payment-link-resolver.service.js';

const LOCAL_FRONTEND_URL = 'http://localhost:8080';
const debtCaseId = process.argv[2];

async function main() {
  await loadDatabase();

  let dc;
  if (debtCaseId) {
    dc = await DebtCase.findByPk(debtCaseId);
    if (!dc) {
      console.error('Debt case not found:', debtCaseId);
      process.exit(1);
    }
  } else {
    dc = await DebtCase.findOne({ order: [['createdAt', 'DESC']] });
    if (!dc) {
      console.error(
        'No debt cases in database. Create one first:\n' +
          '  ./scripts/demo/seed_demo_data.sh\n' +
          '  # Then: node scripts/get-local-payment-link.js <DEBT_CASE_ID from output file>'
      );
      process.exit(1);
    }
    console.log('Using most recent debt case:', dc.id);
  }

  const tenantId = dc.get('tenantId') ?? dc.get('tenant_id');
  if (!tenantId) {
    console.error('Debt case has no tenant_id');
    process.exit(1);
  }

  const url = await getOrCreatePaymentLinkUrl({
    tenantId,
    debtCaseId: dc.id,
  });

  const token = url.split('/p/')[1]?.split('?')[0] || url;
  const localUrl = `${LOCAL_FRONTEND_URL}/p/${token}`;

  console.log('\n--- Local payment link for testing ---\n');
  console.log('Debt case:', dc.id);
  console.log('Token:', token);
  console.log('\nLocal URL (copy & open in browser):\n');
  console.log(localUrl);
  console.log('\n---\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
