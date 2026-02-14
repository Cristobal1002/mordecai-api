/**
 * Property-managers service — Capa 2: conexiones reales por tenant.
 * CRUD pms_connections, testConnection. triggerSync encola job pms-sync;
 * el worker en mordecai-workers procesa el job y ejecuta runSync (4 pasos).
 * Credentials are encrypted at rest (AES-256-GCM) and never returned to the client.
 */
import { PmsConnection, Software } from '../../models/index.js';
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
   */
  triggerSync: async (tenantId, connectionId) => {
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

    const jobId = await addPmsSyncJob(connectionId, tenantId);
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
};
