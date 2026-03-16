/**
 * One-off script to inspect why DPD might be 0 in debt_cases.
 * Run from mordecai-api: node scripts/inspect-dpd.js
 * Optional: CONNECTION_ID=... TENANT_ID=... node scripts/inspect-dpd.js
 */
import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { loadDatabase } from '../src/loaders/sequelize.load.js';

const connectionId = process.env.CONNECTION_ID || '9eb1b274-599c-45d0-973f-6573da8593c3';
const tenantId = process.env.TENANT_ID || 'a6362c3b-9964-46d4-a60a-3d8ba07fc5e8';

async function main() {
  await loadDatabase();
  if (!sequelize) {
    console.error('DB not available');
    process.exit(1);
  }

  console.log('\n--- ar_charges for this connection ---');
  const [chargesCountRows] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM ar_charges WHERE pms_connection_id = :connectionId`,
    { replacements: { connectionId } }
  );
  console.log('Total ar_charges:', chargesCountRows[0]?.count ?? chargesCountRows);

  const [chargeSamples] = await sequelize.query(
    `SELECT id, pms_lease_id, due_date, open_amount_cents, amount_cents, created_at
     FROM ar_charges
     WHERE pms_connection_id = :connectionId
     ORDER BY due_date ASC NULLS LAST
     LIMIT 5`,
    { replacements: { connectionId } }
  );
  console.log('Sample ar_charges (oldest due_date first):', JSON.stringify(chargeSamples, null, 2));

  const [chargesWithOpenRows] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM ar_charges
     WHERE pms_connection_id = :connectionId
       AND (COALESCE(open_amount_cents, amount_cents, 0) > 0)
       AND due_date IS NOT NULL`,
    { replacements: { connectionId } }
  );
  console.log('Charges with open amount and due_date:', chargesWithOpenRows[0]?.count ?? chargesWithOpenRows);

  console.log('\n--- debt_cases (PMS source) for this tenant ---');
  const [casesCountRows] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM debt_cases
     WHERE tenant_id = :tenantId AND meta->>'source' = 'pms' AND meta->>'pms_connection_id' = :connectionId`,
    { replacements: { tenantId, connectionId } }
  );
  console.log('Total debt_cases (PMS):', casesCountRows[0]?.count ?? casesCountRows);

  const [caseSamples] = await sequelize.query(
    `SELECT id, days_past_due, due_date, amount_due_cents, meta->>'pms_lease_id' AS pms_lease_id, updated_at
     FROM debt_cases
     WHERE tenant_id = :tenantId AND meta->>'source' = 'pms' AND meta->>'pms_connection_id' = :connectionId
     ORDER BY updated_at DESC
     LIMIT 8`,
    { replacements: { tenantId, connectionId } }
  );
  console.log('Sample debt_cases:', JSON.stringify(caseSamples, null, 2));

  const [dpdDistribution] = await sequelize.query(
    `SELECT days_past_due, COUNT(*)::int AS cnt
     FROM debt_cases
     WHERE tenant_id = :tenantId AND meta->>'source' = 'pms'
     GROUP BY days_past_due ORDER BY days_past_due`,
    { replacements: { tenantId } }
  );
  console.log('DPD distribution:', JSON.stringify(dpdDistribution, null, 2));

  console.log('\n--- Leases with balance (from ar_balances) ---');
  const [leaseIdsFromBalances] = await sequelize.query(
    `SELECT DISTINCT pms_lease_id FROM ar_balances
     WHERE pms_connection_id = :connectionId AND balance_cents > 0`,
    { replacements: { connectionId } }
  );
  const leaseIds = (leaseIdsFromBalances || []).map((r) => r.pms_lease_id);
  console.log('Lease IDs with balance:', leaseIds.length);

  if (leaseIds.length > 0) {
    const [chargesForLeasesRows] = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM ar_charges
       WHERE pms_connection_id = :connectionId AND pms_lease_id IN (:leaseIds)`,
      { replacements: { connectionId, leaseIds } }
    );
    console.log('ar_charges for those leases:', chargesForLeasesRows[0]?.count ?? chargesForLeasesRows);
  }

  await sequelize.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
