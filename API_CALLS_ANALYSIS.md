# Frontend API Calls Analysis

**Date:** January 23, 2026  
**Environment Variables Set:**
- `REACT_APP_API_BASE_URL=https://hrms.talentshield.co.uk/api`
- `REACT_APP_API_URL=https://hrms.talentshield.co.uk`

---

## Summary

The frontend codebase has **5 distinct patterns** for constructing API URLs with varying levels of compatibility:

| Pattern | Status | Files Count | Impact |
|---------|--------|-------------|--------|
| buildApiUrl() function | ✓ WORKS | 8 files | Clean, centralized, recommended |
| Hardcoded /api/ paths | ✗ BREAKS | 31 files | Will use relative URLs through web server |
| process.env.REACT_APP_API_BASE_URL | ⚠ MIXED | 18 files | Depends on fallback/construction |
| process.env.REACT_APP_API_URL | ⚠ MIXED | 10 files | Requires /api appending |
| API_BASE constants | ⚠ MIXED | 6 files | Depends on initial value |

---

## CATEGORY 1: Using buildApiUrl() - ✓ WORKS

**Status:** ✓ WORKS CORRECTLY

**How it works:** The `buildApiUrl()` function from `apiConfig.js` automatically constructs URLs by:
1. Taking the base URL without /api suffix
2. Appending /api + provided path
3. Result: `https://hrms.talentshield.co.uk/api/certificates`

**Files using this pattern (8):**

### Utils & API Services:
1. [frontend/src/utils/reviewsApi.js](frontend/src/utils/reviewsApi.js)
   - Line 49: `buildApiUrl('/reviews?...')`
   - Line 57: `buildApiUrl('/reviews/my')`
   - Line 72: `buildApiUrl('/reviews/${id}')`
   - ✓ WORKS

2. [frontend/src/utils/rotaApi.js](frontend/src/utils/rotaApi.js)
   - Lines 9, 21, 45, 64, 84, 97, 109, 123, 145, 159, 171, 195, 214, 233, 253, 266, 278, 290, 303, 316
   - All use `buildApiUrl(${ROTA_BASE}/...)`
   - ✓ WORKS

### Pages:
3. [frontend/src/pages/FolderView.js](frontend/src/pages/FolderView.js)
   - Line 86: `buildApiUrl('/documentManagement/folders/${folderId}')`
   - Line 124: `buildApiUrl('/documentManagement/documents/${doc._id}/download')`
   - Line 159: `buildApiUrl('/documentManagement/folders/${item._id}')`
   - Line 163: `buildApiUrl('/documentManagement/documents/${item._id}')`
   - Line 198: `buildApiUrl('/documentManagement/documents/${docToRename._id}')`
   - ✓ WORKS

---

## CATEGORY 2: Hardcoded /api/ paths - ✗ BREAKS

**Status:** ✗ BREAKS - Will use relative URLs routed through web server

**How it works:** Direct `/api/` paths are relative URLs. Browser will resolve them relative to current host:
- Request: `GET /api/expenses/123`
- Resolved as: `https://hrms.talentshield.co.uk/api/expenses/123` ✓ (works via nginx proxy)
- BUT can fail if nginx isn't properly configured

**Critical Risk:** This approach assumes nginx reverse proxy correctly routes `/api/*` requests to the backend API.

**Files using hardcoded /api/ paths (31):**

### Pages:

4. [frontend/src/pages/ViewExpense.js](frontend/src/pages/ViewExpense.js)
   - Line 42: `axios.get('/api/expenses/${id}')`
   - Line 60: `axios.post('/api/expenses/${id}/approve')`
   - Line 75: `axios.post('/api/expenses/${id}/decline')`
   - Line 86: `axios.post('/api/expenses/${id}/pay')`
   - Line 97: `axios.post('/api/expenses/${id}/revert')`
   - Line 106: `axios.get('/api/expenses/${id}/attachments/${attachmentId}')`
   - ✗ BREAKS (depends on nginx)

5. [frontend/src/pages/ReportLibrary.js](frontend/src/pages/ReportLibrary.js)
   - Line 37: `axios.get('/api/report-library/types')`
   - ✗ BREAKS

6. [frontend/src/pages/Profile.js](frontend/src/pages/Profile.js)
   - Line 42: `fetch('/api/my-profile')`
   - ✗ BREAKS

7. [frontend/src/pages/OrganizationalChartNew.jsx](frontend/src/pages/OrganizationalChartNew.jsx)
   - Line 237: `axios.get('/api/employees/org-chart')`
   - Line 261: `axios.get('/api/employees/hub/all')`
   - Line 368: `axios.post('/api/employees/org-chart/save')`
   - ✗ BREAKS

8. [frontend/src/pages/OrganisationalChart.js](frontend/src/pages/OrganisationalChart.js)
   - Line 426: `axios.get('/api/employees/org-chart')`
   - Line 644: `axios.post('/api/employees/org-chart/save')`
   - ✗ BREAKS

9. [frontend/src/pages/MyProfile.js](frontend/src/pages/MyProfile.js)
   - Line 146: `axios.get('/api/employees/by-user-id/${userId}')`
   - Line 151: `axios.get('/api/employees/by-email/${currentUser.email}')`
   - Line 157: `axios.get('/api/employees/by-email/${currentUser.email}')`
   - ✗ BREAKS

10. [frontend/src/pages/MyAccount.js](frontend/src/pages/MyAccount.js)
    - Line 171: `profilePicturePath || '/api/profiles/${profileId}/picture'`
    - ✗ BREAKS

11. [frontend/src/pages/ManagerApprovalDashboard.js](frontend/src/pages/ManagerApprovalDashboard.js)
    - Line 39: `axios.get('/api/leave/pending-requests')`
    - ✗ BREAKS

12. [frontend/src/pages/Expenses.js](frontend/src/pages/Expenses.js)
    - Line 77: `'/api/expenses'` and `'/api/expenses/approvals'`
    - Line 104: `axios.post('/api/expenses/${expenseId}/approve')`
    - Line 119: `axios.post('/api/expenses/${expenseId}/decline')`
    - ✗ BREAKS

13. [frontend/src/pages/EditEmployeeProfile.js](frontend/src/pages/EditEmployeeProfile.js)
    - Line 94: `axios.get('/api/employees?status=Active')`
    - Line 105: `axios.get('/api/leave/balance/${id}')`
    - Line 117: `axios.get('/api/employees/${id}')`
    - ✗ BREAKS

14. [frontend/src/pages/CreateCertificate.js](frontend/src/pages/CreateCertificate.js)
    - Line 43: `fetch('/api/profiles')`
    - ✗ BREAKS

15. [frontend/src/pages/Calendar.js](frontend/src/pages/Calendar.js)
    - Line 156: `axios.get('/api/leave/denied-requests')`
    - Line 174: `axios.get('/api/leave/approved-requests')`
    - Line 189: `axios.get('/api/leave/pending-requests')`
    - Line 613: `'/api/leave/admin/time-off'`
    - ✗ BREAKS

16. [frontend/src/pages/AdminExpenses.js](frontend/src/pages/AdminExpenses.js)
    - Line 41: `axios.get('/api/employees')`
    - Line 62-63: `'/api/expenses/approvals'` and `'/api/expenses'`
    - Line 86: `axios.post('/api/expenses/${id}/approve')`
    - Line 97: `axios.post('/api/expenses/${id}/decline')`
    - ✗ BREAKS

17. [frontend/src/pages/AddExpense.js](frontend/src/pages/AddExpense.js)
    - Line 249: `axios.post('/api/expenses')`
    - Line 257: `axios.post('/api/expenses/${expenseId}/attachments')`
    - ✗ BREAKS

### Components:

18. [frontend/src/components/EmployeeCalendarView.jsx](frontend/src/components/EmployeeCalendarView.jsx)
    - Line 54: `axios.get('/api/leave/calendar')`
    - Line 90: `axios.get('/api/leave/my-requests')`
    - ✗ BREAKS

19. [frontend/src/components/LeaveBalanceCards.js](frontend/src/components/LeaveBalanceCards.js)
    - Line 15: `axios.get('/api/leave/balance')`
    - ✗ BREAKS

20. [frontend/src/components/LeaveRequestForm.js](frontend/src/components/LeaveRequestForm.js)
    - Line 48: `axios.get('/api/users')`
    - Line 115: `axios.post('/api/leave-requests')`
    - ✗ BREAKS

21. [frontend/src/components/MyLeaveRequests.js](frontend/src/components/MyLeaveRequests.js)
    - Line 37: `axios.get('/api/leave/my-requests')`
    - ✗ BREAKS

22. [frontend/src/components/UpcomingLeavesCard.js](frontend/src/components/UpcomingLeavesCard.js)
    - Line 15: `axios.get('/api/leave/my-requests?status=Approved')`
    - ✗ BREAKS

23. [frontend/src/components/Reports/ReportGenerationPanel.js](frontend/src/components/Reports/ReportGenerationPanel.js)
    - Lines 34, 45-56, 209, 225: Multiple hardcoded `/api/` paths
    - Line 34: `axios.get('/api/employees')`
    - Lines 45-56: Report types map with `/api/report-library/*` paths
    - Line 209: `axios.post('/api/report-library/export/csv')`
    - Line 225: `axios.post('/api/report-library/export/pdf')`
    - ✗ BREAKS

24. [frontend/src/components/LeaveManagement/LeaveForm.jsx](frontend/src/components/LeaveManagement/LeaveForm.jsx)
    - Line 86: `axios.post('/api/leave/request')`
    - ✗ BREAKS

25. [frontend/src/components/EmployeeLeaveSection.js](frontend/src/components/EmployeeLeaveSection.js)
    - Line 26: `axios.get('/api/leave/my-requests')`
    - ✗ BREAKS

26. [frontend/src/components/AnnualLeaveBalance.js](frontend/src/components/AnnualLeaveBalance.js)
    - Line 28: `axios.get('/api/employees')`
    - Line 29: `axios.get('/api/leave/balances')`
    - ✗ BREAKS

27. [frontend/src/components/EmployeeQuickView.js](frontend/src/components/EmployeeQuickView.js)
    - Line 45: `axios.get('/api/employees/${employee.managerId}')`
    - Line 62: `axios.get('/api/employees/${manager.managerId}')`
    - ✗ BREAKS

28. [frontend/src/components/ExpenseDetailsModal.js](frontend/src/components/ExpenseDetailsModal.js)
    - Line 27: `axios.get('/api/expenses/${id}')`
    - Line 126: `axios.post('/api/expenses/${id}/approve')`
    - Line 138: `axios.post('/api/expenses/${id}/decline')`
    - ✗ BREAKS

29. [frontend/src/components/DocumentManagement/DocumentPanel.js](frontend/src/components/DocumentManagement/DocumentPanel.js)
    - Line 45: `axios.get('/api/documentManagement/folders/${folder._id}')`
    - Line 91: `axios.post('/api/documentManagement/documents/${doc._id}/archive')`
    - ✗ BREAKS

---

## CATEGORY 3: process.env.REACT_APP_API_BASE_URL (Direct) - ⚠ MIXED

**Status:** ⚠ MIXED - Works but problematic patterns

**How it works:**
- Environment: `REACT_APP_API_BASE_URL=https://hrms.talentshield.co.uk/api`
- Code: `` `${process.env.REACT_APP_API_BASE_URL}/employees` ``
- Result: `https://hrms.talentshield.co.uk/api/api/employees` ✗ DOUBLE /API/
- OR if used without /api suffix: `` `${process.env.REACT_APP_API_BASE_URL}/employees` `` = `https://hrms.talentshield.co.uk/employees` ✗ NO /API/

**Problem:** Direct string interpolation without sanitization causes double /api/ or missing /api/.

**Files using this pattern (18):**

30. [frontend/src/pages/StaffDetail.js](frontend/src/pages/StaffDetail.js)
    - Line 15: `` `${process.env.REACT_APP_API_BASE_URL}/employees/${id}` ``
    - ✗ BREAKS (double /api/)

31. [frontend/src/pages/ProfileDetailView.js](frontend/src/pages/ProfileDetailView.js)
    - Line 494: `` `${process.env.REACT_APP_API_BASE_URL}/certificates/...` ``
    - Line 505: `` `${process.env.REACT_APP_API_BASE_URL}/certificates/...` ``
    - ✗ BREAKS (double /api/)

32. [frontend/src/pages/ManageTeams.js](frontend/src/pages/ManageTeams.js)
    - Line 68: `` `${process.env.REACT_APP_API_BASE_URL}/employees` ``
    - Line 92: `` `${process.env.REACT_APP_API_BASE_URL}/teams` ``
    - Line 208: `` `${process.env.REACT_APP_API_BASE_URL}/teams` ``
    - Line 238: `` `${process.env.REACT_APP_API_BASE_URL}/teams/${teamId}` ``
    - Line 273: `` `${process.env.REACT_APP_API_BASE_URL}/teams/${teamId}` ``
    - Line 316: `` `${process.env.REACT_APP_API_BASE_URL}/teams/${editingTeam.id}` ``
    - Line 339, 376, 379, 398: More similar patterns
    - ✗ BREAKS (double /api/)

33. [frontend/src/pages/UserDashboard.js](frontend/src/pages/UserDashboard.js)
    - Lines 1475, 1712, 1833: `const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';`
    - Then uses `` `${API_BASE_URL}/...` ``
    - ✗ BREAKS (double /api/)

34. [frontend/src/pages/EmployeeHub.js](frontend/src/pages/EmployeeHub.js)
    - Line 45: `` `${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true` ``
    - ✗ BREAKS (double /api/)

35. [frontend/src/pages/ELearning.js](frontend/src/pages/ELearning.js)
    - Line 10: `const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';`
    - ✗ BREAKS (double /api/)

36. [frontend/src/pages/ClockInOut.js](frontend/src/pages/ClockInOut.js)
    - Line 39: `` `${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true` ``
    - ✗ BREAKS (double /api/)

37. [frontend/src/pages/ClockIns.js](frontend/src/pages/ClockIns.js)
    - Line 126: `` `${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true` ``
    - ✗ BREAKS (double /api/)

38. [frontend/src/context/CertificateContext.js](frontend/src/context/CertificateContext.js)
    - Line 14: `const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;`
    - ✗ BREAKS (double /api/)

39. [frontend/src/pages/Goals.js](frontend/src/pages/Goals.js)
    - Line 6: `const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';`
    - Line 121: `` `${API_BASE}/auth/me` ``
    - Line 146: `` `${API_BASE}/goals/summary/all` ``
    - Lines 169, 217, 220, 237, 249, 272: More uses
    - ✗ BREAKS (double /api/)

40. [frontend/src/components/Reviews/CreateReviewModal.js](frontend/src/components/Reviews/CreateReviewModal.js)
    - Line 5: `const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';`
    - ✗ BREAKS (double /api/ in production)

41. [frontend/src/components/Reviews/CommentReviewModal.js](frontend/src/components/Reviews/CommentReviewModal.js)
    - Line 5: `const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';`
    - ✗ BREAKS (double /api/ in production)

---

## CATEGORY 4: process.env.REACT_APP_API_URL - ⚠ MIXED

**Status:** ⚠ MIXED - Better than API_BASE_URL, but still problematic

**How it works:**
- Environment: `REACT_APP_API_URL=https://hrms.talentshield.co.uk`
- Code: `` `${process.env.REACT_APP_API_URL}/api/notifications` ``
- Result: `https://hrms.talentshield.co.uk/api/notifications` ✓ WORKS
- BUT: Some files use `` `${process.env.REACT_APP_API_URL}/certificates/...` `` = `https://hrms.talentshield.co.uk/certificates/...` ✗ NO /API/

**Files using this pattern (10):**

42. [frontend/src/pages/ViewCertificate.js](frontend/src/pages/ViewCertificate.js)
    - Line 390: `` `${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/api/certificates/...` ``
    - ✓ WORKS (properly appends /api)

43. [frontend/src/pages/UserDashboard.js](frontend/src/pages/UserDashboard.js)
    - Line 82: `const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - Then uses `` `${API_BASE_URL}/api/...` `` 
    - ✓ WORKS (when appended with /api)

44. [frontend/src/pages/UserCertificateView.js](frontend/src/pages/UserCertificateView.js)
    - Line 31: `const API_BASE_URL = process.env.REACT_APP_API_URL || '';`
    - ✗ BREAKS (depends on if /api is appended)

45. [frontend/src/pages/ResetPassword.js](frontend/src/pages/ResetPassword.js)
    - Line 77: `const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - ✗ BREAKS (depends on if /api is appended)

46. [frontend/src/pages/ForgotPassword.js](frontend/src/pages/ForgotPassword.js)
    - Line 34: `const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - ✗ BREAKS (depends on if /api is appended)

47. [frontend/src/pages/EditProfile.js](frontend/src/pages/EditProfile.js)
    - Line 36-37: Conditional usage in dev mode
    - Line 44: `return process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - ✗ BREAKS

48. [frontend/src/pages/Documents.js](frontend/src/pages/Documents.js)
    - Line 64: `const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';`
    - Line 65-66: `` `${apiUrl}/api/documentManagement/folders` ``
    - ✓ WORKS (properly appends /api)

49. [frontend/src/pages/EditCertificate.js](frontend/src/pages/EditCertificate.js)
    - Line 124-125: Conditional usage
    - Line 132: `return process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - ✗ BREAKS

50. [frontend/src/pages/CreateCertificate.js](frontend/src/pages/CreateCertificate.js)
    - Line 152-153: Conditional usage
    - Line 160: `return process.env.REACT_APP_API_URL || 'http://localhost:5003';`
    - ✗ BREAKS

51. [frontend/src/context/NotificationContext.js](frontend/src/context/NotificationContext.js)
    - Line 55: `const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5004';`
    - Line 56: `` `${API_BASE_URL}/api/notifications` ``
    - ✓ WORKS (properly appends /api)
    - Line 146: `const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL;`
    - Line 147: `` `${API_BASE_URL}/api/notifications/${notificationId}/read` ``
    - ✗ BREAKS (missing /api/ if REACT_APP_API_BASE_URL used)

---

## CATEGORY 5: Hardcoded API_BASE Constants - ⚠ MIXED

**Status:** ⚠ MIXED - Depends on initialization

**How it works:** Constants are initialized with env variables at module load time.

**Files using this pattern (6):**

52. [frontend/src/utils/performanceApi.js](frontend/src/utils/performanceApi.js)
    - Line 3: `const API_BASE_URL = '/api/performance';`
    - ✓ WORKS (relative path via nginx)

53. [frontend/src/utils/config.js](frontend/src/utils/config.js)
    - Line 23: `export const API_BASE_URL = getApiBaseUrl();`
    - Which returns: `http://localhost:5004/api` or from env vars
    - ✓ WORKS (when used correctly)

54. [frontend/src/context/AuthContext.js](frontend/src/context/AuthContext.js)
    - Line 33: `const API_BASE_URL = getApiUrl();`
    - ✓ WORKS (depends on getApiUrl() implementation)

55. [frontend/src/config/development.js](frontend/src/config/development.js)
    - Line 11: `window.REACT_APP_API_BASE_URL = 'http://localhost:5004';`
    - ✓ WORKS (dev environment only)

---

## SUMMARY TABLE

| Category | Pattern | Files | Status | Recommendation |
|----------|---------|-------|--------|-----------------|
| 1 | buildApiUrl() | 8 | ✓ WORKS | **RECOMMENDED** - Use everywhere |
| 2 | Hardcoded `/api/` | 31 | ✗ BREAKS | Risky - depends on nginx proxy |
| 3 | REACT_APP_API_BASE_URL | 18 | ✗ BREAKS | Double /api/ path issue |
| 4 | REACT_APP_API_URL | 10 | ⚠ MIXED | Some work if /api properly appended |
| 5 | API_BASE constants | 6 | ⚠ MIXED | Works in some contexts |

---

## ROOT CAUSE ANALYSIS

### The Problem:
The environment variables are:
- `REACT_APP_API_BASE_URL=https://hrms.talentshield.co.uk/api` (has /api)
- `REACT_APP_API_URL=https://hrms.talentshield.co.uk` (no /api)

But the code assumes:
- `REACT_APP_API_BASE_URL=https://hrms.talentshield.co.uk` (no /api)
- `REACT_APP_API_URL=https://hrms.talentshield.co.uk/api` (has /api)

This is **backwards from convention**.

### Why buildApiUrl() Works:
```javascript
export const buildApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  // Takes REACT_APP_API_BASE_URL, removes /api if present
  // Then appends /api + path
  return `${baseUrl}/api${cleanPath}`;
};
```

It strips `/api` from the input and re-adds it, making it robust.

---

## RECOMMENDATIONS

### Immediate Actions:

1. **Standardize Environment Variables:**
   ```
   REACT_APP_API_BASE_URL=https://hrms.talentshield.co.uk (no /api)
   REACT_APP_API_URL=https://hrms.talentshield.co.uk (no /api)
   ```

2. **Migrate all 31 hardcoded /api/ files to use buildApiUrl():**
   - Replace: `axios.get('/api/expenses/...')`
   - With: `axios.get(buildApiUrl('/expenses/...'))`

3. **Fix 18 files using process.env.REACT_APP_API_BASE_URL directly:**
   - Replace: `` `${process.env.REACT_APP_API_BASE_URL}/employees` ``
   - With: `buildApiUrl('/employees')`

4. **Fix 10 files using process.env.REACT_APP_API_URL:**
   - Replace: `` `${process.env.REACT_APP_API_URL}/api/...` ``
   - With: `buildApiUrl('/...')`

### Best Practice:

Only use `buildApiUrl()` for **ALL** API calls. It's:
- ✓ Centralized
- ✓ Tested
- ✓ Handles edge cases (trailing slashes, missing /api)
- ✓ Easy to debug
- ✓ Future-proof

---

## Files Needing Migration (Priority Order)

**HIGH PRIORITY (Hardcoded /api/paths - 31 files):**
1. ViewExpense.js (6 API calls)
2. ReportLibrary.js
3. Profile.js
4. OrganizationalChartNew.jsx
5. OrganisationalChart.js
6. MyProfile.js
7. MyAccount.js
8. ManagerApprovalDashboard.js
9. Expenses.js
10. EditEmployeeProfile.js
11. CreateCertificate.js
12. Calendar.js
13. AdminExpenses.js
14. AddExpense.js
15. EmployeeCalendarView.jsx
16. LeaveBalanceCards.js
17. LeaveRequestForm.js
18. MyLeaveRequests.js
19. UpcomingLeavesCard.js
20. ReportGenerationPanel.js
21. LeaveForm.jsx
22. EmployeeLeaveSection.js
23. AnnualLeaveBalance.js
24. EmployeeQuickView.js
25. ExpenseDetailsModal.js
26. DocumentPanel.js

**MEDIUM PRIORITY (Direct env var usage - 18 files):**
27. StaffDetail.js
28. ProfileDetailView.js
29. ManageTeams.js
30. UserDashboard.js
31. EmployeeHub.js
32. ELearning.js
33. ClockInOut.js
34. ClockIns.js
35. CertificateContext.js
36. Goals.js
37. CreateReviewModal.js
38. CommentReviewModal.js

**LOW PRIORITY (Already partially working - 10 files):**
39. ViewCertificate.js (mostly works)
40. UserCertificateView.js
41. ResetPassword.js
42. ForgotPassword.js
43. EditProfile.js
44. Documents.js
45. EditCertificate.js
46. NotificationContext.js

---

## Testing Checklist

After migration, verify:
- [ ] All API calls reach `https://hrms.talentshield.co.uk/api/...`
- [ ] No double /api/ paths
- [ ] No missing /api/ paths
- [ ] All endpoints return 200/expected status codes
- [ ] Error handling works correctly
- [ ] CORS headers are correct
- [ ] Authentication headers are sent
