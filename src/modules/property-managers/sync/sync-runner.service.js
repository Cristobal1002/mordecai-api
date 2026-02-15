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

/** resolveInternalId with an in-memory cache to avoid repeated DB lookups for the same externalId. */
async function resolveInternalIdCached(connectionId, entityType, externalId, transaction, cache) {
  const key = `${entityType}:${externalId}`;
  if (cache.has(key)) return cache.get(key);
  const id = await resolveInternalId(connectionId, entityType, externalId, transaction);
  cache.set(key, id);
  return id;
}

/**
 * Step 1: Sync debtors, properties, units and leases from connector result; upsert and write external_mappings.
 * Properties and units come from leases/export (Rentvine) so leases can link to them.
 */
async function syncDebtorsAndLeases(connectionId, tenantId, data, syncRunId, transaction) {
  const stats = {
    debtorsCreated: 0,
    debtorsUpdated: 0,
    propertiesCreated: 0,
    propertiesUpdated: 0,
    unitsCreated: 0,
    unitsUpdated: 0,
    leasesCreated: 0,
    leasesUpdated: 0,
    leasesSkipped: 0,
  };
  const debtors = data.debtors || [];
  const properties = data.properties || [];
  const units = data.units || [];
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

  const existingProperties = await PmsProperty.findAll({
    where: { pmsConnectionId: connectionId },
    attributes: ['id', 'externalId'],
    transaction,
  });
  const existingPropsByExternal = new Map(existingProperties.map((r) => [r.externalId, r]));
  const propToCreate = [];
  const propToUpdate = [];
  for (const p of properties) {
    const payload = {
      tenantId,
      pmsConnectionId: connectionId,
      externalId: p.externalId,
      name: p.name ?? null,
      address: p.address ?? {},
    };
    const existing = existingPropsByExternal.get(p.externalId);
    if (existing) {
      propToUpdate.push({ id: existing.id, payload: { name: payload.name, address: payload.address } });
    } else {
      propToCreate.push(payload);
    }
  }
  const BULK_CHUNK = 100;
  for (let i = 0; i < propToCreate.length; i += BULK_CHUNK) {
    const chunk = propToCreate.slice(i, i + BULK_CHUNK);
    const created = await PmsProperty.bulkCreate(chunk, { transaction });
    stats.propertiesCreated += created.length;
    for (const row of created) {
      await upsertExternalMapping(connectionId, 'property', row.externalId, 'pms_property', row.id, transaction);
    }
  }
  const UPDATE_BATCH = 50;
  for (let i = 0; i < propToUpdate.length; i += UPDATE_BATCH) {
    const batch = propToUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(batch.map(({ id, payload }) => PmsProperty.update(payload, { where: { id }, transaction })));
    stats.propertiesUpdated += batch.length;
  }

  const existingUnits = await PmsUnit.findAll({
    where: { pmsConnectionId: connectionId },
    attributes: ['id', 'externalId'],
    transaction,
  });
  const existingUnitsByExternal = new Map(existingUnits.map((r) => [r.externalId, r]));
  const unitToCreate = [];
  const unitToUpdate = [];
  const propertyIdCache = new Map();
  for (const u of units) {
    let pmsPropertyId = null;
    if (u.propertyExternalId) {
      if (!propertyIdCache.has(u.propertyExternalId)) {
        propertyIdCache.set(
          u.propertyExternalId,
          await resolveInternalId(connectionId, 'property', u.propertyExternalId, transaction)
        );
      }
      pmsPropertyId = propertyIdCache.get(u.propertyExternalId);
    }
    const rawUnitNumber = u.unitNumber ?? null;
    const unitNumber =
      rawUnitNumber != null && String(rawUnitNumber).length > 64
        ? String(rawUnitNumber).slice(0, 64)
        : rawUnitNumber;
    const payload = {
      tenantId,
      pmsConnectionId: connectionId,
      pmsPropertyId: pmsPropertyId ?? null,
      externalId: u.externalId,
      unitNumber,
    };
    const existing = existingUnitsByExternal.get(u.externalId);
    if (existing) {
      unitToUpdate.push({ id: existing.id, payload: { pmsPropertyId: payload.pmsPropertyId, unitNumber: payload.unitNumber } });
    } else {
      unitToCreate.push(payload);
    }
  }
  for (let i = 0; i < unitToCreate.length; i += BULK_CHUNK) {
    const chunk = unitToCreate.slice(i, i + BULK_CHUNK);
    const created = await PmsUnit.bulkCreate(chunk, { transaction });
    stats.unitsCreated += created.length;
    for (const row of created) {
      await upsertExternalMapping(connectionId, 'unit', row.externalId, 'pms_unit', row.id, transaction);
    }
  }
  for (let i = 0; i < unitToUpdate.length; i += UPDATE_BATCH) {
    const batch = unitToUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(batch.map(({ id, payload }) => PmsUnit.update(payload, { where: { id }, transaction })));
    stats.unitsUpdated += batch.length;
  }

  const resolveCache = new Map();
  const existingLeases = await PmsLease.findAll({
    where: { pmsConnectionId: connectionId },
    attributes: ['id', 'externalId'],
    transaction,
  });
  const existingByExternal = new Map(existingLeases.map((r) => [r.externalId, r]));

  const toCreate = [];
  const toUpdate = [];

  for (let i = 0; i < leases.length; i++) {
    const l = leases[i];
    if (i > 0 && i % 100 === 0) {
      logger.debug({ connectionId, syncRunId, processed: i, total: leases.length }, 'PMS sync: leases progress');
    }
    const pmsDebtorId = await resolveInternalIdCached(
      connectionId,
      'debtor',
      l.debtorExternalId,
      transaction,
      resolveCache
    );
    if (!pmsDebtorId) {
      stats.leasesSkipped++;
      logger.debug(
        { connectionId, leaseExternalId: l.externalId, debtorExternalId: l.debtorExternalId },
        'PMS sync: lease skipped (debtor not found)'
      );
      continue;
    }
    const pmsPropertyId = l.propertyExternalId
      ? await resolveInternalIdCached(
          connectionId,
          'property',
          l.propertyExternalId,
          transaction,
          resolveCache
        )
      : null;
    const pmsUnitId = l.unitExternalId
      ? await resolveInternalIdCached(connectionId, 'unit', l.unitExternalId, transaction, resolveCache)
      : null;
    const status =
      l.isActive === false ? 'ended' : l.isActive === true ? 'active' : (l.status ?? 'active');
    const payload = {
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
    };
    const existing = existingByExternal.get(l.externalId);
    if (existing) {
      toUpdate.push({ id: existing.id, externalId: l.externalId, payload });
    } else {
      toCreate.push(payload);
    }
  }

  for (let i = 0; i < toCreate.length; i += BULK_CHUNK) {
    const chunk = toCreate.slice(i, i + BULK_CHUNK);
    const created = await PmsLease.bulkCreate(chunk, { transaction });
    stats.leasesCreated += created.length;
    for (const row of created) {
      existingByExternal.set(row.externalId, row);
      await upsertExternalMapping(connectionId, 'lease', row.externalId, 'pms_lease', row.id, transaction);
    }
  }

  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      batch.map(({ id, externalId, payload }) =>
        PmsLease.update(payload, { where: { id }, transaction }).then(() =>
          upsertExternalMapping(connectionId, 'lease', externalId, 'pms_lease', id, transaction)
        )
      )
    );
    stats.leasesUpdated += batch.length;
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
  const run = await SyncRun.findByPk(syncRunId, { attributes: ['stats'], transaction });
  await SyncRun.update(
    {
      step: 'charges',
      stats: { ...(run?.stats || {}), ...(data.stats || {}), chargesCreated: created, chargesUpdated: updated, chargesSkipped: skipped },
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
  const run = await SyncRun.findByPk(syncRunId, { attributes: ['stats'], transaction });
  await SyncRun.update(
    { step: 'payments', stats: { ...(run?.stats || {}), ...(data.stats || {}), paymentsCreated: created, paymentsUpdated: updated } },
    { where: { id: syncRunId }, transaction }
  );
  return { paymentsCreated: created, paymentsUpdated: updated };
}

/**
 * Step 4: Compute balances per lease and aging snapshot for the connection.
 * If data.leaseBalances is provided (e.g. from Rentvine leases/export), those are applied first;
 * then balances are computed from charges/payments for any lease not in leaseBalances.
 */
async function computeBalancesAndAging(connectionId, tenantId, syncRunId, data, transaction) {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const leaseBalancesFromConnector = data?.leaseBalances ?? [];
  /** @type {Map<string, number>} lease id -> balanceCents from connector */
  const connectorBalanceByLeaseId = new Map();

  if (leaseBalancesFromConnector.length > 0) {
    for (const lb of leaseBalancesFromConnector) {
      const pmsLeaseId = await resolveInternalId(connectionId, 'lease', lb.leaseExternalId, transaction);
      if (!pmsLeaseId) continue;
      const balanceCents = Number(lb.balanceCents) || 0;
      const lbDate = lb.asOfDate || asOfDate;
      await ArBalance.upsert(
        {
          tenantId,
          pmsConnectionId: connectionId,
          pmsLeaseId,
          balanceCents,
          currency: 'USD',
          asOfDate: lbDate,
        },
        { transaction, conflictFields: ['pms_lease_id', 'as_of_date'] }
      );
      connectorBalanceByLeaseId.set(pmsLeaseId, balanceCents);
    }
  }

  const leases = await PmsLease.findAll({ where: { pmsConnectionId: connectionId }, attributes: ['id'], transaction });
  let totalCents = 0;
  const buckets = { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };

  for (const lease of leases) {
    const charges = await ArCharge.findAll({
      where: { pmsLeaseId: lease.id },
      attributes: ['amountCents', 'openAmountCents', 'dueDate', 'postDate'],
      transaction,
    });
    const payments = await ArPayment.findAll({
      where: { pmsLeaseId: lease.id },
      attributes: ['amountCents'],
      transaction,
    });
    const chargeTotal = charges.reduce((s, c) => s + Number(c.amountCents), 0);
    const paymentTotal = payments.reduce((s, p) => s + Number(p.amountCents), 0);
    const computedBalanceCents = chargeTotal - paymentTotal;

    const hasConnectorBalance = connectorBalanceByLeaseId.has(lease.id);
    if (!hasConnectorBalance && computedBalanceCents > 0) {
      await ArBalance.upsert(
        {
          tenantId,
          pmsConnectionId: connectionId,
          pmsLeaseId: lease.id,
          balanceCents: computedBalanceCents,
          currency: 'USD',
          asOfDate,
        },
        { transaction, conflictFields: ['pms_lease_id', 'as_of_date'] }
      );
    }

    const leaseBalanceCents = hasConnectorBalance
      ? connectorBalanceByLeaseId.get(lease.id)
      : computedBalanceCents;
    if (leaseBalanceCents > 0) totalCents += leaseBalanceCents;

    const today = new Date(asOfDate);
    for (const c of charges) {
      const dueDateOrPost = c.dueDate || c.postDate;
      if (!dueDateOrPost) continue;
      const due = new Date(dueDateOrPost);
      const daysPastDue = Math.floor((today - due) / (24 * 60 * 60 * 1000));
      if (daysPastDue < 0) continue;
      const amt = Number(c.openAmountCents ?? c.amountCents);
      if (amt <= 0) continue;
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

  const run = await SyncRun.findByPk(syncRunId, { attributes: ['stats'], transaction });
  await SyncRun.update(
    {
      step: 'balances_aging',
      stats: { ...(run?.stats || {}), totalCents, ...buckets },
    },
    { where: { id: syncRunId }, transaction }
  );
  return { totalCents, ...buckets };
}

const ALL_STEPS = ['debtors_leases', 'charges', 'payments', 'balances_aging'];

/**
 * Run full or partial sync for a connection: create SyncRun, run requested steps, update connection and SyncRun.
 * Invoked by the worker with { connectionId, trigger?, idempotencyKey?, steps? }.
 * @param {string} connectionId
 * @param {{ trigger?: 'manual'|'scheduled'|'webhook', idempotencyKey?: string, steps?: string[] }} [options]
 *   steps: if set, only these steps run (e.g. ['debtors_leases']); otherwise all 4 steps.
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
  const stepsRequested = options.steps && options.steps.length > 0 ? options.steps : null;
  const stepsToRun = stepsRequested ?? ALL_STEPS;
  const idempotencyKey = options.idempotencyKey ?? `${connectionId}-${trigger}-${Date.now()}`;

  logger.info(
    { connectionId, tenantId, trigger, steps: stepsToRun, softwareKey: software?.key },
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
      properties: data?.properties ?? [],
      units: data?.units ?? [],
      leases: data?.leases ?? [],
      charges: data?.charges ?? [],
      payments: data?.payments ?? [],
      leaseBalances: data?.leaseBalances ?? [],
      stats: data?.stats ?? {},
    };

    logger.info(
      {
        connectionId,
        syncRunId: syncRun.id,
        debtorsCount: dataNorm.debtors.length,
        propertiesCount: dataNorm.properties.length,
        unitsCount: dataNorm.units.length,
        leasesCount: dataNorm.leases.length,
        chargesCount: dataNorm.charges.length,
        paymentsCount: dataNorm.payments.length,
      },
      'PMS sync: data received from connector'
    );

    // One transaction per step so data and SyncRun.step are visible after each step (UI can show progress and refetch).
    for (const stepName of stepsToRun) {
      const t = await sequelize.transaction();
      try {
        if (stepName === 'debtors_leases') {
          logger.info({ connectionId, syncRunId: syncRun.id, step: '1/4' }, 'PMS sync: step debtors_leases');
          const step1Stats = await syncDebtorsAndLeases(connectionId, tenantId, dataNorm, syncRun.id, t);
          logger.info(
            { connectionId, syncRunId: syncRun.id, step: 'debtors_leases', ...step1Stats },
            'PMS sync: step debtors_leases done'
          );
        } else if (stepName === 'charges') {
          logger.info({ connectionId, syncRunId: syncRun.id, step: '2/4' }, 'PMS sync: step charges');
          const step2Stats = await syncCharges(connectionId, tenantId, dataNorm, syncRun.id, t);
          logger.info(
            { connectionId, syncRunId: syncRun.id, step: 'charges', ...step2Stats },
            'PMS sync: step charges done'
          );
        } else if (stepName === 'payments') {
          logger.info({ connectionId, syncRunId: syncRun.id, step: '3/4' }, 'PMS sync: step payments');
          const step3Stats = await syncPayments(connectionId, tenantId, dataNorm, syncRun.id, t);
          logger.info(
            { connectionId, syncRunId: syncRun.id, step: 'payments', ...step3Stats },
            'PMS sync: step payments done'
          );
        } else if (stepName === 'balances_aging') {
          logger.info({ connectionId, syncRunId: syncRun.id, step: '4/4' }, 'PMS sync: step balances_aging');
          const step4Stats = await computeBalancesAndAging(connectionId, tenantId, syncRun.id, dataNorm, t);
          logger.info(
            { connectionId, syncRunId: syncRun.id, step: 'balances_aging', ...step4Stats },
            'PMS sync: step balances_aging done'
          );
        }
        await t.commit();
      } catch (err) {
        await t.rollback();
        logger.error(
          { err, connectionId, syncRunId: syncRun.id, step: stepName },
          'PMS sync: step failed, transaction rolled back'
        );
        throw err;
      }
    }
    logger.info({ connectionId, syncRunId: syncRun.id, steps: stepsToRun }, 'PMS sync: steps committed');

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
    const prevState = connection?.syncState ?? {};
    const syncState = { ...prevState, lastAttemptAt: now };

    try {
      await PmsConnection.update(
        { status: 'error', lastError: { message: err.message, step: syncRun?.step }, syncState },
        { where: { id: connectionId } }
      );
    } catch (updateErr) {
      logger.warn({ connectionId, err: updateErr?.message }, 'Could not set connection status to error');
    }
    if (syncRun?.id) {
      await SyncRun.update(
        { status: 'failed', finishedAt: now, errorMessage: err.message, errorDetails: { message: err.message } },
        { where: { id: syncRun.id } }
      ).catch(() => {});
    }
    throw err;
  }
}
