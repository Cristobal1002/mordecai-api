import * as dotenv from 'dotenv';
dotenv.config();

import { startServer } from './src/server.js';
import { logger } from './src/utils/logger.js';

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

startServer().catch((error) => {
  logger.fatal({ error }, 'Error fatal starting the server');
  process.exit(1);
});