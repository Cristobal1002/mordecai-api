import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { initModels } from '../models/index.js';

export const loadDatabase = async () => {
  // Si la base de datos no está habilitada, salir sin hacer nada
  if (!config.db.enabled) {
    logger.info('Database is disabled. Skipping database connection.');
    return;
  }

  // Si sequelize es null, significa que la configuración está incompleta
  if (!sequelize) {
    logger.warn('Database is enabled but configuration is incomplete. Skipping database connection.');
    return;
  }

  try {
    logger.info('Connecting to PostgreSQL...');
    await sequelize.authenticate();
    logger.info('Database connected');

    // Inicializa modelos
    initModels(sequelize);
    logger.info('Models initialized');

    logger.info({ enabled: config.db.enabled, mode: config.db.sync.mode }, 'DB config');
    // Sincronizar modelos con la base de datos
    if (config.db.sync.mode) {
      const mode = config.db.sync.mode;
      logger.info({ syncMode: mode }, 'Database sync: starting model synchronization');
      if (mode !== 'alter' && mode !== 'force') {
        logger.warn(
          'Database sync: mode is not "alter". Existing tables will NOT be updated (new columns in models will not be applied). Use DB_SYNC_MODE=alter to apply schema changes.'
        );
      }

      const syncOptions = {
        logging: (sql) => {
          const s = String(sql);
          const createMatch = s.match(/CREATE TABLE (?:IF NOT EXISTS )?"?(\w+)"?/i);
          const alterMatch = s.match(/ALTER TABLE "?(\w+)"?/i);
          const selectTableMatch = s.match(/table_name = '(\w+)'/);
          const relnameMatch = s.match(/t\.relname = '(\w+)'/);
          if (createMatch) {
            logger.info({ table: createMatch[1], sql: s }, 'Database sync: creating table');
          } else if (alterMatch) {
            logger.info({ table: alterMatch[1], sql: s }, 'Database sync: altering table');
          } else if (selectTableMatch) {
            logger.info({ table: selectTableMatch[1] }, 'Database sync: table exists (no change)');
          } else if (relnameMatch) {
            logger.info({ table: relnameMatch[1] }, 'Database sync: table indexes checked');
          } else {
            logger.info({ sql: s }, 'Database sync: executing SQL');
          }
        },
      };

      if (mode === 'alter') {
        syncOptions.alter = true;
        logger.warn('Database sync: alter=true will modify existing tables');
      } else if (mode === 'force') {
        syncOptions.force = true;
        logger.error('Database sync: force=true will drop and recreate all tables');
        if (config.app.nodeEnv === 'production') {
          throw new Error('Don\'t allow sync with force=true in production');
        }
      }

      await sequelize.sync(syncOptions);
      logger.info({ syncMode: mode }, 'Database sync: models synchronized successfully');
    } else {
      logger.info('Database sync disabled (use migrations for schema changes)');
    }
  } catch (error) {
    logger.error(
      {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        err: error,
      },
      'Error loading the database'
    );
    throw error;
  }
};

