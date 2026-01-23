const EmployeeHub = require('../models/EmployeesHub');

/**
 * Hierarchy Helper Utilities
 * Handles role-based authorization and hierarchy checking for EmployeeHub
 * NOTE: User model (profiles) is separate and only handles certificate uploads
 */

/**
 * Check if an approver can approve a leave request for an employee
 * @param {String|ObjectId} approverId - The ID of the person trying to approve
 * @param {String|ObjectId} employeeId - The ID of the employee who requested leave
 * @returns {Boolean} - True if approver has permission
 */
exports.canApproveLeave = async (approverId, employeeId) => {
  try {
    const approver = await EmployeeHub.findById(approverId).select('role _id');
    const employee = await EmployeeHub.findById(employeeId).select('managerId _id');
    
    if (!approver || !employee) {
      return false;
    }
    
    // Super-admin can approve anything
    if (approver.role === 'super-admin') {
      return true;
    }
    
    // Admin can approve anything
    if (approver.role === 'admin') {
      return true;
    }
    
    // HR can approve any leave
    if (approver.role === 'hr') {
      return true;
    }
    
    // Senior-manager can approve if employee is in their hierarchy
    if (approver.role === 'senior-manager') {
      return await this.isInHierarchy(employee, approver);
    }
    
    // Manager can approve if employee reports directly to them
    if (approver.role === 'manager') {
      return employee.managerId?.toString() === approver._id.toString();
    }
    
    // Regular employees cannot approve
    return false;
  } catch (error) {
    console.error('Error in canApproveLeave:', error);
    return false;
  }
};

/**
 * Check if an approver can approve an expense for an employee
 * @param {String|ObjectId} approverId - The ID of the person trying to approve
 * @param {String|ObjectId} employeeId - The ID of the employee who submitted expense
 * @returns {Boolean} - True if approver has permission
 */
exports.canApproveExpense = async (approverId, employeeId) => {
  try {
    const approver = await EmployeeHub.findById(approverId).select('role _id');
    const employee = await EmployeeHub.findById(employeeId).select('managerId _id');
    
    if (!approver || !employee) {
      return false;
    }
    
    // Super-admin can approve anything
    if (approver.role === 'super-admin') {
      return true;
    }
    
    // Admin can approve anything
    if (approver.role === 'admin') {
      return true;
    }
    
    // HR cannot approve expenses (view only)
    if (approver.role === 'hr') {
      return false;
    }
    
    // Senior-manager can approve if employee is in their hierarchy
    if (approver.role === 'senior-manager') {
      return await this.isInHierarchy(employee, approver);
    }
    
    // Manager can approve if employee reports directly to them
    if (approver.role === 'manager') {
      return employee.managerId?.toString() === approver._id.toString();
    }
    
    // Regular employees cannot approve
    return false;
  } catch (error) {
    console.error('Error in canApproveExpense:', error);
    return false;
  }
};

/**
 * Check if an approver can mark an expense as paid
 * @param {String|ObjectId} approverId - The ID of the person trying to mark as paid
 * @returns {Boolean} - True if approver has permission
 */
exports.canMarkExpenseAsPaid = async (approverId) => {
  try {
    const approver = await EmployeeHub.findById(approverId).select('role');
    
    if (!approver) {
      return false;
    }
    
    // Only admin and super-admin can mark as paid (financial authority)
    return ['admin', 'super-admin'].includes(approver.role);
  } catch (error) {
    console.error('Error in canMarkExpenseAsPaid:', error);
    return false;
  }
};

/**
 * Check if employee is in manager's reporting hierarchy (recursive)
 * @param {Object} employee - Employee document with managerId
 * @param {Object} manager - Manager document to check against
 * @returns {Boolean} - True if employee reports to manager (directly or indirectly)
 */
exports.isInHierarchy = async (employee, manager) => {
  try {
    if (!employee.managerId) {
      return false;
    }
    
    // Direct report check
    if (employee.managerId.toString() === manager._id.toString()) {
      return true;
    }
    
    // For senior managers, check indirect reports
    if (manager.role === 'senior-manager' || manager.role === 'admin' || manager.role === 'super-admin') {
      const directManager = await EmployeeHub.findById(employee.managerId).select('managerId role _id');
      
      if (!directManager) {
        return false;
      }
      
      // Recursively check if employee's manager reports to this manager
      return await this.isInHierarchy(directManager, manager);
    }
    
    return false;
  } catch (error) {
    console.error('Error in isInHierarchy:', error);
    return false;
  }
};

/**
 * Get all subordinates for a manager
 * @param {String|ObjectId} managerId - The manager's ID
 * @param {Boolean} includeIndirect - Include indirect reports (for senior managers)
 * @returns {Array} - Array of employee documents
 */
exports.getSubordinates = async (managerId, includeIndirect = false) => {
  try {
    const manager = await EmployeeHub.findById(managerId).select('role');
    
    if (!manager) {
      return [];
    }
    
    // Get direct reports
    const directReports = await EmployeeHub.find({ managerId })
      .select('firstName lastName email employeeId jobTitle department managerId role')
      .lean();
    
    if (!includeIndirect) {
      return directReports;
    }
    
    // For senior managers, get indirect reports recursively
    if (manager.role === 'senior-manager' || manager.role === 'admin' || manager.role === 'super-admin') {
      let allSubordinates = [...directReports];
      
      for (const employee of directReports) {
        const subSubordinates = await this.getSubordinates(employee._id, true);
        allSubordinates = [...allSubordinates, ...subSubordinates];
      }
      
      return allSubordinates;
    }
    
    return directReports;
  } catch (error) {
    console.error('Error in getSubordinates:', error);
    return [];
  }
};

/**
 * Get pending approvals for a manager
 * @param {String|ObjectId} managerId - The manager's ID
 * @returns {Object} - Object with leaves and expenses arrays
 */
exports.getPendingApprovalsForManager = async (managerId) => {
  try {
    const LeaveRecord = require('../models/LeaveRecord');
    const Expense = require('../models/Expense');
    
    const manager = await EmployeeHub.findById(managerId).select('role');
    
    if (!manager) {
      return { leaves: [], expenses: [] };
    }
    
    // Get all subordinates based on role
    const includeIndirect = ['senior-manager', 'admin', 'super-admin'].includes(manager.role);
    const subordinates = await this.getSubordinates(managerId, includeIndirect);
    const subordinateIds = subordinates.map(e => e._id);
    
    // For HR, get all employees
    let leaveQuery = { status: 'pending' };
    let expenseQuery = { status: 'pending' };
    
    if (manager.role === 'hr') {
      // HR sees all pending leaves
      leaveQuery = { status: 'pending' };
    } else if (manager.role === 'admin' || manager.role === 'super-admin') {
      // Admin sees all pending approvals
      leaveQuery = { status: 'pending' };
      expenseQuery = { status: 'pending' };
    } else {
      // Managers and senior managers see only their subordinates
      leaveQuery = { user: { $in: subordinateIds }, status: 'pending' };
      expenseQuery = { employee: { $in: subordinateIds }, status: 'pending' };
    }
    
    // Get pending leaves
    const leaves = await LeaveRecord.find(leaveQuery)
      .populate('user', 'firstName lastName employeeId email jobTitle')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get pending expenses (HR cannot approve expenses)
    let expenses = [];
    if (manager.role !== 'hr') {
      expenses = await Expense.find(expenseQuery)
        .populate('employee', 'firstName lastName employeeId email jobTitle')
        .sort({ createdAt: -1 })
        .lean();
    }
    
    return { leaves, expenses };
  } catch (error) {
    console.error('Error in getPendingApprovalsForManager:', error);
    return { leaves: [], expenses: [] };
  }
};

/**
 * Get approval authority level for a user
 * @param {String|ObjectId} userId - The user's ID
 * @returns {Object} - Object with role and permission flags
 */
exports.getApprovalAuthority = async (userId) => {
  try {
    const user = await EmployeeHub.findById(userId).select('role firstName lastName employeeId');
    
    if (!user) {
      return {
        role: null,
        canApproveLeave: false,
        canApproveExpense: false,
        canMarkAsPaid: false,
        isManager: false,
        isSeniorManager: false,
        isHR: false,
        isAdmin: false
      };
    }
    
    const roleHierarchy = {
      'employee': 1,
      'manager': 2,
      'senior-manager': 3,
      'hr': 4,
      'admin': 5,
      'super-admin': 6
    };
    
    const authorityLevel = roleHierarchy[user.role] || 1;
    
    return {
      role: user.role,
      authorityLevel,
      canApproveLeave: authorityLevel >= 2, // Manager and above
      canApproveExpense: ['manager', 'senior-manager', 'admin', 'super-admin'].includes(user.role),
      canMarkAsPaid: ['admin', 'super-admin'].includes(user.role),
      isManager: authorityLevel >= 2,
      isSeniorManager: authorityLevel >= 3,
      isHR: user.role === 'hr',
      isAdmin: authorityLevel >= 5,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        employeeId: user.employeeId
      }
    };
  } catch (error) {
    console.error('Error in getApprovalAuthority:', error);
    return {
      role: null,
      canApproveLeave: false,
      canApproveExpense: false,
      canMarkAsPaid: false,
      isManager: false,
      isSeniorManager: false,
      isHR: false,
      isAdmin: false
    };
  }
};

module.exports = exports;
