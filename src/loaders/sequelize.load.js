import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { initModels } from '../models/index.js';

export const loadDatabase = async () => {
  try {
    logger.info('Connecting to PostgreSQL...');
    await sequelize.authenticate();
    logger.info('Database connected');

    // Inicializa modelos
    initModels(sequelize);
    logger.info('Models initialized');

    // Sincronizar modelos con la base de datos
    if (config.db.sync.mode) {
      logger.info('Synchronizing models...');
      
      const syncOptions = {};
      
      if (config.db.sync.mode === 'alter') {
        syncOptions.alter = true;
        logger.warn(' this option will modify existing tables');
      } else if (config.db.sync.mode === 'force') {
        syncOptions.force = true;
        logger.error('Using sync with force=true (will delete all tables)');
        if (config.app.nodeEnv === 'production') {
          throw new Error('Don\'t allow sync with force=true in production');
        }
      }
      
      await sequelize.sync(syncOptions);
      logger.info('Models synchronized with the database');
    } else {
      logger.info('Sync disabled (use migrations for changes in the database)');
    }
  } catch (error) {
    logger.error({ error }, 'Error loading the database');
    throw error;
  }
};

