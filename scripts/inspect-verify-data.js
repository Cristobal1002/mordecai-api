/**
 * Inspect lastName and unitNumber for pay verification.
 * Run: node scripts/inspect-verify-data.js <debt-case-id>
 */
import 'dotenv/config';
import { loadDatabase } from '../src/loaders/sequelize.load.js';
import { sequelize } from '../src/config/database.js';

const debtCaseId = process.argv[2] || '89ea1793-0c60-4875-8096-f16a10e31765';

async function main() {
  await loadDatabase();

  const [rows] = await sequelize.query(
    `
    SELECT 
      dc.id AS debt_case_id,
      dc.meta AS case_meta,
      d.id AS debtor_id,
      d.full_name,
      d.metadata AS debtor_metadata,
      pu.unit_number AS pms_unit_number
    FROM debt_cases dc
    JOIN debtors d ON d.id = dc.debtor_id
    LEFT JOIN pms_leases pl ON pl.id = COALESCE(
      (dc.meta->>'pms_lease_id')::uuid,
      (dc.meta->>'pmsLeaseId')::uuid
    )
    LEFT JOIN pms_units pu ON pu.id = pl.pms_unit_id
    WHERE dc.id = :debtCaseId
    `,
    { replacements: { debtCaseId } }
  );

  if (!rows.length) {
    console.log('Debt case not found:', debtCaseId);
    process.exit(1);
  }

  const r = rows[0];
  const meta = r.case_meta || {};
  const debtorMeta = r.debtor_metadata || {};

  const lastName =
    debtorMeta.last_name ?? debtorMeta.lastName ?? (r.full_name ? r.full_name.trim().split(/\s+/).pop() : null);
  const unitNumber =
    meta.unit_number ?? meta.unitNumber ?? debtorMeta.unit ?? r.pms_unit_number ?? null;

  console.log('\n--- Verification data for debt case', debtCaseId, '---\n');
  console.log('lastName:', lastName ?? '(not found)');
  console.log('unitNumber:', unitNumber ?? '(not found)');
  console.log('\nUse in POST body:');
  console.log(JSON.stringify({ lastName: lastName ?? '', unitNumber: unitNumber ?? '' }, null, 2));
  console.log('\nRaw: full_name=', r.full_name, '| case_meta=', JSON.stringify(meta), '| debtor_metadata=', JSON.stringify(debtorMeta));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
