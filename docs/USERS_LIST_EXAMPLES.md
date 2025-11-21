# Users List API - Usage Examples

## Overview

This document provides practical examples of how to use the advanced Users List API endpoints in the Mordecai application.

## Basic Usage Examples

### 1. Simple User List

Get the first 20 users ordered by creation date:

```javascript
const response = await fetch('/api/v1/users?page=1&limit=20', {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
console.log(`Total users: ${data.data.pagination.total}`);
console.log(`Users on this page: ${data.data.users.length}`);
```

### 2. Search Users

Search for users by email, name, or other fields:

```javascript
const searchTerm = 'john';
const response = await fetch(`/api/v1/users?search=${searchTerm}&limit=10`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
data.data.users.forEach(user => {
  console.log(`Found: ${user.email} - ${user.displayName}`);
});
```

### 3. Filter by Role

Get all administrators sorted by last login:

```javascript
const response = await fetch('/api/v1/users?appRole=admin&sortBy=lastLoginAt&sortOrder=DESC', {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
console.log('Admin users by activity:');
data.data.users.forEach(user => {
  console.log(`${user.email} - Last login: ${user.lastLoginAt}`);
});
```

### 4. Date Range Filtering

Get users who registered in the last month:

```javascript
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);

const response = await fetch(`/api/v1/users?dateFrom=${lastMonth.toISOString()}&sortBy=createdAt`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
console.log(`New users in last month: ${data.data.users.length}`);
```

### 5. Dashboard Overview

Get summary statistics for admin dashboard:

```javascript
const response = await fetch('/api/v1/users/overview', {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
const overview = data.data.overview;

console.log(`Total Users: ${overview.totalUsers}`);
console.log(`Active Users: ${overview.activeUsers}`);
console.log(`Recent Signups: ${overview.recentSignups}`);
console.log('Role Distribution:', data.data.roleDistribution);
```

## Advanced Examples

### 6. Complex Filtering

Combine multiple filters for specific user segments:

```javascript
const params = new URLSearchParams({
  appRole: 'user',
  isActive: 'true',
  sortBy: 'lastLoginAt',
  sortOrder: 'ASC',  // Get least active users first
  limit: '50',
  dateFrom: '2024-01-01',
  dateTo: '2024-06-30'
});

const response = await fetch(`/api/v1/users?${params}`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
console.log('Inactive users from first half of 2024:');
data.data.users.forEach(user => {
  const daysSinceLogin = user.lastLoginAt 
    ? Math.floor((Date.now() - new Date(user.lastLoginAt)) / (1000 * 60 * 60 * 24))
    : 'Never';
  console.log(`${user.email} - ${daysSinceLogin} days ago`);
});
```

### 7. Pagination with State Management

Handle pagination in a React component:

```javascript
import { useState, useEffect } from 'react';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    search: '',
    appRole: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const response = await fetch(`/api/v1/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });
      
      const data = await response.json();
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleSearch = (searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  return (
    <div>
      <input 
        type="text" 
        placeholder="Search users..."
        onChange={(e) => handleSearch(e.target.value)}
      />
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>
            {users.map(user => (
              <div key={user.id}>
                <h3>{user.displayName || user.email}</h3>
                <p>Role: {user.appRole}</p>
                <p>Status: {user.isActive ? 'Active' : 'Inactive'}</p>
                <p>Last Login: {user.lastLoginAt || 'Never'}</p>
              </div>
            ))}
          </div>
          
          <div>
            <button 
              disabled={!pagination.hasPrev}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Previous
            </button>
            
            <span>Page {pagination.page} of {pagination.pages}</span>
            
            <button 
              disabled={!pagination.hasNext}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

### 8. Audit Trail with Deleted Users

Include soft deleted users for audit purposes:

```javascript
const response = await fetch('/api/v1/users?includeDeleted=true&sortBy=updatedAt&sortOrder=DESC', {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const data = await response.json();
console.log('All users including deleted:');
data.data.users.forEach(user => {
  const status = user.deletedAt ? 'DELETED' : (user.isActive ? 'ACTIVE' : 'INACTIVE');
  console.log(`${user.email} - ${status} - Updated: ${user.updatedAt}`);
});
```

### 9. Export Users Data

Generate a CSV export of filtered users:

```javascript
const exportUsers = async (filters = {}) => {
  const params = new URLSearchParams({
    ...filters,
    limit: '1000', // Get large batch for export
    sortBy: 'createdAt',
    sortOrder: 'ASC'
  });

  const response = await fetch(`/api/v1/users?${params}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });

  const data = await response.json();
  
  // Convert to CSV
  const headers = ['Email', 'Display Name', 'Role', 'Status', 'Created At', 'Last Login'];
  const csvContent = [
    headers.join(','),
    ...data.data.users.map(user => [
      user.email || '',
      user.displayName || '',
      user.appRole,
      user.isActive ? 'Active' : 'Inactive',
      user.createdAt,
      user.lastLoginAt || 'Never'
    ].join(','))
  ].join('\n');

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Export all active users
exportUsers({ isActive: 'true' });
```

## Performance Optimization Examples

### 10. Efficient Dashboard Queries

Optimize dashboard loading with parallel requests:

```javascript
const loadDashboard = async () => {
  try {
    // Fetch overview and recent users in parallel
    const [overviewResponse, recentUsersResponse] = await Promise.all([
      fetch('/api/v1/users/overview', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }),
      fetch('/api/v1/users?sortBy=createdAt&sortOrder=DESC&limit=10', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      })
    ]);

    const [overviewData, recentUsersData] = await Promise.all([
      overviewResponse.json(),
      recentUsersResponse.json()
    ]);

    return {
      overview: overviewData.data,
      recentUsers: recentUsersData.data.users
    };
  } catch (error) {
    console.error('Error loading dashboard:', error);
    throw error;
  }
};
```

### 11. Debounced Search

Implement efficient search with debouncing:

```javascript
import { debounce } from 'lodash';

const useUserSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const performSearch = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/users?search=${encodeURIComponent(searchTerm)}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();
      setSearchResults(data.data.users);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(performSearch, 300);

  return { searchResults, loading, search: debouncedSearch };
};
```

### 12. Virtual Scrolling for Large Lists

Handle large user lists efficiently:

```javascript
import { FixedSizeList as List } from 'react-window';

const VirtualUsersList = () => {
  const [users, setUsers] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMoreUsers = async (page) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/users?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();
      
      if (page === 1) {
        setUsers(data.data.users);
      } else {
        setUsers(prev => [...prev, ...data.data.users]);
      }
      
      setHasNextPage(data.data.pagination.hasNext);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const UserRow = ({ index, style }) => {
    const user = users[index];
    
    // Load more when near the end
    if (index === users.length - 10 && hasNextPage && !loading) {
      const nextPage = Math.floor(users.length / 50) + 1;
      loadMoreUsers(nextPage);
    }

    return (
      <div style={style}>
        <div>{user.displayName || user.email}</div>
        <div>{user.appRole} - {user.isActive ? 'Active' : 'Inactive'}</div>
      </div>
    );
  };

  useEffect(() => {
    loadMoreUsers(1);
  }, []);

  return (
    <List
      height={600}
      itemCount={users.length}
      itemSize={80}
    >
      {UserRow}
    </List>
  );
};
```

## Error Handling Examples

### 13. Robust Error Handling

Handle various error scenarios gracefully:

```javascript
const fetchUsersWithErrorHandling = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`/api/v1/users?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      switch (response.status) {
        case 401:
          // Token expired or invalid
          console.error('Authentication failed. Please login again.');
          redirectToLogin();
          break;
        case 403:
          // Insufficient permissions
          console.error('Access denied. Admin privileges required.');
          showPermissionError();
          break;
        case 400:
          // Validation error
          console.error('Invalid parameters:', errorData.error.details);
          showValidationErrors(errorData.error.details);
          break;
        case 500:
          // Server error
          console.error('Server error. Please try again later.');
          showServerError();
          break;
        default:
          console.error('Unexpected error:', errorData.message);
      }
      
      throw new Error(errorData.message);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError') {
      // Network error
      console.error('Network error. Check your connection.');
      showNetworkError();
    }
    throw error;
  }
};
```

## Testing Examples

### 14. Unit Test Examples

Test the users list functionality:

```javascript
// Jest test example
describe('Users List API', () => {
  test('should fetch users with pagination', async () => {
    const mockResponse = {
      success: true,
      data: {
        users: [
          { id: '1', email: 'user1@test.com', appRole: 'user' },
          { id: '2', email: 'user2@test.com', appRole: 'admin' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await fetchUsers({ page: 1, limit: 20 });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/users?page=1&limit=20',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer ')
        })
      })
    );
    
    expect(result.data.users).toHaveLength(2);
    expect(result.data.pagination.total).toBe(2);
  });

  test('should handle search parameters correctly', async () => {
    await fetchUsers({ search: 'john', appRole: 'user' });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/users?search=john&appRole=user',
      expect.any(Object)
    );
  });
});
```

These examples demonstrate the flexibility and power of the Users List API in the Mordecai application! 🚀
