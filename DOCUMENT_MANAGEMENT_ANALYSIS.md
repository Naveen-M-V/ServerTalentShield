# COMPLETE DOCUMENT MANAGEMENT SYSTEM ANALYSIS

**Date:** January 27, 2026  
**System:** TalentShield HRMS Document Management  
**Scope:** Admin Dashboard & Employee Dashboard Document Pages

---

## TABLE OF CONTENTS
1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Authentication & Permissions](#authentication--permissions)
5. [Data Flow](#data-flow)
6. [Critical Issues Analysis](#critical-issues-analysis)
7. [Key Differences: Admin vs Employee](#key-differences-admin-vs-employee)

---

## SYSTEM OVERVIEW

### Purpose
The Document Management System provides a unified interface for managing folders and documents across the organization. It supports:
- Folder-based organization
- Role-based access control (Admin/Employee)
- Document upload/download/view
- Permission management
- "My Documents" personal folders

### Key Components
- **Frontend:** React components with embedded mode support
- **Backend:** Express.js REST API with MongoDB
- **Database Models:** Folder, DocumentManagement, EmployeeHub
- **Middleware:** JWT authentication, permission checks

---

## FRONTEND ARCHITECTURE

### 1. Documents.js Component
**Location:** `frontend/src/pages/Documents.js`

**Purpose:** Main document management page showing folder list

**Props:**
```javascript
{ embedded = false }  // Controls rendering mode
```

**States (33 total):**
```javascript
- folders: []                    // List of all folders
- loading: true                  // Loading state
- selectedFolderId: null         // For embedded mode
- selectedFolder: null           // Currently selected folder
- folderContents: []             // Contents of selected folder
- searchQuery: ''                // Search filter
- pagination: { page, limit, total }
- sortBy: 'name'                 // Sort field
- sortOrder: 'asc'               // Sort direction
- myDocumentsFolder: null        // Auto-created personal folder
- showDocumentViewer: false      // Modal state
- selectedDocument: null         // Document to view
// ... 21 more UI state variables
```

**Key Functions:**

**`ensureMyDocumentsFolder()` - Auto-creates personal folder**
```javascript
- Runs on component mount via useEffect
- Fetches existing folders via GET /api/documentManagement/folders
- Searches for folder with name "My Documents" or containing "My Documents"
- If not found, creates new folder with isDefault: true
- Issue: Can create duplicates if multiple calls race
```

**`fetchFolders()` - Loads folder list**
```javascript
- GET /api/documentManagement/folders
- Query params: page, limit, sort, order
- Sets folders state with response
- Called on mount and when pagination changes
```

**`handleFolderClick(folderId)` - Navigation logic**
```javascript
- Validates folderId exists
- If embedded mode: sets selectedFolderId state
- If not embedded: navigates to /documents/:folderId
- NEW: Added validation to prevent undefined navigation
```

**`fetchFolderContents(folderId)` - Embedded mode folder view**
```javascript
- Only used when embedded=true
- GET /api/documentManagement/folders/:folderId
- Fetches folder metadata and contents
- Updates selectedFolder and folderContents states
```

**Rendering Modes:**

**Standalone Mode (embedded=false):**
- Full page layout with header, search, filters
- Shows folder grid/table
- Clicking folder navigates to /documents/:folderId route
- Used in Admin Dashboard main Documents page

**Embedded Mode (embedded=true):**
- Compact layout without page chrome
- Shows folder list initially
- Clicking folder opens inline folder view (no navigation)
- Used in:
  - Employee Dashboard Documents tab
  - Employee Profile Documents tab (admin view)

**Where Used:**
```javascript
// Admin Dashboard - Standalone
<Route path="/documents" element={<Documents />} />

// Employee Dashboard - Embedded
{activeTab === 'documents' && <Documents embedded />}

// Employee Profile - Embedded (Admin viewing employee)
<Documents embedded />
```

---

### 2. FolderView.js Component
**Location:** `frontend/src/pages/FolderView.js`

**Purpose:** Display contents of a specific folder

**Route:** `/documents/:folderId`

**Key Features:**
- Extracts folderId from URL params: `const { folderId } = useParams()`
- Shows breadcrumb navigation
- Lists subfolders and documents
- Supports upload, create folder, rename, delete
- Opens DocumentViewer modal for document viewing

**States:**
```javascript
- folder: null                   // Folder metadata
- items: []                      // Contents (folders + documents)
- breadcrumb: []                 // Navigation path
- folderPermissions: {}          // User's permissions for this folder
- loading, showUploadModal, showDocumentViewer, etc.
```

**Validation (NEW):**
```javascript
useEffect(() => {
  if (!folderId) {
    console.error('❌ FolderView: No folderId provided');
    showError('Cannot load folder: Invalid folder ID');
    navigate('/documents');
    return;
  }
  
  if (folderId === 'undefined' || folderId === 'null') {
    console.error('❌ FolderView: Received invalid folderId');
    navigate('/documents');
    return;
  }
  
  fetchFolderContents();
}, [folderId]);
```

**Item Click Handler:**
```javascript
const handleItemClick = (item) => {
  if (item.type === 'folder') {
    navigate(`/documents/${item._id}`);  // Drill down to subfolder
  } else {
    setSelectedDocument(item);
    setShowDocumentViewer(true);        // Open viewer modal
  }
};
```

**Not Used In:**
- Embedded mode (Documents.js handles folder view inline)
- Only used for standalone navigation

---

### 3. DocumentViewer.js Component
**Location:** `frontend/src/components/DocumentManagement/DocumentViewer.js`

**Purpose:** Unified modal for viewing all document types

**Props:**
```javascript
{
  document: { _id, name, mimeType, ... },
  open: boolean,
  onClose: function
}
```

**Document Types Supported:**
- **PDF:** Rendered via iframe with blob URL
- **Images:** jpg, jpeg, png, gif, svg - Direct img tag
- **Office Documents:** pptx, docx, xlsx - Microsoft Office Online Viewer
- **Other:** Download-only

**Detection Logic:**
```javascript
const canPreview = () => {
  // 1. Check mimeType first (more reliable)
  if (document.mimeType) {
    if (mimeType.includes('pdf')) return true;
    if (mimeType.includes('image')) return true;
    if (mimeType.includes('powerpoint') || 'presentation') return true;
    if (mimeType.includes('word') || 'wordprocessing') return true;
  }
  
  // 2. Fallback to file extension
  const ext = filename.split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','svg','pdf','pptx','docx','xlsx'].includes(ext);
};

const isOfficeDocument = () => {
  // Check mimeType for Office document signatures
  const officeMimeTypes = [
    'application/vnd.ms-powerpoint',                                      // PPT
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/msword',                                                 // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // DOCX
    // ... more
  ];
  return officeMimeTypes.includes(document.mimeType);
};
```

**Office Document Viewing:**
```javascript
// Uses Microsoft Office Online Viewer
const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`;
<iframe src={officeViewerUrl} />
```

**Fullscreen Feature:**
- Toggle button in viewer header
- Uses CSS positioning to cover viewport
- Exit on close or ESC key

---

### 4. UserDashboard.js Integration
**Location:** `frontend/src/pages/UserDashboard.js`

**Documents Tab:**
```javascript
{activeTab === 'documents' && isEmployeeUser && (
  <div style={{ margin: '-32px', padding: '0' }}>
    <Documents embedded />
  </div>
)}
```

**User Type Check:**
```javascript
const isEmployeeUser = user?.userType === 'employee';
```

**Notes:**
- Only shows for employee users (not profile-only users)
- Embedded mode with negative margin for edge-to-edge layout
- Documents component handles ALL folder/document operations
- No custom logic in UserDashboard

---

### 5. EmployeeProfile.js Integration
**Location:** `frontend/src/pages/EmployeeProfile.js` (Admin view)

**Documents Tab:**
```javascript
const DocumentsTab = ({ employee }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
      <Documents embedded />
    </div>
  );
};
```

**Context:**
- Admin viewing employee profile
- Shows employee's accessible folders/documents
- Uses same embedded Documents component
- Backend filters based on authenticated admin's session
- **Does NOT pass employee prop** - relies on backend user context

---

## BACKEND ARCHITECTURE

### 1. Route Structure
**File:** `backend/routes/documentManagement.js`

**Authentication:** ALL routes require JWT authentication via middleware

**Key Routes:**

```javascript
// FOLDERS
GET    /api/documentManagement/folders              // List all folders
POST   /api/documentManagement/folders              // Create folder
GET    /api/documentManagement/folders/:folderId    // Get folder contents
PUT    /api/documentManagement/folders/:folderId    // Update folder
DELETE /api/documentManagement/folders/:folderId    // Delete folder (+ all contents)

// DOCUMENTS
GET    /api/documentManagement/documents            // List all documents
POST   /api/documentManagement/documents            // Upload document (no folder)
POST   /api/documentManagement/folders/:folderId/documents  // Upload to folder
GET    /api/documentManagement/documents/:documentId        // Get document metadata
GET    /api/documentManagement/documents/:documentId/view   // View document inline
GET    /api/documentManagement/documents/:documentId/download // Download document
PUT    /api/documentManagement/documents/:documentId        // Update document
DELETE /api/documentManagement/documents/:documentId        // Delete document
```

---

### 2. Authentication & User Resolution

**JWT Token Flow:**
```javascript
// Middleware extracts token from header
Authorization: Bearer <token>

// Token decoded to user object
{
  _id: "69789adcd7feaa2af5857b5c",      // User ID (from User table)
  email: "steverogers172737@gmail.com",
  firstName: "Jon",
  lastName: "Snow",
  role: "employee",                     // or "admin", "super-admin", "hr"
  employeeId: "507f1f77bcf86cd799439011" // Reference to EmployeeHub (may be missing)
}
```

**Critical Function: `resolveEmployeeIdForUser()`**
```javascript
// Attempts to find EmployeeHub record for authenticated user
const resolveEmployeeIdForUser = async (user) => {
  if (!user) return null;
  
  // 1. Check if employeeId already on user object
  if (user.employeeId && isValid(user.employeeId)) {
    return user.employeeId;
  }
  
  // 2. Search by User ID in EmployeeHub.userId field
  const authId = user._id || user.userId || user.id;
  if (authId && isValid(authId)) {
    employee = await EmployeeHub.findOne({ userId: authId });
    if (!employee) {
      employee = await EmployeeHub.findById(authId); // Try as EmployeeHub ID
    }
  }
  
  // 3. Fallback: search by email
  if (!employee && user.email) {
    employee = await EmployeeHub.findOne({ 
      email: user.email.toLowerCase() 
    });
  }
  
  // 4. Update user object and return
  if (employee?._id) {
    user.employeeId = employee._id;
    return employee._id;
  }
  
  return null; // Employee record not found
};
```

**THIS IS THE SOURCE OF YOUR 404 ERROR:**
```javascript
// MyProfile.js console log shows:
Current user: {
  id: '69789adcd7feaa2af5857b5c',     // This is the User ID
  role: 'employee'
}

// MyProfile tries to fetch employee by this ID:
GET /api/employees/by-user-id/69789adcd7feaa2af5857b5c  // 404 Not Found

// Because the endpoint expects a userId field in EmployeeHub
// But this record's userId might be missing or different

// Fallback to email works:
GET /api/employees/by-email/steverogers172737@gmail.com  // 200 OK
Response: {
  _id: '69789adcd7feaa2af5857b5c',    // Same ID (EmployeeHub and User share ID)
  firstName: 'Jon',
  lastName: 'Snow',
  email: 'steverogers172737@gmail.com'
}
```

**Root Cause:**
- User table and EmployeeHub table have separate IDs
- Some employees: User._id === EmployeeHub._id (legacy)
- Some employees: EmployeeHub.userId === User._id (correct)
- Link may be broken or missing

---

### 3. Permission System

**Admin Roles:**
```javascript
const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];

// Admins can:
- See ALL folders and documents
- Create/edit/delete any folder/document
- Bypass all permission checks
- Upload documents for any employee
```

**Folder Permissions Model:**
```javascript
// Folder schema supports dual permission system
{
  permissions: {
    // For employee users (have EmployeeHub record)
    viewEmployeeIds: [ObjectId, ...],     // Can view folder/contents
    editEmployeeIds: [ObjectId, ...],     // Can upload/edit
    deleteEmployeeIds: [ObjectId, ...],   // Can delete
    
    // For profile-admin users (User record only, no EmployeeHub)
    viewUserIds: [ObjectId, ...],
    editUserIds: [ObjectId, ...],
    deleteUserIds: [ObjectId, ...]
  },
  
  createdByUserId: ObjectId,              // User who created (for admins)
  createdByEmployeeId: ObjectId           // Employee who created
}
```

**Permission Hierarchy:**
```javascript
// Enforced by backend:
delete permission → implies edit permission → implies view permission

// Example:
If user has deleteEmployeeIds permission:
  → Automatically gets editEmployeeIds
  → Automatically gets viewEmployeeIds
```

**Permission Check Logic:**
```javascript
// Folder.hasPermission(action, user)
folderSchema.methods.hasPermission = function(action, user) {
  const role = user?.role || 'employee';
  
  // 1. Admins always pass
  if (['admin', 'super-admin'].includes(role)) return true;
  
  // 2. Check employee permissions
  const employeeId = user?.employeeId?.toString();
  if (employeeId) {
    if (action === 'view' && this.permissions.viewEmployeeIds.includes(employeeId)) return true;
    if (action === 'edit' && this.permissions.editEmployeeIds.includes(employeeId)) return true;
    if (action === 'delete' && this.permissions.deleteEmployeeIds.includes(employeeId)) return true;
  }
  
  // 3. Check user permissions (for profile admins)
  const userId = (user?._id || user?.userId)?.toString();
  if (userId) {
    if (action === 'view' && this.permissions.viewUserIds.includes(userId)) return true;
    if (action === 'edit' && this.permissions.editUserIds.includes(userId)) return true;
    if (action === 'delete' && this.permissions.deleteUserIds.includes(userId)) return true;
  }
  
  return false;
};
```

**Document Access Control:**
```javascript
// Document schema
{
  accessControl: {
    visibility: 'all' | 'admin' | 'employee' | 'custom',
    allowedUserIds: [ObjectId, ...]
  },
  
  uploadedBy: ObjectId,        // User who uploaded
  uploadedByRole: 'admin' | 'employee',
  ownerId: ObjectId            // Employee who owns (for employee docs)
}

// Access logic:
- visibility: 'all' → Everyone can view
- visibility: 'admin' → Only admins can view
- visibility: 'employee' → Only owner employee can view
- visibility: 'custom' → Only allowedUserIds can view
```

---

### 4. GET /folders - Fetch Folder List

**Endpoint:** `GET /api/documentManagement/folders`

**Query Params:**
```javascript
?includeSubfolders=true    // Include child folders (default: false, only root)
?page=1
?limit=10
```

**Logic Flow:**

```javascript
router.get('/folders', async (req, res) => {
  // 1. Check authentication
  if (!req.user) return 401;
  
  // 2. Determine role
  const role = req.user?.role;
  const isAdmin = ['admin', 'super-admin', 'hr'].includes(role);
  
  // 3. Resolve employee ID for non-admins
  const empId = await resolveEmployeeIdForRequest(req);
  
  // 4. Build query
  let folderQuery = { 
    isActive: true,
    parentFolder: null  // Only root folders (unless includeSubfolders=true)
  };
  
  // 5. Admin: sees all folders
  if (isAdmin) {
    // No additional filters
  }
  
  // 6. Employee: only folders they have permission to
  else {
    if (!empId) {
      return res.json({ success: true, folders: [] });  // No employee record = no folders
    }
    
    const userId = req.user._id || req.user.userId;
    const orConditions = [];
    
    // Check User ID permissions (for profile admins)
    if (userId) {
      orConditions.push(
        { createdByUserId: userId },              // Created by this user
        { 'permissions.viewUserIds': userId },    // Granted view
        { 'permissions.editUserIds': userId },    // Granted edit
        { 'permissions.deleteUserIds': userId }   // Granted delete
      );
    }
    
    // Check Employee ID permissions (for employees)
    if (empId) {
      orConditions.push(
        { createdByEmployeeId: empId },           // Created by this employee
        { 'permissions.viewEmployeeIds': empId }, // Granted view
        { 'permissions.editEmployeeIds': empId }, // Granted edit
        { 'permissions.deleteEmployeeIds': empId }// Granted delete
      );
    }
    
    folderQuery.$or = orConditions;
  }
  
  // 7. Execute query
  const folders = await Folder.find(folderQuery).sort({ name: 1 });
  
  // 8. Add document counts to each folder
  const foldersWithCount = await Promise.all(folders.map(async (folder) => {
    // Count documents user can access in this folder
    let docQuery = { 
      folderId: folder._id, 
      isActive: true, 
      isArchived: false 
    };
    
    // Non-admins: filter by document access control
    if (!isAdmin) {
      docQuery.$or = [
        { 'accessControl.visibility': 'all' },
        { 'accessControl.visibility': 'employee', ownerId: empId },
        { 'accessControl.allowedUserIds': userId },
        { uploadedBy: userId }
      ];
    }
    
    const documentCount = await DocumentManagement.countDocuments(docQuery);
    
    // 9. Add permission flags for frontend
    const canEdit = isAdmin || folder.hasPermission('edit', req.user);
    const canDelete = isAdmin || folder.hasPermission('delete', req.user);
    
    return {
      ...folder.toObject(),
      documentCount,
      canView: true,
      canEdit,
      canDelete
    };
  }));
  
  // 10. Return folders with metadata
  res.json({ success: true, folders: foldersWithCount });
});
```

**Response Format:**
```javascript
{
  success: true,
  folders: [
    {
      _id: "507f1f77bcf86cd799439011",
      name: "My Documents",
      description: "Personal documents",
      createdByEmployeeId: "507f...",
      parentFolder: null,
      isActive: true,
      permissions: {
        viewEmployeeIds: [...],
        editEmployeeIds: [...],
        deleteEmployeeIds: [...]
      },
      createdAt: "2026-01-20T...",
      updatedAt: "2026-01-27T...",
      
      // Added by backend:
      documentCount: 5,      // Number of documents in folder
      canView: true,
      canEdit: true,
      canDelete: false
    },
    // ... more folders
  ]
}
```

---

### 5. GET /folders/:folderId - Get Folder Contents

**Endpoint:** `GET /api/documentManagement/folders/:folderId`

**Middleware:** `requireFolderPermission('view')`

**Logic Flow:**

```javascript
router.get('/folders/:folderId', requireFolderPermission('view'), async (req, res) => {
  // 1. Middleware already validated:
  //    - User is authenticated
  //    - User has 'view' permission for this folder (or is admin)
  //    - Folder exists (stored in req.folder)
  
  const folder = await Folder.findById(req.params.folderId)
    .populate('createdBy', 'firstName lastName');
  
  if (!folder) return res.status(404).json({ message: 'Folder not found' });
  
  // 2. Get documents in this folder
  const role = req.user?.role;
  const isAdmin = ['admin', 'super-admin'].includes(role);
  
  let documents;
  if (isAdmin) {
    // Admin sees all documents
    documents = await DocumentManagement.getByFolder(req.params.folderId);
  } else {
    // Employee sees only permitted documents
    const empId = req.user.employeeId;
    const userId = req.user._id || req.user.userId;
    
    documents = await DocumentManagement.find({
      folderId: req.params.folderId,
      isActive: true,
      isArchived: false,
      $or: [
        { 'accessControl.visibility': 'all' },
        { 'accessControl.visibility': 'employee', ownerId: empId },
        { 'accessControl.allowedUserIds': userId },
        { uploadedBy: userId }
      ]
    })
    .populate('uploadedBy', 'firstName lastName email')
    .populate('ownerId', 'firstName lastName employeeId')
    .sort({ createdAt: -1 });
  }
  
  // 3. Build breadcrumb trail (for navigation UI)
  const breadcrumb = [];
  let current = folder;
  while (current) {
    breadcrumb.unshift({
      _id: current._id,
      name: current.name,
      parentFolder: current.parentFolder
    });
    
    if (!current.parentFolder) break;
    current = await Folder.findById(current.parentFolder);
  }
  
  // 4. Get subfolders
  const subfoldersRaw = await Folder.find({ 
    parentFolder: req.params.folderId, 
    isActive: true 
  });
  
  // Filter subfolders by permission (non-admins only see what they can access)
  const subfolders = isAdmin 
    ? subfoldersRaw 
    : subfoldersRaw.filter(sf => sf.hasPermission('view', req.user));
  
  // 5. Combine folders and documents into "contents" array
  const contents = [
    ...subfolders.map(f => ({
      ...f.toObject(),
      type: 'folder',  // Frontend distinguishes by type
      canView: true,
      canEdit: isAdmin || f.hasPermission('edit', req.user),
      canDelete: isAdmin || f.hasPermission('delete', req.user)
    })),
    ...documents.map(d => ({ 
      ...d.toObject(), 
      type: 'document'  // Frontend knows to show document icon
    }))
  ];
  
  // 6. Return everything
  res.json({
    folder,
    folderPermissions: {
      canView: true,  // Already validated by middleware
      canEdit: isAdmin || folder.hasPermission('edit', req.user),
      canDelete: isAdmin || folder.hasPermission('delete', req.user)
    },
    breadcrumb,
    contents,
    documents  // Keep for backwards compatibility
  });
});
```

**Response Format:**
```javascript
{
  folder: {
    _id: "507f...",
    name: "My Documents",
    description: "Personal documents",
    // ... folder metadata
  },
  
  folderPermissions: {
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  breadcrumb: [
    { _id: "root_id", name: "Documents", parentFolder: null },
    { _id: "507f...", name: "My Documents", parentFolder: "root_id" }
  ],
  
  contents: [
    // Subfolders first
    {
      _id: "subfolder_id",
      name: "Work Documents",
      type: 'folder',
      documentCount: 3,
      canView: true,
      canEdit: true,
      canDelete: false
    },
    
    // Then documents
    {
      _id: "doc_id",
      name: "Resume.pdf",
      type: 'document',
      mimeType: "application/pdf",
      fileSize: 245000,
      uploadedBy: { firstName: "Jon", lastName: "Snow" },
      createdAt: "2026-01-20T..."
    },
    // ... more items
  ],
  
  documents: [ /* legacy array */ ]
}
```

---

### 6. POST /folders - Create Folder

**Endpoint:** `POST /api/documentManagement/folders`

**Request Body:**
```javascript
{
  name: "My Documents",
  description: "Personal documents",
  parentFolderId: null,              // Optional: parent folder ID
  isDefault: true,                   // Optional: mark as default folder
  viewEmployeeIds: [],               // Optional: employee IDs with view access
  editEmployeeIds: [],               // Optional: employee IDs with edit access
  deleteEmployeeIds: []              // Optional: employee IDs with delete access
}
```

**Logic:**
```javascript
router.post('/folders', async (req, res) => {
  const { name, createdBy, parentFolderId } = req.body;
  
  // 1. Validate name
  if (!name?.trim()) {
    return res.status(400).json({ message: 'Folder name is required' });
  }
  
  // 2. Get creator IDs
  const createdByUserId = req.user._id || req.user.userId || req.user.id;
  const createdByEmployeeId = req.user.employeeId || null;
  
  // 3. Validate parent folder
  const parentFolder = parentFolderId?.trim() || null;
  if (parentFolder && !mongoose.Types.ObjectId.isValid(parentFolder)) {
    return res.status(400).json({ message: 'Invalid parentFolderId' });
  }
  
  // 4. Enforce permission hierarchy (delete → edit → view)
  const normalized = enforcePermissionHierarchy({
    viewEmployeeIds: req.body.viewEmployeeIds,
    editEmployeeIds: req.body.editEmployeeIds,
    deleteEmployeeIds: req.body.deleteEmployeeIds
  });
  
  // 5. Creator MUST always have full permissions (prevent lockout)
  if (createdByEmployeeId) {
    const creatorId = createdByEmployeeId.toString();
    normalized.viewEmployeeIds.push(creatorId);
    normalized.editEmployeeIds.push(creatorId);
    normalized.deleteEmployeeIds.push(creatorId);
  }
  
  // 6. Create folder
  const folder = await Folder.create({
    name: name.trim(),
    description: req.body.description || '',
    createdBy: createdByUserId,
    createdByUserId,
    createdByEmployeeId,
    parentFolder,
    permissions: normalized,
    isDefault: req.body.isDefault || false
  });
  
  return res.status(201).json({ success: true, folder });
});
```

**Notes:**
- No middleware check → Anyone authenticated can create folders
- Creator automatically gets full permissions
- Can create root folders (parentFolder: null) or subfolders

---

### 7. POST /folders/:folderId/documents - Upload Document

**Endpoint:** `POST /api/documentManagement/folders/:folderId/documents`

**Middleware:**
- `checkPermission('edit')` - Must have edit permission for folder
- `upload.single('file')` - Multer file upload

**Request Body (multipart/form-data):**
```javascript
{
  file: <File>,                    // Required: document file
  category: 'other',               // Optional: document category
  ownerId: 'employee_id',          // Optional: owner employee ID
  description: 'Document desc',    // Optional
  expiresOn: '2027-01-01',        // Optional: expiry date
  reminderEnabled: true            // Optional: enable expiry reminders
}
```

**Logic:**
```javascript
router.post('/folders/:folderId/documents', 
  checkPermission('edit'),
  upload.single('file'),
  async (req, res) => {
    
  // 1. Validate authentication and file
  if (!req.user) return res.status(401);
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  // 2. Validate e-learning files are PDF only
  if (req.body.category === 'e_learning' && req.file.mimetype !== 'application/pdf') {
    await fs.unlink(req.file.path);  // Delete uploaded file
    return res.status(400).json({ message: 'E-Learning documents must be PDF' });
  }
  
  // 3. Validate folder exists
  const folder = await Folder.findById(req.params.folderId);
  if (!folder) return res.status(404).json({ message: 'Folder not found' });
  
  // 4. Determine uploader and owner
  const uploadedBy = req.user._id || req.user.userId;
  const uploadedByRole = ['admin', 'super-admin', 'hr'].includes(req.user.role) 
    ? 'admin' 
    : 'employee';
  
  let ownerId = null;
  if (uploadedByRole === 'employee') {
    // Employee uploads are owned by themselves
    ownerId = req.user.employeeId || null;
  } else {
    // Admin can specify owner
    ownerId = req.body.ownerId || null;
  }
  
  // 5. Set access control
  let accessControl = { visibility: 'all', allowedUserIds: [] };
  
  if (uploadedByRole === 'admin') {
    if (ownerId) {
      // Admin uploading for employee → employee-only
      accessControl = { visibility: 'employee', allowedUserIds: [ownerId] };
    } else {
      // Admin uploading general document → all can view
      accessControl = { visibility: 'all', allowedUserIds: [] };
    }
  } else {
    // Employee uploads → employee-only
    accessControl = { visibility: 'employee', allowedUserIds: [ownerId] };
  }
  
  // 6. Read file into buffer
  const fileBuffer = await fs.readFile(req.file.path);
  
  // 7. Create document record
  const document = new DocumentManagement({
    name: req.file.originalname,
    fileData: fileBuffer,          // Store in MongoDB
    fileSize: req.file.size,
    mimeType: req.file.mimetype,   // ← THIS IS WHERE MIMETYPE IS SET
    uploadedBy,
    uploadedByRole,
    ownerId,
    folderId: req.params.folderId,
    accessControl,
    category: req.body.category || 'other',
    expiresOn: req.body.expiresOn || null,
    reminderEnabled: req.body.reminderEnabled === 'true',
    version: 1,
    isActive: true,
    isArchived: false,
    downloadCount: 0,
    auditLog: [{
      action: 'uploaded',
      performedBy: uploadedBy,
      timestamp: new Date(),
      details: `Document uploaded by ${req.user.firstName} ${req.user.lastName}`
    }]
  });
  
  await document.save();
  
  // 8. Delete temp file
  await fs.unlink(req.file.path);
  
  // 9. Return document
  res.status(201).json({ 
    success: true, 
    document,
    message: 'Document uploaded successfully' 
  });
});
```

**CRITICAL: mimeType Property**
```javascript
// Backend sets this from multer:
mimeType: req.file.mimetype

// Multer automatically detects MIME type from file:
{
  fieldname: 'file',
  originalname: 'presentation.pptx',
  mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  size: 1245000,
  ...
}

// This IS stored in database and returned to frontend
```

---

### 8. GET /documents/:documentId/view - View Document

**Endpoint:** `GET /api/documentManagement/documents/:documentId/view`

**Purpose:** Stream document content for inline viewing (not download)

**Logic:**
```javascript
router.get('/documents/:documentId/view', async (req, res) => {
  // 1. Manual token validation (for iframe embedding)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401);
  
  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  // 2. Fetch document
  const document = await DocumentManagement.findById(req.params.documentId);
  if (!document) return res.status(404);
  
  // 3. Check permissions (skip for admins)
  const isAdmin = ['admin', 'super-admin'].includes(user.role);
  if (!isAdmin) {
    // Check folder permission
    if (document.folderId) {
      const folder = await Folder.findById(document.folderId);
      if (!folder || !folder.hasPermission('view', user)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
    }
    
    // Check document permission
    if (!document.hasPermission('view', user)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
  }
  
  // 4. Send file inline for viewing
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);
  res.setHeader('Content-Length', document.fileData.length);
  res.send(document.fileData);
});
```

**Headers Set:**
```javascript
Content-Type: application/pdf  // or image/jpeg, etc.
Content-Disposition: inline; filename="document.pdf"
Content-Length: 245000
```

**Used By:**
- DocumentViewer component for PDF rendering
- Image previews
- Office Online Viewer (constructs URL to this endpoint)

---

## DATA FLOW

### Scenario 1: Admin Views Documents Page (Standalone)

**Step 1: Page Load**
```
1. Admin navigates to /documents
2. Documents.js component mounts (embedded=false)
3. useEffect runs → ensureMyDocumentsFolder()
   GET /api/documentManagement/folders
   → Backend returns all folders (admin sees everything)
   → Searches for "My Documents" folder
   → If not found, creates one
   → Sets myDocumentsFolder state
4. useEffect runs → fetchFolders()
   GET /api/documentManagement/folders?page=1&limit=10&sort=name&order=asc
   → Backend returns all folders with document counts
   → Sets folders state
5. Component renders folder grid
```

**Step 2: Admin Clicks Folder**
```
1. User clicks folder "HR Documents"
2. handleFolderClick(folderId) called
3. Validates folderId exists
4. navigate('/documents/507f1f77bcf86cd799439011')
5. React Router navigates to FolderView component
6. FolderView extracts folderId from URL params
7. useEffect runs → fetchFolderContents()
   GET /api/documentManagement/folders/507f1f77bcf86cd799439011
   → Backend validates admin has permission
   → Returns folder metadata, breadcrumb, contents (subfolders + documents)
   → Sets folder, items, breadcrumb states
8. Component renders folder contents with breadcrumb
```

**Step 3: Admin Clicks Document**
```
1. User clicks document "policy.pdf"
2. handleItemClick(item) called
3. Checks item.type === 'document'
4. Sets selectedDocument state
5. Sets showDocumentViewer = true
6. DocumentViewer modal opens
7. DocumentViewer checks canPreview()
   → mimeType: 'application/pdf' → Yes
8. DocumentViewer constructs view URL:
   https://hrms.talentshield.co.uk/api/documentManagement/documents/abc123/view
9. Renders iframe with this URL
10. Backend /view endpoint streams file content
11. PDF displays in iframe
```

---

### Scenario 2: Employee Views Documents (Embedded)

**Step 1: Employee Dashboard Load**
```
1. Employee logs in → navigates to /user-dashboard
2. UserDashboard.js component mounts
3. Checks isEmployeeUser = (user.userType === 'employee')
4. If employee, shows Documents tab
5. Employee clicks "Documents" tab
6. activeTab state changes to 'documents'
7. Renders: <Documents embedded />
8. Documents component mounts with embedded=true
```

**Step 2: Documents Component (Embedded Mode)**
```
1. Documents.js runs useEffect → ensureMyDocumentsFolder()
   GET /api/documentManagement/folders
   → Backend resolves employee ID for user
   → Returns only folders employee has permission to see
   → Searches for "My Documents"
   → If not found, creates one (owned by this employee)
   
2. Documents.js runs useEffect → fetchFolders()
   GET /api/documentManagement/folders?page=1&limit=10
   → Backend filters folders by employee permissions
   → Returns folders: ["My Documents", "Shared Docs"]
   → Sets folders state
   
3. Component renders folder list (compact embedded layout)
```

**Step 3: Employee Clicks Folder (Embedded Behavior)**
```
1. User clicks "My Documents" folder
2. handleFolderClick(folderId) called
3. Validates folderId exists
4. Checks embedded=true
5. DOES NOT navigate (different from admin!)
6. Instead: setSelectedFolderId(folderId)
7. useEffect runs → fetchFolderContents(folderId)
   GET /api/documentManagement/folders/507f...
   → Backend validates employee has view permission
   → Returns folder contents (filtered by employee access)
   → Sets selectedFolder and folderContents states
8. Component re-renders showing folder contents INLINE
9. Shows "Back to Folders" button
```

**Step 4: Employee Clicks Document (Embedded)**
```
1. User clicks document in embedded folder view
2. handleViewDocument(doc) or similar handler called
3. Sets selectedDocument state
4. Sets showDocumentViewer = true
5. DocumentViewer modal opens (SAME as admin)
6. Document loads and displays
```

**Step 5: Employee Clicks Back**
```
1. User clicks "Back to Folders"
2. setSelectedFolderId(null)
3. setSelectedFolder(null)
4. setFolderContents([])
5. Component re-renders showing folder list again
6. NO page navigation - stays on employee dashboard
```

---

### Scenario 3: Admin Views Employee Profile Documents

**Context:** Admin is viewing employee "Jon Snow" profile

**Step 1: Profile Page Load**
```
1. Admin navigates to /employee-profile/69789adcd7feaa2af5857b5c
2. EmployeeProfile.js component mounts
3. Fetches employee data
4. Admin clicks "Documents" tab
5. DocumentsTab component renders
6. Renders: <Documents embedded />
```

**Step 2: Documents Component in Profile Context**
```
1. Documents.js mounts with embedded=true
2. useEffect runs → ensureMyDocumentsFolder()
   GET /api/documentManagement/folders
   → Backend sees admin role
   → Returns ALL folders (not filtered)
   → Problem: Backend uses req.user (the admin)
   → NOT using employee prop
   
3. Documents.js runs → fetchFolders()
   GET /api/documentManagement/folders
   → Backend returns ALL folders (admin view)
   → NOT scoped to this employee
```

**ISSUE IDENTIFIED:**
```javascript
// EmployeeProfile.js passes employee prop but Documents.js doesn't use it!
<Documents embedded />  // No employee prop passed

// Documents.js only uses authenticated user (admin)
const { user } = useAuth();  // This is the admin, not the employee

// Backend uses req.user (admin) for permission checks
// So admin sees ALL folders, not just employee's folders
```

**This May Be Intentional:**
- Admin needs to see all folders to assign documents to employees
- Admin may want to create folders for this employee
- Admin may want to upload documents to employee's folders

**Or It May Be a Bug:**
- Expected: Show only folders/documents related to this employee
- Actual: Shows all folders admin has access to

---

## KEY DIFFERENCES: ADMIN VS EMPLOYEE

### Frontend Differences

| Aspect | Admin Dashboard | Employee Dashboard |
|--------|----------------|-------------------|
| **Component Mode** | `<Documents embedded={false} />` | `<Documents embedded={true} />` |
| **Folder Navigation** | navigate('/documents/:folderId') | Sets state, inline folder view |
| **Page Changes** | Yes - uses React Router | No - stays on dashboard page |
| **Layout** | Full page with header | Compact embedded in tab |
| **Breadcrumb** | Shows in FolderView page | Not shown |
| **URL Changes** | /documents → /documents/:id | Always /user-dashboard?tab=documents |
| **Back Button** | Browser back | "Back to Folders" button |

### Backend Permission Differences

| Aspect | Admin/Super-Admin/HR | Employee |
|--------|---------------------|----------|
| **GET /folders** | Returns ALL folders | Returns only permitted folders |
| **Folder Contents** | Sees ALL documents | Sees only permitted documents |
| **Permission Checks** | Always passes | Must have explicit permission |
| **Document Upload** | Can upload for anyone | Can only upload for self |
| **Folder Creation** | Can create any folder | Can create folders (auto-owned) |
| **Access Control** | Bypasses all checks | Enforced strictly |
| **Employee ID Resolution** | Not required | Required for access |

### User Resolution Issues

**Admin Users:**
```javascript
{
  _id: "admin_user_id",
  role: "admin",
  employeeId: null  // May not have EmployeeHub record
}
// No need to resolve employeeId → Always passes permission checks
```

**Employee Users:**
```javascript
{
  _id: "user_id_123",
  role: "employee",
  employeeId: "employee_id_456"  // Must link to EmployeeHub
}

// If employeeId missing or wrong:
- resolveEmployeeIdForUser() tries to find EmployeeHub by:
  1. user.employeeId
  2. EmployeeHub.findOne({ userId: user._id })
  3. EmployeeHub.findById(user._id)
  4. EmployeeHub.findOne({ email: user.email })
  
// If all fail → employeeId = null
// Result: User sees NO folders (returns empty array)
```

---

## CRITICAL ISSUES ANALYSIS

### Issue 1: Employee ID Resolution Failure

**Symptom:**
```javascript
// MyProfile.js console log:
Current user: {id: '69789adcd7feaa2af5857b5c', email: 'steverogers172737@gmail.com', role: 'employee'}
GET /api/employees/by-user-id/69789adcd7feaa2af5857b5c  // 404 Not Found
```

**Root Cause:**
- User._id and EmployeeHub._id are not always the same
- EmployeeHub.userId field may be missing or incorrect
- Legacy data migration issues

**Impact on Documents:**
- If `resolveEmployeeIdForUser()` fails → employeeId = null
- Backend returns empty folder list
- Employee sees "No folders found"
- Employee cannot access any documents

**Solution:**
- Ensure EmployeeHub.userId field is populated correctly
- Fix data: Update EmployeeHub records to set userId = User._id
- Or: Fix code to handle missing links gracefully

---

### Issue 2: Multiple "My Documents" Folders

**Symptom:**
- Admin dashboard shows duplicate "My Documents" folders
- Multiple folders with same name appear

**Root Cause:**
```javascript
// Documents.js line 78-100
const ensureMyDocumentsFolder = async () => {
  const existingFolder = response.data.folders?.find(f => 
    f.name === 'My Documents' || f.name.includes('My Documents')
  );
  
  if (existingFolder) {
    return;  // Found one, don't create
  }
  
  // Create new folder - RACE CONDITION
  const createResponse = await axios.post(...);
};

// Problem:
// 1. User opens admin dashboard in 2 tabs
// 2. Both tabs call ensureMyDocumentsFolder simultaneously
// 3. Both check for existing folder → None found yet
// 4. Both create new folder
// 5. Result: 2 folders named "My Documents"
```

**Fix Applied:**
- Changed search to find ANY folder with "My Documents" in name
- Prevents additional creation
- But doesn't fix existing duplicates

**Better Solution:**
- Backend: Add unique constraint on folder name per user
- Backend: Check for existing folder before creating
- Frontend: Don't auto-create folders - let user create manually
- Or: Use isDefault flag properly

---

### Issue 3: Undefined folderId Navigation

**Symptom:**
```javascript
// Console error:
📂 FolderView: Fetching folder contents for: undefined
/api/documentManagement/folders/undefined  // 500 error
```

**Root Cause:**
```javascript
// Documents.js folder click:
onClick={() => handleFolderClick(folder._id)}

// If folder._id is undefined:
handleFolderClick(undefined)
navigate('/documents/undefined')

// FolderView.js:
const { folderId } = useParams();  // folderId = "undefined" (string!)
```

**Possible Causes:**
- Backend returning folders without _id field
- Frontend state corruption
- Race condition during folder creation

**Fix Applied:**
```javascript
// Documents.js validation
const handleFolderClick = (folderId) => {
  if (!folderId) {
    console.error('❌ No folder ID provided');
    showError('Cannot open folder: Invalid folder ID');
    return;
  }
  // ... rest
};

// FolderView.js validation
useEffect(() => {
  if (!folderId || folderId === 'undefined' || folderId === 'null') {
    console.error('❌ Invalid folderId');
    navigate('/documents');
    return;
  }
  fetchFolderContents();
}, [folderId]);
```

---

### Issue 4: PPTX Preview Not Working

**Symptom:**
- User uploads PPTX file
- DocumentViewer shows "Preview not available for this file type"
- But logic seems correct

**Investigation:**
```javascript
// DocumentViewer.js checks mimeType first
if (document.mimeType.includes('powerpoint') || 'presentation')) return true;

// Backend sets mimeType from multer:
mimeType: req.file.mimetype
// For PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
```

**Added Logging:**
```javascript
const isOfficeDocument = () => {
  console.log('🔍 DocumentViewer - Checking if Office document:', {
    name: document.name,
    mimeType: document.mimeType,
    fileName: document.fileName
  });
  
  // Check if mimeType is actually present
  // ...
};
```

**Possible Issues:**
- Document object missing mimeType property
- Backend not populating mimeType in response
- Frontend not passing complete document object
- mimeType field name mismatch (mimeType vs mimetype)

**Verification Needed:**
- Check actual document object in console
- Verify backend /folders/:id response includes mimeType
- Test with fresh PPTX upload

---

### Issue 5: Employee Dashboard Documents Context

**Question:** When employee views Documents tab, whose documents do they see?

**Answer:**
```javascript
// UserDashboard.js:
<Documents embedded />  // No props passed

// Documents.js:
const { user } = useAuth();  // Gets authenticated user

// Backend:
GET /api/documentManagement/folders
→ Uses req.user (authenticated user)
→ Resolves req.user.employeeId
→ Returns folders employee has permission to view

// Result: Employee sees their OWN folders/documents
```

**This is CORRECT:**
- Employee sees folders they created
- Employee sees folders shared with them
- Employee does NOT see other employees' folders
- Unless admin explicitly granted permission

---

### Issue 6: Admin Viewing Employee Profile Documents

**Question:** When admin views employee profile Documents tab, whose documents are shown?

**Current Behavior:**
```javascript
// EmployeeProfile.js:
<Documents embedded />  // No employee prop!

// Documents.js still uses:
const { user } = useAuth();  // This is the ADMIN

// Backend sees:
req.user = { _id: admin_id, role: 'admin' }

// Result: Admin sees ALL folders (not scoped to employee)
```

**Expected Behavior (Unclear):**
- Option A: Show all folders (current) - admin can manage all documents
- Option B: Show only employee's folders - scoped view
- Option C: Show folders where employee is owner or has access

**Recommendation:**
- If scoped view is desired:
  - Add employeeId prop to Documents component
  - Backend endpoint: GET /employees/:id/folders
  - Or: Add ?employeeId filter to existing endpoint
  
- If current behavior is correct:
  - Document this as intentional
  - Admin sees everything to manage documents

---

## SECURITY CONSIDERATIONS

### 1. JWT Token Handling
- Tokens stored in localStorage
- Sent in Authorization header: `Bearer <token>`
- Backend validates on every request
- No token refresh mechanism visible (tokens may expire)

### 2. Permission Bypass Risks
- Admin role bypasses ALL permission checks
- Super-admin and HR have same privileges as admin
- No audit log for admin actions
- No rate limiting on folder/document creation

### 3. File Storage
- Documents stored in MongoDB as Buffer (fileData field)
- No file size limits enforced (multer has 10MB limit)
- No virus scanning
- No encryption at rest

### 4. Access Control Gaps
- Employee can create folders with any permissions
- No validation of permission arrays
- allowedUserIds can include any User ID (no validation)
- Creator lockout prevention exists (good!)

### 5. CORS & Embedding
- Office Online Viewer requires public document URL
- /view endpoint manually validates token (good for iframe)
- No CSRF protection visible
- withCredentials: true used for cookie auth

---

## PERFORMANCE CONSIDERATIONS

### 1. Database Queries
- No pagination on folder contents (could be large)
- No caching of folder list
- Document counts calculated on every folder fetch (N+1 problem)
- Breadcrumb calculation traverses ancestors (could be slow)

### 2. File Storage
- Documents stored in MongoDB (not optimal for large files)
- fileData field is Buffer → entire file loaded to memory
- No streaming for large downloads
- No CDN for static files

### 3. Frontend State
- Full folder list fetched on every page load
- No caching in React Query or similar
- Search filters client-side (not server-side)
- Multiple useEffect hooks firing on every render

---

## RECOMMENDATIONS

### High Priority
1. **Fix Employee ID Resolution**
   - Update EmployeeHub records to have correct userId
   - Add migration script to link User ↔ EmployeeHub
   - Add fallback logic in resolveEmployeeIdForUser

2. **Prevent Duplicate Folders**
   - Add unique index: `{ name: 1, createdByEmployeeId: 1 }`
   - Check existence before creation in backend
   - Remove ensureMyDocumentsFolder from frontend

3. **Fix undefined Navigation**
   - Add null checks in folder._id access
   - Validate folder objects have _id before rendering
   - Log folders without IDs for debugging

4. **Clarify Employee Profile Scope**
   - Decide: Should admin see all folders or only employee's?
   - If scoped: Add employeeId filter to backend
   - If not: Document current behavior

### Medium Priority
5. **Add Pagination to Folder Contents**
   - Limit documents returned per request
   - Add pagination controls in FolderView

6. **Optimize Document Counts**
   - Use aggregation pipeline instead of N+1 queries
   - Cache folder document counts

7. **Add File Storage Service**
   - Move from MongoDB to S3 or Azure Blob Storage
   - Store only metadata in MongoDB
   - Stream large files instead of loading to memory

8. **Add Audit Logging**
   - Log all admin document operations
   - Track who accessed which documents
   - Add downloadCount tracking

### Low Priority
9. **Add Token Refresh**
   - Implement refresh token mechanism
   - Auto-refresh before expiry

10. **Add Search Backend**
    - Move search filtering to backend
    - Add full-text search on document names/content

11. **Add File Validation**
    - Virus scanning on upload
    - File type whitelist validation
    - Maximum file size per user quota

---

## TESTING CHECKLIST

### Admin Dashboard
- [ ] Can view all folders
- [ ] Can create root folder
- [ ] Can create subfolder
- [ ] Can upload document to folder
- [ ] Can view document (PDF, PPTX, DOCX)
- [ ] Can download document
- [ ] Can delete folder (cascades to documents)
- [ ] Can rename folder
- [ ] Can search folders
- [ ] Pagination works
- [ ] "My Documents" created automatically
- [ ] No duplicate "My Documents"
- [ ] Navigation /documents → /documents/:id works
- [ ] Breadcrumb shows correct path

### Employee Dashboard
- [ ] Can view permitted folders only
- [ ] Cannot see other employees' folders
- [ ] Can create personal folder
- [ ] Can upload document to own folder
- [ ] Can view document
- [ ] Can download document
- [ ] Embedded folder view works
- [ ] Back button returns to folder list
- [ ] No page navigation (stays on dashboard)
- [ ] "My Documents" created automatically
- [ ] Employee without EmployeeHub record: shows error or empty

### Employee Profile (Admin View)
- [ ] Documents tab shows folders
- [ ] Admin can upload document for employee
- [ ] Admin can view employee's documents
- [ ] Clarify: Should show all or only employee's?

### Permissions
- [ ] Employee cannot access admin-only folders
- [ ] Employee cannot delete folder without permission
- [ ] Folder creator always has full access
- [ ] Permission hierarchy enforced (delete → edit → view)
- [ ] Admin bypasses all checks

### Document Viewer
- [ ] PDF renders inline
- [ ] PPTX opens in Office Online Viewer
- [ ] DOCX opens in Office Online Viewer
- [ ] Images display directly
- [ ] Fullscreen toggle works
- [ ] Download button works
- [ ] Close button works

---

## CONCLUSION

The Document Management System is a well-structured but complex system with dual-mode rendering (standalone/embedded) and role-based access control. The key architectural decisions are:

1. **Single Component, Multiple Contexts:** Documents.js serves both admin and employee with embedded prop
2. **Permission-Based Filtering:** Backend enforces strict access control for employees, none for admins
3. **MongoDB File Storage:** Documents stored as Buffer in database (not ideal for scale)
4. **Employee ID Resolution:** Critical dependency on User ↔ EmployeeHub link
5. **Embedded vs Standalone:** Different navigation behavior based on context

**Main Issues:**
- Employee ID resolution failures prevent document access
- "My Documents" auto-creation causes duplicates
- undefined navigation errors need validation
- PPTX preview needs verification
- Employee profile document scope needs clarification

**Next Steps:**
1. Fix data integrity (User ↔ EmployeeHub links)
2. Add validation to prevent undefined navigation
3. Remove or improve auto-folder creation
4. Clarify and document intended behavior for admin viewing employee documents
5. Add comprehensive logging for debugging

