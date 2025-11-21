# Mordecai API - Branding Update

## Overview

All documentation and API responses have been updated to properly reflect the **Mordecai** brand name instead of generic "Firebase Authentication API" references.

## Updated Files

### 📋 Postman Collection & Environment

**`docs/postman-collection.json`**
- ✅ Collection name: "Firebase Authentication API" → **"Mordecai API"**
- ✅ Description: Updated to mention Mordecai
- ✅ Added complete User Management section with new endpoints:
  - Get User Profile
  - Get Users List (Admin)
  - Update User Role (Admin)
  - Deactivate User (Admin)
  - Soft Delete User (Admin)
  - Restore User (Admin)
  - Permanently Delete User (Admin)
  - Get Deleted Users (Admin)
  - Get User Statistics (Admin)

**`docs/postman-environment.json`**
- ✅ Environment name: "Firebase Auth Environment" → **"Mordecai API Environment"**
- ✅ Environment ID: "firebase-auth-env" → **"mordecai-api-env"**
- ✅ Added new variable: `TARGET_FIREBASE_UID` for admin operations

### 📖 Documentation Files

**`docs/API_DOCUMENTATION.md`**
- ✅ Title: "Firebase Authentication API Documentation" → **"Mordecai API Documentation"**
- ✅ Overview updated to mention Mordecai

**`docs/README.md`**
- ✅ Title: "Firebase Authentication System" → **"Mordecai API"**
- ✅ Description updated for Mordecai application

**`docs/QUICK_START.md`**
- ✅ Title: "Mordecai - Quick Start Guide" → **"Mordecai API - Quick Start Guide"**
- ✅ All references updated to "Mordecai API"
- ✅ Test examples use `test@mordecai.com`
- ✅ Health check response mentions Mordecai
- ✅ Features list updated with new capabilities

### 🔧 API Endpoints

**`src/routes/health.route.js`**
- ✅ Health check responses now include `"service": "Mordecai API"`
- ✅ All health endpoints properly branded

## New Postman Collection Structure

```
Mordecai API
├── Authentication
│   ├── Register with Email
│   ├── Login with Email
│   ├── Login with Google
│   ├── Refresh Token
│   ├── Get Current User
│   ├── Logout
│   ├── Send Password Reset
│   └── Verify Email
├── User Management (NEW)
│   ├── Get User Profile
│   ├── Get Users List (Admin)
│   ├── Update User Role (Admin)
│   ├── Deactivate User (Admin)
│   ├── Soft Delete User (Admin)
│   ├── Restore User (Admin)
│   ├── Permanently Delete User (Admin)
│   ├── Get Deleted Users (Admin)
│   └── Get User Statistics (Admin)
└── Health Check
    └── Health Check
```

## API Response Examples

### Health Check (Updated)
```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "status": "ready",
    "service": "Mordecai API",
    "database": "connected",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### User Statistics (New)
```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "totalUsers": 1000,
    "activeUsers": 950,
    "inactiveUsers": 50,
    "deletedUsers": 25,
    "totalWithDeleted": 1025,
    "adminUsers": 5,
    "recentUsers": 30,
    "inactivePercentage": 5,
    "deletedPercentage": 2
  }
}
```

### User Profile (Enhanced)
```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "id": "uuid",
      "firebaseUid": "firebase-uid",
      "appRole": "user",
      "isActive": true,
      "lastLoginAt": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      
      // Firebase data (fetched dynamically)
      "email": "user@mordecai.com",
      "displayName": "John Doe",
      "photoURL": "https://...",
      "emailVerified": true,
      "providerData": [...],
      "metadata": {
        "creationTime": "2024-01-01T00:00:00Z",
        "lastSignInTime": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

## Environment Variables

### Postman Environment Variables
```json
{
  "BASE_URL": "http://localhost:3000",
  "API_VERSION": "v1",
  "ACCESS_TOKEN": "",
  "REFRESH_TOKEN": "",
  "GOOGLE_ID_TOKEN": "",
  "EMAIL_VERIFICATION_TOKEN": "",
  "TARGET_FIREBASE_UID": ""  // NEW: For admin operations
}
```

## Testing the Updated API

### 1. Import Updated Collection
```bash
# Import into Postman
docs/postman-collection.json
docs/postman-environment.json
```

### 2. Test Health Check
```bash
GET http://localhost:3000/api/v1/health

# Should return:
{
  "success": true,
  "data": {
    "status": "ready",
    "service": "Mordecai API",
    "database": "connected"
  }
}
```

### 3. Test User Registration
```bash
POST http://localhost:3000/api/v1/auth/register
{
  "email": "test@mordecai.com",
  "password": "Test123!",
  "firstName": "Test",
  "lastName": "User"
}
```

### 4. Test Admin Functions (After Login as Admin)
```bash
# Get users list
GET http://localhost:3000/api/v1/users?page=1&limit=20

# Get user statistics
GET http://localhost:3000/api/v1/users/stats

# Soft delete user
DELETE http://localhost:3000/api/v1/users/{firebaseUid}

# Restore user
POST http://localhost:3000/api/v1/users/{firebaseUid}/restore
```

## Benefits of Branding Update

### 🎯 **Professional Identity**
- Clear brand recognition
- Consistent naming across all touchpoints
- Professional API documentation

### 📋 **Complete Postman Collection**
- All endpoints documented
- Ready-to-use examples
- Proper environment variables
- Admin functionality included

### 🔧 **Enhanced Functionality**
- User management endpoints
- Soft delete operations
- Statistics and reporting
- Role-based administration

### 📖 **Better Documentation**
- Mordecai-specific examples
- Clear branding throughout
- Updated feature lists
- Professional presentation

## Next Steps

1. **Import Updated Postman Collection**
   - Use the updated collection for API testing
   - Set up environment variables

2. **Update Frontend References**
   - Update any hardcoded API names
   - Use "Mordecai API" in UI elements

3. **Update Deployment Scripts**
   - Ensure service names reflect Mordecai
   - Update monitoring and logging labels

4. **Documentation Review**
   - All docs now properly branded
   - Examples use mordecai.com domain
   - Professional presentation maintained

The Mordecai API is now properly branded and includes comprehensive user management functionality! 🚀
