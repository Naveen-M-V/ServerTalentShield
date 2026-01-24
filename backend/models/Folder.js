const mongoose = require('mongoose');

/**
 * Simplified Folder Schema for Document Management Module
 */
const folderSchema = new mongoose.Schema({
  // Folder Information
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    maxlength: [100, 'Folder name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  // Organization
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },

  // Access Control
  permissions: {
    viewEmployeeIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeHub',
      index: true
    }],
    editEmployeeIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeHub',
      index: true
    }],
    deleteEmployeeIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeHub',
      index: true
    }]
  },
  
  // Metadata
  createdBy: {
    type: String, // Changed from ObjectId to String for simplicity
    required: false,
    default: null
  },

  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },

  createdByEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeHub',
    required: false,
    default: null,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Instance method to check permission (employee-based)
folderSchema.methods.hasPermission = function(action, user) {
  const role = user?.role || 'employee';
  if (role === 'admin' || role === 'super-admin') return true;

  const employeeId = user?.employeeId;
  const empIdStr = employeeId ? employeeId.toString() : null;

  const perms = this.permissions || {};
  const viewIds = Array.isArray(perms.viewEmployeeIds) ? perms.viewEmployeeIds.map(v => v.toString()) : [];
  const editIds = Array.isArray(perms.editEmployeeIds) ? perms.editEmployeeIds.map(v => v.toString()) : [];
  const deleteIds = Array.isArray(perms.deleteEmployeeIds) ? perms.deleteEmployeeIds.map(v => v.toString()) : [];

  // Prefer employee-based permissions when configured
  const hasEmployeePerms = viewIds.length > 0 || editIds.length > 0 || deleteIds.length > 0;
  if (hasEmployeePerms) {
    if (!empIdStr) return false;
    if (action === 'view' || action === 'download') {
      return viewIds.includes(empIdStr) || editIds.includes(empIdStr) || deleteIds.includes(empIdStr);
    }
    if (action === 'edit' || action === 'upload') {
      return editIds.includes(empIdStr) || deleteIds.includes(empIdStr);
    }
    if (action === 'delete') {
      return deleteIds.includes(empIdStr);
    }
    return false;
  }

  // Legacy fallback (older folders)
  const legacy = perms[action];
  if (!legacy) return false;
  if (!Array.isArray(legacy)) return false;
  return legacy.includes(role);
};

// Prevent model re-compilation
const Folder = mongoose.models.Folder || mongoose.model('Folder', folderSchema);

module.exports = Folder;
