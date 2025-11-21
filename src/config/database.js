import { Sequelize } from 'sequelize';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let sequelize = null;

if (config.db.enabled) {
  if (!config.db.name || !config.db.user || !config.db.password || !config.db.host) {
    logger.warn('Database is enabled but configuration is incomplete. Database connection will not be initialized.');
  } else {
    sequelize = new Sequelize(
      config.db.name,
      config.db.user,
      config.db.password,
      {
        host: config.db.host,
        port: config.db.port,
        dialect: config.db.dialect,
        pool: config.db.pool,
        logging: config.db.logging ? (msg) => logger.debug(msg) : false,
      }
    );
  }
} else {
  logger.info('Database is disabled (DB_ENABLED=false). Skipping database initialization.');
}

export { sequelize };
