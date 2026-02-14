import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
];

const validateEnvVars = () => {
  // Solo validar variables de DB si está habilitada
  const dbEnabled = process.env.DB_ENABLED !== 'false';
  
  if (dbEnabled) {
    const missing = requiredEnvVars.filter((key) => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(
        `Environment variables missing: ${missing.join(', ')}`
      );
    }
  }
};

// Validar solo en producción o si se especifica
if (process.env.NODE_ENV === 'production' || process.env.VALIDATE_ENV === 'true') {
  validateEnvVars();
}

export const config = {
  app: {
    name: process.env.APP_NAME || 'Mordecai API',
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
  },
  db: {
    enabled: process.env.DB_ENABLED !== 'false', // Por defecto habilitado, deshabilitar con DB_ENABLED=false
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    pool: {
      acquire: Number(process.env.PG_POOL_ACQUIRE) || 60000,
      idle: Number(process.env.PG_POOL_IDLE) || 10000,
      max: Number(process.env.PG_POOL_MAX) || 10,
      min: Number(process.env.PG_POOL_MIN) || 0,
    },
    logging: process.env.DB_LOGGING === 'true',
    sync: {
      // Opciones: 'alter', 'force', false
      // 'alter': modifica tablas existentes
      // 'force': elimina y recrea tablas (¡CUIDADO en producción!)
      // false: no sincroniza (usa migraciones)
      // process.env.DB_SYNC_MODE es siempre string; 'false' y '' deben ser false
      mode: (() => {
        const v = process.env.DB_SYNC_MODE;
        if (!v || v === 'false' || v === '0') return false;
        return v;
      })(),
    },
  },
  cors: {
    origin:
      process.env.CORS_ORIGIN ||
      (process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:8080'),
    credentials:
      process.env.CORS_CREDENTIALS === 'true' ||
      (process.env.NODE_ENV !== 'production' && !process.env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minuto
    max: Number(process.env.RATE_LIMIT_MAX) || 100, // 100 requests por minuto
  },
  // PMS credentials at rest: base64-encoded 32-byte key. Generate: openssl rand -base64 32
  credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY || null,
};

