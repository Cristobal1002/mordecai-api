# Complete .env Template for Mordecai

Copy this entire configuration to your `.env` file in the project root:

```env
# ===========================================
# MORDECAI API - COMPLETE ENVIRONMENT CONFIGURATION
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

# PostgreSQL Pool Configuration
PG_POOL_MAX=10
PG_POOL_MIN=0
PG_POOL_ACQUIRE=60000
PG_POOL_IDLE=10000

# ===========================================
# JWT CONFIGURATION
# ===========================================
JWT_SECRET=mordecai-super-secret-jwt-key-2024-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===========================================
# FIREBASE CONFIGURATION - ALL VARIABLES
# ===========================================
# Use environment variables instead of JSON file
FIREBASE_USE_ENV_VARS=true

# Firebase Service Account Configuration
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
# ENVIRONMENT VALIDATION
# ===========================================
VALIDATE_ENV=false
```

## Instructions

1. **Create .env file:**
   ```bash
   touch .env
   ```

2. **Copy the entire configuration above** into your `.env` file

3. **Update these values:**
   - `DB_PASSWORD` - Your PostgreSQL password
   - `JWT_SECRET` - A strong, unique secret key
   - `FIREBASE_PROJECT_ID` - Your Firebase project ID
   - `FIREBASE_PRIVATE_KEY_ID` - From your Firebase service account JSON
   - `FIREBASE_PRIVATE_KEY` - Your Firebase private key (keep the \n characters)
   - `FIREBASE_CLIENT_EMAIL` - Your Firebase service account email
   - `FIREBASE_CLIENT_ID` - Your Firebase client ID
   - `FIREBASE_CLIENT_X509_CERT_URL` - Your Firebase cert URL
   - Any other values specific to your setup

4. **Save the file** and start your server:
   ```bash
   npm run dev
   ```

## What's Included

✅ **All App Configuration**  
✅ **Complete PostgreSQL Setup**  
✅ **JWT Security Settings**  
✅ **All Firebase Variables** (extracted from your JSON file)  
✅ **Authentication Settings**  
✅ **CORS Configuration**  
✅ **Rate Limiting**  
✅ **Environment Validation**  

## Security Notes

🔒 **Never commit this .env file to Git**  
🔒 **Change JWT_SECRET in production**  
🔒 **Use strong database passwords**  
🔒 **Keep Firebase credentials secure**  

Your Mordecai project will now use **only environment variables** - no JSON files needed! 🚀

## How to Get Firebase Values

To get your Firebase credentials:

1. **Go to Firebase Console** → Your Project → Project Settings
2. **Service Accounts tab** → Generate new private key
3. **Download the JSON file** and extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key_id` → `FIREBASE_PRIVATE_KEY_ID` 
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `client_id` → `FIREBASE_CLIENT_ID`
   - `client_x509_cert_url` → `FIREBASE_CLIENT_X509_CERT_URL`

4. **⚠️ Important**: Keep your Firebase JSON file secure and never commit it to Git!
