#!/usr/bin/env node
/**
 * Truncate PM Manager tables - uses same DB config as API (dotenv + Sequelize)
 * Run: cd mordecai-api && node scripts/truncate-pm-manager.js
 */
import { config } from 'dotenv';
import { Sequelize } from 'sequelize';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');

config({ path: join(apiRoot, '.env') });

const db = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

if (!db.host || !db.name || !db.user || !db.password) {
  console.error('Missing DB_HOST, DB_NAME, DB_USER or DB_PASSWORD in .env');
  process.exit(1);
}

const sequelize = new Sequelize(db.name, db.user, db.password, {
  host: db.host,
  port: Number(db.port),
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
  },
});

const sqlPath = join(apiRoot, '..', 'scripts', 'truncate_pm_manager_tables.sql');
if (!existsSync(sqlPath)) {
  console.error('SQL file not found:', sqlPath);
  process.exit(1);
}
const sql = readFileSync(sqlPath, 'utf8');

async function run() {
  try {
    await sequelize.authenticate();
    console.log(`Connected to ${db.name}. Truncating PM Manager tables...`);
    await sequelize.query(sql);
    console.log('Done. Run a full PMS sync to reload data.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
