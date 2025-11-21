# Firebase Environment Variables Setup for Mordecai

## Why Use Environment Variables for Firebase?

✅ **More Secure**: No sensitive files in your repository  
✅ **Better for Production**: Environment-specific configurations  
✅ **Easier Deployment**: No need to manage JSON files  
✅ **Version Control Safe**: Credentials never committed to Git  

## Setup Options

### Option 1: Environment Variables (Recommended)

Add these variables to your `.env` file:

```env
# ===========================================
# FIREBASE CONFIGURATION - ENVIRONMENT VARIABLES
# ===========================================
FIREBASE_USE_ENV_VARS=true
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=testing-multi-provider
FIREBASE_PRIVATE_KEY_ID=88c3e328cac3f6aac8f3baffdb1e508aaf1aa22b
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCf/bL6pNija+6/\n36pUG2oBk6sNCUpbkH2BGcZK8G9gKY3PDUkNFS3GasVtd4MoIlbQPIPlI3MhKRIG\nl+vqbf+U97NHt+GhvhQThxnGEAUAOsFlxkxVtHZe9t3VVMpMqCZ2unBkOp6rbxCV\n2gU8zTlIKHu4B/2p2VXbKq3G+dbXe+6VV5lNIl9q9V+oPGAQ7cVshhlg8QXgjYcy\nJxLkSnsDhCNIsuKjBj7Q41ypl9ue5KzRGeV2dGfPeHgC8ciChHCUK6Iw3yASTsRp\nk6uYMCbbj4j+RPKKJR3zNc10jjPvnsya8yPtQ++hUIZ7tiEaiRxga5c8jm/7bVcL\nydBM91M9AgMBAAECggEAHk5aHijmQZSTKeTmGJ8Fxk0w2FwTagNVhsQ5X94qFsrg\nSiGP3irOHDkC82CxZ0OT8seXy2qa5yPmvnl+Lo7OHGuMWhA+rRr6phVQIEjODbRT\niKIWuSBhUM1OCZhRZtJuUMyxuAazojE8cMpW9iTAzkae4uYempMo9IZh2yBd3jzW\npcw0rYzHpp67flK5KQFk5Sct8DRj1C8wkwU+QD9JZY8/pKXI3OQ6anWU3AShumA/\nwY+3fn1Ue4fZOUMxBvJIoO6xgiNJZV2xh0h3rt8cWonWTa9w0wj9IKH9N6jR8pLf\nAuZpTI6qAUOpRt24xdaRhA1kIbArIRJh+s833Y44kQKBgQDRe1IceExqvYa7fl/d\nRDPHeDDUYB7cNqwAHxObpgGjp/UNNgDiXys93eJ6rzshTzrF0BhxOB2l+pm3Vv0u\nZbqy+NoOgScYbVRCpDo31F8NPs1nedSjpLCES6+aNmnM1dh1MXOpMUhUrGIi00zh\nPomq7SR5mLvr+trkCIRKqN5aTQKBgQDDhOpyv1QVMxe1ioZxREnlUjSiWpMCQnVz\nS1CFNZokv34hlkw+hIMfyOZOLpDNXYGdmG39JSiXZ95ZtNmoxC0mZ9s3UOfVuh+/\nDZ9hWm9gHTH24crM1QOCPcpYzTqFrzuJYKHgiGYlEguX9V7WgMmGtWMQe1djfiF5\nOJWTe5B0sQKBgGuMg/Cn9pvKqFS0oiUosejUFUXD/7QRwabiTZ/Yz/ik75QTyMpw\nD/RYacGRG6uTUNpkZ1ghdl9T1P2jBKOAiST/zHwr5NWOs/bu+BDX0OEtACoDC5/k\nmtehQAvNqe4HUHWCqR4RdlA6nLvCfjMad3WxAMwJFVonVaBDmx/1qQr1AoGAEZiC\nqPUDEi1Y8uOWmdb1d4fgaMQR+uAURd3/Tx2105zQMyGdlvrB+jhQUbTrHzBNG+u9\n6kxPzOByKEyYUhHlplEub1n+o0Nu2/jT4SUMZO/7sSY85BY/jJcXAMrne2R7zS8/\nIj/kQW3QUUqp0FAi0ta8JZ2UDcYqKQionW8/XuECgYBpPmAcjh2MgEzt1HwAT6ZF\norBJgrofdEkJmNmhxQWieQmjrJ4+Kxb6N7aFcD8PwiWIdGaNvRPgtQHx98MJNhx/\niIqCJ/ddWbt3h3XFoqHENvJ+lytbpQhoHMHMBDweaHVaStVEBN1KhW/s6AepAm34\nHi1gfXM/MNV6GDtqXqkmIw==\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@testing-multi-provider.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=107391307607145476208
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40testing-multi-provider.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

### Option 2: JSON File (Current Setup)

Keep using the JSON file:

```env
# ===========================================
# FIREBASE CONFIGURATION - JSON FILE
# ===========================================
FIREBASE_USE_ENV_VARS=false
FIREBASE_PROJECT_ID=testing-multi-provider
FIREBASE_SERVICE_ACCOUNT_PATH=./testing-multi-provider-firebase-adminsdk-fbsvc-88c3e328ca.json
```

## How to Extract Variables from JSON File

If you have a Firebase JSON file and want to convert it to environment variables:

### Step 1: Open your JSON file
```bash
cat testing-multi-provider-firebase-adminsdk-fbsvc-88c3e328ca.json
```

### Step 2: Extract each field
From your JSON file, map each field to an environment variable:

```json
{
  "type": "service_account",                    → FIREBASE_TYPE
  "project_id": "testing-multi-provider",      → FIREBASE_PROJECT_ID
  "private_key_id": "88c3e328...",             → FIREBASE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY...", → FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk...",      → FIREBASE_CLIENT_EMAIL
  "client_id": "107391307607145476208",        → FIREBASE_CLIENT_ID
  "auth_uri": "https://accounts.google...",    → FIREBASE_AUTH_URI
  "token_uri": "https://oauth2.googleapis...", → FIREBASE_TOKEN_URI
  "auth_provider_x509_cert_url": "https://...", → FIREBASE_AUTH_PROVIDER_X509_CERT_URL
  "client_x509_cert_url": "https://www.googleapis...", → FIREBASE_CLIENT_X509_CERT_URL
  "universe_domain": "googleapis.com"          → FIREBASE_UNIVERSE_DOMAIN
}
```

### Step 3: Handle the Private Key
The private key needs special handling because it contains newlines:

**In JSON:**
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAI..."
```

**In .env (keep the \\n):**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAI..."
```

## Configuration Examples

### Development Environment
```env
# Use JSON file for simplicity in development
FIREBASE_USE_ENV_VARS=false
FIREBASE_PROJECT_ID=testing-multi-provider
FIREBASE_SERVICE_ACCOUNT_PATH=./testing-multi-provider-firebase-adminsdk-fbsvc-88c3e328ca.json
```

### Production Environment
```env
# Use environment variables for security in production
FIREBASE_USE_ENV_VARS=true
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-production-project-id
FIREBASE_PRIVATE_KEY_ID=your-production-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRODUCTION_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-production-client-email
FIREBASE_CLIENT_ID=your-production-client-id
# ... other production values
```

## Security Best Practices

### 1. Never Commit Credentials
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.json" >> .gitignore  # If you want to exclude JSON files too
```

### 2. Use Different Projects for Different Environments
- **Development**: `mordecai-dev`
- **Staging**: `mordecai-staging`
- **Production**: `mordecai-prod`

### 3. Rotate Keys Regularly
- Generate new service account keys periodically
- Revoke old keys after updating

### 4. Minimal Permissions
- Create service accounts with only necessary permissions
- Don't use project owner accounts for applications

## Testing Your Configuration

### Test Firebase Connection
```bash
# Start your server
npm run dev

# Check logs for Firebase initialization
# Should see: "Firebase initialized successfully"
```

### Test Authentication Endpoints
```bash
# Test user registration
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@mordecai.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

## Troubleshooting

### Common Issues

1. **Private Key Format Error**
   ```
   Error: Firebase initialization failed: Invalid private key
   ```
   **Solution**: Make sure the private key includes `\n` characters and is wrapped in quotes

2. **Missing Environment Variables**
   ```
   Error: Environment variables missing: FIREBASE_PRIVATE_KEY
   ```
   **Solution**: Check that all required Firebase variables are set when `FIREBASE_USE_ENV_VARS=true`

3. **JSON File Not Found**
   ```
   Error: ENOENT: no such file or directory
   ```
   **Solution**: Check the `FIREBASE_SERVICE_ACCOUNT_PATH` or switch to environment variables

### Debug Mode
Enable detailed logging:
```env
NODE_ENV=development
```

This will show detailed Firebase initialization logs.

## Migration Guide

### From JSON File to Environment Variables

1. **Backup your current setup**
2. **Extract variables from JSON** (see steps above)
3. **Add variables to .env**
4. **Set `FIREBASE_USE_ENV_VARS=true`**
5. **Test your application**
6. **Remove or secure the JSON file**

### From Environment Variables to JSON File

1. **Set `FIREBASE_USE_ENV_VARS=false`**
2. **Ensure JSON file path is correct**
3. **Test your application**

## Recommendation for Mordecai

For **development**: Use JSON file for simplicity
```env
FIREBASE_USE_ENV_VARS=false
FIREBASE_SERVICE_ACCOUNT_PATH=./testing-multi-provider-firebase-adminsdk-fbsvc-88c3e328ca.json
```

For **production**: Use environment variables for security
```env
FIREBASE_USE_ENV_VARS=true
# ... all Firebase environment variables
```

This gives you the flexibility to choose the best approach for each environment! 🚀
