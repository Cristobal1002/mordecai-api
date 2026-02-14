/**
 * Connector factory — resuelve el connector por software.key.
 * No hardcodear lógica de proveedor en el core; solo key → connector.
 */
import { getBuildiumConnector } from './buildium/buildium.connector.js';
import { getRentvineConnector } from './rentvine/rentvine.connector.js';
import { logger } from '../../../utils/logger.js';

const registry = {
  buildium: getBuildiumConnector,
  rentvine: getRentvineConnector,
};

export function getConnector(softwareKey, connection) {
  const normalizedKey = String(softwareKey).toLowerCase().trim();
  const factory = registry[normalizedKey];

  if (!factory) {
    logger.warn({ softwareKey: normalizedKey }, 'No connector registered for software key');
    throw new Error(`No connector registered for software: ${normalizedKey}`);
  }

  return factory(connection);
}

export function hasConnector(softwareKey) {
  const normalizedKey = String(softwareKey).toLowerCase().trim();
  return Boolean(registry[normalizedKey]);
}
