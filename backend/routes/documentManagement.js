const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const DocumentManagement = require('../models/DocumentManagement');
const EmployeeHub = require('../models/EmployeesHub');

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];

const resolveEmployeeIdForUser = async (user) => {
  if (!user) return null;
  if (user.employeeId && mongoose.Types.ObjectId.isValid(String(user.employeeId))) {
    return user.employeeId;
  }

  const authId = user._id || user.userId || user.id;
  const authIdStr = authId ? String(authId).trim() : '';
  let employee = null;

  if (authIdStr && mongoose.Types.ObjectId.isValid(authIdStr)) {
    employee = await EmployeeHub.findOne({ userId: authIdStr }).select('_id');
    if (!employee) {
      employee = await EmployeeHub.findById(authIdStr).select('_id');
    }
  }

  if (!employee && user.email) {
    employee = await EmployeeHub.findOne({ email: String(user.email).toLowerCase() }).select('_id');
  }

  if (employee?._id) {
    user.employeeId = employee._id;
    return employee._id;
  }

  return null;
};

const resolveEmployeeIdForRequest = async (req) => {
  if (!req.user) return null;
  return resolveEmployeeIdForUser(req.user);
};

const normalizeIdArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => v && v.toString()).filter(Boolean);
  if (typeof value === 'string') return [value].map(v => v && v.toString()).filter(Boolean);
  return [];
};

const enforcePermissionHierarchy = ({ 
  viewEmployeeIds, editEmployeeIds, deleteEmployeeIds,
  viewUserIds, editUserIds, deleteUserIds 
}) => {
  // Employee permission hierarchy
  const viewEmpSet = new Set(normalizeIdArray(viewEmployeeIds));
  const editEmpSet = new Set(normalizeIdArray(editEmployeeIds));
  const deleteEmpSet = new Set(normalizeIdArray(deleteEmployeeIds));

  for (const id of deleteEmpSet) {
    editEmpSet.add(id);
    viewEmpSet.add(id);
  }
  for (const id of editEmpSet) {
    viewEmpSet.add(id);
  }

  // User permission hierarchy (for profile admins)
  const viewUserSet = new Set(normalizeIdArray(viewUserIds));
  const editUserSet = new Set(normalizeIdArray(editUserIds));
  const deleteUserSet = new Set(normalizeIdArray(deleteUserIds));

  for (const id of deleteUserSet) {
    editUserSet.add(id);
    viewUserSet.add(id);
  }
  for (const id of editUserSet) {
    viewUserSet.add(id);
  }

  return {
    viewEmployeeIds: Array.from(viewEmpSet),
    editEmployeeIds: Array.from(editEmpSet),
    deleteEmployeeIds: Array.from(deleteEmpSet),
    viewUserIds: Array.from(viewUserSet),
    editUserIds: Array.from(editUserSet),
    deleteUserIds: Array.from(deleteUserSet)
  };
};

const requireFolderPermission = (action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const role = req.user.role || 'employee';
      if (ADMIN_ROLES.includes(role)) {
        return next();
      }

      await resolveEmployeeIdForRequest(req);

      const folderId = req.params.folderId;
      if (!folderId) return next();

      const folder = await Folder.findById(folderId);
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
      req.folder = folder;

      // Creator can always access (check both User ID and Employee ID)
      const userId = req.user._id || req.user.userId || req.user.id;
      const userIdStr = userId ? userId.toString() : null;
      const empId = req.user.employeeId ? req.user.employeeId.toString() : null;
      
      // Check if user is creator (via User ID for profile admins)
      if (userIdStr && folder.createdByUserId && folder.createdByUserId.toString() === userIdStr) {
        return next();
      }
      
      // Check if user is creator (via Employee ID for employees)
      if (empId && folder.createdByEmployeeId && folder.createdByEmployeeId.toString() === empId) {
        return next();
      }

      if (!folder.hasPermission(action, req.user)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      return next();
    } catch (error) {
      console.error('requireFolderPermission error:', { action, error });
      return res.status(500).json({ message: error.message });
    }
  };
};

// ==================== UNIFIED DOCUMENT FETCH LOGIC ====================

// Get all documents (admin: all, employee: permitted only)
router.get('/documents', async (req, res) => {
  try {
    if (!req.user || (!req.user._id && !req.user.userId && !req.user.id)) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const role = req.user.role || 'employee';
    const isAdminLike = ADMIN_ROLES.includes(role);
    const userId = req.user._id || req.user.userId || req.user.id;
    let query = { isActive: true };

    const empId = await resolveEmployeeIdForRequest(req);

    if (isAdminLike) {
      // Admin sees all
    } else {
      if (!empId) {
        return res.json([]);
      }

      // Limit to folders the user can view (prevents folder permission bypass)
      const userId = req.user._id || req.user.userId || req.user.id;
      const folderOrConditions = [];
      
      if (userId) {
        folderOrConditions.push(
          { createdByUserId: userId },
          { 'permissions.viewUserIds': userId },
          { 'permissions.editUserIds': userId },
          { 'permissions.deleteUserIds': userId }
        );
      }
      
      if (empId) {
        folderOrConditions.push(
          { createdByEmployeeId: empId },
          { 'permissions.viewEmployeeIds': empId },
          { 'permissions.editEmployeeIds': empId },
          { 'permissions.deleteEmployeeIds': empId }
        );
      }
      
      const allowedFolders = await Folder.find({
        isActive: true,
        $or: folderOrConditions
      }).select('_id');
      const allowedFolderIds = allowedFolders.map(f => f._id);

      // Employee/User: only permitted documents
      const docAccessOr = [
        { 'accessControl.visibility': 'all' },
        { 'accessControl.visibility': 'employee', ownerId: empId },
        { 'accessControl.allowedUserIds': userId },
        { uploadedBy: userId } // Profile admins can see documents they uploaded
      ];

      query.$or = [
        { folderId: null, $or: docAccessOr },
        { folderId: { $in: allowedFolderIds }, $or: docAccessOr }
      ];
    }

    // Optional: filter by folder, category, etc.
    if (req.query.folderId) {
      const requestedFolderId = String(req.query.folderId);
      if (isAdminLike) {
        query.folderId = requestedFolderId;
      } else {
        // Ensure employee can view this folder
        const folder = await Folder.findById(requestedFolderId);
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }
        if (!folder.hasPermission('view', req.user)) {
          return res.status(403).json({ message: 'Insufficient permissions' });
        }
        query.folderId = requestedFolderId;
      }
    }
    if (req.query.category) query.category = req.query.category;

    const documents = await DocumentManagement.find(query)
      .populate('uploadedBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName employeeId')
      .populate('folderId', 'name')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'documents');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      console.log('Upload directory ensured:', uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    console.log('Generating filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', // PPT
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, images and text files are allowed.'));
    }
  }
});

// Middleware to check user role and permissions
const checkPermission = (action) => {
  return async (req, res, next) => {
    try {
      // If no user at this point, return 401 immediately
      if (!req.user) {
        console.warn('checkPermission: No user found, returning 401');
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = req.user;
      const userRole = user.role || 'employee';
      
      // Admin and super-admin have all permissions
      if (ADMIN_ROLES.includes(userRole)) {
        return next();
      }

      await resolveEmployeeIdForRequest(req);
      
      // For folder operations, check folder permissions
      if (req.params.folderId) {
        return requireFolderPermission(action)(req, res, next);
      }
      
      // For document operations, check document permissions
      if (req.params.documentId) {
        const document = await DocumentManagement.findById(req.params.documentId);
        if (!document) {
          return res.status(404).json({ message: 'Document not found' });
        }

        // If document belongs to a folder, folder permissions must allow this action too
        if (document.folderId) {
          const folder = await Folder.findById(document.folderId);
          if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
          }

          // Creator can always access (check both User ID and Employee ID)
          const userId = req.user._id || req.user.userId || req.user.id;
          const userIdStr = userId ? userId.toString() : null;
          const empId = req.user.employeeId ? req.user.employeeId.toString() : null;
          
          const isCreator = 
            (userIdStr && folder.createdByUserId && folder.createdByUserId.toString() === userIdStr) ||
            (empId && folder.createdByEmployeeId && folder.createdByEmployeeId.toString() === empId);
          
          if (!isCreator) {
            if (!folder.hasPermission(action, req.user)) {
              return res.status(403).json({ message: 'Insufficient permissions' });
            }
          }
        }
        
        if (!document.hasPermission(action, req.user)) {
          return res.status(403).json({ message: 'Insufficient permissions' });
        }
      }
      
      next();
    } catch (error) {
      console.error('checkPermission error:', { action, error });
      res.status(500).json({ message: error.message });
    }
  };
};

// ==================== FOLDER ROUTES ====================

// Health check endpoint
router.get('/health', (req, res) => {
  console.log('🏥 Document Management Health Check Called');
  res.json({ 
    status: 'OK', 
    message: 'Document Management API is working',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to check Folder model
router.get('/test-folder', async (req, res) => {
  try {
    console.log('🧪 Testing Folder model...');
    
    // Test if Folder model exists
    console.log('📁 Folder model:', typeof Folder);
    
    // Test database connection
    const count = await Folder.countDocuments();
    console.log('📊 Folder count:', count);
    
    // Test creating a simple folder
    const testFolder = {
      name: 'Test Folder ' + Date.now(),
      description: 'Test description',
      createdBy: 'system'
    };
    
    console.log('✅ Test endpoint successful');
    res.json({
      status: 'OK',
      folderModelExists: typeof Folder === 'function',
      folderCount: count,
      testFolder: testFolder
    });
  } catch (error) {
    console.error('💥 Test endpoint error:', error);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    });
  }
});

// Get all folders - SIMPLIFIED
router.get('/folders', async (req, res) => {
  try {
    console.log("📂 Fetching folders...");
    const includeSubfolders = String(req.query.includeSubfolders || '').toLowerCase() === 'true';
    const role = req.user?.role;
    const isAdminLike = ADMIN_ROLES.includes(role);
    const empIdResolved = await resolveEmployeeIdForRequest(req);
    const empId = empIdResolved ? empIdResolved.toString() : null;
    const folderQuery = {
      isActive: true,
      ...(includeSubfolders ? {} : { parentFolder: null })
    };

    if (!isAdminLike && !empId) {
      console.log('📂 EmployeeId not resolved for non-admin user; returning no folders');
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, folders: [] });
    }

    if (!isAdminLike) {
      const userId = req.user._id || req.user.userId || req.user.id;
      const orConditions = [];
      
      // Add User ID checks (for profile admins)
      if (userId) {
        orConditions.push(
          { createdByUserId: userId },
          { 'permissions.viewUserIds': userId },
          { 'permissions.editUserIds': userId },
          { 'permissions.deleteUserIds': userId }
        );
      }
      
      // Add Employee ID checks (for employees)
      if (empId) {
        orConditions.push(
          { createdByEmployeeId: empId },
          { 'permissions.viewEmployeeIds': empId },
          { 'permissions.editEmployeeIds': empId },
          { 'permissions.deleteEmployeeIds': empId }
        );
      }
      
      if (orConditions.length > 0) {
        folderQuery.$or = orConditions;
      } else {
        // No user or employee ID - return empty
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, folders: [] });
      }
    }

    const folders = await Folder.find(folderQuery)
      .sort({ name: 1 });
    
    // Add document count to each folder
    const foldersWithCount = await Promise.all(folders.map(async (folder) => {
      // Count documents respecting access control
      let documentCountQuery = { folderId: folder._id, isActive: true, isArchived: false };
      if (req.user && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
        const userId = req.user?._id || req.user?.userId || req.user?.id;
        const docCountOr = [
          { 'accessControl.visibility': 'all' },
          { 'accessControl.allowedUserIds': userId },
          { uploadedBy: userId } // User can see documents they uploaded
        ];
        
        // Add employee-specific check if user has employeeId
        if (req.user.employeeId) {
          docCountOr.push({ 'accessControl.visibility': 'employee', ownerId: req.user.employeeId });
        }
        
        documentCountQuery = {
          folderId: folder._id,
          isActive: true,
          isArchived: false,
          $or: docCountOr
        };
      }
      const documentCount = await DocumentManagement.countDocuments(documentCountQuery);
      
      // Enhanced permission checks for folder
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      const canEditFolder = isAdminLike ? true : (
        (userId && folder.createdByUserId && folder.createdByUserId.toString() === userId.toString()) ||
        folder.hasPermission('edit', req.user)
      );
      const canDeleteFolder = isAdminLike ? true : (
        (userId && folder.createdByUserId && folder.createdByUserId.toString() === userId.toString()) ||
        folder.hasPermission('delete', req.user)
      );
      return {
        ...folder.toObject(),
        canView: true,
        canEdit: canEditFolder,
        canDelete: canDeleteFolder,
        documentCount
      };
    }));
    
    console.log("✅ Folders fetched successfully:", foldersWithCount.length);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, folders: foldersWithCount });
  } catch (error) {
    console.error("💥 Error fetching folders:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Internal server error while fetching folders' 
    });
  }
});

// Get folder by ID with documents
router.get('/folders/:folderId', requireFolderPermission('view'), async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId)
      .populate('createdBy', 'firstName lastName employeeId');
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Apply access control: admin/super-admin sees all, others see permitted documents
    let documents;
    const role = req.user?.role;
    const isAdminLike = role === 'admin' || role === 'super-admin';
    const userId = req.user && (req.user._id || req.user.userId || req.user.id);

    if (isAdminLike) {
      documents = await DocumentManagement.getByFolder(req.params.folderId);
    } else {
      const query = {
        folderId: req.params.folderId,
        isActive: true,
        isArchived: false,
        $or: [
          { 'accessControl.visibility': 'all' },
          { 'accessControl.visibility': 'employee', ownerId: req.user.employeeId },
          { 'accessControl.allowedUserIds': userId }
        ]
      };

      documents = await DocumentManagement.find(query)
        .populate('uploadedBy', 'firstName lastName email')
        .populate('ownerId', 'firstName lastName employeeId')
        .sort({ createdAt: -1 });
    }
    
    // Build breadcrumb (ancestors) for UI
    const breadcrumb = [];
    try {
      let current = folder;
      while (current) {
        breadcrumb.unshift({
          _id: current._id,
          name: current.name,
          parentFolder: current.parentFolder || null
        });
        if (!current.parentFolder) break;
        current = await Folder.findById(current.parentFolder).select('name parentFolder');
      }
    } catch (breadcrumbError) {
      console.error('Error building folder breadcrumb:', breadcrumbError);
    }

    // Get subfolders
    const subfoldersRaw = await Folder.find({ parentFolder: req.params.folderId, isActive: true });

    const isAdminLikeForFolder = ADMIN_ROLES.includes(req.user?.role);
    const subfolders = isAdminLikeForFolder
      ? subfoldersRaw
      : subfoldersRaw.filter((sf) => sf.hasPermission('view', req.user));
    
    // Format contents with type field for frontend
    const contents = [
      ...subfolders.map(f => ({
        ...f.toObject(),
        type: 'folder',
        canView: true,
        canEdit: isAdminLikeForFolder ? true : f.hasPermission('edit', req.user),
        canDelete: isAdminLikeForFolder ? true : f.hasPermission('delete', req.user)
      })),
      ...documents.map(d => ({ ...d.toObject(), type: 'document' }))
    ];
    
    res.json({
      folder,
      folderPermissions: {
        canView: true,
        canEdit: isAdminLikeForFolder ? true : folder.hasPermission('edit', req.user),
        canDelete: isAdminLikeForFolder ? true : folder.hasPermission('delete', req.user)
      },
      breadcrumb,
      contents,
      documents // Keep for backwards compatibility
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update folder
router.put('/folders/:folderId', requireFolderPermission('edit'), async (req, res) => {
  try {
    const { name, description, viewEmployeeIds, editEmployeeIds, deleteEmployeeIds } = req.body;

    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof description === 'string') update.description = description;
    if (viewEmployeeIds !== undefined || editEmployeeIds !== undefined || deleteEmployeeIds !== undefined) {
      const normalized = enforcePermissionHierarchy({
        viewEmployeeIds,
        editEmployeeIds,
        deleteEmployeeIds
      });

      // Prevent accidental lockout of original creator
      const creatorEmpId = req.folder?.createdByEmployeeId ? req.folder.createdByEmployeeId.toString() : null;
      if (creatorEmpId) {
        const v = new Set(normalizeIdArray(normalized.viewEmployeeIds));
        const e = new Set(normalizeIdArray(normalized.editEmployeeIds));
        const d = new Set(normalizeIdArray(normalized.deleteEmployeeIds));
        v.add(creatorEmpId);
        e.add(creatorEmpId);
        d.add(creatorEmpId);
        update.permissions = {
          viewEmployeeIds: Array.from(v),
          editEmployeeIds: Array.from(e),
          deleteEmployeeIds: Array.from(d)
        };
      } else {
        update.permissions = normalized;
      }
    }
    
    const folder = await Folder.findByIdAndUpdate(
      req.params.folderId,
      update,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName employeeId');
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    res.json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/folders", async (req, res) => {
  try {
    console.log("FOLDER API BODY:", req.body);

    const { name, createdBy, parentFolderId, parentId, viewEmployeeIds, editEmployeeIds, deleteEmployeeIds } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Folder name is required" });
    }

    const createdById = createdBy || (req.user && (req.user._id || req.user.userId || req.user.id)) || null;
    const createdByEmployeeId = (req.user && req.user.employeeId) ? req.user.employeeId : null;
    const rawParent = parentFolderId || parentId || null;
    const resolvedParentFolder = rawParent && String(rawParent).trim() ? String(rawParent).trim() : null;
    if (resolvedParentFolder && !mongoose.Types.ObjectId.isValid(resolvedParentFolder)) {
      return res.status(400).json({ message: 'Invalid parentFolderId' });
    }

    const normalized = enforcePermissionHierarchy({
      viewEmployeeIds,
      editEmployeeIds,
      deleteEmployeeIds
    });

    // Creator must always retain full access (prevents lockout)
    if (createdByEmployeeId) {
      const v = new Set(normalizeIdArray(normalized.viewEmployeeIds));
      const e = new Set(normalizeIdArray(normalized.editEmployeeIds));
      const d = new Set(normalizeIdArray(normalized.deleteEmployeeIds));
      const creatorIdStr = createdByEmployeeId.toString();
      v.add(creatorIdStr);
      e.add(creatorIdStr);
      d.add(creatorIdStr);
      normalized.viewEmployeeIds = Array.from(v);
      normalized.editEmployeeIds = Array.from(e);
      normalized.deleteEmployeeIds = Array.from(d);
    }

    const folder = await Folder.create({
      name: name.trim(),
      description: req.body.description || '',
      createdBy: createdById,
      createdByUserId: createdById,
      createdByEmployeeId,
      parentFolder: resolvedParentFolder,
      permissions: normalized,
    });

    console.log("✅ Folder created successfully:", folder);
    return res.status(201).json({ success: true, folder });
  } catch (err) {
    console.error("FOLDER CREATION ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error creating folder",
      error: err.message
    });
  }
});

// Delete folder (soft delete)
router.delete('/folders/:folderId', checkPermission('delete'), async (req, res) => {
  try {
    const rootFolder = await Folder.findById(req.params.folderId);
    if (!rootFolder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Collect folder + all descendants
    const folderIds = [String(rootFolder._id)];
    for (let i = 0; i < folderIds.length; i++) {
      const currentId = folderIds[i];
      const children = await Folder.find({ parentFolder: currentId }).select('_id');
      for (const child of children) {
        folderIds.push(String(child._id));
      }
    }

    const deleteDocsResult = await DocumentManagement.deleteMany({
      folderId: { $in: folderIds },
    });
    const deleteFoldersResult = await Folder.deleteMany({ _id: { $in: folderIds } });

    res.json({
      message: 'Folder deleted successfully',
      deletedDocuments: deleteDocsResult.deletedCount,
      deletedFolders: deleteFoldersResult.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload document to folder
router.post('/folders/:folderId/documents', 
  checkPermission('edit'),
  upload.single('file'),
  async (req, res) => {
    try {
      // --- Unified Document Upload Logic ---
      const authenticatedUserId = req.user?._id || req.user?.userId || req.user?.id;
      if (!req.user || !authenticatedUserId) {
        if (req.file) {
          try { await fs.unlink(req.file.path); } catch {}
        }
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (req.body.category === 'e_learning' && req.file.mimetype !== 'application/pdf') {
        try { await fs.unlink(req.file.path); } catch {}
        return res.status(400).json({ message: 'Invalid file type. Only PDF files are allowed for E-Learning documents.' });
      }

      // Folder is optional, but if provided, check existence
      let folderId = req.params.folderId || null;
      if (folderId) {
        const folder = await Folder.findById(folderId);
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }
      } else {
        folderId = null;
      }

      // Determine uploader info
      const userRole = req.user.role === 'admin' ? 'admin' : 'employee';
      const uploadedBy = authenticatedUserId;
      const uploadedByRole = userRole;

      // OwnerId: for employee uploads, set to employeeId; for admin, can be null or set by admin
      let ownerId = null;
      if (userRole === 'employee') {
        // Try to get employeeId from user or request
        ownerId = req.user.employeeId || req.body.ownerId || null;
      } else if (req.body.ownerId) {
        ownerId = req.body.ownerId;
      }

      // Access control
      let accessControl = { visibility: 'all', allowedUserIds: [] };
      if (req.body.accessControl) {
        try {
          const parsed = typeof req.body.accessControl === 'string' ? JSON.parse(req.body.accessControl) : req.body.accessControl;
          accessControl = {
            visibility: parsed.visibility || 'all',
            allowedUserIds: Array.isArray(parsed.allowedUserIds) ? parsed.allowedUserIds : []
          };
        } catch (e) {
          // fallback to default
        }
      } else if (userRole === 'employee') {
        // Employees can only upload for themselves, default to employee-only
        accessControl = { visibility: 'employee', allowedUserIds: [uploadedBy] };
      }

      // Read file data into buffer
      const fileBuffer = await fs.readFile(req.file.path);

      // Create document
      const document = new DocumentManagement({
        name: req.file.originalname,
        fileUrl: null,
        fileData: fileBuffer,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy,
        uploadedByRole,
        ownerId,
        folderId,
        accessControl,
        category: req.body.category || 'other',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        version: 1,
        parentDocument: null,
        expiresOn: req.body.expiresOn ? new Date(req.body.expiresOn) : null,
        reminderEnabled: req.body.reminderEnabled === 'true',
        isActive: true,
        isArchived: false,
        downloadCount: 0,
        lastAccessedAt: null,
        // Actor/Subject Tracking
        performedByAdmin: userRole === 'admin' && ownerId !== null && ownerId !== uploadedBy,
        targetEmployeeId: ownerId,
        auditLog: [{
          action: 'uploaded',
          performedBy: uploadedBy,
          timestamp: new Date(),
          details: `Document uploaded by ${req.user.firstName || ''} ${req.user.lastName || ''}` + 
                   (userRole === 'admin' && ownerId ? ` for employee ${ownerId}` : '')
        }]
      });

      // Delete uploaded file from filesystem after reading into buffer
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {}

      await document.save();

      // Populate references - handle cases where ownerId might be null or invalid
      try {
        const populateOptions = [
          { path: 'uploadedBy', select: 'firstName lastName email' },
          { path: 'folderId', select: 'name' }
        ];
        
        // Only populate ownerId if it exists
        if (document.ownerId) {
          populateOptions.push({ path: 'ownerId', select: 'firstName lastName employeeId' });
        }
        
        await document.populate(populateOptions);
      } catch (populateError) {
        console.warn('Document populate warning:', populateError.message);
        // Continue even if populate fails - document is already saved
      }

      res.status(201).json(document);
    } catch (error) {
      // Clean up uploaded file if there's an error
      if (req.file) {
        try { await fs.unlink(req.file.path); } catch {}
      }
      res.status(500).json({ message: error.message });
    }
  }
);

// Get document by ID
router.get('/documents/:documentId', checkPermission('view'), async (req, res) => {
  try {
    const document = await DocumentManagement.findById(req.params.documentId)
      .populate('folderId', 'name')
      .populate('uploadedBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName employeeId');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Add audit log for viewing
    try {
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      if (userId) {
        document.auditLog.push({
          action: 'viewed',
          performedBy: userId,
          timestamp: new Date(),
          details: 'Document viewed'
        });
        await document.save();
      }
    } catch (auditError) {
      console.error('Error logging view:', auditError);
      // Continue to return document even if audit fails
    }
    
    res.json(document);
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      message: error.message,
      name: error.name,
      code: error.code
    });
  }
});

// View/stream document (for opening in browser) - accepts token in query param
router.get('/documents/:documentId/view', async (req, res) => {
  try {
    console.log('=== View Document Request ===');
    console.log('Query token:', req.query.token ? 'Present' : 'Missing');
    console.log('Auth header:', req.headers.authorization ? 'Present' : 'Missing');
    
    // Check for token in query parameter or Authorization header
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      console.error('No token found in request');
      return res.status(401).json({ message: 'Authentication required - no token' });
    }
    
    console.log('Token found, verifying...');
    
    // Verify token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'hrms-jwt-secret-key-2024';
    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
      console.log('Token verified successfully for user:', user.email);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Check permissions
    const isAdminLike = ADMIN_ROLES.includes(user.role);
    if (!isAdminLike) {
      await resolveEmployeeIdForUser(user);
    }

    const document = await DocumentManagement.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!isAdminLike) {
      if (document.folderId) {
        const folder = await Folder.findById(document.folderId);
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }
        if (!folder.hasPermission('view', user)) {
          return res.status(403).json({ message: 'Insufficient permissions' });
        }
      }
      if (!document.hasPermission('view', user)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
    }
    
    if (!document.fileData) {
      return res.status(404).json({ message: 'File data not found' });
    }
    
    // Send file inline (for viewing in browser)
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.name || document.fileName}"`);
    res.setHeader('Content-Length', document.fileData.length);
    res.send(document.fileData);
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload document without folder (optional folder)
router.post('/documents',
  checkPermission('edit'),
  upload.single('file'),
  async (req, res) => {
    try {
      console.log('📤 Document upload request received');
      console.log('👤 User:', { 
        id: req.user?._id || req.user?.userId || req.user?.id,
        role: req.user?.role,
        email: req.user?.email,
        employeeId: req.user?.employeeId 
      });
      console.log('📋 Request body:', { 
        category: req.body.category,
        ownerId: req.body.ownerId,
        hasFile: !!req.file
      });

      const authenticatedUserId = req.user?._id || req.user?.userId || req.user?.id;
      if (!req.user || !authenticatedUserId) {
        if (req.file) {
          try { await fs.unlink(req.file.path); } catch {}
        }
        console.error('❌ Authentication required');
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!req.file) {
        console.error('❌ No file uploaded');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (req.body.category === 'e_learning' && req.file.mimetype !== 'application/pdf') {
        try { await fs.unlink(req.file.path); } catch {}
        console.error('❌ Invalid file type for e-learning');
        return res.status(400).json({ message: 'Invalid file type. Only PDF files are allowed for E-Learning documents.' });
      }

      // No folder provided
      const folderId = null;

      // Check if user is admin using ADMIN_ROLES array
      const isAdmin = ADMIN_ROLES.includes(req.user.role);
      const userRole = isAdmin ? 'admin' : 'employee';
      const uploadedBy = authenticatedUserId;
      const uploadedByRole = userRole;

      console.log('🔐 Role check:', { role: req.user.role, isAdmin, userRole });

      // Determine document owner
      let ownerId = null;
      if (isAdmin) {
        // Admin can upload for specific employee (ownerId in request) or for themselves
        if (req.body.ownerId) {
          ownerId = req.body.ownerId;
          console.log('👤 Admin uploading for employee:', ownerId);
        } else {
          // Admin uploading for themselves - resolve their employee ID
          const resolvedEmployeeId = await resolveEmployeeIdForRequest(req);
          ownerId = resolvedEmployeeId;
          console.log('👤 Admin uploading for self:', ownerId);
        }
      } else {
        // Employee uploading for themselves
        ownerId = req.user.employeeId || req.body.ownerId || null;
        console.log('👤 Employee uploading:', ownerId);
      }

      // Validate ownerId exists
      if (!ownerId) {
        if (req.file) {
          try { await fs.unlink(req.file.path); } catch {}
        }
        console.error('❌ Could not determine document owner');
        return res.status(400).json({ 
          message: 'Could not determine document owner. Please ensure employee exists.',
          details: {
            isAdmin,
            userRole,
            hasBodyOwnerId: !!req.body.ownerId,
            hasEmployeeId: !!req.user.employeeId
          }
        });
      }

      console.log('✅ Document owner resolved:', ownerId);

      let accessControl = { visibility: 'all', allowedUserIds: [] };
      if (req.body.accessControl) {
        try {
          const parsed = typeof req.body.accessControl === 'string' ? JSON.parse(req.body.accessControl) : req.body.accessControl;
          accessControl = {
            visibility: parsed.visibility || 'all',
            allowedUserIds: Array.isArray(parsed.allowedUserIds) ? parsed.allowedUserIds : []
          };
        } catch (e) {}
      } else if (userRole === 'employee') {
        accessControl = { visibility: 'employee', allowedUserIds: [uploadedBy] };
      }

      console.log('📁 Reading file from disk:', req.file.path);
      const fileBuffer = await fs.readFile(req.file.path);
      console.log('✅ File read successfully, size:', fileBuffer.length, 'bytes');

      const document = new DocumentManagement({
        name: req.file.originalname,
        fileUrl: null,
        fileData: fileBuffer,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy,
        uploadedByRole,
        ownerId,
        folderId,
        accessControl,
        category: req.body.category || 'other',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        version: 1,
        parentDocument: null,
        expiresOn: req.body.expiresOn ? new Date(req.body.expiresOn) : null,
        reminderEnabled: req.body.reminderEnabled === 'true',
        isActive: true,
        isArchived: false,
        downloadCount: 0,
        lastAccessedAt: null,
        auditLog: [{ action: 'uploaded', performedBy: uploadedBy, timestamp: new Date(), details: `Document uploaded by ${req.user.firstName || ''} ${req.user.lastName || ''}` }]
      });

      console.log('💾 Saving document to database...');
      try { await fs.unlink(req.file.path); } catch {}

      await document.save();
      console.log('✅ Document saved successfully:', document._id);
      await document.populate([
        { path: 'uploadedBy', select: 'firstName lastName email' },
        { path: 'ownerId', select: 'firstName lastName employeeId' }
      ]);

      console.log('✅ Document upload complete:', document._id);
      res.status(201).json(document);
    } catch (error) {
      console.error('❌ Document upload failed:', {
        message: error.message,
        stack: error.stack,
        file: req.file?.originalname,
        user: req.user?.email,
        ownerId: req.body?.ownerId
      });
      if (req.file) { try { await fs.unlink(req.file.path); } catch {} }
      res.status(500).json({ 
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Download document
router.get('/documents/:documentId/download', checkPermission('download'), async (req, res) => {
  try {
    const document = await DocumentManagement.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (!document.fileData) {
      return res.status(404).json({ message: 'File data not found' });
    }
    
    // Increment download count - don't block download if this fails
    try {
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      document.downloadCount += 1;
      document.lastAccessedAt = new Date();
      if (userId) {
        document.auditLog.push({
          action: 'downloaded',
          performedBy: userId,
          timestamp: new Date(),
          details: 'Document downloaded'
        });
      }
      await document.save();
    } catch (auditError) {
      console.error('Error updating download audit:', auditError);
      // Continue with download even if audit fails
    }
    
    const originalName = document.name || document.fileName || 'document';
    const isPdf = document.mimeType === 'application/pdf';
    let downloadName = originalName;
    if (isPdf) {
      const base = downloadName.replace(/\.[^/.]+$/, '');
      downloadName = base.endsWith('.pdf') ? base : `${base}.pdf`;
    }

    // Send file from MongoDB buffer
    res.setHeader('Content-Type', isPdf ? 'application/pdf' : document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Length', document.fileData.length);
    res.send(document.fileData);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update document
router.put('/documents/:documentId', checkPermission('edit'), async (req, res) => {
  try {
    const { name, fileName, category, tags, permissions, expiresOn, reminderEnabled } = req.body;

    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof fileName === 'string' && fileName.trim()) update.fileName = fileName.trim();
    if (category !== undefined) update.category = category;

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        update.tags = tags.map((tag) => String(tag).trim()).filter(Boolean);
      } else if (typeof tags === 'string') {
        update.tags = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      }
    }

    if (permissions !== undefined) {
      if (typeof permissions === 'string') {
        try {
          update.permissions = JSON.parse(permissions);
        } catch {
          // ignore invalid permissions payload
        }
      } else {
        update.permissions = permissions;
      }
    }

    if (expiresOn !== undefined) {
      const parsed = expiresOn ? new Date(expiresOn) : null;
      if (!expiresOn) update.expiresOn = null;
      else if (!Number.isNaN(parsed.getTime())) update.expiresOn = parsed;
    }
    if (reminderEnabled !== undefined) update.reminderEnabled = reminderEnabled;
    
    const document = await DocumentManagement.findByIdAndUpdate(
      req.params.documentId,
      update,
      { new: true, runValidators: true }
    ).populate([
      { path: 'folderId', select: 'name' },
      { path: 'uploadedBy', select: 'firstName lastName employeeId' },
      { path: 'ownerId', select: 'firstName lastName employeeId' }
    ]);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Add audit log
    try {
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
        document.auditLog.push({
          action: 'updated',
          performedBy: userId,
          timestamp: new Date(),
          details: 'Document updated'
        });
        await document.save();
      }
    } catch (auditError) {
      console.error('Error logging update:', auditError);
      // Continue to return document even if audit fails
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new version of document
router.post('/documents/:documentId/version', 
  checkPermission('edit'), 
  upload.single('file'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const originalDocument = await DocumentManagement.findById(req.params.documentId);
      if (!originalDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Read file data into buffer
      const fileBuffer = await fs.readFile(req.file.path);
      
      // Delete temp file
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError);
      }
      
      // Create new version
      const userId = req.user._id || req.user.userId || req.user.id;
      const newVersion = await originalDocument.createNewVersion(
        fileBuffer,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        userId
      );
      
      await newVersion.populate([
        { path: 'folderId', select: 'name' },
        { path: 'uploadedBy', select: 'firstName lastName employeeId' },
        { path: 'employeeId', select: 'firstName lastName employeeId' }
      ]);
      
      // Add audit log
      try {
        if (userId) {
          newVersion.auditLog.push({
            action: 'uploaded',
            performedBy: userId,
            timestamp: new Date(),
            details: 'New version uploaded'
          });
          await newVersion.save();
        }
      } catch (auditError) {
        console.error('Error logging new version:', auditError);
        // Continue to return document even if audit fails
      }
      
      res.status(201).json(newVersion);
    } catch (error) {
      // Clean up uploaded file if there's an error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to clean up file:', cleanupError);
        }
      }
      res.status(500).json({ message: error.message });
    }
  }
);

// Archive document
router.post('/documents/:documentId/archive', checkPermission('delete'), async (req, res) => {
  try {
    const document = await DocumentManagement.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    document.isArchived = true;
    document.isActive = false;
    if (userId) {
      document.auditLog.push({
        action: 'archived',
        performedBy: userId,
        timestamp: new Date(),
        details: 'Document archived'
      });
    }
    await document.save();
    
    res.json({ message: 'Document archived successfully' });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete document
router.delete('/documents/:documentId', checkPermission('delete'), async (req, res) => {
  try {
    const document = await DocumentManagement.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Delete from database (file data is stored in MongoDB, no filesystem cleanup needed)
    await DocumentManagement.findByIdAndDelete(req.params.documentId);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Search documents
router.get('/documents/search', async (req, res) => {
  try {
    const { q, folderId } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const documents = await DocumentManagement.searchDocuments(q, { folderId });
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get expiring documents
router.get('/documents/expiring', async (req, res) => {
  try {
    const { days } = req.query;
    const documents = await DocumentManagement.getExpiringSoon(parseInt(days) || 30);
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get document versions
router.get('/documents/:documentId/versions', checkPermission('view'), async (req, res) => {
  try {
    const document = await DocumentManagement.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    const versions = await DocumentManagement.find({
      $or: [
        { _id: req.params.documentId },
        { parentDocument: req.params.documentId }
      ]
    })
    .populate('uploadedBy', 'firstName lastName employeeId')
    .sort({ version: 1 });
    
    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== MY DOCUMENTS FEATURE ====================

/**
 * Helper function: Ensure "My Documents" folder exists for employee
 * Creates folder if not exists, returns existing if found
 */
async function ensureMyDocumentsFolder(employeeId) {
  try {
    // Check if folder already exists
    let folder = await Folder.findOne({
      name: 'My Documents',
      createdBy: employeeId,
      isActive: true
    });

    if (folder) {
      return folder;
    }

    // Create new "My Documents" folder
    folder = await Folder.create({
      name: 'My Documents',
      description: 'Personal documents folder',
      createdBy: employeeId,
      permissions: {
        view: ['admin', 'employee'],
        edit: ['admin'],
        upload: ['admin'],
        download: ['admin', 'employee'],
        delete: ['admin']
      },
      isActive: true
    });

    console.log('Created My Documents folder for employee:', employeeId);
    return folder;
  } catch (error) {
    console.error('Error ensuring My Documents folder:', error);
    throw error;
  }
}

/**
 * POST /api/document-management/employees/:employeeId/upload
 * Upload document to employee's "My Documents" folder (admin only)
 */
router.post('/employees/:employeeId/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { category } = req.body;

      // Explicit admin authorization check
      if (!req.user || !['admin', 'super-admin', 'hr'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Ensure My Documents folder exists
      const folder = await ensureMyDocumentsFolder(employeeId);

      // Create document record
      const document = await DocumentManagement.create({
        name: req.file.originalname,
        fileUrl: `/uploads/documents/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user._id || req.user.userId || req.user.id,
        uploadedByRole: 'admin',
        ownerId: employeeId,
        folderId: folder._id,
        category: category || 'other',
        accessControl: {
          visibility: 'employee',
          allowedUserIds: [employeeId]
        },
        isActive: true,
        isArchived: false
      });

      console.log('Document uploaded to My Documents:', document._id);

      res.status(201).json({
        message: 'Document uploaded successfully',
        document
      });
    } catch (error) {
      console.error('Upload to My Documents error:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/document-management/employees/:employeeId/my-documents
 * Get all documents in employee's "My Documents" folder
 * Auth: Employee can only access their own, admins can access any
 */
router.get('/employees/:employeeId/my-documents', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?._id || req.user?.userId || req.user?.id;

    console.log('📂 GET /my-documents - Auth check:', {
      employeeId,
      userId,
      userRole,
      match: String(userId) === String(employeeId),
      reqUser: req.user
    });

    // Authorization check: if not admin, must be accessing own documents
    if (userRole !== 'admin' && userRole !== 'super-admin') {
      if (String(userId) !== String(employeeId)) {
        console.error('❌ Access denied: userId mismatch', {
          userId,
          employeeId
        });
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Find My Documents folder
    const folder = await Folder.findOne({
      name: 'My Documents',
      createdBy: employeeId,
      isActive: true
    });

    if (!folder) {
      return res.json({ folder: null, documents: [] });
    }

    // Get documents in folder
    const documents = await DocumentManagement.find({
      folderId: folder._id,
      isActive: true,
      isArchived: false
    })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ folder, documents });
  } catch (error) {
    console.error('Get My Documents error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
