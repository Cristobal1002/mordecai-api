# User Model Optimization for Mordecai

## Problem: Too Much Data in PostgreSQL

The original user model was storing too much user data in PostgreSQL, including:
- ❌ Email (already in Firebase)
- ❌ First/Last Name (already in Firebase)  
- ❌ Email verification status (Firebase handles this)
- ❌ Profile picture URL (Firebase can store this)
- ❌ Password (Firebase handles authentication)
- ❌ Provider info (Firebase knows this)

## Solution: Optimized Lean Model

### What We Store in PostgreSQL (Minimal)
```javascript
{
  id: "UUID",                    // Internal app ID
  firebaseUid: "string",         // Firebase user identifier
  role: "user|admin|moderator",  // App-specific authorization
  isActive: "boolean",           // Account status control
  preferences: "JSONB",          // App-specific settings
  lastLoginAt: "date",           // Security tracking
  loginAttempts: "integer",      // Security tracking
  lockedUntil: "date",           // Security tracking
  createdAt: "date",             // Record creation
  updatedAt: "date"              // Record updates
}
```

### What Firebase Handles
```javascript
{
  uid: "firebase-uid",           // User identifier
  email: "user@example.com",     // Email address
  displayName: "John Doe",       // Full name
  photoURL: "https://...",       // Profile picture
  emailVerified: true,           // Email verification
  providerData: [...],           // Sign-in providers
  customClaims: {...},           // Custom JWT claims
  metadata: {
    creationTime: "...",
    lastSignInTime: "..."
  }
}
```

## Benefits of Optimization

### 🔒 Security
- **Less PII in database** - Reduced data breach impact
- **Single source of truth** - Firebase handles user data
- **Better compliance** - GDPR/privacy friendly
- **Reduced attack surface** - Less sensitive data to protect

### 🚀 Performance  
- **Smaller database** - Faster queries
- **Less data transfer** - Reduced network overhead
- **Simpler queries** - Better performance
- **Efficient indexing** - Only essential fields indexed

### 🛠️ Maintenance
- **Less duplication** - Firebase is authoritative
- **Simpler sync** - No need to keep data in sync
- **Easier updates** - User changes handled by Firebase
- **Better separation** - Auth vs app data clearly separated

## Implementation Strategy

### Phase 1: Create Optimized Model
```javascript
// New lean user model
const User = {
  id: UUID,
  firebaseUid: String,  // Only Firebase reference needed
  role: Enum,           // App-specific
  isActive: Boolean,    // App-specific  
  preferences: JSONB,   // App-specific
  // Security fields only
  lastLoginAt: Date,
  loginAttempts: Integer,
  lockedUntil: Date
}
```

### Phase 2: Update Services
```javascript
// Get user data from Firebase when needed
const getUserProfile = async (firebaseUid) => {
  // Get app data from PostgreSQL
  const appUser = await User.findOne({ where: { firebaseUid } });
  
  // Get profile data from Firebase
  const firebaseUser = await admin.auth().getUser(firebaseUid);
  
  // Combine for complete user profile
  return {
    ...appUser.toJSON(),
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
};
```

### Phase 3: Migration Strategy
```sql
-- Create new optimized table
CREATE TABLE users_optimized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrate essential data only
INSERT INTO users_optimized (firebase_uid, is_active, last_login_at, created_at)
SELECT firebase_uid, is_active, last_login_at, created_at 
FROM users 
WHERE firebase_uid IS NOT NULL;
```

## Updated Authentication Flow

### Registration (Optimized)
```javascript
async registerWithEmail(userData) {
  // 1. Create user in Firebase (handles email, password, name)
  const firebaseUser = await getAuth().createUser({
    email: userData.email,
    password: userData.password,
    displayName: `${userData.firstName} ${userData.lastName}`,
  });

  // 2. Create minimal record in PostgreSQL
  const user = await User.create({
    firebaseUid: firebaseUser.uid,
    role: 'user',
    isActive: true,
  });

  return { user, firebaseUser };
}
```

### Login (Optimized)
```javascript
async loginWithGoogle(idToken) {
  const decodedToken = await verifyIdToken(idToken);
  
  // Find or create minimal user record
  let user = await User.findOne({ 
    where: { firebaseUid: decodedToken.uid } 
  });

  if (!user) {
    user = await User.create({
      firebaseUid: decodedToken.uid,
      role: 'user',
      isActive: true,
      lastLoginAt: new Date(),
    });
  } else {
    await user.update({ lastLoginAt: new Date() });
  }

  return { user };
}
```

## API Response Format

### Before (Too Much Data)
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",      // Duplicate from Firebase
    "firstName": "John",              // Duplicate from Firebase
    "lastName": "Doe",                // Duplicate from Firebase
    "firebaseUid": "firebase-uid",
    "provider": "google",             // Firebase knows this
    "emailVerified": true,            // Firebase handles this
    "profilePicture": "https://...",  // Firebase can store this
    "isActive": true,
    "role": "user"
  }
}
```

### After (Optimized)
```json
{
  "user": {
    "id": "uuid",
    "firebaseUid": "firebase-uid",
    "role": "user",
    "isActive": true,
    "preferences": {
      "theme": "dark",
      "notifications": true
    },
    "lastLoginAt": "2024-01-01T00:00:00Z",
    // Firebase data fetched when needed
    "email": "user@example.com",      // From Firebase
    "displayName": "John Doe",        // From Firebase  
    "photoURL": "https://...",        // From Firebase
    "emailVerified": true             // From Firebase
  }
}
```

## Database Size Comparison

### Before (Per User)
```
- id: 36 bytes (UUID)
- email: ~50 bytes
- password: ~60 bytes (hashed)
- firstName: ~20 bytes
- lastName: ~20 bytes
- firebaseUid: ~30 bytes
- provider: ~10 bytes
- emailVerified: 1 byte
- profilePicture: ~100 bytes
- isActive: 1 byte
- lastLoginAt: 8 bytes
- loginAttempts: 4 bytes
- lockedUntil: 8 bytes
- timestamps: 16 bytes
Total: ~364 bytes per user
```

### After (Per User)
```
- id: 36 bytes (UUID)
- firebaseUid: ~30 bytes
- role: ~10 bytes
- isActive: 1 byte
- preferences: ~50 bytes (JSON)
- lastLoginAt: 8 bytes
- loginAttempts: 4 bytes
- lockedUntil: 8 bytes
- timestamps: 16 bytes
Total: ~163 bytes per user
```

**Space Savings: ~55% reduction per user**

## Implementation Files

1. **`src/models/user.model.optimized.js`** - New lean user model
2. **`src/services/user.service.js`** - Service to combine Firebase + PostgreSQL data
3. **Migration script** - To migrate existing data

## Recommendation

✅ **Use the optimized model** for new Mordecai installations
✅ **Migrate existing installations** using the provided migration strategy
✅ **Let Firebase handle user data** - it's designed for this
✅ **Store only app-specific data** in PostgreSQL

This approach follows the **principle of least privilege** and **single responsibility** - each system does what it's best at! 🚀
