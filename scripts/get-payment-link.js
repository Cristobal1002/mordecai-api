/**
 * Get or create a payment link URL for a debt case.
 * Run from mordecai-api: node scripts/get-payment-link.js <debt-case-id>
 *
 * Example: node scripts/get-payment-link.js 89ea1793-0c60-4875-8096-f16a10e31765
 */
import 'dotenv/config';
import { loadDatabase } from '../src/loaders/sequelize.load.js';
import { DebtCase } from '../src/models/index.js';
import { getOrCreatePaymentLinkUrl } from '../src/modules/pay/payment-link-resolver.service.js';

const debtCaseId = process.argv[2];
if (!debtCaseId) {
  console.error('Usage: node scripts/get-payment-link.js <debt-case-id>');
  process.exit(1);
}

async function main() {
  await loadDatabase();

  const dc = await DebtCase.findByPk(debtCaseId);
  if (!dc) {
    console.error('Debt case not found:', debtCaseId);
    process.exit(1);
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
  console.log('\nPayment link for debt case', debtCaseId);
  console.log('URL:', url);
  console.log('Token (for /p/{token} or /pay/{token}/verify):', token);
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
