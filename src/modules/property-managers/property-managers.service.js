/**
 * Property-managers service — Capa 2: conexiones reales por tenant.
 * CRUD pms_connections, testConnection. triggerSync encola job pms-sync;
 * el worker en mordecai-workers procesa el job y ejecuta runSync (4 pasos).
 * Credentials are encrypted at rest (AES-256-GCM) and never returned to the client.
 */
import { Op } from 'sequelize';
import {
  PmsConnection,
  PmsDebtor,
  PmsLease,
  Software,
  ArCharge,
  ArPayment,
  ArBalance,
  ArAgingSnapshot,
} from '../../models/index.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { getConnector, hasConnector } from './connectors/connector.factory.js';
import { addPmsSyncJob } from '../../queues/pms-sync.queue.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors/index.js';
import {
  encryptCredentials,
  decryptCredentials,
  isEncryptedPayload,
} from '../../utils/credentials-crypto.js';

const VALID_STATUSES = ['draft', 'connected', 'syncing', 'error', 'disabled'];

async function ensureTenant(tenantId) {
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) throw new NotFoundError('Tenant');
  return tenant;
}

async function getSoftwareByKey(softwareKey) {
  const software = await Software.findOne({
    where: { key: softwareKey, isEnabled: true },
  });
  if (!software) throw new NotFoundError('Software');
  return software;
}

export const propertyManagersService = {
  listByTenant: async (tenantId) => {
    await ensureTenant(tenantId);
    return await PmsConnection.findAll({
      where: { tenantId },
      include: [
        {
          association: 'software',
          attributes: ['id', 'key', 'name', 'authType', 'logoUrl'],
        },
        {
          association: 'syncRuns',
          where: { status: { [Op.in]: ['pending', 'running'] } },
          required: false,
          limit: 1,
          order: [['startedAt', 'DESC']],
          attributes: ['id', 'step', 'stats', 'status', 'startedAt'],
          separate: true,
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  getById: async (tenantId, connectionId) => {
    await ensureTenant(tenantId);
    const connection = await PmsConnection.findOne({
      where: { id: connectionId, tenantId },
      include: [
        {
          association: 'software',
          attributes: ['id', 'key', 'name', 'authType', 'logoUrl', 'docsUrl'],
        },
      ],
    });
    if (!connection) throw new NotFoundError('PmsConnection');
    return connection;
  },

  /**
   * Returns only the decrypted credentials for a connection. Used when the user
   * opens the edit form (authenticated request).
   */
  getCredentials: async (tenantId, connectionId) => {
    const withCreds = await propertyManagersService.getByIdWithDecryptedCredentials(
      tenantId,
      connectionId
    );
    return { credentials: withCreds.credentials ?? null };
  },

  /**
   * Same as getById but with credentials decrypted for internal use (connector).
   * Do not expose the returned object to the client.
   */
  getByIdWithDecryptedCredentials: async (tenantId, connectionId) => {
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    const plain = connection.get({ plain: true });
    const credentials = isEncryptedPayload(plain.credentials)
      ? decryptCredentials(plain.credentials)
      : plain.credentials;
    return { ...plain, credentials };
  },

  create: async (tenantId, body) => {
    await ensureTenant(tenantId);
    const { softwareKey, credentials = null, status = 'draft' } = body;
    if (!softwareKey) throw new BadRequestError('softwareKey is required');

    const software = await getSoftwareByKey(softwareKey);
    const existing = await PmsConnection.findOne({
      where: { tenantId, softwareId: software.id },
    });

    const targetStatus = status || 'draft';
    if (existing) {
      const canReconnect = ['disabled', 'draft'].includes(existing.status);
      if (canReconnect) {
        const toStore =
          credentials != null
            ? encryptCredentials(credentials)
            : existing.credentials;
        await existing.update({
          credentials: toStore,
          status: targetStatus,
          lastError: null,
        });
        return await PmsConnection.findByPk(existing.id, {
          include: [
            {
              association: 'software',
              attributes: ['id', 'key', 'name', 'authType', 'logoUrl'],
            },
          ],
        });
      }
      throw new ConflictError('A connection for this software already exists for this tenant');
    }

    const connection = await PmsConnection.create({
      tenantId,
      softwareId: software.id,
      status: targetStatus,
      credentials:
        credentials != null ? encryptCredentials(credentials) : null,
      capabilities: software.capabilities ?? null,
    });
    return await PmsConnection.findByPk(connection.id, {
      include: [
        {
          association: 'software',
          attributes: ['id', 'key', 'name', 'authType', 'logoUrl'],
        },
      ],
    });
  },

  updateCredentials: async (tenantId, connectionId, credentials) => {
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    const toStore =
      credentials != null
        ? encryptCredentials(credentials)
        : connection.credentials;
    await connection.update({
      credentials: toStore,
      lastError: null,
    });
    return connection.reload();
  },

  updateStatus: async (tenantId, connectionId, status) => {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    await connection.update({ status });
    return connection.reload();
  },

  /**
   * Delete a PMS connection. Removes the record from the database.
   */
  delete: async (tenantId, connectionId) => {
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    await connection.destroy();
    return { deleted: true, connectionId };
  },

  testConnection: async (tenantId, connectionId) => {
    const connectionWithCreds = await propertyManagersService.getByIdWithDecryptedCredentials(
      tenantId,
      connectionId
    );
    const software = await Software.findByPk(connectionWithCreds.softwareId);
    if (!software) throw new NotFoundError('Software');

    if (!hasConnector(software.key)) {
      throw new BadRequestError(`Connector not available for software: ${software.key}`);
    }
    const connector = getConnector(software.key, connectionWithCreds);
    return await connector.testConnection();
  },

  /**
   * Test credentials without persisting. Uses the connector to hit the PMS API
   * (e.g. Rentvine /portfolios/search). Returns { ok, message }.
   */
  testCredentials: async (tenantId, body) => {
    await ensureTenant(tenantId);
    const { softwareKey, credentials = {} } = body;
    if (!softwareKey) throw new BadRequestError('softwareKey is required');

    const software = await getSoftwareByKey(softwareKey);
    if (!hasConnector(software.key)) {
      throw new BadRequestError(`Connector not available for software: ${software.key}`);
    }

    const fakeConnection = { credentials };
    const connector = getConnector(software.key, fakeConnection);
    return await connector.testConnection();
  },

  /**
   * Enqueue a sync job and set connection to syncing. Worker (mordecai-workers) processes the job.
   * @param {{ steps?: string[] }} [opts] - If steps is set (e.g. ['debtors_leases']), only those steps run.
   */
  triggerSync: async (tenantId, connectionId, opts = {}) => {
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    const software = await Software.findByPk(connection.softwareId);
    if (!software) throw new NotFoundError('Software');

    if (connection.status === 'syncing') {
      throw new ConflictError('A sync is already in progress for this connection');
    }
    if (!['connected', 'error'].includes(connection.status)) {
      throw new BadRequestError('Connection must be in connected or error state to sync');
    }
    if (!hasConnector(software.key)) {
      throw new BadRequestError(`Connector not available for software: ${software.key}`);
    }

    const jobId = await addPmsSyncJob(connectionId, tenantId, { trigger: 'manual', steps: opts.steps ?? null });
    if (jobId == null) {
      throw new BadRequestError(
        'Sync queue is not available. Set REDIS_URL to enable on-demand sync (worker must be running).'
      );
    }

    await connection.update({ status: 'syncing', lastError: null });
    return {
      enqueued: true,
      jobId,
      connectionId: connection.id,
      status: 'syncing',
      message: 'Sync requested. The worker will process the job.',
    };
  },

  /**
   * List pms_debtors for the tenant (synced from PMS). Optional filter by connectionId, search (name/email), sort.
   */
  listPmsDebtors: async (tenantId, opts = {}) => {
    await ensureTenant(tenantId);
    const limit = Math.min(Number(opts.limit) || 500, 1000);
    const offset = Number(opts.offset) || 0;
    const connectionId = opts.connectionId || null;
    const search = typeof opts.search === 'string' ? opts.search.trim() : null;
    const sortBy = opts.sortBy && ['displayName', 'email', 'createdAt'].includes(opts.sortBy) ? opts.sortBy : 'displayName';
    const sortOrder = opts.sortOrder === 'desc' ? 'DESC' : 'ASC';

    const where = { tenantId };
    if (connectionId) where.pmsConnectionId = connectionId;
    if (search && search.length > 0) {
      where[Op.or] = [
        { displayName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await PmsDebtor.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          association: 'pmsConnection',
          attributes: ['id', 'status', 'lastSyncedAt'],
          include: [
            { association: 'software', attributes: ['key', 'name'] },
          ],
        },
      ],
    });

    return { data: rows, total: count, limit, offset };
  },

  /**
   * List pms_leases for the tenant. Optional filter by connectionId, search (leaseNumber/status), sort.
   */
  listPmsLeases: async (tenantId, opts = {}) => {
    await ensureTenant(tenantId);
    const limit = Math.min(Number(opts.limit) || 500, 1000);
    const offset = Number(opts.offset) || 0;
    const connectionId = opts.connectionId || null;
    const search = typeof opts.search === 'string' ? opts.search.trim() : null;
    const status = opts.status && ['active', 'ended', 'pending'].includes(opts.status) ? opts.status : null;
    const sortBy = opts.sortBy && ['leaseNumber', 'status', 'moveInDate', 'createdAt'].includes(opts.sortBy) ? opts.sortBy : 'leaseNumber';
    const sortOrder = opts.sortOrder === 'desc' ? 'DESC' : 'ASC';

    const where = { tenantId };
    if (connectionId) where.pmsConnectionId = connectionId;
    if (status) where.status = status;
    if (search && search.length > 0) {
      where[Op.or] = [
        { leaseNumber: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await PmsLease.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          association: 'pmsConnection',
          attributes: ['id', 'status', 'lastSyncedAt'],
          include: [{ association: 'software', attributes: ['key', 'name'] }],
        },
        {
          association: 'pmsDebtor',
          attributes: ['id', 'displayName', 'email'],
        },
      ],
    });

    return { data: rows, total: count, limit, offset };
  },

  /**
   * Stats for PM-Manager cards: counts (debtors, leases, charges, payments) and balances/aging summary.
   */
  getPmsStats: async (tenantId) => {
    await ensureTenant(tenantId);
    const [totalDebtors, totalLeases, totalCharges, totalPayments, balancesCount, latestSnapshot] = await Promise.all([
      PmsDebtor.count({ where: { tenantId } }),
      PmsLease.count({ where: { tenantId } }),
      ArCharge.count({ where: { tenantId } }),
      ArPayment.count({ where: { tenantId } }),
      ArBalance.count({ where: { tenantId } }),
      ArAgingSnapshot.findOne({
        where: { tenantId },
        order: [['asOfDate', 'DESC']],
        attributes: ['asOfDate', 'totalCents', 'bucket030Cents', 'bucket3160Cents', 'bucket6190Cents', 'bucket90PlusCents'],
      }),
    ]);
    const aging = latestSnapshot
      ? {
          asOfDate: latestSnapshot.asOfDate,
          totalCents: Number(latestSnapshot.totalCents) || 0,
          bucket030Cents: Number(latestSnapshot.bucket030Cents) || 0,
          bucket3160Cents: Number(latestSnapshot.bucket3160Cents) || 0,
          bucket6190Cents: Number(latestSnapshot.bucket6190Cents) || 0,
          bucket90PlusCents: Number(latestSnapshot.bucket90PlusCents) || 0,
        }
      : null;
    return {
      totalDebtors,
      totalLeases,
      totalCharges,
      totalPayments,
      totalBalanceCents: aging?.totalCents ?? 0,
      balancesCount,
      aging,
    };
  },

  /**
   * List ar_charges for the tenant (paginated). Optional filter by connectionId, leaseId, sort.
   */
  listPmsCharges: async (tenantId, opts = {}) => {
    await ensureTenant(tenantId);
    const limit = Math.min(Number(opts.limit) || 50, 500);
    const offset = Number(opts.offset) || 0;
    const connectionId = opts.connectionId || null;
    const sortBy = opts.sortBy && ['dueDate', 'postDate', 'amountCents', 'createdAt'].includes(opts.sortBy) ? opts.sortBy : 'dueDate';
    const sortOrder = opts.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const where = { tenantId };
    if (connectionId) where.pmsConnectionId = connectionId;

    const { rows, count } = await ArCharge.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          association: 'pmsLease',
          attributes: ['id', 'leaseNumber', 'status', 'externalId'],
          required: false,
          include: [
            { association: 'pmsDebtor', attributes: ['id', 'displayName', 'email'], required: false },
          ],
        },
      ],
    });

    return { data: rows, total: count, limit, offset };
  },

  /**
   * Balances and aging summary for the tenant (lease-level balances + aging snapshot).
   */
  getPmsBalancesSummary: async (tenantId) => {
    await ensureTenant(tenantId);
    const latestSnapshot = await ArAgingSnapshot.findOne({
      where: { tenantId },
      order: [['asOfDate', 'DESC']],
      attributes: ['asOfDate', 'totalCents', 'bucket030Cents', 'bucket3160Cents', 'bucket6190Cents', 'bucket90PlusCents', 'currency'],
    });
    const asOfDate = latestSnapshot?.asOfDate ?? null;
    const latestDate = asOfDate;
    const leaseBalances = latestDate
      ? await ArBalance.findAll({
          where: { tenantId, asOfDate: latestDate },
          attributes: ['id', 'pmsLeaseId', 'balanceCents', 'asOfDate', 'currency'],
          include: [
            {
              association: 'pmsLease',
              attributes: ['id', 'leaseNumber', 'externalId'],
              required: false,
              include: [{ association: 'pmsDebtor', attributes: ['id', 'displayName'], required: false }],
            },
          ],
        })
      : [];

    const aging = latestSnapshot
      ? {
          asOfDate: latestSnapshot.asOfDate,
          totalCents: Number(latestSnapshot.totalCents) || 0,
          bucket030Cents: Number(latestSnapshot.bucket030Cents) || 0,
          bucket3160Cents: Number(latestSnapshot.bucket3160Cents) || 0,
          bucket6190Cents: Number(latestSnapshot.bucket6190Cents) || 0,
          bucket90PlusCents: Number(latestSnapshot.bucket90PlusCents) || 0,
          currency: latestSnapshot.currency || 'USD',
        }
      : null;

    return {
      asOfDate: latestDate,
      totalCents: aging?.totalCents ?? leaseBalances.reduce((s, b) => s + Number(b.balanceCents || 0), 0),
      currency: 'USD',
      aging,
      leaseBalances: leaseBalances.map((b) => {
        const plain = b.get ? b.get({ plain: true }) : b;
        return {
          id: plain.id,
          pmsLeaseId: plain.pmsLeaseId,
          balanceCents: Number(plain.balanceCents) || 0,
          asOfDate: plain.asOfDate,
          currency: plain.currency || 'USD',
          pmsLease: plain.pmsLease,
        };
      }),
    };
  },
};
