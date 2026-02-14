/**
 * PMS sync runner: 4-step strategy (debtors+leases, charges, payments, balances+aging).
 * Called by the worker when a pms-sync job is processed.
 * Uses connector.syncFull() to get data; upserts into canonical tables and external_mappings.
 */
import { sequelize } from '../../../config/database.js';
import { PmsConnection, Software } from '../../../models/index.js';
import {
  PmsDebtor,
  PmsDebtorContact,
  PmsLease,
  PmsProperty,
  PmsUnit,
  ArCharge,
  ArPayment,
  ArBalance,
  ArAgingSnapshot,
  SyncRun,
  ExternalMapping,
} from '../../../models/index.js';
import { getConnector, hasConnector } from '../connectors/connector.factory.js';
import { propertyManagersService } from '../property-managers.service.js';
import { logger } from '../../../utils/logger.js';

const STEPS = ['debtors_leases', 'charges', 'payments', 'balances_aging'];

async function ensureConnection(connectionId) {
  const connection = await PmsConnection.findByPk(connectionId, {
    include: [{ association: 'software', attributes: ['id', 'key'] }],
  });
  if (!connection) throw new Error(`PmsConnection not found: ${connectionId}`);
  const withCreds = await propertyManagersService.getByIdWithDecryptedCredentials(
    connection.tenantId,
    connectionId
  );
  if (!hasConnector(connection.software?.key)) {
    throw new Error(`Connector not available: ${connection.software?.key}`);
  }
  return { connection, withCreds, software: connection.software };
}

function upsertExternalMapping(connectionId, entityType, externalId, internalEntityType, internalId, transaction) {
  return ExternalMapping.upsert(
    {
      pmsConnectionId: connectionId,
      entityType,
      externalId: String(externalId),
      internalEntityType,
      internalId,
    },
    { transaction, conflictFields: ['pms_connection_id', 'entity_type', 'external_id'] }
  );
}

/** Resolve internal UUID from external_mappings (cache) or fallback to table lookup. */
async function resolveInternalId(connectionId, entityType, externalId, transaction) {
  const mapping = await ExternalMapping.findOne({
    where: { pmsConnectionId: connectionId, entityType, externalId: String(externalId) },
    attributes: ['internalId'],
    transaction,
  });
  if (mapping) return mapping.internalId;
  if (entityType === 'lease') {
    const lease = await PmsLease.findOne({
      where: { pmsConnectionId: connectionId, externalId: String(externalId) },
      attributes: ['id'],
      transaction,
    });
    return lease?.id ?? null;
  }
  if (entityType === 'debtor') {
    const debtor = await PmsDebtor.findOne({
      where: { pmsConnectionId: connectionId, externalId: String(externalId) },
      attributes: ['id'],
      transaction,
    });
    return debtor?.id ?? null;
  }
  if (entityType === 'property') {
    const prop = await PmsProperty.findOne({
      where: { pmsConnectionId: connectionId, externalId: String(externalId) },
      attributes: ['id'],
      transaction,
    });
    return prop?.id ?? null;
  }
  if (entityType === 'unit') {
    const unit = await PmsUnit.findOne({
      where: { pmsConnectionId: connectionId, externalId: String(externalId) },
      attributes: ['id'],
      transaction,
    });
    return unit?.id ?? null;
  }
  return null;
}

/**
 * Step 1: Sync debtors and leases from connector result; upsert and write external_mappings.
 */
async function syncDebtorsAndLeases(connectionId, tenantId, data, syncRunId, transaction) {
  const stats = { debtorsCreated: 0, debtorsUpdated: 0, leasesCreated: 0, leasesUpdated: 0, leasesSkipped: 0 };
  const debtors = data.debtors || [];
  const leases = data.leases || [];

  for (const d of debtors) {
    const [instance, created] = await PmsDebtor.upsert(
      {
        tenantId,
        pmsConnectionId: connectionId,
        externalId: d.externalId,
        displayName: d.displayName || 'Unknown',
        type: d.type || 'person',
        email: d.email ?? null,
        phone: d.phone ?? null,
        address: d.address ?? {},
        language: d.language ?? null,
        timezone: d.timezone ?? null,
        doNotContact: d.doNotContact ?? false,
        doNotCall: d.doNotCall ?? false,
        meta: d.meta ?? {},
        lastExternalUpdatedAt: d.lastExternalUpdatedAt ?? null,
      },
      { transaction, conflictFields: ['pms_connection_id', 'external_id'] }
    );
    const id = instance?.id ?? (await PmsDebtor.findOne({ where: { pmsConnectionId: connectionId, externalId: d.externalId }, transaction }))?.id;
    if (id) {
      await upsertExternalMapping(connectionId, 'debtor', d.externalId, 'pms_debtor', id, transaction);
      if (created) stats.debtorsCreated++;
      else stats.debtorsUpdated++;
    }
  }

  for (const l of leases) {
    const pmsDebtorId = await resolveInternalId(connectionId, 'debtor', l.debtorExternalId, transaction);
    if (!pmsDebtorId) {
      stats.leasesSkipped++;
      logger.debug(
        { connectionId, leaseExternalId: l.externalId, debtorExternalId: l.debtorExternalId },
        'PMS sync: lease skipped (debtor not found)'
      );
      continue;
    }
    const pmsPropertyId = l.propertyExternalId
      ? await resolveInternalId(connectionId, 'property', l.propertyExternalId, transaction)
      : null;
    const pmsUnitId = l.unitExternalId
      ? await resolveInternalId(connectionId, 'unit', l.unitExternalId, transaction)
      : null;
    const status =
      l.isActive === false ? 'ended' : l.isActive === true ? 'active' : (l.status ?? 'active');
    const [instance, created] = await PmsLease.upsert(
      {
        tenantId,
        pmsConnectionId: connectionId,
        pmsDebtorId,
        pmsPropertyId: pmsPropertyId ?? null,
        pmsUnitId: pmsUnitId ?? null,
        externalId: l.externalId,
        leaseNumber: l.leaseNumber ?? null,
        status,
        moveInDate: l.moveInDate ?? null,
        moveOutDate: l.moveOutDate ?? null,
        lastNoteSummary: l.lastNoteSummary ?? null,
        inCollections: l.inCollections ?? false,
        lastExternalUpdatedAt: l.lastExternalUpdatedAt ?? null,
      },
      { transaction, conflictFields: ['pms_connection_id', 'external_id'] }
    );
    const id = instance?.id ?? (await PmsLease.findOne({ where: { pmsConnectionId: connectionId, externalId: l.externalId }, transaction }))?.id;
    if (id) {
      await upsertExternalMapping(connectionId, 'lease', l.externalId, 'pms_lease', id, transaction);
      if (created) stats.leasesCreated++;
      else stats.leasesUpdated++;
    }
  }

  if (stats.leasesSkipped > 0) {
    logger.warn(
      { connectionId, syncRunId, leasesSkipped: stats.leasesSkipped },
      'PMS sync: some leases skipped (debtor not found)'
    );
  }
  await SyncRun.update(
    { step: 'debtors_leases', stats: { ...(data.stats || {}), ...stats } },
    { where: { id: syncRunId }, transaction }
  );
  return stats;
}

/**
 * Step 2: Sync charges.
 */
async function syncCharges(connectionId, tenantId, data, syncRunId, transaction) {
  const charges = data.charges || [];
  let created = 0, updated = 0, skipped = 0;
  for (const c of charges) {
    const pmsLeaseId = await resolveInternalId(connectionId, 'lease', c.leaseExternalId, transaction);
    if (!pmsLeaseId) {
      skipped++;
      logger.debug(
        { connectionId, chargeExternalId: c.externalId, leaseExternalId: c.leaseExternalId },
        'PMS sync: charge skipped (lease not found)'
      );
      continue;
    }
    const [, wasCreated] = await ArCharge.upsert(
      {
        tenantId,
        pmsConnectionId: connectionId,
        pmsLeaseId,
        externalId: c.externalId,
        chargeType: c.chargeType ?? null,
        amountCents: c.amountCents,
        openAmountCents: c.openAmountCents ?? null,
        currency: c.currency ?? 'USD',
        dueDate: c.dueDate,
        postDate: c.postDate ?? null,
        description: c.description ?? null,
        lastExternalUpdatedAt: c.lastExternalUpdatedAt ?? null,
      },
      { transaction, conflictFields: ['pms_connection_id', 'external_id'] }
    );
    if (wasCreated) created++;
    else updated++;
  }
  if (skipped > 0) {
    logger.warn(
      { connectionId, syncRunId, chargesSkipped: skipped },
      'PMS sync: some charges skipped (lease not found)'
    );
  }
  await SyncRun.update(
    {
      step: 'charges',
      stats: { ...(data.stats || {}), chargesCreated: created, chargesUpdated: updated, chargesSkipped: skipped },
    },
    { where: { id: syncRunId }, transaction }
  );
  return { chargesCreated: created, chargesUpdated: updated, chargesSkipped: skipped };
}

/**
 * Step 3: Sync payments.
 */
async function syncPayments(connectionId, tenantId, data, syncRunId, transaction) {
  const payments = data.payments || [];
  let created = 0, updated = 0;
  for (const p of payments) {
    const pmsLeaseId = p.leaseExternalId
      ? await resolveInternalId(connectionId, 'lease', p.leaseExternalId, transaction)
      : null;
    const [, wasCreated] = await ArPayment.upsert(
      {
        tenantId,
        pmsConnectionId: connectionId,
        pmsLeaseId,
        externalId: p.externalId,
        amountCents: p.amountCents,
        currency: p.currency ?? 'USD',
        paidAt: p.paidAt,
        paymentMethod: p.paymentMethod ?? null,
        appliedToCharges: p.appliedToCharges ?? [],
        lastExternalUpdatedAt: p.lastExternalUpdatedAt ?? null,
      },
      { transaction, conflictFields: ['pms_connection_id', 'external_id'] }
    );
    if (wasCreated) created++;
    else updated++;
  }
  await SyncRun.update(
    { step: 'payments', stats: { ...(data.stats || {}), paymentsCreated: created, paymentsUpdated: updated } },
    { where: { id: syncRunId }, transaction }
  );
  return { paymentsCreated: created, paymentsUpdated: updated };
}

/**
 * Step 4: Compute balances per lease and aging snapshot for the connection.
 */
async function computeBalancesAndAging(connectionId, tenantId, syncRunId, transaction) {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const leases = await PmsLease.findAll({ where: { pmsConnectionId: connectionId }, attributes: ['id'], transaction });
  let totalCents = 0;
  const buckets = { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };

  for (const lease of leases) {
    const charges = await ArCharge.findAll({
      where: { pmsLeaseId: lease.id },
      attributes: ['amountCents', 'dueDate'],
      transaction,
    });
    const payments = await ArPayment.findAll({
      where: { pmsLeaseId: lease.id },
      attributes: ['amountCents'],
      transaction,
    });
    const chargeTotal = charges.reduce((s, c) => s + Number(c.amountCents), 0);
    const paymentTotal = payments.reduce((s, p) => s + Number(p.amountCents), 0);
    const balanceCents = chargeTotal - paymentTotal;
    if (balanceCents <= 0) continue;

    await ArBalance.upsert(
      {
        tenantId,
        pmsConnectionId: connectionId,
        pmsLeaseId: lease.id,
        balanceCents,
        currency: 'USD',
        asOfDate,
      },
      { transaction, conflictFields: ['pms_lease_id', 'as_of_date'] }
    );

    totalCents += balanceCents;
    const today = new Date(asOfDate);
    for (const c of charges) {
      const due = new Date(c.dueDate);
      const daysPastDue = Math.floor((today - due) / (24 * 60 * 60 * 1000));
      if (daysPastDue < 0) continue;
      const amt = Number(c.amountCents);
      if (daysPastDue <= 30) buckets['0_30'] += amt;
      else if (daysPastDue <= 60) buckets['31_60'] += amt;
      else if (daysPastDue <= 90) buckets['61_90'] += amt;
      else buckets['90_plus'] += amt;
    }
  }

  await ArAgingSnapshot.upsert(
    {
      tenantId,
      pmsConnectionId: connectionId,
      asOfDate,
      totalCents,
      bucket030Cents: buckets['0_30'],
      bucket3160Cents: buckets['31_60'],
      bucket6190Cents: buckets['61_90'],
      bucket90PlusCents: buckets['90_plus'],
      currency: 'USD',
    },
    { transaction, conflictFields: ['pms_connection_id', 'as_of_date'] }
  );

  await SyncRun.update(
    {
      step: 'balances_aging',
      stats: { totalCents, ...buckets },
    },
    { where: { id: syncRunId }, transaction }
  );
  return { totalCents, ...buckets };
}

/**
 * Run full sync for a connection: create SyncRun, run 4 steps, update connection and SyncRun.
 * Invoked by the worker with { connectionId, trigger?, idempotencyKey? }.
 * @param {string} connectionId
 * @param {{ trigger?: 'manual'|'scheduled'|'webhook', idempotencyKey?: string }} [options]
 */
export async function runSync(connectionId, options = {}) {
  const { connection, withCreds, software } = await ensureConnection(connectionId);
  const tenantId = connection.tenantId;
  const connector = getConnector(software.key, withCreds);

  const active = await SyncRun.findOne({
    where: { pmsConnectionId: connectionId, status: ['pending', 'running'] },
    attributes: ['id'],
  });
  if (active) {
    logger.warn({ connectionId, activeRunId: active.id }, 'PMS sync rejected: already in progress');
    throw new Error(`PMS sync already in progress for connection ${connectionId} (run ${active.id})`);
  }

  const trigger = options.trigger ?? 'manual';
  const idempotencyKey = options.idempotencyKey ?? `${connectionId}-${trigger}-${Date.now()}`;

  logger.info(
    { connectionId, tenantId, trigger, softwareKey: software?.key },
    'PMS sync started'
  );

  let syncRun;
  const transaction = await sequelize.transaction();
  try {
    syncRun = await SyncRun.create(
      {
        pmsConnectionId: connectionId,
        status: 'running',
        trigger,
        idempotencyKey,
        triggeredAt: new Date(),
        startedAt: new Date(),
        step: null,
        stats: {},
      },
      { transaction }
    );
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    logger.error({ err, connectionId }, 'PMS sync: failed to create SyncRun');
    throw err;
  }

  logger.info({ connectionId, syncRunId: syncRun.id }, 'PMS sync: SyncRun created');

  let finalStats = {};
  try {
    logger.info({ connectionId, syncRunId: syncRun.id }, 'PMS sync: fetching data from connector...');
    const data = await connector.syncFull();
    const dataNorm = {
      debtors: data?.debtors ?? [],
      leases: data?.leases ?? [],
      charges: data?.charges ?? [],
      payments: data?.payments ?? [],
      stats: data?.stats ?? {},
    };

    logger.info(
      {
        connectionId,
        syncRunId: syncRun.id,
        debtorsCount: dataNorm.debtors.length,
        leasesCount: dataNorm.leases.length,
        chargesCount: dataNorm.charges.length,
        paymentsCount: dataNorm.payments.length,
      },
      'PMS sync: data received from connector'
    );

    const t2 = await sequelize.transaction();
    try {
      logger.info({ connectionId, syncRunId: syncRun.id, step: '1/4' }, 'PMS sync: step debtors_leases');
      const step1Stats = await syncDebtorsAndLeases(connectionId, tenantId, dataNorm, syncRun.id, t2);
      logger.info(
        { connectionId, syncRunId: syncRun.id, step: 'debtors_leases', ...step1Stats },
        'PMS sync: step debtors_leases done'
      );

      logger.info({ connectionId, syncRunId: syncRun.id, step: '2/4' }, 'PMS sync: step charges');
      const step2Stats = await syncCharges(connectionId, tenantId, dataNorm, syncRun.id, t2);
      logger.info(
        { connectionId, syncRunId: syncRun.id, step: 'charges', ...step2Stats },
        'PMS sync: step charges done'
      );

      logger.info({ connectionId, syncRunId: syncRun.id, step: '3/4' }, 'PMS sync: step payments');
      const step3Stats = await syncPayments(connectionId, tenantId, dataNorm, syncRun.id, t2);
      logger.info(
        { connectionId, syncRunId: syncRun.id, step: 'payments', ...step3Stats },
        'PMS sync: step payments done'
      );

      logger.info({ connectionId, syncRunId: syncRun.id, step: '4/4' }, 'PMS sync: step balances_aging');
      const step4Stats = await computeBalancesAndAging(connectionId, tenantId, syncRun.id, t2);
      logger.info(
        { connectionId, syncRunId: syncRun.id, step: 'balances_aging', ...step4Stats },
        'PMS sync: step balances_aging done'
      );

      await t2.commit();
      logger.info({ connectionId, syncRunId: syncRun.id }, 'PMS sync: all steps committed');
    } catch (err) {
      await t2.rollback();
      logger.error(
        { err, connectionId, syncRunId: syncRun.id, step: 'sync_steps' },
        'PMS sync: step failed, transaction rolled back'
      );
      throw err;
    }

    const now = new Date();
    const prevState = connection.syncState ?? {};
    const syncState = {
      ...prevState,
      lastAttemptAt: now,
      lastSuccessfulRunAt: now,
      ...(dataNorm.stats?.cursors && {
        debtorsSince: dataNorm.stats.cursors.debtorsSince ?? prevState.debtorsSince,
        leasesSince: dataNorm.stats.cursors.leasesSince ?? prevState.leasesSince,
        chargesSince: dataNorm.stats.cursors.chargesSince ?? prevState.chargesSince,
        paymentsSince: dataNorm.stats.cursors.paymentsSince ?? prevState.paymentsSince,
      }),
    };

    await PmsConnection.update(
      { status: 'connected', lastSyncedAt: now, lastError: null, syncState },
      { where: { id: connectionId } }
    );
    await SyncRun.update(
      { status: 'completed', finishedAt: now },
      { where: { id: syncRun.id } }
    );
    logger.info(
      { connectionId, syncRunId: syncRun.id, lastSyncedAt: now },
      'PMS sync completed successfully'
    );
    return { ok: true, syncRunId: syncRun.id };
  } catch (err) {
    logger.error(
      { err, connectionId, syncRunId: syncRun?.id, step: syncRun?.step, message: err?.message },
      'PMS sync failed'
    );
    const now = new Date();
    const prevState = connection.syncState ?? {};
    const syncState = { ...prevState, lastAttemptAt: now };

    await PmsConnection.update(
      { status: 'error', lastError: { message: err.message, step: syncRun?.step }, syncState },
      { where: { id: connectionId } }
    );
    await SyncRun.update(
      { status: 'failed', finishedAt: now, errorMessage: err.message, errorDetails: { message: err.message } },
      { where: { id: syncRun.id } }
    ).catch(() => {});
    throw err;
  }
}
