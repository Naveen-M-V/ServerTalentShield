# Role Hierarchy & Permissions

## Role Definitions

### ADMIN_ROLES (Full System Access)
```javascript
const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
```

**Permissions:**
- ✅ Can create and manage reviews for all employees
- ✅ Can view all team reviews
- ✅ Can create goals for team members
- ✅ Can approve/reject goals
- ✅ Full access to performance management
- ✅ Access to employee data
- ✅ Access to admin dashboard features

### MANAGER_ROLES (Team Management)
```javascript
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];
// Expands to: ['admin', 'super-admin', 'hr', 'manager']
```

**Permissions:**
- ✅ Can create and manage reviews for direct reports
- ✅ Can view team reviews
- ✅ Can create goals for team members
- ✅ Can approve/reject goals
- ✅ Access to team performance data
- ✅ Access to performance management tab

### Regular Employees
**Role:** `'employee'` or any role not in MANAGER_ROLES

**Permissions:**
- ✅ Can view own reviews
- ✅ Can add comments to submitted reviews
- ✅ Can create personal goals
- ✅ Can update goal progress
- ❌ Cannot create reviews for others
- ❌ Cannot approve/reject goals
- ❌ Cannot view team performance data

---

## Role Detection Logic

### Frontend Components

**Reviews.js:**
```javascript
const isAdmin = ADMIN_ROLES.includes(userData.role);
const isManager = MANAGER_ROLES.includes(userData.role);

if (isManager) {
  // Shows "Team reviews" tab with create button
  setActiveTab('team');
} else {
  // Shows "My reviews" tab only
  setActiveTab('mine');
}
```

**PerformanceTab.js:**
```javascript
const isManager = user?.role && MANAGER_ROLES.includes(user.role);
const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);

// Empty state message adapts based on role:
{isManager || isAdmin
  ? "Navigate to Performance → Reviews to manage team reviews"
  : "Your manager hasn't created a review for you yet"}
```

### Backend Controllers

**reviewsController.js:**
```javascript
const isManager = (req) => MANAGER_ROLES.includes(getUserRole(req));

// Used to gate manager-only endpoints:
if (!isManager(req)) {
  return res.status(403).json({ message: 'Manager/HR access required' });
}
```

---

## Testing Role Detection

### Admin Login Test:
```javascript
// Expected console output:
🎯 Reviews Page - User loaded: {
  role: 'admin',           // ✅ Role is defined
  email: 'admin@example.com',
  isAdmin: true,           // ✅ Detected as admin
  isManager: true,         // ✅ Detected as manager (admins are managers too)
  adminRoles: ['admin', 'super-admin', 'hr'],
  managerRoles: ['admin', 'super-admin', 'hr', 'manager']
}

✅ Manager/Admin/Super-Admin detected - Setting team tab {
  role: 'admin',
  canCreateReviews: true,
  canManageTeam: true
}

🎯 PerformanceTab - User role detection: {
  userRole: 'admin',
  isManager: true,
  isAdmin: true
}
```

### Super-Admin Login Test:
```javascript
// Expected console output:
🎯 Reviews Page - User loaded: {
  role: 'super-admin',     // ✅ Role is defined
  isAdmin: true,           // ✅ Detected as admin
  isManager: true          // ✅ Detected as manager
}

✅ Manager/Admin/Super-Admin detected - Setting team tab {
  role: 'super-admin',
  canCreateReviews: true,
  canManageTeam: true
}
```

### Regular Employee Login Test:
```javascript
// Expected console output:
🎯 Reviews Page - User loaded: {
  role: 'employee',        // ✅ Role is defined
  isAdmin: false,          // ✅ Not admin
  isManager: false         // ✅ Not manager
}

⚠️ Regular employee - staying on mine tab {
  role: 'employee',
  canCreateReviews: false,
  canManageTeam: false
}
```

---

## Common Issues & Solutions

### Issue: "Not a manager" message for admin/super-admin

**Root Cause:**
- User role is `undefined` instead of actual role value
- Nested API response not properly extracted

**Solution:**
```javascript
// ✅ CORRECT: Extract from nested structure
const userData = res.data?.data?.user || res.data?.user || res.data?.data || res.data;

// ❌ WRONG: Access flat structure
const userData = res.data; // role will be undefined
```

### Issue: Admin can't create reviews

**Root Cause:**
- `isManager` check doesn't include admin roles
- Role constants not imported correctly

**Solution:**
```javascript
// ✅ CORRECT: Admins are included in MANAGER_ROLES
const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

// Check includes admin roles automatically
if (MANAGER_ROLES.includes(user.role)) {
  // Show create button
}
```

### Issue: Employee resolution fails for admin accounts

**Root Cause:**
- Admin users might have User._id instead of EmployeeHub._id
- Missing userId field mapping

**Solution:**
- Use enhanced `resolveEmployeeForRequest()` with 4-step lookup
- Try EmployeeHub._id first, then userId field, then email fallback
- See REVIEW_SYSTEM_FIXES.md for implementation details

---

## Files Using Role Checks

### Frontend:
- ✅ `frontend/src/pages/Reviews.js` - Main review management
- ✅ `frontend/src/components/Performance/PerformanceTab.js` - Dashboard performance tab
- `frontend/src/pages/UserDashboard.js` - Passes user to PerformanceTab
- `frontend/src/context/AuthContext.js` - User authentication and role storage

### Backend:
- ✅ `backend/controllers/reviewsController.js` - Review CRUD operations
- `backend/controllers/goalsController.js` - Goal management
- `backend/controllers/performanceController.js` - Performance data
- `backend/middleware/auth.js` - Authentication middleware

---

## Best Practices

1. **Always use MANAGER_ROLES for permission checks**
   - Don't hardcode `['admin', 'super-admin']`
   - Use the constant to ensure consistency

2. **Extract user data correctly from API responses**
   - Backend returns: `{ success: true, data: { user: {...} } }`
   - Always extract from `res.data.data.user`

3. **Add debug logging for role detection**
   - Log role value, isAdmin, isManager flags
   - Helps diagnose permission issues quickly

4. **Test with all role types**
   - admin
   - super-admin
   - hr
   - manager
   - employee

5. **Consistent role definitions across frontend and backend**
   - Same ADMIN_ROLES and MANAGER_ROLES arrays
   - Keeps permission logic synchronized

---

**Last Updated:** 2024-01-26  
**Status:** ✅ Verified and working  
**Related Docs:** REVIEW_SYSTEM_FIXES.md, PERFORMANCE_SYSTEM_AUDIT_REPORT.md
