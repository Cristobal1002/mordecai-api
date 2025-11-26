# Environment Variables for Mordecai

## Required Environment Variables

Create a `.env` file in the root directory of your Mordecai project with the following variables:

```env
# ===========================================
# MORDECAI API - ENVIRONMENT VARIABLES
# ===========================================

# ===========================================
# APP CONFIGURATION
# ===========================================
APP_NAME=Mordecai API
PORT=3000
NODE_ENV=development
API_VERSION=v1

# ===========================================
# DATABASE CONFIGURATION (PostgreSQL)
# ===========================================
DB_NAME=mordecai_db
DB_USER=mordecai_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432
DB_LOGGING=false
DB_SYNC_MODE=alter

# PostgreSQL Pool Configuration (Optional)
PG_POOL_MAX=10
PG_POOL_MIN=0
PG_POOL_ACQUIRE=60000
PG_POOL_IDLE=10000

# ===========================================
# JWT CONFIGURATION
# ===========================================
# IMPORTANT: Change this in production!
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production-mordecai-2024
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===========================================
# FIREBASE CONFIGURATION
# ===========================================
# Option 1: Use environment variables (RECOMMENDED for production)
FIREBASE_USE_ENV_VARS=true
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=testing-multi-provider
FIREBASE_PRIVATE_KEY_ID=88c3e328cac3f6aac8f3baffdb1e508aaf1aa22b
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@testing-multi-provider.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=107391307607145476208
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40testing-multi-provider.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com

# Option 2: Use JSON file (fallback)
# FIREBASE_USE_ENV_VARS=false
# FIREBASE_SERVICE_ACCOUNT_PATH=./testing-multi-provider-firebase-adminsdk-fbsvc-88c3e328ca.json

# ===========================================
# AUTHENTICATION CONFIGURATION
# ===========================================
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=1800000

# ===========================================
# CORS CONFIGURATION
# ===========================================
CORS_ORIGIN=*
CORS_CREDENTIALS=false

# ===========================================
# RATE LIMITING
# ===========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ===========================================
# EMAIL CONFIGURATION (Nodemailer with Gmail)
# ===========================================
EMAIL_ENABLED=true
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Mordecai

# ===========================================
# ENVIRONMENT VALIDATION
# ===========================================
# Set to 'true' to validate required env vars in development
VALIDATE_ENV=false
```

## Variable Descriptions

### App Configuration
- **APP_NAME**: Name of your application (Mordecai API)
- **PORT**: Port where the server will run (default: 3000)
- **NODE_ENV**: Environment mode (development/production)
- **API_VERSION**: API version for routing (v1)

### Database Configuration (PostgreSQL)
- **DB_NAME**: PostgreSQL database name
- **DB_USER**: PostgreSQL username
- **DB_PASSWORD**: PostgreSQL password
- **DB_HOST**: Database host (usually localhost)
- **DB_PORT**: PostgreSQL port (default: 5432)
- **DB_LOGGING**: Enable/disable SQL query logging
- **DB_SYNC_MODE**: Database synchronization mode
  - `false`: No sync (use migrations)
  - `alter`: Modify existing tables
  - `force`: Drop and recreate tables (⚠️ Dangerous)

### JWT Configuration
- **JWT_SECRET**: Secret key for signing JWT tokens (⚠️ MUST be changed in production)
- **JWT_EXPIRES_IN**: Access token expiration time
- **JWT_REFRESH_EXPIRES_IN**: Refresh token expiration time

### Firebase Configuration

**Option 1: Environment Variables (Recommended for production)**
- **FIREBASE_USE_ENV_VARS**: Set to `true` to use environment variables instead of JSON file
- **FIREBASE_TYPE**: Service account type (usually `service_account`)
- **FIREBASE_PROJECT_ID**: Your Firebase project ID
- **FIREBASE_PRIVATE_KEY_ID**: Private key ID from Firebase service account
- **FIREBASE_PRIVATE_KEY**: Private key from Firebase service account (keep the `\n` characters)
- **FIREBASE_CLIENT_EMAIL**: Client email from Firebase service account
- **FIREBASE_CLIENT_ID**: Client ID from Firebase service account
- **FIREBASE_AUTH_URI**: OAuth2 auth URI (default provided)
- **FIREBASE_TOKEN_URI**: OAuth2 token URI (default provided)
- **FIREBASE_AUTH_PROVIDER_X509_CERT_URL**: Auth provider cert URL (default provided)
- **FIREBASE_CLIENT_X509_CERT_URL**: Client cert URL from Firebase service account
- **FIREBASE_UNIVERSE_DOMAIN**: Universe domain (usually `googleapis.com`)

**Option 2: JSON File (Fallback)**
- **FIREBASE_SERVICE_ACCOUNT_PATH**: Path to Firebase service account JSON file

### Authentication Configuration
- **BCRYPT_ROUNDS**: Number of rounds for password hashing (higher = more secure but slower)
- **MAX_LOGIN_ATTEMPTS**: Maximum failed login attempts before account lockout
- **LOCKOUT_TIME**: Account lockout duration in milliseconds

### CORS Configuration
- **CORS_ORIGIN**: Allowed origins for CORS (* for all origins)
- **CORS_CREDENTIALS**: Allow credentials in CORS requests

### Rate Limiting
- **RATE_LIMIT_WINDOW_MS**: Time window for rate limiting in milliseconds
- **RATE_LIMIT_MAX**: Maximum number of requests per window

### Email Configuration (Nodemailer with Gmail)
- **EMAIL_ENABLED**: Enable/disable email service (default: `true`). Set to `false` to disable sending emails
- **EMAIL_SERVICE**: Email service provider (default: `gmail`)
- **EMAIL_HOST**: SMTP host (default: `smtp.gmail.com`)
- **EMAIL_PORT**: SMTP port (default: `587` for Gmail)
- **EMAIL_SECURE**: Use secure connection (default: `false` for port 587, `true` for port 465)
- **EMAIL_USER**: Gmail address to send emails from
- **EMAIL_PASSWORD**: Gmail App Password (⚠️ NOT your regular Gmail password). Generate at: https://myaccount.google.com/apppasswords
- **EMAIL_FROM**: Sender email address (defaults to EMAIL_USER if not set)
- **EMAIL_FROM_NAME**: Display name for sender (default: `Mordecai`)

**Important:** To use Gmail, you need to:
1. Enable 2-Step Verification in your Google account
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Use the App Password (16 characters) as `EMAIL_PASSWORD`
- **RATE_LIMIT_MAX**: Maximum requests per time window

## Setup Instructions

### 1. Create .env file
```bash
# In your project root directory
touch .env
```

### 2. Copy the variables above into your .env file

### 3. Update the values
- Replace `your_secure_password_here` with your actual PostgreSQL password
- Replace `your-super-secret-jwt-key-here-change-this-in-production-mordecai-2024` with a strong, unique secret
- Update database credentials to match your PostgreSQL setup
- Adjust other values as needed for your environment

### 4. Secure your .env file
```bash
# Make sure .env is in your .gitignore
echo ".env" >> .gitignore
```

## Environment-Specific Configurations

### Development Environment
```env
NODE_ENV=development
DB_LOGGING=true
DB_SYNC_MODE=alter
VALIDATE_ENV=false
CORS_ORIGIN=*
```

### Production Environment
```env
NODE_ENV=production
DB_LOGGING=false
DB_SYNC_MODE=false
VALIDATE_ENV=true
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
JWT_SECRET=your-super-strong-production-secret-key-here
```

## Security Best Practices

### JWT Secret
- Use a strong, random string (at least 32 characters)
- Different secret for each environment
- Never commit secrets to version control

### Database Credentials
- Use strong passwords
- Create dedicated database users with minimal privileges
- Use SSL connections in production

### Firebase
- Keep service account files secure
- Use different Firebase projects for different environments
- Regularly rotate service account keys

## Validation

The application will validate required environment variables on startup if `VALIDATE_ENV=true`. Required variables are:
- DB_NAME
- DB_USER
- DB_PASSWORD
- DB_HOST
- JWT_SECRET
- FIREBASE_PROJECT_ID
- FIREBASE_SERVICE_ACCOUNT_PATH

## Troubleshooting

### Common Issues

1. **Missing .env file**
   ```
   Error: Cannot find module 'dotenv'
   ```
   Solution: Create `.env` file in project root

2. **Invalid JWT_SECRET**
   ```
   Error: JWT_SECRET is required
   ```
   Solution: Set a strong JWT_SECRET in your `.env` file

3. **Database connection failed**
   ```
   Error: Unable to connect to database
   ```
   Solution: Check your PostgreSQL credentials and ensure the database exists

4. **Firebase initialization failed**
   ```
   Error: Firebase initialization failed
   ```
   Solution: Check your Firebase service account path and project ID

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
DB_LOGGING=true
```

This will show all SQL queries and detailed error messages in the console.
