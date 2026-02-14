/**
 * Property-managers service — Capa 2: conexiones reales por tenant.
 * CRUD pms_connections, testConnection. triggerSync solo pone status syncing;
 * el worker en mordecai-workers (BullMQ/Upstash) consume y ejecuta el sync.
 */
import { PmsConnection, Software } from '../../models/index.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { getConnector, hasConnector } from './connectors/connector.factory.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors/index.js';

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

  create: async (tenantId, body) => {
    await ensureTenant(tenantId);
    const { softwareKey, credentials = null, status = 'draft' } = body;
    if (!softwareKey) throw new BadRequestError('softwareKey is required');

    const software = await getSoftwareByKey(softwareKey);
    const existing = await PmsConnection.findOne({
      where: { tenantId, softwareId: software.id },
    });
    if (existing) {
      throw new ConflictError('A connection for this software already exists for this tenant');
    }

    const connection = await PmsConnection.create({
      tenantId,
      softwareId: software.id,
      status: status || 'draft',
      credentials: credentials ?? null,
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
    await connection.update({
      credentials: credentials ?? connection.credentials,
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

  testConnection: async (tenantId, connectionId) => {
    const connection = await propertyManagersService.getById(tenantId, connectionId);
    const software = await Software.findByPk(connection.softwareId);
    if (!software) throw new NotFoundError('Software');

    if (!hasConnector(software.key)) {
      throw new BadRequestError(`Connector not available for software: ${software.key}`);
    }
    const connector = getConnector(software.key, connection);
    return await connector.testConnection();
  },

  /**
   * Marca la conexión como syncing. El worker en mordecai-workers (BullMQ/Upstash)
   * es el que encola y procesa el job; puede usar status=syncing para detectar pendientes
   * o encolar por otro mecanismo.
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

    await connection.update({ status: 'syncing', lastError: null });
    return {
      enqueued: true,
      connectionId: connection.id,
      status: 'syncing',
      message:
        'Sync requested. The worker (mordecai-workers) will process the job via BullMQ/Upstash.',
    };
  },
};
