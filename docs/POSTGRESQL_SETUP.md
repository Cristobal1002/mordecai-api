# PostgreSQL Setup for Mordecai

## Database Configuration

Mordecai is configured to use **PostgreSQL** as the primary database with Sequelize ORM.

## Prerequisites

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Or use Chocolatey
choco install postgresql
```

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```sql
-- Connect to PostgreSQL as superuser
sudo -u postgres psql

-- Create database for Mordecai
CREATE DATABASE mordecai_db;

-- Create user for Mordecai
CREATE USER mordecai_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mordecai_db TO mordecai_user;

-- Grant schema privileges
\c mordecai_db
GRANT ALL ON SCHEMA public TO mordecai_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mordecai_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mordecai_user;

-- Exit
\q
```

## Environment Configuration

Update your `.env` file with PostgreSQL credentials:

```env
# Database Configuration
DB_NAME=mordecai_db
DB_USER=mordecai_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_LOGGING=false
DB_SYNC_MODE=alter

# PostgreSQL Pool Configuration (optional)
PG_POOL_MAX=10
PG_POOL_MIN=0
PG_POOL_ACQUIRE=60000
PG_POOL_IDLE=10000
```

## Database Schema

The following tables will be created automatically when you start the server:

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    firebase_uid VARCHAR(255) UNIQUE,
    provider VARCHAR(255) CHECK (provider IN ('email', 'google')) DEFAULT 'email',
    email_verified BOOLEAN DEFAULT false,
    profile_picture VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_is_active ON users(is_active);
```

## Connection Pool Configuration

Mordecai uses connection pooling for optimal performance:

```javascript
pool: {
  max: 10,        // Maximum number of connections
  min: 0,         // Minimum number of connections
  acquire: 60000, // Maximum time to get connection (ms)
  idle: 10000,    // Maximum time connection can be idle (ms)
}
```

## Database Sync Modes

Configure `DB_SYNC_MODE` in your environment:

- **`false`** (Recommended for production): No automatic sync, use migrations
- **`alter`** (Development): Modify existing tables to match models
- **`force`** (⚠️ Dangerous): Drop and recreate all tables

## Testing Database Connection

Create a simple test script to verify your PostgreSQL connection:

```javascript
// test-db.js
import { sequelize } from './src/config/database.js';

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful!');
    
    // Test query
    const result = await sequelize.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result[0][0].version);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error);
  }
}

testConnection();
```

Run the test:
```bash
node test-db.js
```

## Common PostgreSQL Commands

### Connect to Database
```bash
# Connect as mordecai_user
psql -h localhost -U mordecai_user -d mordecai_db

# Connect as postgres superuser
sudo -u postgres psql
```

### Useful Queries
```sql
-- List all databases
\l

-- Connect to mordecai_db
\c mordecai_db

-- List all tables
\dt

-- Describe users table
\d users

-- Check current connections
SELECT * FROM pg_stat_activity WHERE datname = 'mordecai_db';

-- View all users
SELECT id, email, first_name, last_name, provider, email_verified, is_active, created_at FROM users;
```

## Backup and Restore

### Create Backup
```bash
# Full database backup
pg_dump -h localhost -U mordecai_user -d mordecai_db > mordecai_backup.sql

# Schema only
pg_dump -h localhost -U mordecai_user -d mordecai_db --schema-only > mordecai_schema.sql

# Data only
pg_dump -h localhost -U mordecai_user -d mordecai_db --data-only > mordecai_data.sql
```

### Restore Backup
```bash
# Restore full backup
psql -h localhost -U mordecai_user -d mordecai_db < mordecai_backup.sql
```

## Performance Optimization

### Recommended PostgreSQL Settings

Add to your `postgresql.conf`:

```conf
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# Connections
max_connections = 100

# Logging
log_statement = 'all'  # For development only
log_duration = on      # For development only
```

### Indexes for Authentication

The User model automatically creates these indexes:

```sql
-- Unique indexes (automatically created)
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- Performance indexes (consider adding)
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Start PostgreSQL
   sudo systemctl start postgresql
   ```

2. **Authentication Failed**
   ```bash
   # Check pg_hba.conf for authentication methods
   sudo nano /etc/postgresql/*/main/pg_hba.conf
   ```

3. **Database Does Not Exist**
   ```sql
   -- Create database if it doesn't exist
   CREATE DATABASE mordecai_db;
   ```

4. **Permission Denied**
   ```sql
   -- Grant all privileges to user
   GRANT ALL PRIVILEGES ON DATABASE mordecai_db TO mordecai_user;
   ```

### Debug Connection Issues

Enable detailed logging in your `.env`:

```env
DB_LOGGING=true
NODE_ENV=development
```

This will show all SQL queries in the console.

## Production Considerations

1. **Use SSL connections**
2. **Set up read replicas for scaling**
3. **Configure proper backup strategy**
4. **Monitor connection pool usage**
5. **Use environment-specific databases**
6. **Enable query logging and monitoring**

## Next Steps

1. ✅ PostgreSQL is already configured in Mordecai
2. ✅ User authentication table schema is ready
3. ✅ Connection pooling is optimized
4. 🔄 Create your database and user
5. 🔄 Update your `.env` file
6. 🔄 Start the Mordecai server
7. 🔄 Test the authentication endpoints

Your Mordecai project is ready to use PostgreSQL! 🚀
