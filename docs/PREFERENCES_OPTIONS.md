# User Preferences - Implementation Options

## Do You Need User Preferences?

User preferences are **optional** and depend on your app's functionality. Here are the considerations:

## Option 1: No Preferences (Current Implementation)

**Best for:**
- Simple applications
- MVP/prototype phase
- Apps with minimal customization
- When you want to keep the database lean

**Benefits:**
- Smaller database
- Simpler code
- Faster queries
- Less complexity

**Current Schema (No Preferences):**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  app_role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Option 2: Add Preferences (If Needed)

**Best for:**
- Apps with user customization
- Multi-theme support
- Notification settings
- Language preferences
- Dashboard layouts

**Examples of preferences:**
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": {
    "email": true,
    "push": false,
    "sms": false
  },
  "dashboard": {
    "layout": "grid",
    "widgets": ["weather", "calendar", "tasks"]
  },
  "privacy": {
    "profileVisible": true,
    "showOnlineStatus": false
  }
}
```

## Implementation Options

### Option A: JSONB Column (Recommended)
```javascript
// In user.model.js
preferences: {
  type: DataTypes.JSONB, // PostgreSQL JSON field
  allowNull: true,
  defaultValue: {},
  comment: 'User preferences and settings',
},

// Usage
await user.update({ 
  preferences: { 
    ...user.preferences, 
    theme: 'dark',
    language: 'es' 
  } 
});
```

**Pros:**
- Flexible schema
- Easy to add new preferences
- Good performance with PostgreSQL
- No additional tables

**Cons:**
- Less structured
- Harder to query specific preferences
- No foreign key constraints

### Option B: Separate Preferences Table
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  preference_key VARCHAR(100) NOT NULL,
  preference_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, preference_key)
);
```

**Pros:**
- Structured data
- Easy to query
- Can add validation per preference
- Audit trail possible

**Cons:**
- More complex queries
- Additional table joins
- More database overhead

### Option C: Typed Preferences Table
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(5) DEFAULT 'en',
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  dashboard_layout VARCHAR(20) DEFAULT 'list',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pros:**
- Type safety
- Easy to query
- Database constraints
- Clear schema

**Cons:**
- Less flexible
- Schema changes needed for new preferences
- Can become wide table

## Quick Implementation (If You Want Preferences)

If you decide you want preferences, here's how to add them quickly:

### 1. Update User Model
```javascript
// Uncomment in src/models/user.model.js
preferences: {
  type: DataTypes.JSONB,
  allowNull: true,
  defaultValue: {},
  comment: 'User preferences and settings',
},
```

### 2. Add Preferences Method
```javascript
// Uncomment in src/models/user.model.js
User.prototype.updatePreferences = async function (newPreferences) {
  const currentPreferences = this.preferences || {};
  const updatedPreferences = { ...currentPreferences, ...newPreferences };
  return this.update({ preferences: updatedPreferences });
};
```

### 3. Add Service Method
```javascript
// Uncomment in src/services/user.service.js
async updateUserPreferences(firebaseUid, preferences) {
  const user = await User.findOne({ where: { firebaseUid } });
  if (!user) {
    throw new AuthenticationError('User not found');
  }
  await user.updatePreferences(preferences);
  return user;
}
```

### 4. Add Controller Method
```javascript
// Uncomment in src/controllers/user.controller.js
async updatePreferences(req, res, next) {
  try {
    const user = await userService.updateUserPreferences(req.firebaseUid, req.body);
    res.success({
      message: 'Preferences updated successfully',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    next(error);
  }
}
```

### 5. Add Route
```javascript
// Uncomment in src/routes/user.route.js
router.put('/preferences', authenticate, userController.updatePreferences);
```

## Common Preferences Examples

### Theme Preferences
```json
{
  "theme": "dark",
  "primaryColor": "#007bff",
  "fontSize": "medium",
  "compactMode": false
}
```

### Notification Preferences
```json
{
  "notifications": {
    "email": {
      "marketing": false,
      "updates": true,
      "security": true
    },
    "push": {
      "messages": true,
      "mentions": true,
      "likes": false
    }
  }
}
```

### Dashboard Preferences
```json
{
  "dashboard": {
    "layout": "grid",
    "widgets": [
      { "type": "weather", "position": 1 },
      { "type": "calendar", "position": 2 },
      { "type": "tasks", "position": 3 }
    ],
    "refreshInterval": 300
  }
}
```

### Privacy Preferences
```json
{
  "privacy": {
    "profileVisible": true,
    "showEmail": false,
    "showOnlineStatus": true,
    "allowMessages": "friends"
  }
}
```

## API Usage Examples

### Get User Profile (with preferences)
```javascript
GET /api/v1/users/profile

Response:
{
  "user": {
    "id": "uuid",
    "appRole": "user",
    "preferences": {
      "theme": "dark",
      "language": "en"
    },
    // ... other user data
  }
}
```

### Update Preferences
```javascript
PUT /api/v1/users/preferences
{
  "theme": "dark",
  "notifications": {
    "email": false,
    "push": true
  }
}
```

### Partial Preference Update
```javascript
PUT /api/v1/users/preferences
{
  "theme": "light"  // Only updates theme, keeps other preferences
}
```

## Recommendation

**For Mordecai MVP:** Start **without preferences** to keep it simple.

**Add preferences later if you need:**
- User customization
- Theme switching
- Notification controls
- Dashboard layouts
- Language settings

The current implementation is **clean and efficient** without preferences. You can always add them later when your app grows! 🚀

## Migration Path

If you decide to add preferences later:

1. **Add the JSONB column** to existing table
2. **Set default empty object** for existing users
3. **Add the API endpoints**
4. **Update frontend** to use preferences

This approach keeps your options open while maintaining a lean, fast database! 💪
