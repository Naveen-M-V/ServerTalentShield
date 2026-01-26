# Actor/Subject Pattern - Quick Reference

## ✅ Implementation Complete - Zero Breaking Changes

### What Changed?
Added **optional tracking fields** to identify:
- **Actor**: Admin User who performed the action
- **Subject**: Employee the action was performed for

---

## Modified Files

### Schemas (Added Optional Fields)
1. **[backend/models/TimeEntry.js](backend/models/TimeEntry.js)**
   - `performedBy` (User ref)
   - `performedByRole` (admin/hr/employee)
   - `isAdminAction` (boolean)
   - `actionNotes` (string)

2. **[backend/models/LeaveRequest.js](backend/models/LeaveRequest.js)**
   - `approvedByUserId` (User ref)
   - `approverRole` (admin/super-admin/hr/manager)
   - `approverComments` (string)

3. **[backend/models/DocumentManagement.js](backend/models/DocumentManagement.js)**
   - `performedByAdmin` (boolean)
   - `targetEmployeeId` (EmployeeHub ref)

### Endpoints (Enhanced Logic)
4. **[backend/routes/clockRoutes.js](backend/routes/clockRoutes.js)**
   - Clock in: Detects admin action, populates actor fields
   - Clock out: Appends admin action to notes

5. **[backend/controllers/unifiedLeaveController.js](backend/controllers/unifiedLeaveController.js)**
   - Approve: Tracks admin User ID who approved
   - Reject: Tracks admin User ID who rejected

6. **[backend/routes/documentManagement.js](backend/routes/documentManagement.js)**
   - Upload: Flags admin uploads for employees

---

## How It Works

### Before (Employee Self-Service)
```javascript
// Employee clocks in themselves
TimeEntry {
  employee: "EmployeeHub_ID_123",
  clockIn: "2024-01-15T09:00:00Z",
  // NEW FIELDS: All null/false (backward compatible)
  performedBy: null,
  performedByRole: null,
  isAdminAction: false,
  actionNotes: null
}
```

### After (Admin Action)
```javascript
// Admin clocks in an employee
TimeEntry {
  employee: "EmployeeHub_ID_123",        // Subject
  clockIn: "2024-01-15T09:00:00Z",
  // NEW FIELDS: Populated for admin actions
  performedBy: "User_ID_456",            // Actor
  performedByRole: "admin",
  isAdminAction: true,
  actionNotes: "Admin clock-in by John Doe"
}
```

---

## Query Examples

### Find All Admin Actions
```javascript
// Admin clock-ins
TimeEntry.find({ isAdminAction: true })

// Admin leave approvals
LeaveRequest.find({ approverRole: { $in: ['admin', 'super-admin'] } })

// Admin document uploads
DocumentManagement.find({ performedByAdmin: true })
```

### Find Actions by Specific Admin
```javascript
const adminUserId = "User_ID_456";

// Clock actions
TimeEntry.find({ performedBy: adminUserId })

// Leave approvals
LeaveRequest.find({ approvedByUserId: adminUserId })
```

### Find Employee History (All Actions)
```javascript
const employeeId = "EmployeeHub_ID_123";

// All clock entries (admin + self-service)
TimeEntry.find({ employee: employeeId })

// Only self-service entries
TimeEntry.find({ employee: employeeId, isAdminAction: false })

// Only admin entries
TimeEntry.find({ employee: employeeId, isAdminAction: true })
```

---

## Benefits

✅ **Complete Audit Trail**: Know exactly who performed every action  
✅ **Compliance Ready**: Meet regulatory requirements for action tracking  
✅ **Zero Breaking Changes**: Existing functionality unchanged  
✅ **No Migration Needed**: Optional fields with defaults  
✅ **Future-Proof**: Foundation for advanced reporting  

---

## Testing Status

### ✅ Confirmed Working
- Employee clock in/out (unchanged)
- Admin clock in/out (enhanced)
- Leave approval/rejection (enhanced)
- Document upload (enhanced)
- Annual leave balance display (fixed previously)

### 🔄 Ready for Testing
- Admin action audit reports (NEW capability)
- Frontend display of actor information (FUTURE)
- Performance with large datasets (MONITOR)

---

## Next Steps

### Immediate
- ✅ Schema changes deployed
- ✅ Endpoint logic updated
- ✅ Documentation created

### Short-Term (Recommended)
1. **Frontend Enhancements**
   - Display "Clocked in by Admin John Doe" in UI
   - Show admin approver name in notifications
   - Add "Admin Actions" filter

2. **Admin Dashboard**
   - "My Admin Actions" widget
   - "Admin Actions Log" page
   - Export audit trail

### Long-Term (Optional)
- Advanced analytics
- Compliance reports
- Role-based metrics

---

## Files to Review

- **[ACTOR_SUBJECT_IMPLEMENTATION.md](ACTOR_SUBJECT_IMPLEMENTATION.md)**: Complete documentation
- **[backend/models/TimeEntry.js](backend/models/TimeEntry.js)**: Schema changes
- **[backend/models/LeaveRequest.js](backend/models/LeaveRequest.js)**: Schema changes
- **[backend/models/DocumentManagement.js](backend/models/DocumentManagement.js)**: Schema changes
- **[backend/routes/clockRoutes.js](backend/routes/clockRoutes.js)**: Clock endpoint updates
- **[backend/controllers/unifiedLeaveController.js](backend/controllers/unifiedLeaveController.js)**: Leave approval updates
- **[backend/routes/documentManagement.js](backend/routes/documentManagement.js)**: Document upload updates

---

## Summary

**Status**: ✅ **Production Ready**  
**Breaking Changes**: 0  
**Migration Required**: No  
**Risk Level**: Minimal (all fields optional)  

The actor/subject pattern is fully implemented and backward compatible. All existing functionality works unchanged, while new fields provide complete audit trail tracking for admin actions on behalf of employees.
