# Mordecai API - Quick Start Guide

## 🚀 Get Mordecai API running in 5 minutes

### Step 1: Create .env file
```bash
# Create .env file in project root
touch .env
```

### Step 2: Copy this COMPLETE configuration to your .env file

📋 **[Get Complete .env Template →](./COMPLETE_ENV_TEMPLATE.md)**

Or copy this directly:

```env
# ===========================================
# MORDECAI API - COMPLETE CONFIGURATION
# ===========================================

# App Configuration
APP_NAME=Mordecai API
PORT=3000
NODE_ENV=development
API_VERSION=v1

# PostgreSQL Database
DB_NAME=mordecai_db
DB_USER=mordecai_user
DB_PASSWORD=mordecai123
DB_HOST=localhost
DB_PORT=5432
DB_SYNC_MODE=alter

# JWT Security
JWT_SECRET=mordecai-super-secret-jwt-key-2024-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Firebase - ALL VARIABLES (no JSON file needed!)
FIREBASE_USE_ENV_VARS=true
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_FIREBASE_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id-here
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com

# Authentication & Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=1800000
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
VALIDATE_ENV=false
```

### Step 3: Setup PostgreSQL Database
```sql
-- Connect to PostgreSQL
sudo -u postgres psql

-- Create database and user
CREATE DATABASE mordecai_db;
CREATE USER mordecai_user WITH PASSWORD 'mordecai123';
GRANT ALL PRIVILEGES ON DATABASE mordecai_db TO mordecai_user;

-- Exit
\q
```

### Step 4: Start Mordecai
```bash
npm run dev
```

### Step 5: Test Mordecai API
Open your browser and go to:
```
http://localhost:3000/api/v1/health
```

You should see:
```json
{
  "success": true,
  "message": "Mordecai API is healthy",
  "data": {
    "status": "OK",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🧪 Test Authentication

### Import Postman Collection
1. Open Postman
2. Import `docs/postman-collection.json`
3. Import `docs/postman-environment.json`
4. Set environment to "Firebase Auth Environment"

### Test Mordecai User Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@mordecai.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Mordecai User Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@mordecai.com",
    "password": "Test123!"
  }'
```

## 🔧 Customization

### Change Database Password
1. Update `DB_PASSWORD` in `.env`
2. Update PostgreSQL user password:
   ```sql
   ALTER USER mordecai_user WITH PASSWORD 'your_new_password';
   ```

### Change JWT Secret
1. Generate a strong secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in `.env`

### Enable Firebase Google Sign-In
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (testing-multi-provider)
3. Go to Authentication > Sign-in method
4. Enable Google provider
5. Add your domain to authorized domains

## 📚 Next Steps

- [Complete Setup Guide](./README.md)
- [Environment Variables](./ENV_VARIABLES.md)
- [PostgreSQL Setup](./POSTGRESQL_SETUP.md)
- [API Documentation](./API_DOCUMENTATION.md)

## 🆘 Troubleshooting

### Server won't start
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Verify database exists: `psql -U mordecai_user -d mordecai_db`
- Check .env file exists and has correct values

### Authentication errors
- Verify Firebase service account file exists
- Check JWT_SECRET is set
- Ensure database connection is working

### Database errors
- Create database: `CREATE DATABASE mordecai_db;`
- Create user: `CREATE USER mordecai_user WITH PASSWORD 'mordecai123';`
- Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE mordecai_db TO mordecai_user;`

## 🎉 You're Ready!

Mordecai API is now running with:
- ✅ PostgreSQL database
- ✅ Firebase authentication
- ✅ JWT token management
- ✅ Email/password registration
- ✅ Google Sign-In ready
- ✅ Complete API endpoints
- ✅ Security features enabled
- ✅ Soft delete functionality
- ✅ Role-based authorization

Happy coding with Mordecai! 🚀
