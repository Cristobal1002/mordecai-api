# Roles Architecture in Mordecai

## Role Separation Strategy

Mordecai implements a **dual-role system** that separates Firebase authentication roles from application-specific roles for better security and flexibility.

## Firebase Roles vs App Roles

### Firebase Custom Claims (Optional)
Firebase can store custom claims in JWT tokens for basic authorization:

```javascript
// Firebase custom claims (stored in Firebase)
{
  "role": "authenticated_user",
  "subscription": "premium",
  "verified": true
}
```

**Use cases:**
- Basic authentication status
- Subscription levels
- Account verification status
- Global permissions across multiple apps

### App Roles (Stored in PostgreSQL)
Application-specific roles stored in our database:

```javascript
// App roles (stored in PostgreSQL)
{
  "appRole": "admin",        // Application-specific role
  "isActive": true,          // Account status
  "firebaseUid": "uid123"    // Link to Firebase user
}
```

**Use cases:**
- Application-specific permissions
- Business logic authorization
- Feature access control
- Administrative functions

## Available App Roles

```javascript
const APP_ROLES = {
  USER: 'user',           // Regular user - basic access
  MODERATOR: 'moderator', // Content moderation permissions
  MANAGER: 'manager',     // Team/department management
  EDITOR: 'editor',       // Content creation/editing
  ADMIN: 'admin'          // Full system administration
};
```

### Role Hierarchy & Permissions

```
ADMIN (Highest)
├── Full system access
├── User management
├── Role assignment
├── System configuration
└── All lower-level permissions

MANAGER
├── Team management
├── User oversight
├── Reports access
└── All lower-level permissions

EDITOR
├── Content management
├── Publishing permissions
├── Media access
└── All lower-level permissions

MODERATOR
├── Content moderation
├── User reports handling
├── Comment management
└── All lower-level permissions

USER (Lowest)
├── Basic app features
├── Profile management
└── Standard functionality
```

## Implementation Examples

### 1. JWT Token Structure

```javascript
// JWT payload includes app role
{
  "userId": "uuid",
  "firebaseUid": "firebase-uid",
  "appRole": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 2. Authorization Middleware

```javascript
// Check app role for specific permissions
export const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    const userRole = req.user.appRole;
    
    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

// Usage in routes
router.delete('/users/:id', 
  authenticate, 
  requireRole(['admin']), 
  userController.deleteUser
);

router.put('/content/:id', 
  authenticate, 
  requireRole(['admin', 'editor', 'moderator']), 
  contentController.updateContent
);
```

### 3. Role-Based UI

```javascript
// Frontend role checking
const UserDashboard = ({ user }) => {
  const canManageUsers = ['admin', 'manager'].includes(user.appRole);
  const canEditContent = ['admin', 'editor', 'moderator'].includes(user.appRole);
  
  return (
    <div>
      <h1>Dashboard</h1>
      
      {canManageUsers && (
        <UserManagementPanel />
      )}
      
      {canEditContent && (
        <ContentEditor />
      )}
      
      <UserProfile />
    </div>
  );
};
```

## Database Schema

### Users Table (Optimized)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  app_role VARCHAR(50) DEFAULT 'user' CHECK (app_role IN ('user', 'moderator', 'manager', 'editor', 'admin')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_app_role ON users(app_role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);
```

## API Endpoints

### Role Management

#### GET /api/v1/users
List users with role filtering
```bash
GET /api/v1/users?appRole=admin&isActive=true&page=1&limit=20
```

#### PUT /api/v1/users/:firebaseUid/role
Update user app role (admin only)
```json
{
  "appRole": "moderator"
}
```

### Permission Checking

#### Middleware Usage
```javascript
// Protect admin-only routes
router.use('/admin/*', authenticate, requireRole(['admin']));

// Multiple role access
router.get('/reports', authenticate, requireRole(['admin', 'manager']));

// Hierarchical permissions
router.post('/moderate', authenticate, requireRole(['admin', 'moderator']));
```

## Security Benefits

### 1. Separation of Concerns
- **Firebase**: Handles authentication, email verification, password reset
- **App Database**: Handles authorization, business logic, app-specific permissions

### 2. Flexibility
- Change app roles without touching Firebase
- Different role systems for different environments
- Easy to extend with new roles

### 3. Security
- App roles can't be manipulated through Firebase console
- Centralized permission management
- Audit trail for role changes

### 4. Scalability
- Role-based access control (RBAC)
- Easy to add new permissions
- Clear permission hierarchy

## Best Practices

### 1. Role Assignment
```javascript
// Always validate role changes
const VALID_ROLES = ['user', 'moderator', 'manager', 'editor', 'admin'];

const updateUserRole = async (targetUid, newRole, adminUid) => {
  // Validate role
  if (!VALID_ROLES.includes(newRole)) {
    throw new ValidationError('Invalid role');
  }
  
  // Check admin permissions
  const admin = await User.findOne({ where: { firebaseUid: adminUid } });
  if (admin.appRole !== 'admin') {
    throw new AuthenticationError('Only admins can change roles');
  }
  
  // Update role
  await User.update(
    { appRole: newRole },
    { where: { firebaseUid: targetUid } }
  );
};
```

### 2. Permission Checking
```javascript
// Create reusable permission functions
const hasPermission = (userRole, requiredPermissions) => {
  const roleHierarchy = {
    'user': 1,
    'moderator': 2,
    'editor': 3,
    'manager': 4,
    'admin': 5
  };
  
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = Math.min(...requiredPermissions.map(role => roleHierarchy[role] || 999));
  
  return userLevel >= requiredLevel;
};
```

### 3. Audit Logging
```javascript
// Log all role changes
const logRoleChange = async (targetUserId, oldRole, newRole, adminId) => {
  await AuditLog.create({
    action: 'ROLE_CHANGE',
    targetUserId,
    adminId,
    oldValue: oldRole,
    newValue: newRole,
    timestamp: new Date()
  });
};
```

## Migration from Simple Roles

If you currently have simple roles, here's how to migrate:

### 1. Update Database Schema
```sql
-- Rename column
ALTER TABLE users RENAME COLUMN role TO app_role;

-- Add new role options
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_app_role_check 
  CHECK (app_role IN ('user', 'moderator', 'manager', 'editor', 'admin'));
```

### 2. Update Code References
```bash
# Find and replace in codebase
grep -r "\.role" src/ --include="*.js"
# Replace with .appRole

grep -r "role:" src/ --include="*.js"  
# Replace with appRole:
```

### 3. Update API Documentation
- Update all API examples
- Change role parameter names
- Update validation schemas

This dual-role architecture provides maximum flexibility while maintaining security and clear separation of concerns! 🚀
