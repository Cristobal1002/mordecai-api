/**
 * Service - Capa de lógica de negocio
 * 
 * Este archivo contiene toda la lógica de negocio.
 * Aquí se validan reglas de negocio, se procesan datos, etc.
 */
import { exampleRepository } from './example.repository.js';
import { buildPagination, buildMeta } from '../../utils/pagination.js';
import { BadRequestError, NotFoundError, DatabaseError } from '../../errors/http.error.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const create = async (data) => {
  // Verificar que la base de datos esté habilitada
  if (!config.db.enabled) {
    throw new DatabaseError('Database is disabled. Enable it in your .env file (DB_ENABLED=true)');
  }

  // Validaciones de negocio
  if (!data.name || data.name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  logger.debug({ data }, 'Creating new example');

  // Crear el registro
  const example = await exampleRepository.create(data);

  logger.info({ exampleId: example.id }, 'Example created successfully');

  return example;
};

const list = async (query) => {
  // Verificar que la base de datos esté habilitada
  if (!config.db.enabled) {
    throw new DatabaseError('Database is disabled. Enable it in your .env file (DB_ENABLED=true)');
  }

  const { page, perPage, name, status } = query;

  logger.debug({ query }, 'Listing examples with filters');

  // Construir paginación
  const pagination = buildPagination(page, perPage);

  // Construir filtros
  const filters = {
    name,
    status,
  };

  // Obtener datos paginados
  const { rows, count } = await exampleRepository.findAllPaginated(
    filters,
    pagination
  );

  logger.info({ count, page: pagination.currentPage }, 'Examples retrieved successfully');

  // Construir respuesta con metadata
  return {
    items: rows,
    meta: buildMeta({
      count,
      limit: pagination.limit,
      currentPage: pagination.currentPage,
    }),
  };
};

const getById = async (id) => {
  // Verificar que la base de datos esté habilitada
  if (!config.db.enabled) {
    throw new DatabaseError('Database is disabled. Enable it in your .env file (DB_ENABLED=true)');
  }

  if (!id) {
    throw new BadRequestError('Id is required');
  }

  logger.debug({ id }, 'Fetching example by ID');

  const example = await exampleRepository.findById(id);
  if (!example) {
    logger.warn({ id }, 'Example not found');
    throw new NotFoundError('Example not found');
  }

  return example;
};

const update = async (id, data) => {
  // Verificar que la base de datos esté habilitada
  if (!config.db.enabled) {
    throw new DatabaseError('Database is disabled. Enable it in your .env file (DB_ENABLED=true)');
  }

  if (!id) {
    throw new BadRequestError('Id is required');
  }

  logger.debug({ id, data }, 'Updating example');

  // Verificar que existe
  const existing = await exampleRepository.findById(id);
  if (!existing) {
    logger.warn({ id }, 'Example not found for update');
    throw new NotFoundError('Example not found');
  }

  // Actualizar
  const [affected] = await exampleRepository.update(id, data);
  if (!affected) {
    throw new NotFoundError('Example not found');
  }

  logger.info({ id }, 'Example updated successfully');

  // Retornar el registro actualizado
  return exampleRepository.findById(id);
};

const softDelete = async (id) => {
  // Verificar que la base de datos esté habilitada
  if (!config.db.enabled) {
    throw new DatabaseError('Database is disabled. Enable it in your .env file (DB_ENABLED=true)');
  }

  if (!id) {
    throw new BadRequestError('Id is required');
  }

  logger.debug({ id }, 'Soft deleting example');

  const [affected] = await exampleRepository.softDelete(id);
  if (!affected) {
    logger.warn({ id }, 'Example not found for deletion');
    throw new NotFoundError('Example not found');
  }

  logger.info({ id }, 'Example deleted successfully');
};

export const exampleService = {
  create,
  list,
  getById,
  update,
  softDelete,
};

