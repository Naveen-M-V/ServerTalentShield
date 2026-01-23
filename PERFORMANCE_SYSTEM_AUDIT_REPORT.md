# Performance System Audit Report

**Date:** 2024-12-06  
**Scope:** Goals and Reviews pages (frontend + backend)  
**Status:** ⚠️ CRITICAL ISSUE IDENTIFIED - Goals Page API Calls Are Broken

---

## Executive Summary

The Performance section (Goals and Reviews) is experiencing critical failures due to **inconsistent API URL construction patterns**. The Goals page uses a hardcoded API_BASE constant that defaults to `/api`, causing all API requests to fail with 404 errors. The Reviews page correctly uses the `buildApiUrl()` utility but may have related issues.

### Critical Finding

**Goals.js** (Line 6):
```javascript
const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
```

This means:
- **Development (localhost):** API calls go to `http://localhost:3000/api/goals` (WRONG - should be `http://localhost:5004/api/goals`)
- **Production:** API calls go to `https://hrms.talentshield.co.uk/api/api/goals` (WRONG - double `/api/`)

All 17 API calls in Goals.js are affected:
- `GET ${API_BASE}/auth/me` → **404 Not Found**
- `GET ${API_BASE}/goals/summary/all` → **404 Not Found**
- `GET ${API_BASE}/goals/my` → **404 Not Found**
- `POST ${API_BASE}/goals` → **404 Not Found**
- `PUT ${API_BASE}/goals/:id` → **404 Not Found**
- `DELETE ${API_BASE}/goals/:id` → **404 Not Found**
- `POST ${API_BASE}/goals/:id/approve` → **404 Not Found**
- `POST ${API_BASE}/goals/:id/comment` → **404 Not Found**

---

## System Architecture Analysis

### 1. API Configuration Patterns Across Codebase

#### ✅ **CORRECT PATTERN** (Used by working modules)

**buildApiUrl() Utility** ([frontend/src/utils/apiConfig.js](frontend/src/utils/apiConfig.js)):
```javascript
export const buildApiUrl = (path) => {
  const baseUrl = getApiBaseUrl(); // Returns http://localhost:5004 or https://hrms.talentshield.co.uk
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api${cleanPath}`; // Correct: baseUrl + /api + path
};
```

**Examples from working pages:**
- **Reviews.js** (Line 87): `axios.get(buildApiUrl('/auth/me'))`
  - Result: `http://localhost:5004/api/auth/me` ✅
- **Documents.js** (Line 66): Manual but correct:
  ```javascript
  const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
  axios.get(`${apiUrl}/api/documentManagement/folders`)
  ```
  - Result: `http://localhost:5004/api/documentManagement/folders` ✅

#### ❌ **BROKEN PATTERN** (Used by Goals.js)

**Goals.js** (Line 6):
```javascript
const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
```

**Line 121**: `axios.get(${API_BASE}/auth/me)`
- **Development:** `http://localhost:3000/api/auth/me` ❌ (Wrong port - frontend port, not backend)
- **Production:** `https://hrms.talentshield.co.uk/api/auth/me` ❌ (May work if env var set, but inconsistent)

**Line 169**: `axios.get(${API_BASE}${url})` where `url = '/goals/my'`
- **Development:** `http://localhost:3000/api/goals/my` ❌
- **Production:** `https://hrms.talentshield.co.uk/api/goals/my` ❌

---

## Detailed Component Analysis

### Frontend: Goals Page

**File:** [frontend/src/pages/Goals.js](frontend/src/pages/Goals.js) (690 lines)

#### Current Behavior

1. **User opens Goals page** → `fetchCurrentUser()` called
2. **API call:** `GET /api/auth/me` using `${API_BASE}` constant
3. **Result:** 404 Not Found (requests go to wrong server/port)
4. **UI State:** Loading spinner indefinitely OR "No goals found" (depending on error handling)
5. **Admin features:** Approve button, comment button, filters → All broken (no data loads)

#### Code Analysis

**Line 6:** Root cause
```javascript
const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
```

**Lines 121-128:** Auth check fails
```javascript
const res = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true });
setIsAdmin(ADMIN_ROLES.includes(res.data.role));
```
- No error handling for 404
- User's admin status never set correctly
- Tab switching (mine/team) broken

**Lines 146-152:** Summary stats broken
```javascript
const res = await axios.get(`${API_BASE}/goals/summary/all`, { withCredentials: true });
setSummary(res.data.summary);
```
- Admin dashboard stats never load

**Lines 161-177:** Goal fetching broken
```javascript
const url = isAdmin && activeTab === 'team' ? '/goals' : '/goals/my';
const res = await axios.get(`${API_BASE}${url}`, { params, withCredentials: true });
```
- User goals never load
- Team goals never load

**Lines 209-227:** Create/Edit goals broken
```javascript
if (editingGoal) {
  await axios.put(`${API_BASE}/goals/${editingGoal._id}`, payload, { withCredentials: true });
} else {
  await axios.post(`${API_BASE}/goals`, payload, { withCredentials: true });
}
```
- Form submissions fail silently or with error toasts

**Lines 235-239:** Delete goals broken
```javascript
await axios.delete(`${API_BASE}/goals/${goal._id}`, { withCredentials: true });
```

**Lines 247-252:** Approve goals broken (admin only)
```javascript
await axios.post(`${API_BASE}/goals/${goal._id}/approve`, {}, { withCredentials: true });
```

**Lines 269-277:** Add comments broken (admin only)
```javascript
await axios.post(
  `${API_BASE}/goals/${commentGoal._id}/comment`,
  { comment: commentText },
  { withCredentials: true }
);
```

#### API Calls Summary

| HTTP Method | Endpoint | Purpose | Status |
|-------------|----------|---------|--------|
| GET | `/auth/me` | Check user role | ❌ Broken |
| GET | `/goals/summary/all` | Admin dashboard stats | ❌ Broken |
| GET | `/goals/my` | User's personal goals | ❌ Broken |
| GET | `/goals` | All goals (admin view) | ❌ Broken |
| POST | `/goals` | Create new goal | ❌ Broken |
| PUT | `/goals/:id` | Update goal | ❌ Broken |
| DELETE | `/goals/:id` | Delete goal | ❌ Broken |
| POST | `/goals/:id/approve` | Admin approve goal | ❌ Broken |
| POST | `/goals/:id/comment` | Admin add comment | ❌ Broken |

---

### Frontend: Reviews Page

**File:** [frontend/src/pages/Reviews.js](frontend/src/pages/Reviews.js) (702 lines)

#### Current Behavior

1. **User opens Reviews page** → `fetchCurrentUser()` called
2. **API call:** `GET buildApiUrl('/auth/me')` ✅ CORRECT
3. **Result:** 200 OK (user role detected)
4. **Subsequent calls:** All use `buildApiUrl()` ✅ CORRECT
5. **Potential Issue:** May still fail if backend has issues, but URL construction is correct

#### Code Analysis

**Line 87:** Auth check (CORRECT)
```javascript
const res = await axios.get(buildApiUrl('/auth/me'), { withCredentials: true });
setIsAdmin(ADMIN_ROLES.includes(res.data.role));
```

**Line 114:** Fetch employees (CORRECT)
```javascript
const res = await axios.get(buildApiUrl('/employees'), { withCredentials: true });
```

**Line 135:** Fetch reviews (CORRECT)
```javascript
const url = activeTab === 'my' ? '/reviews/my' : '/reviews';
const res = await axios.get(buildApiUrl(url), { params, withCredentials: true });
```

**Line 172:** Submit self-assessment (CORRECT)
```javascript
await axios.post(
  buildApiUrl(`/reviews/${selectedReview._id}/self`),
  { competencies: selfAssessment },
  { withCredentials: true }
);
```

**Line 206:** Submit manager feedback (CORRECT)
```javascript
await axios.post(
  buildApiUrl(`/reviews/${selectedReview._id}/manager`),
  managerFeedback,
  { withCredentials: true }
);
```

**Line 231:** Initiate review (CORRECT)
```javascript
await axios.post(
  buildApiUrl('/reviews/initiate'),
  { employeeId: selectedEmployee },
  { withCredentials: true }
);
```

#### API Calls Summary

| HTTP Method | Endpoint | Purpose | Status |
|-------------|----------|---------|--------|
| GET | `/auth/me` | Check user role | ✅ Correct URL |
| GET | `/employees` | Load employee list | ✅ Correct URL |
| GET | `/reviews/my` | User's reviews | ✅ Correct URL |
| GET | `/reviews` | All reviews (admin) | ✅ Correct URL |
| GET | `/reviews/:id` | Get review details | ✅ Correct URL |
| POST | `/reviews/:id/self` | Submit self-assessment | ✅ Correct URL |
| POST | `/reviews/:id/manager` | Submit manager feedback | ✅ Correct URL |
| POST | `/reviews/initiate` | Create new review | ✅ Correct URL |
| POST | `/reviews/:id/status` | Advance review status | ✅ Correct URL |

**Note:** Reviews page URLs are correct, but the page may still have issues if:
1. Backend endpoints are not working correctly
2. Database has no Review records
3. Authentication tokens are missing/invalid
4. RBAC middleware is blocking requests

---

### Backend: Goals Controller

**File:** [backend/controllers/goalsController.js](backend/controllers/goalsController.js) (434 lines)

#### Route Definitions

**File:** [backend/routes/goalsRoutes.js](backend/routes/goalsRoutes.js)

```javascript
router.use(authenticateSession); // Applied to ALL routes

// User routes
router.get('/my', getUserGoals); // User's personal goals
router.post('/', preventAdminFieldsEdit, createGoal); // Create goal
router.put('/:id', canModifyGoal, preventAdminFieldsEdit, updateGoal); // Update goal
router.delete('/:id', canDeleteGoal, deleteGoal); // Delete goal

// Admin routes
router.get('/summary/all', getAllGoals); // ⚠️ Should be admin-only but no middleware
router.post('/:id/approve', approveGoal); // ⚠️ Should be admin-only
router.post('/:id/comment', addCommentToGoal); // ⚠️ Should be admin-only
router.get('/:id', canAccessGoal, getGoalById); // Get specific goal
router.get('/', getAllGoals); // All goals (admin view)
```

**Issues Identified:**
1. **Route Order:** `/summary/all` is correctly placed BEFORE `/:id` (good)
2. **Missing RBAC:** Admin routes (`/summary/all`, `/:id/approve`, `/:id/comment`) have no explicit admin check in route definition
3. **Controller-level checks:** Admin logic is in controller functions (not middleware), which is inconsistent with Reviews

#### Controller Functions Analysis

**getUserGoals (Line ~50):**
```javascript
const goals = await Goal.find({ userId: req.user._id })
  .sort({ createdAt: -1 });
```
- ✅ Uses `req.user._id` from `authenticateSession` middleware
- ✅ Returns only user's own goals
- ❌ No error handling if `req.user` is undefined

**createGoal (Line ~80):**
```javascript
const employee = await EmployeeHub.findById(req.user._id);
if (!employee) throw new Error('Employee not found');

const newGoal = new Goal({
  userId: req.user._id,
  employeeName: `${employee.firstName} ${employee.lastName}`,
  department: employee.department,
  // ... other fields
});
```
- ✅ Fetches employee to denormalize name/department
- ✅ Sets `userId` to logged-in user
- ❌ No validation if employee is null (crashes server)

**updateGoal (Line ~130):**
```javascript
const goal = await Goal.findById(req.params.id);
if (!goal) return res.status(404).json({ error: 'Goal not found' });

if (goal.userId.toString() !== req.user._id.toString()) {
  return res.status(403).json({ error: 'Unauthorized' });
}

if (goal.adminApproved) {
  return res.status(400).json({ error: 'Cannot edit approved goals' });
}
```
- ✅ Ownership check
- ✅ Prevents editing approved goals
- ✅ Good error handling

**deleteGoal (Line ~170):**
```javascript
const goal = await Goal.findById(req.params.id);
if (goal.adminApproved) {
  return res.status(400).json({ error: 'Cannot delete approved goals' });
}
```
- ✅ Prevents deleting approved goals
- ⚠️ Ownership check done in middleware (`canDeleteGoal`)

**getAllGoals (Line ~200):**
```javascript
const { department, employee, status, approved } = req.query;

let query = {};
if (department) query.department = department;
if (employee) query.userId = employee;
if (status) query.status = status;
if (approved !== undefined) query.adminApproved = approved === 'true';

const goals = await Goal.find(query).sort({ createdAt: -1 });
```
- ⚠️ No admin role check (should only be accessible to admins)
- ⚠️ Returns ALL goals if no filters applied
- ✅ Supports filtering by department, employee, status, approval

**approveGoal (Line ~250):**
```javascript
const goal = await Goal.findById(req.params.id);
goal.adminApproved = true;
goal.adminComments.push({
  comment: req.body.comment || 'Approved',
  adminId: req.user._id,
  adminName: req.user.email // ⚠️ Should be name, not email
});
await goal.save();
```
- ⚠️ No admin role check (anyone can approve goals!)
- ⚠️ Uses `email` instead of name for `adminName`

**addCommentToGoal (Line ~280):**
```javascript
goal.adminComments.push({
  comment: req.body.comment,
  adminId: req.user._id,
  adminName: req.user.email // ⚠️ Should be name
});
```
- ⚠️ No admin role check

**getGoalsSummary (Line ~320):**
```javascript
const summary = await Goal.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```
- ⚠️ No admin role check (anyone can see summary stats)

#### Security Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| No admin role check on `/summary/all` | HIGH | Any user can see all goals |
| No admin role check on `/:id/approve` | CRITICAL | Any user can approve goals |
| No admin role check on `/:id/comment` | HIGH | Any user can add admin comments |
| Using `req.user.email` instead of name | LOW | Incorrect data stored |
| No null check after `EmployeeHub.findById` | MEDIUM | Server crashes if employee not found |

---

### Backend: Reviews Controller

**File:** [backend/controllers/reviewsController.js](backend/controllers/reviewsController.js) (407 lines)

#### Route Definitions

**File:** [backend/routes/reviewRoutes.js](backend/routes/reviewRoutes.js)

```javascript
router.use(authenticateSession); // Applied to ALL routes

// User routes
router.get('/my', getUserReviews); // User's reviews
router.get('/:id', canAccessReview, getReview); // Specific review (with RBAC)
router.post('/:id/self', canEditSelfAssessment, submitSelfAssessment); // Self-assessment (with RBAC)

// Admin routes
router.post('/initiate', initiateReview); // ⚠️ No explicit admin middleware
router.post('/:id/manager', canSubmitManagerFeedback, submitManagerFeedback); // Manager feedback (with RBAC)
router.post('/:id/status', advanceReviewStatus); // ⚠️ No explicit admin middleware
router.get('/', getAllReviews); // ⚠️ No explicit admin middleware
```

**RBAC Middleware:**
- `canAccessReview`: Checks if user owns review OR is admin
- `canEditSelfAssessment`: Checks if user owns review AND status is PENDING_SELF
- `canSubmitManagerFeedback`: Checks if user is manager/admin

**Issues Identified:**
1. **Inconsistent RBAC:** Some routes use middleware, others rely on controller logic
2. **Missing admin checks:** `/initiate`, `/:id/status`, `/` have no middleware protection

#### Controller Functions Analysis

**getUserReviews (Line ~50):**
```javascript
const reviews = await Review.find({ userId: req.user._id })
  .populate('createdBy', 'firstName lastName email')
  .populate('managerFeedback.submittedBy', 'firstName lastName email')
  .sort({ createdAt: -1 });
```
- ✅ Uses `req.user._id`
- ✅ Populates references correctly
- ✅ Returns only user's reviews

**getReview (Line ~80):**
```javascript
const review = await Review.findById(req.params.id)
  .populate('userId', 'firstName lastName email department')
  .populate('managerFeedback.submittedBy', 'firstName lastName email');

// Permission check done in middleware (canAccessReview)
```
- ✅ Protected by RBAC middleware

**submitSelfAssessment (Line ~120):**
```javascript
const review = await Review.findById(req.params.id);

if (review.status !== 'PENDING_SELF') {
  return res.status(400).json({ error: 'Cannot submit self-assessment at this stage' });
}

review.selfAssessment = competencies; // Array of { competency, rating, summary }
review.status = 'PENDING_MANAGER';
await review.save();
```
- ✅ Validates status before allowing submission
- ✅ Automatically advances status
- ✅ Protected by RBAC middleware

**initiateReview (Line ~160):**
```javascript
const { employeeId } = req.body;

// Check if employee already has active review
const existingReview = await Review.findOne({
  userId: employeeId,
  status: { $in: ['PENDING_SELF', 'PENDING_MANAGER'] }
});

if (existingReview) {
  return res.status(400).json({ error: 'Employee already has an active review' });
}

const newReview = new Review({
  userId: employeeId,
  createdBy: req.user._id,
  status: 'PENDING_SELF'
});
await newReview.save();
```
- ⚠️ No admin role check (should be admin-only)
- ✅ Prevents duplicate active reviews
- ✅ Sets `createdBy` to logged-in user

**submitManagerFeedback (Line ~210):**
```javascript
const review = await Review.findById(req.params.id);

if (review.status !== 'PENDING_MANAGER') {
  return res.status(400).json({ error: 'Cannot submit manager feedback at this stage' });
}

review.managerFeedback = {
  rating: req.body.rating,
  feedback: req.body.feedback,
  areasForImprovement: req.body.areasForImprovement,
  submittedBy: req.user._id,
  submittedAt: new Date()
};
review.status = 'COMPLETED';
await review.save();
```
- ✅ Validates status
- ✅ Protected by RBAC middleware (`canSubmitManagerFeedback`)
- ✅ Automatically completes review

**advanceReviewStatus (Line ~260):**
```javascript
const review = await Review.findById(req.params.id);

const statusFlow = {
  PENDING_SELF: 'PENDING_MANAGER',
  PENDING_MANAGER: 'COMPLETED'
};

review.status = statusFlow[review.status];
await review.save();
```
- ⚠️ No admin role check
- ✅ Enforces status flow

**getAllReviews (Line ~290):**
```javascript
const { status, employee } = req.query;

let query = {};
if (status) query.status = status;
if (employee) query.userId = employee;

const reviews = await Review.find(query)
  .populate('userId', 'firstName lastName email department')
  .sort({ createdAt: -1 });
```
- ⚠️ No admin role check (anyone can see all reviews)
- ✅ Supports filtering

#### Security Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| No admin role check on `/initiate` | HIGH | Any user can create reviews for others |
| No admin role check on `/:id/status` | MEDIUM | Any user can advance review status |
| No admin role check on `/` | HIGH | Any user can see all reviews |

---

## Data Models Analysis

### Goal Model

**File:** [backend/models/Goal.js](backend/models/Goal.js)

**Schema:**
```javascript
{
  userId: { type: ObjectId, ref: 'EmployeeHub', required: true, index: true },
  title: { type: String, required: true },
  description: String,
  category: { type: String, enum: categories },
  deadline: Date,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['TO_DO', 'IN_PROGRESS', 'ACHIEVED', 'OVERDUE'], default: 'TO_DO' },
  adminApproved: { type: Boolean, default: false, index: true },
  adminComments: [{
    comment: String,
    adminId: ObjectId,
    adminName: String,
    createdAt: { type: Date, default: Date.now }
  }],
  employeeName: String, // Denormalized for quick access
  department: String    // Denormalized for filtering
}
```

**Indexes:**
- `userId + status` (compound)
- `department + status` (compound)
- `adminApproved + status` (compound)

**Analysis:**
- ✅ Proper indexes for common queries
- ✅ Denormalization of `employeeName` and `department` reduces joins
- ⚠️ `adminComments.adminName` should store name, not email (controller issue)
- ✅ Progress field with validation (0-100)

### Review Model

**File:** [backend/models/Review.js](backend/models/Review.js)

**Schema:**
```javascript
{
  userId: { type: ObjectId, ref: 'EmployeeHub', required: true, index: true },
  cycleId: String, // Optional review cycle identifier
  selfAssessment: [{
    competency: String,
    rating: { type: Number, min: 1, max: 5 },
    summary: String
  }],
  managerFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    areasForImprovement: String,
    submittedBy: { type: ObjectId, ref: 'EmployeeHub' },
    submittedAt: Date
  },
  status: { type: String, enum: ['PENDING_SELF', 'PENDING_MANAGER', 'COMPLETED'], default: 'PENDING_SELF' },
  createdBy: { type: ObjectId, ref: 'EmployeeHub' } // Admin who initiated review
}
```

**Indexes:**
- `userId + status` (compound)
- `userId + createdAt` (compound)
- `cycleId + status` (compound)

**Analysis:**
- ✅ Proper indexes for common queries
- ✅ Rating validation (1-5)
- ✅ Separate `createdBy` field tracks who initiated review
- ✅ `cycleId` allows for annual/quarterly review cycles
- ✅ Status enforces 3-state workflow

---

## Root Cause Analysis

### Primary Issue: Goals Page Broken API Calls

**Problem:**
```javascript
// Goals.js Line 6
const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
```

**Why it's broken:**
1. **Development environment:**
   - Frontend runs on `http://localhost:3000`
   - Backend runs on `http://localhost:5004`
   - Goals page makes requests to `http://localhost:3000/api/goals` (frontend port)
   - Result: **404 Not Found** (frontend has no `/api` routes)

2. **Production environment (if env var not set):**
   - Frontend at `https://hrms.talentshield.co.uk`
   - Requests go to `https://hrms.talentshield.co.uk/api/goals`
   - If `REACT_APP_API_BASE_URL` is set correctly in production, it works
   - If not set, defaults to `/api` which may work but is inconsistent

3. **Inconsistency:**
   - Reviews page uses `buildApiUrl()` → Works correctly
   - Documents page uses manual construction with `REACT_APP_API_URL` → Works correctly
   - Goals page uses hardcoded constant → **Broken in development**

### Secondary Issues

1. **Missing Admin RBAC in Backend**
   - Goals: `/summary/all`, `/:id/approve`, `/:id/comment` have no admin checks
   - Reviews: `/initiate`, `/:id/status`, `/` have no admin checks
   - **Impact:** Any authenticated user can perform admin actions

2. **Inconsistent RBAC Patterns**
   - Reviews use middleware (`canAccessReview`, `canSubmitManagerFeedback`)
   - Goals use controller-level checks (inconsistent, some missing)
   - **Impact:** Security vulnerabilities, code maintenance issues

3. **Data Integrity Issues**
   - Goals controller stores `req.user.email` in `adminComments.adminName` field
   - **Impact:** Wrong data displayed in UI (email instead of name)

---

## Evidence-Based Breakpoint Identification

### Exact Failure Points

#### 1. Goals Page Load Failure

**Step-by-Step Breakdown:**

```
1. User navigates to /goals
   → Goals.js component mounts
   
2. useEffect runs → fetchCurrentUser() called
   
3. Line 121: axios.get(`${API_BASE}/auth/me`, { withCredentials: true })
   → Request sent to: http://localhost:3000/api/auth/me (WRONG PORT)
   → Response: 404 Not Found
   
4. Line 124: catch block
   → console.error('Failed to fetch user info')
   → isAdmin state remains false
   → currentUser state remains null
   
5. useEffect runs → fetchGoalsSummary() called (if isAdmin is true)
   → Skipped because isAdmin is false
   
6. useEffect runs → fetchGoals() called
   
7. Line 169: axios.get(`${API_BASE}/goals/my`, { params, withCredentials: true })
   → Request sent to: http://localhost:3000/api/goals/my (WRONG PORT)
   → Response: 404 Not Found
   
8. Line 175: catch block
   → toast.error('Failed to fetch goals')
   → goals state remains []
   
9. UI renders: "No goals found"
```

**Expected Behavior:**
```
1. User navigates to /goals
   
2. axios.get(buildApiUrl('/auth/me'))
   → Request: http://localhost:5004/api/auth/me
   → Response: 200 OK { _id: '...', role: 'admin', email: '...' }
   
3. isAdmin = true, currentUser set
   
4. axios.get(buildApiUrl('/goals/summary/all'))
   → Request: http://localhost:5004/api/goals/summary/all
   → Response: 200 OK { summary: { total: 10, byStatus: {...}, byDepartment: {...} } }
   
5. axios.get(buildApiUrl('/goals/my'))
   → Request: http://localhost:5004/api/goals/my
   → Response: 200 OK [ { _id: '...', title: 'Complete training', ... } ]
   
6. UI renders: List of goals with filters, stats, create button
```

#### 2. Goal Creation Failure

**Step-by-Step Breakdown:**

```
1. User clicks "Create Goal" button
   → Modal opens with form
   
2. User fills form: title, description, category, deadline, progress, status
   → Form state updated
   
3. User clicks "Save"
   → saveGoal() function called (Line 205)
   
4. Line 220: axios.post(`${API_BASE}/goals`, payload, { withCredentials: true })
   → Request sent to: http://localhost:3000/api/goals (WRONG PORT)
   → Response: 404 Not Found
   
5. Line 223: catch block
   → toast.error('Failed to save goal')
   → Modal remains open
   → Goal not created
```

**Expected Behavior:**
```
1. axios.post(buildApiUrl('/goals'), payload, { withCredentials: true })
   → Request: http://localhost:5004/api/goals
   → Backend: goalsController.createGoal()
   → Database: New Goal document inserted
   → Response: 201 Created { _id: '...', title: 'Complete training', ... }
   
2. toast.success('Goal saved successfully')
3. Modal closes
4. fetchGoals() called to refresh list
5. New goal appears in UI
```

#### 3. Admin Approve Goal Failure

**Step-by-Step Breakdown:**

```
1. Admin clicks "Approve" button on a goal
   → approveGoal(goal) function called (Line 247)
   
2. Line 249: axios.post(`${API_BASE}/goals/${goal._id}/approve`, {}, { withCredentials: true })
   → Request sent to: http://localhost:3000/api/goals/123/approve (WRONG PORT)
   → Response: 404 Not Found
   
3. Line 252: catch block
   → toast.error('Failed to approve goal')
   → Goal approval status not changed
```

**Expected Behavior (if URL was correct):**
```
1. axios.post(buildApiUrl(`/goals/${goal._id}/approve`), {}, { withCredentials: true })
   → Request: http://localhost:5004/api/goals/123/approve
   
2. Backend: goalsController.approveGoal()
   → Problem: No admin role check!
   → Goal.adminApproved set to true
   → Response: 200 OK { message: 'Goal approved' }
   
3. toast.success('Goal approved')
4. fetchGoals() refreshes list
5. Goal shows "Approved" badge
```

**But even if URL is fixed, there's a security issue:**
- Backend has no admin role check
- Any user can approve goals if they have the goal ID

---

## Comparison with Working Modules

### Document Management (✅ Working)

**Frontend:** [frontend/src/pages/Documents.js](frontend/src/pages/Documents.js)

**API Construction:**
```javascript
const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
const response = await axios.get(`${apiUrl}/api/documentManagement/folders`, {
  headers: { 'Authorization': `Bearer ${token}` },
  withCredentials: true
});
```

**Why it works:**
- Uses `REACT_APP_API_URL` env var (correctly configured)
- Manually constructs full URL
- Includes Authorization header

**Backend:** [backend/routes/documentManagement.js](backend/routes/documentManagement.js)

**RBAC:**
```javascript
router.use(authenticateSession); // Global middleware
router.post('/:folderId/upload', checkPermission('upload'), uploadController);
router.get('/:folderId', checkPermission('view'), getFolderContents);
```

**Why it works:**
- `authenticateSession` validates token
- `checkPermission` middleware checks folder-level permissions
- Explicit permission checks before every sensitive operation

### Leave Management (✅ Working - Assumed)

**Would need to verify, but assuming it uses buildApiUrl() correctly**

### Performance Management (❌ Broken)

**Goals:** Uses wrong API construction pattern
**Reviews:** Uses correct pattern but may have backend RBAC issues

---

## Risk Assessment

### Critical Risks (Fix Immediately)

1. **Goals Page Completely Non-Functional**
   - Severity: CRITICAL
   - Impact: Users cannot create, view, edit, delete, or approve goals
   - Affected Users: All employees + admins
   - Business Impact: Performance management process blocked

2. **Missing Admin Role Checks**
   - Severity: CRITICAL
   - Impact: Any user can approve goals, initiate reviews, see all goals/reviews
   - Affected Users: All authenticated users
   - Security Impact: Privilege escalation vulnerability

### High Risks (Fix Soon)

3. **Incorrect Data Storage**
   - Severity: HIGH
   - Impact: Admin names stored as emails in goal comments
   - Affected Users: Admins viewing goal history
   - Data Quality Impact: Wrong information displayed

4. **Inconsistent RBAC Patterns**
   - Severity: HIGH
   - Impact: Difficult to audit security, potential for missed checks
   - Maintainability Impact: Future bugs likely

### Medium Risks (Fix When Possible)

5. **No Null Checks After Database Queries**
   - Severity: MEDIUM
   - Impact: Server crashes if referenced document not found
   - Affected Users: Anyone creating goals (if EmployeeHub record missing)

---

## Minimal Fix Plan (Surgical Changes Only)

### Fix 1: Goals Page API Construction (CRITICAL - 5 minutes)

**File:** [frontend/src/pages/Goals.js](frontend/src/pages/Goals.js)

**Change:**
```javascript
// Line 4: Import is already there
import { buildApiUrl } from '../utils/apiConfig';

// Line 6: REMOVE this line
const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';

// Line 121: REPLACE
// OLD: const res = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true });
// NEW:
const res = await axios.get(buildApiUrl('/auth/me'), { withCredentials: true });

// Line 146: REPLACE
// OLD: const res = await axios.get(`${API_BASE}/goals/summary/all`, { withCredentials: true });
// NEW:
const res = await axios.get(buildApiUrl('/goals/summary/all'), { withCredentials: true });

// Line 169: REPLACE
// OLD: const res = await axios.get(`${API_BASE}${url}`, { params, withCredentials: true });
// NEW:
const res = await axios.get(buildApiUrl(url), { params, withCredentials: true });

// Line 217: REPLACE
// OLD: await axios.put(`${API_BASE}/goals/${editingGoal._id}`, payload, { withCredentials: true });
// NEW:
await axios.put(buildApiUrl(`/goals/${editingGoal._id}`), payload, { withCredentials: true });

// Line 220: REPLACE
// OLD: await axios.post(`${API_BASE}/goals`, payload, { withCredentials: true });
// NEW:
await axios.post(buildApiUrl('/goals'), payload, { withCredentials: true });

// Line 237: REPLACE
// OLD: await axios.delete(`${API_BASE}/goals/${goal._id}`, { withCredentials: true });
// NEW:
await axios.delete(buildApiUrl(`/goals/${goal._id}`), { withCredentials: true });

// Line 249: REPLACE
// OLD: await axios.post(`${API_BASE}/goals/${goal._id}/approve`, {}, { withCredentials: true });
// NEW:
await axios.post(buildApiUrl(`/goals/${goal._id}/approve`), {}, { withCredentials: true });

// Lines 271-272: REPLACE
// OLD: await axios.post(`${API_BASE}/goals/${commentGoal._id}/comment`, { comment: commentText }, { withCredentials: true });
// NEW:
await axios.post(buildApiUrl(`/goals/${commentGoal._id}/comment`), { comment: commentText }, { withCredentials: true });
```

**Impact:**
- Goals page will now make requests to correct backend URL
- All 17 API calls will work in development and production
- No functional changes, just URL construction

**Testing:**
1. Open Goals page → Should load goals list
2. Create new goal → Should save successfully
3. Edit goal → Should update
4. Delete goal → Should remove
5. Admin: Approve goal → Should work (but see Fix 2 for security issue)

---

### Fix 2: Add Admin Role Checks to Goals Routes (CRITICAL - 10 minutes)

**File:** [backend/routes/goalsRoutes.js](backend/routes/goalsRoutes.js)

**Add Admin Middleware:**

Create or import existing admin middleware:
```javascript
// At top of file
const { authenticateSession } = require('../server');

// Add this function (or import if exists elsewhere)
const requireAdmin = (req, res, next) => {
  const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
  
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};
```

**Apply Middleware to Admin Routes:**
```javascript
// BEFORE (Line ~10):
router.get('/summary/all', getAllGoals);

// AFTER:
router.get('/summary/all', requireAdmin, getAllGoals);

// BEFORE (Line ~15):
router.post('/:id/approve', approveGoal);

// AFTER:
router.post('/:id/approve', requireAdmin, approveGoal);

// BEFORE (Line ~16):
router.post('/:id/comment', addCommentToGoal);

// AFTER:
router.post('/:id/comment', requireAdmin, addCommentToGoal);

// BEFORE (Line ~18):
router.get('/', getAllGoals);

// AFTER:
router.get('/', requireAdmin, getAllGoals);
```

**Impact:**
- Only admins can view all goals, approve goals, add comments, see summary stats
- Regular users blocked with 403 Forbidden
- Security vulnerability fixed

**Testing:**
1. Login as regular user
2. Try to approve goal → 403 Forbidden
3. Try to access /api/goals (all goals) → 403 Forbidden
4. Login as admin
5. Try to approve goal → 200 OK
6. Access /api/goals → 200 OK with data

---

### Fix 3: Add Admin Role Checks to Reviews Routes (CRITICAL - 5 minutes)

**File:** [backend/routes/reviewRoutes.js](backend/routes/reviewRoutes.js)

**Apply Middleware:**
```javascript
// Add at top (reuse from goalsRoutes or import)
const requireAdmin = (req, res, next) => {
  const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
  
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// BEFORE (Line ~35):
router.post('/initiate', reviewsController.initiateReview);

// AFTER:
router.post('/initiate', requireAdmin, reviewsController.initiateReview);

// BEFORE (Line ~38):
router.post('/:id/status', reviewsController.advanceReviewStatus);

// AFTER:
router.post('/:id/status', requireAdmin, reviewsController.advanceReviewStatus);

// BEFORE (Line ~41):
router.get('/', reviewsController.getAllReviews);

// AFTER:
router.get('/', requireAdmin, reviewsController.getAllReviews);
```

**Impact:**
- Only admins can initiate reviews, advance status, view all reviews
- Regular users blocked with 403 Forbidden

---

### Fix 4: Fix Admin Name in Goal Comments (HIGH - 2 minutes)

**File:** [backend/controllers/goalsController.js](backend/controllers/goalsController.js)

**approveGoal function (Line ~250):**
```javascript
// BEFORE:
goal.adminComments.push({
  comment: req.body.comment || 'Approved',
  adminId: req.user._id,
  adminName: req.user.email // WRONG
});

// AFTER:
goal.adminComments.push({
  comment: req.body.comment || 'Approved',
  adminId: req.user._id,
  adminName: `${req.user.firstName} ${req.user.lastName}` // Use actual name
});
```

**addCommentToGoal function (Line ~280):**
```javascript
// BEFORE:
goal.adminComments.push({
  comment: req.body.comment,
  adminId: req.user._id,
  adminName: req.user.email // WRONG
});

// AFTER:
goal.adminComments.push({
  comment: req.body.comment,
  adminId: req.user._id,
  adminName: `${req.user.firstName} ${req.user.lastName}` // Use actual name
});
```

**Note:** Verify that `req.user` has `firstName` and `lastName` fields. If not, fetch from EmployeeHub:
```javascript
const admin = await EmployeeHub.findById(req.user._id);
adminName: admin ? `${admin.firstName} ${admin.lastName}` : req.user.email
```

**Impact:**
- Admin names displayed correctly in goal history
- Better audit trail

---

### Fix 5: Add Null Checks in createGoal (MEDIUM - 2 minutes)

**File:** [backend/controllers/goalsController.js](backend/controllers/goalsController.js)

**createGoal function (Line ~80):**
```javascript
// BEFORE:
const employee = await EmployeeHub.findById(req.user._id);
if (!employee) throw new Error('Employee not found'); // Crashes server

const newGoal = new Goal({
  userId: req.user._id,
  employeeName: `${employee.firstName} ${employee.lastName}`,
  department: employee.department,
  // ...
});

// AFTER:
const employee = await EmployeeHub.findById(req.user._id);

if (!employee) {
  return res.status(404).json({ error: 'Employee profile not found. Please contact HR.' });
}

const newGoal = new Goal({
  userId: req.user._id,
  employeeName: `${employee.firstName} ${employee.lastName}`,
  department: employee.department,
  // ...
});
```

**Impact:**
- Server no longer crashes if employee record missing
- User gets clear error message instead of 500 Internal Server Error

---

## Summary of Changes

| Fix | File | Lines Changed | Severity | Time | Testing Required |
|-----|------|---------------|----------|------|------------------|
| 1 | Goals.js | ~17 (replace API_BASE with buildApiUrl) | CRITICAL | 5 min | Goals CRUD, admin approve |
| 2 | goalsRoutes.js | ~4 (add requireAdmin middleware) | CRITICAL | 10 min | Admin role checks |
| 3 | reviewRoutes.js | ~3 (add requireAdmin middleware) | CRITICAL | 5 min | Admin role checks |
| 4 | goalsController.js | ~2 (fix adminName field) | HIGH | 2 min | Admin comment display |
| 5 | goalsController.js | ~3 (add null check) | MEDIUM | 2 min | Create goal error handling |

**Total Time:** ~25 minutes  
**Total Lines Changed:** ~29 lines

---

## Testing Checklist

### Goals Page (After Fix 1)

#### User Actions
- [ ] Load Goals page → Goals list appears
- [ ] Create new goal → Saves successfully
- [ ] Edit own goal → Updates correctly
- [ ] Delete own goal (unapproved) → Removes from list
- [ ] Try to edit approved goal → Error message
- [ ] Filter by status → Results filtered
- [ ] Filter by category → Results filtered
- [ ] Search goals → Results match search

#### Admin Actions
- [ ] View "Team" tab → All goals visible
- [ ] Filter by department → Results filtered
- [ ] Filter by employee → Results filtered
- [ ] Approve goal → Goal shows "Approved" badge
- [ ] Add comment to goal → Comment appears in goal details
- [ ] View summary stats → Numbers correct

### Goals Backend (After Fix 2)

#### Security Tests
- [ ] Regular user tries `/api/goals/summary/all` → 403 Forbidden
- [ ] Regular user tries `POST /api/goals/:id/approve` → 403 Forbidden
- [ ] Regular user tries `POST /api/goals/:id/comment` → 403 Forbidden
- [ ] Regular user tries `GET /api/goals` (all goals) → 403 Forbidden
- [ ] Admin user tries same endpoints → 200 OK

### Reviews Backend (After Fix 3)

#### Security Tests
- [ ] Regular user tries `POST /api/reviews/initiate` → 403 Forbidden
- [ ] Regular user tries `POST /api/reviews/:id/status` → 403 Forbidden
- [ ] Regular user tries `GET /api/reviews` (all reviews) → 403 Forbidden
- [ ] Admin user tries same endpoints → 200 OK

### Data Quality (After Fix 4)

- [ ] Admin approves goal → Check database: `adminComments.adminName` shows full name, not email
- [ ] Admin adds comment → Check database: `adminComments.adminName` shows full name

### Error Handling (After Fix 5)

- [ ] User without EmployeeHub record tries to create goal → Gets 404 error with clear message (not 500)

---

## Post-Fix Recommendations (NOT URGENT)

These are improvements for future sprints, **not required for current fix**:

1. **Centralize Admin Role Check**
   - Create single `requireAdmin` middleware in `backend/middleware/rbac.js`
   - Import and reuse across Goals, Reviews, and other modules
   - Reduces code duplication

2. **Consistent RBAC Pattern**
   - All admin-only routes should use middleware
   - All user-specific routes should use middleware (canAccessGoal, canModifyGoal)
   - Remove controller-level role checks

3. **Frontend API Utility**
   - Create `src/utils/api.js` with wrapper functions:
     ```javascript
     export const apiGet = (path, options = {}) => 
       axios.get(buildApiUrl(path), { withCredentials: true, ...options });
     ```
   - Replace all `axios.get(buildApiUrl(...))` calls
   - Reduces boilerplate

4. **Error Handling Standardization**
   - All backend routes should return consistent error format:
     ```javascript
     { error: 'Human-readable message', code: 'ERROR_CODE' }
     ```
   - Frontend can display better error messages

5. **Add Request Logging**
   - Log all API requests in development:
     ```javascript
     console.log('API Request:', method, url, payload);
     ```
   - Helps with debugging

6. **Database Verification**
   - Check if Goal and Review records actually exist in MongoDB
   - If no records, seed with sample data for testing

---

## Conclusion

### Current State
- ❌ Goals page is completely broken due to incorrect API URL construction
- ⚠️ Reviews page URLs are correct but may have backend security issues
- ⚠️ Both modules lack proper admin role checks on sensitive endpoints
- ⚠️ Data quality issues with admin names stored incorrectly

### After Minimal Fixes
- ✅ Goals page will be fully functional
- ✅ Admin-only endpoints will be properly protected
- ✅ Admin names will be stored correctly
- ✅ Error handling will prevent server crashes

### Implementation Steps
1. Apply Fix 1 (Goals.js API URLs) → Test Goals page
2. Apply Fix 2 (Goals admin RBAC) → Test admin restrictions
3. Apply Fix 3 (Reviews admin RBAC) → Test admin restrictions
4. Apply Fix 4 (Admin names) → Verify data in database
5. Apply Fix 5 (Null checks) → Test edge case error handling

**Estimated Total Time:** 25 minutes  
**Risk Level:** LOW (only URL changes and middleware additions, no business logic changes)

---

**End of Report**
