/**
 * Crea un debt case de demo e inscribe en una automation específica.
 *
 * Usage:
 *   node scripts/seed-demo-case-into-automation.js [automation-id]
 *
 * Si no se pasa automation-id, usa: 89727e95-9728-4f27-9f49-13744ca1e8da
 *
 * Prerequisites:
 *   - DB con la automation existente (y su tenant, strategy, stages)
 *   - La automation debe tener strategy con al menos un stage
 */
import 'dotenv/config';
import { loadDatabase } from '../src/loaders/sequelize.load.js';
import {
  CollectionAutomation,
  DebtCase,
  Debtor,
  FlowPolicy,
} from '../src/models/index.js';
import { automationService } from '../src/modules/automations/automation.service.js';

const DEFAULT_AUTOMATION_ID = '89727e95-9728-4f27-9f49-13744ca1e8da';

async function main() {
  const automationId = process.argv[2] || DEFAULT_AUTOMATION_ID;

  await loadDatabase();

  const automation = await CollectionAutomation.findByPk(automationId);

  if (!automation) {
    console.error('Automation not found:', automationId);
    process.exit(1);
  }

  const tenantId = automation.tenantId;
  const flowPolicy = await FlowPolicy.findOne({
    where: { tenantId },
    order: [['createdAt', 'ASC']],
  });

  const debtor = await Debtor.create({
    tenantId,
    fullName: 'Demo Debtor ' + Date.now().toString(36),
    email: `demo.${Date.now()}@example.com`,
    phone: '+15550000000',
    metadata: { notes: 'Synthetic demo debtor for automation testing' },
  });

  const debtCase = await DebtCase.create({
    tenantId,
    debtorId: debtor.id,
    flowPolicyId: flowPolicy?.id ?? null,
    amountDueCents: 50000, // $500
    currency: 'USD',
    daysPastDue: 12,
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'NEW',
    approvalStatus: 'APPROVED',
    meta: {
      notes: 'Synthetic demo case for automation',
      lease_id: 'LEASE-DEMO-001',
      unit_number: '101',
      balance_type: 'rent',
    },
  });

  const { enrolled, skipped, total } = await automationService.enroll(tenantId, automationId, {
    debtCaseIds: [debtCase.id],
  });

  console.log('\n--- Demo case creado e inscrito ---');
  console.log('Automation:', automationId);
  console.log('Tenant:', tenantId);
  console.log('Debtor:', debtor.id);
  console.log('Debt case:', debtCase.id);
  console.log('Enroll result: enrolled=%d, skipped=%d, total=%d', enrolled, skipped, total);
  console.log('\n---\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
