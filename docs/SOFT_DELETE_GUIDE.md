# Soft Delete Implementation in Mordecai

## What is Soft Delete?

Soft delete is a database pattern where records are **marked as deleted** rather than physically removed from the database. This provides data recovery capabilities and maintains referential integrity.

## Benefits of Soft Delete

### 🔒 **Data Recovery**
- Accidental deletions can be recovered
- Admin mistakes can be undone
- User requests to restore accounts

### 📊 **Audit & Compliance**
- Complete audit trail of all actions
- Regulatory compliance (GDPR, HIPAA, etc.)
- Historical data analysis
- Legal requirements for data retention

### 🔗 **Referential Integrity**
- Foreign key relationships remain intact
- No cascading delete issues
- Related data stays consistent

### 🛡️ **Security**
- Prevents permanent data loss
- Malicious deletion protection
- Backup and recovery strategies

### 📈 **Analytics**
- User churn analysis
- Deletion patterns
- Recovery statistics

## Implementation in Mordecai

### Database Schema

Sequelize automatically adds a `deletedAt` column when `paranoid: true` is enabled:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  app_role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL  -- Soft delete column
);

-- Index for performance
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- Unique constraint only for non-deleted records
CREATE UNIQUE INDEX idx_users_firebase_uid_active 
ON users(firebase_uid) WHERE deleted_at IS NULL;
```

### Model Configuration

```javascript
// src/models/user.model.js
const User = sequelize.define('User', {
  // ... fields
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,  // Enable soft delete
  indexes: [
    {
      unique: true,
      fields: ['firebaseUid'],
      where: { deletedAt: null } // Unique only for active records
    }
  ]
});
```

## API Endpoints

### Soft Delete Operations

#### 1. Soft Delete User
```http
DELETE /api/v1/users/:firebaseUid
Authorization: Bearer <admin-token>
```

**What happens:**
- Sets `deletedAt` timestamp
- Disables user in Firebase
- User becomes invisible in normal queries
- Data is preserved for recovery

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

#### 2. Restore User
```http
POST /api/v1/users/:firebaseUid/restore
Authorization: Bearer <admin-token>
```

**What happens:**
- Sets `deletedAt` to `null`
- Re-enables user in Firebase
- User becomes visible again
- Full account restoration

**Response:**
```json
{
  "success": true,
  "message": "User restored successfully",
  "data": {
    "user": { /* restored user data */ }
  }
}
```

#### 3. Permanent Delete (Dangerous)
```http
DELETE /api/v1/users/:firebaseUid/permanent
Authorization: Bearer <admin-token>
```

**What happens:**
- Completely removes record from database
- Deletes user from Firebase
- **IRREVERSIBLE** - data is gone forever
- Should be used very carefully

#### 4. List Deleted Users
```http
GET /api/v1/users/deleted?page=1&limit=20
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "firebaseUid": "firebase-uid",
        "appRole": "user",
        "deletedAt": "2024-01-01T00:00:00Z",
        "email": "user@example.com",
        "displayName": "John Doe"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### Enhanced Statistics

```http
GET /api/v1/users/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
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

## Query Behavior

### Default Queries (Exclude Deleted)
```javascript
// These automatically exclude soft deleted records
await User.findAll();           // Only active users
await User.findByPk(id);        // Only if not deleted
await User.count();             // Count only active users
```

### Include Deleted Records
```javascript
// Include soft deleted records
await User.findAll({ paranoid: false });
await User.findByPk(id, { paranoid: false });
await User.count({ paranoid: false });
```

### Only Deleted Records
```javascript
// Custom methods for deleted records only
await User.findOnlyDeleted();
await User.countOnlyDeleted();
```

## Model Methods

### Instance Methods
```javascript
const user = await User.findByPk(userId);

// Soft delete
await user.softDelete();

// Check if deleted
if (user.isDeleted()) {
  console.log('User is deleted');
}

// Restore
await user.restore();
```

### Static Methods
```javascript
// Find including deleted
const allUsers = await User.findWithDeleted();

// Find only deleted
const deletedUsers = await User.findOnlyDeleted();

// Count including deleted
const totalCount = await User.countWithDeleted();

// Count only deleted
const deletedCount = await User.countOnlyDeleted();
```

## Best Practices

### 1. Admin Permissions
```javascript
// Always verify admin permissions for delete operations
const verifyAdminPermission = async (adminFirebaseUid) => {
  const admin = await User.findOne({ where: { firebaseUid: adminFirebaseUid } });
  if (!admin || admin.appRole !== 'admin') {
    throw new AuthenticationError('Insufficient permissions');
  }
  return admin;
};
```

### 2. Logging & Audit
```javascript
// Log all delete/restore operations
logger.warn({
  action: 'USER_SOFT_DELETE',
  targetUserId: user.id,
  adminId: admin.id,
  timestamp: new Date()
}, 'User soft deleted');

logger.info({
  action: 'USER_RESTORE',
  targetUserId: user.id,
  adminId: admin.id,
  timestamp: new Date()
}, 'User restored');
```

### 3. Firebase Synchronization
```javascript
// Keep Firebase in sync with soft delete state
const softDeleteUser = async (firebaseUid) => {
  // Disable in Firebase (don't delete)
  await getAuth().updateUser(firebaseUid, { disabled: true });
  
  // Soft delete in database
  await user.softDelete();
};

const restoreUser = async (firebaseUid) => {
  // Re-enable in Firebase
  await getAuth().updateUser(firebaseUid, { disabled: false });
  
  // Restore in database
  await user.restore();
};
```

### 4. Unique Constraints
```sql
-- Unique constraints should exclude deleted records
CREATE UNIQUE INDEX idx_users_email_active 
ON users(email) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_users_firebase_uid_active 
ON users(firebase_uid) WHERE deleted_at IS NULL;
```

### 5. Performance Considerations
```sql
-- Index deleted_at for performance
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- Composite indexes for common queries
CREATE INDEX idx_users_role_active ON users(app_role, deleted_at);
CREATE INDEX idx_users_active_status ON users(is_active, deleted_at);
```

## Data Cleanup Strategy

### Automatic Cleanup (Optional)
```javascript
// Clean up old soft deleted records (e.g., after 1 year)
const cleanupOldDeletedUsers = async () => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const oldDeletedUsers = await User.findAll({
    paranoid: false,
    where: {
      deletedAt: {
        [Op.lt]: oneYearAgo,
        [Op.ne]: null
      }
    }
  });
  
  for (const user of oldDeletedUsers) {
    // Permanently delete old records
    await user.destroy({ force: true });
    
    // Also delete from Firebase if still exists
    try {
      await getAuth().deleteUser(user.firebaseUid);
    } catch (error) {
      // User might already be deleted from Firebase
    }
  }
  
  logger.info(`Cleaned up ${oldDeletedUsers.length} old deleted users`);
};

// Run cleanup job monthly
setInterval(cleanupOldDeletedUsers, 30 * 24 * 60 * 60 * 1000);
```

## Migration from Hard Delete

If you're migrating from hard delete to soft delete:

### 1. Add Column
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

### 2. Update Unique Constraints
```sql
-- Drop old unique constraint
DROP INDEX idx_users_firebase_uid_unique;

-- Add new conditional unique constraint
CREATE UNIQUE INDEX idx_users_firebase_uid_active 
ON users(firebase_uid) WHERE deleted_at IS NULL;
```

### 3. Update Application Code
- Enable `paranoid: true` in model
- Update delete operations to use soft delete
- Add restore functionality
- Update admin interfaces

## Security Considerations

### 1. GDPR Compliance
```javascript
// For GDPR "right to be forgotten"
const gdprDeleteUser = async (firebaseUid) => {
  // First soft delete
  await softDeleteUser(firebaseUid);
  
  // After legal retention period, permanently delete
  setTimeout(async () => {
    await permanentlyDeleteUser(firebaseUid);
  }, LEGAL_RETENTION_PERIOD);
};
```

### 2. Access Control
- Only admins can delete users
- Only super admins can permanently delete
- Audit all delete/restore operations
- Rate limiting on delete operations

### 3. Data Anonymization
```javascript
// Alternative to permanent delete: anonymize data
const anonymizeUser = async (user) => {
  await user.update({
    firebaseUid: `anonymous_${user.id}`,
    // Keep statistical data, remove PII
  });
};
```

Soft delete is a **production-ready feature** that significantly improves data safety and user experience in Mordecai! 🛡️
