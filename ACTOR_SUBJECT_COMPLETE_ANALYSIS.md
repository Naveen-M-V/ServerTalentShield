# ACTOR_SUBJECT Pattern - Complete Codebase Analysis

**Date**: January 27, 2026  
**Purpose**: Identify all controllers that need ACTOR_SUBJECT pattern implementation

---

## ✅ Already Implemented (5 controllers)

### 1. **overtimeController.js** ✅
**ACTOR_SUBJECT Status**: FULLY IMPLEMENTED
```javascript
approvedByUserId: actorUserId,    // User._id
approverRole: actorRole,
approverComments
```
**Pattern**: Tracks admin User._id who approves overtime

---

### 2. **sicknessController.js** ✅
**ACTOR_SUBJECT Status**: FULLY IMPLEMENTED
```javascript
createdBy: actorUserId,           // User._id
createdByRole: actorRole,
isAdminCreated: isAdmin,
approvedByUserId: actorUserId,    // Admin who approved
approverRole: actorRole
```
**Pattern**: Tracks both creator and approver User._id

---

### 3. **latenessController.js** ✅
**ACTOR_SUBJECT Status**: FULLY IMPLEMENTED
```javascript
createdBy: actorUserId,           // User._id
createdByRole: actorRole,
isAdminCreated: isAdmin
```
**Pattern**: Tracks creator User._id for lateness records

---

### 4. **unifiedLeaveController.js** ✅
**ACTOR_SUBJECT Status**: FULLY IMPLEMENTED
```javascript
approvedByUserId: actorUserId,    // User._id
approverRole: actorRole,
approverComments
```
**Pattern**: Tracks admin User._id who approves/rejects leave

---

### 5. **documentManagement.js (routes)** ✅
**ACTOR_SUBJECT Status**: RECENTLY FIXED
```javascript
createdByUserId: authenticatedUserId,    // User._id
createdByEmployeeId: employeeId          // EmployeeHub._id
```
**Pattern**: Dual tracking for both user types

---

## ⚠️ NEEDS IMPLEMENTATION (10+ controllers)

### 1. **goalsController.js** ⚠️
**Current Issue**: Uses `req.user.employeeId` without null checks
**Lines**: 32, 529
**Risk**: Profile admins creating goals will fail
**Required Changes**:
```javascript
// Add ACTOR_SUBJECT tracking
createdBy: req.user._id || req.user.userId,     // Actor
createdByRole: req.user.role,
targetEmployeeId: employeeId                    // Subject
```

---

### 2. **reviewController.js** ⚠️
**Current Issue**: Likely assumes employeeId exists
**Risk**: Profile admins creating reviews will fail
**Required Changes**:
```javascript
createdBy: req.user._id,                        // Actor (admin)
createdByRole: req.user.role,
assignedTo: employeeId                          // Subject (employee being reviewed)
```

---

### 3. **reviewsController.js** ⚠️
**Current Issue**: Has `getUserModel()` check for userType but may need ACTOR tracking
**Lines**: 23, 293
**Risk**: Moderate - already has some user type awareness
**Required Changes**:
```javascript
submittedBy: req.user._id,                      // Actor
submittedByRole: req.user.role,
revieweeId: employeeId                          // Subject
```

---

### 4. **performanceController.js** ⚠️
**Current Issue**: Uses employeeId lookups without null handling
**Lines**: 304+
**Risk**: Profile admins managing performance will fail
**Required Changes**:
```javascript
evaluatedBy: req.user._id,                      // Actor (admin)
evaluatorRole: req.user.role,
employeeId: targetEmployeeId                    // Subject
```

---

### 5. **teamController.js** ⚠️
**Current Issue**: Team creation/management doesn't track who performed action
**Risk**: Low (teams may not be employee-specific)
**Required Changes**:
```javascript
createdBy: req.user._id,                        // Actor
createdByRole: req.user.role,
managerAssignedBy: req.user._id                 // Who assigned manager
```

---

### 6. **rotaController.js** ⚠️
**Current Issue**: Shift assignments don't track admin who created them
**Risk**: High - admins assign shifts to employees
**Required Changes**:
```javascript
assignedBy: req.user._id,                       // Actor (admin)
assignedByRole: req.user.role,
employeeId: targetEmployeeId,                   // Subject
isAdminAssigned: true
```

---

### 7. **expenseController.js** ⚠️
**Current Issue**: Expense approval doesn't track approver User._id
**Risk**: High - admins approve employee expenses
**Required Changes**:
```javascript
approvedByUserId: req.user._id,                 // Actor
approverRole: req.user.role,
submittedByEmployeeId: employeeId               // Subject
```

---

### 8. **leaveApprovalController.js** ⚠️
**Current Issue**: Uses employeeId extensively without ACTOR tracking
**Lines**: 19, 21, 29, 40, 51, 69, 404
**Risk**: Moderate - may work but lacks actor tracking
**Required Changes**:
```javascript
approvedByUserId: req.user._id,                 // Actor
approverRole: req.user.role,
employeeId: targetEmployeeId                    // Subject
```

---

### 9. **reportingController.js** ⚠️
**Current Issue**: Report generation doesn't track who generated it
**Risk**: Low (mostly read operations)
**Required Changes**:
```javascript
generatedBy: req.user._id,                      // Actor
generatedByRole: req.user.role
```

---

### 10. **reportLibraryController.js** ⚠️
**Current Issue**: Report library operations don't track actor
**Risk**: Low (mostly read operations)
**Required Changes**:
```javascript
requestedBy: req.user._id,                      // Actor
requestedByRole: req.user.role
```

---

### 11. **employeeHubController.js** ⚠️
**Current Issue**: Employee CRUD operations don't track admin who performed action
**Risk**: High - admins create/update/terminate employees
**Required Changes**:
```javascript
createdBy: req.user._id,                        // Actor (admin who hired)
createdByRole: req.user.role,
terminatedBy: req.user._id,                     // Actor (admin who terminated)
terminationApprovedBy: req.user._id
```

---

## 🎯 Priority Implementation Order

### **P0 - CRITICAL** (Do First)
1. **employeeHubController.js** - Employee lifecycle actions
2. **expenseController.js** - Expense approvals
3. **rotaController.js** - Shift assignments

### **P1 - HIGH** (Do Next)
4. **goalsController.js** - Goal creation/management
5. **performanceController.js** - Performance evaluations
6. **reviewController.js** - Review creation

### **P2 - MEDIUM** (Nice to Have)
7. **leaveApprovalController.js** - Enhanced leave tracking
8. **teamController.js** - Team management tracking
9. **reviewsController.js** - Review submissions

### **P3 - LOW** (Optional)
10. **reportingController.js** - Report generation tracking
11. **reportLibraryController.js** - Report library tracking

---

## 📋 Implementation Checklist

For each controller, implement:

### Schema Changes
```javascript
// Add to model
createdBy: { type: ObjectId, ref: 'User', required: false },
createdByRole: { type: String, enum: ROLE_ENUMS },
isAdminCreated: { type: Boolean, default: false }
```

### Controller Logic
```javascript
// Extract actor information
const actorUserId = req.user?._id || req.user?.userId || req.user?.id;
const actorRole = req.user?.role || req.user?.userType;
const isAdmin = ADMIN_ROLES.includes(actorRole);

// Store in database
{
  createdBy: actorUserId,
  createdByRole: actorRole,
  isAdminCreated: isAdmin,
  // ... existing fields
}
```

---

## 🔍 Detection Pattern

To find areas needing ACTOR_SUBJECT:

1. **Search for**: `req.user.employeeId`
2. **Check if**: Operation affects another employee
3. **If yes**: Implement ACTOR_SUBJECT pattern
4. **Track**: User._id (actor) separate from EmployeeHub._id (subject)

---

## ✅ Benefits of Full Implementation

1. **Complete Audit Trail**: Know exactly who performed every admin action
2. **Compliance Ready**: Meet regulatory requirements
3. **Debug Support**: Trace issues to specific admin actions
4. **Analytics**: Track admin productivity and patterns
5. **Profile Admin Support**: Works for admins without EmployeeHub records

---

## 📊 Current Status Summary

- ✅ **Implemented**: 5 controllers (overtime, sickness, lateness, leave, documents)
- ⚠️ **Needs Work**: 11 controllers
- 📈 **Coverage**: ~31% complete
- 🎯 **Target**: 100% coverage for all admin actions

---

**Next Steps**: Implement P0 controllers first, then proceed through priority levels.
