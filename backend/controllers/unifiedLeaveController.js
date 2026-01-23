const LeaveRequest = require('../models/LeaveRequest');
const LeaveRecord = require('../models/LeaveRecord');
const AnnualLeaveBalance = require('../models/AnnualLeaveBalance');
const EmployeeHub = require('../models/EmployeesHub');
const Notification = require('../models/Notification');
const ShiftAssignment = require('../models/ShiftAssignment');
const TimeEntry = require('../models/TimeEntry');
const mongoose = require('mongoose');

/**
 * UNIFIED LEAVE MANAGEMENT CONTROLLER
 * Handles all leave-related operations in one place
 */

// ==================== EMPLOYEE LEAVE REQUESTS ====================

/**
 * Create leave request from employee dashboard
 * @route POST /api/leave/request
 */
exports.createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, status } = req.body;
    
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      console.error('Authentication error: req.user not found or missing ID');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }
    
    const employeeId = req.user.id || req.user._id;
    console.log('Creating leave request for employee:', employeeId);

    // Validation
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: leaveType, startDate, endDate, reason'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Calculate numberOfDays (including weekends, excluding time)
    const diffTime = Math.abs(end - start);
    const numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    console.log('Calculated numberOfDays:', numberOfDays);

    // Check for overlapping leave
    const overlappingLeave = await LeaveRequest.findOne({
      employeeId,
      status: { $in: ['Pending', 'Approved'] },
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
    });

    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for this date range'
      });
    }

    // Create leave request - no approverId needed, goes to all admins
    const leaveRequest = new LeaveRequest({
      employeeId,
      approverId: employeeId, // Placeholder, will be updated on approval
      leaveType,
      startDate: start,
      endDate: end,
      numberOfDays,
      reason,
      status: status === 'Draft' ? 'Draft' : 'Pending'
    });

    await leaveRequest.save();
    await leaveRequest.populate('employeeId', 'firstName lastName email department');

    // Notify all admins if status is Pending
    if (leaveRequest.status === 'Pending') {
      await notifyAdminsOfNewRequest(leaveRequest);
    }

    res.status(201).json({
      success: true,
      message: leaveRequest.status === 'Draft' ? 'Leave request saved as draft' : 'Leave request submitted successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating leave request',
      error: error.message
    });
  }
};

/**
 * Get employee's own leave requests
 * @route GET /api/leave/my-requests
 */
exports.getMyLeaveRequests = async (req, res) => {
  try {
    const employeeId = req.user.id || req.user._id;
    const { status } = req.query;

    let query = { employeeId };
    if (status) query.status = status;

    const leaveRequests = await LeaveRequest.find(query)
      .populate('approverId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .populate('rejectedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: leaveRequests
    });
  } catch (error) {
    console.error('Get my leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leave requests',
      error: error.message
    });
  }
};

// ==================== ADMIN APPROVAL WORKFLOW ====================

/**
 * Get all pending leave requests for admin dashboard
 * @route GET /api/leave/pending-requests
 */
exports.getPendingLeaveRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { leaveType, startDate, endDate } = req.query;

    // Only admins and super-admins can access
    if (userRole !== 'admin' && userRole !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    let query = { status: 'Pending' };
    if (leaveType) query.leaveType = leaveType;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email vtid department jobTitle')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });
  } catch (error) {
    console.error('Get pending leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending leave requests',
      error: error.message
    });
  }
};

exports.getApprovedLeaveRequestsByApprover = async (req, res) => {
  try {
    const userRole = req.user.role;
    const adminUserId = req.user.id || req.user._id;
    const { leaveType, startDate, endDate } = req.query;

    if (userRole !== 'admin' && userRole !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    let approverEmp = await EmployeeHub.findOne({ userId: adminUserId });
    if (!approverEmp && req.user?.email) {
      approverEmp = await EmployeeHub.findOne({ email: req.user.email.toString().trim().toLowerCase() });
    }
    const approverEmployeeId = approverEmp ? approverEmp._id : null;

    // Admin dashboard "Approved Requests" should show all approved requests.
    // Keep approverId data for display/audit, but don't filter by it.
    let query = { status: 'Approved' };
    if (leaveType) query.leaveType = leaveType;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email vtid department jobTitle')
      .sort({ approvedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });
  } catch (error) {
    console.error('Get approved leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching approved leave requests',
      error: error.message
    });
  }
};

exports.getDeniedLeaveRequestsByApprover = async (req, res) => {
  try {
    const userRole = req.user.role;
    const adminUserId = req.user.id || req.user._id;
    const { leaveType, startDate, endDate } = req.query;

    if (userRole !== 'admin' && userRole !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Resolve approver as EmployeeHub record (prefer by userId; fallback by email)
    // NOTE: We currently do not filter by approverId (same behavior as Approved Requests).
    // We resolve it anyway for forward-compatibility/audit.
    let approverEmp = await EmployeeHub.findOne({ userId: adminUserId });
    if (!approverEmp && req.user?.email) {
      approverEmp = await EmployeeHub.findOne({ email: req.user.email.toString().trim().toLowerCase() });
    }
    const approverEmployeeId = approverEmp ? approverEmp._id : null;

    let query = { status: 'Rejected' };
    if (leaveType) query.leaveType = leaveType;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email vtid department jobTitle')
      .sort({ rejectedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });
  } catch (error) {
    console.error('Get denied leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching denied leave requests',
      error: error.message
    });
  }
};

/**
 * Approve leave request
 * @route PATCH /api/leave/approve/:id
 */
exports.approveLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;
    const adminUserId = req.user.id || req.user._id;

    // Resolve approver as EmployeeHub record (prefer by userId; fallback by email)
    let approverEmp = null;

    if (adminUserId && mongoose.Types.ObjectId.isValid(String(adminUserId))) {
      approverEmp = await EmployeeHub.findById(adminUserId);
    }

    if (!approverEmp) {
      approverEmp = await EmployeeHub.findOne({ userId: adminUserId });
    }
    if (!approverEmp && req.user?.email) {
      approverEmp = await EmployeeHub.findOne({ email: req.user.email.toString().trim().toLowerCase() });
    }

    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const approverId = approverEmp?._id || leaveRequest.approverId || null;

    if (!approverId) {
      return res.status(400).json({
        success: false,
        message: 'Approver employee record not found. Please link the admin user to an EmployeeHub record.'
      });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve a ${leaveRequest.status} leave request`
      });
    }

    // Update leave request
    leaveRequest.status = 'Approved';
    leaveRequest.approverId = approverId;
    leaveRequest.approvedBy = approverId; // Track who approved
    leaveRequest.adminComment = adminComment || '';
    leaveRequest.approvedAt = new Date();
    await leaveRequest.save();

    // Create LeaveRecord for reporting
    const leaveTypeMap = {
      'Sick': 'sick',
      'Casual': 'annual',
      'Paid': 'annual',
      'Unpaid': 'unpaid',
      'Maternity': 'annual',
      'Paternity': 'annual',
      'Bereavement': 'annual',
      'Other': 'annual'
    };

    await LeaveRecord.create({
      user: leaveRequest.employeeId,
      type: leaveTypeMap[leaveRequest.leaveType] || 'annual',
      status: 'approved',
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      days: leaveRequest.numberOfDays,
      reason: leaveRequest.reason,
      approvedBy: approverId,
      approvedAt: new Date(),
      createdBy: approverId
    });

    // Update leave balance if applicable
    if (leaveRequest.leaveType !== 'Unpaid') {
      await updateLeaveBalance(leaveRequest.employeeId, leaveRequest.numberOfDays);
    }

    // Cancel shifts on leave dates
    await cancelShiftsForLeave(leaveRequest);

    // Notify employee
    await notifyEmployeeOfApproval(leaveRequest, adminComment);

    // Notify team members
    await notifyTeamOfLeave(leaveRequest);

    await leaveRequest.populate('employeeId', 'firstName lastName email');
    await leaveRequest.populate('approverId', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving leave request',
      error: error.message
    });
  }
};

/**
 * Reject leave request
 * @route PATCH /api/leave/reject/:id
 */
exports.rejectLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminUserId = req.user.id || req.user._id;

    // Resolve approver as EmployeeHub record (prefer by userId; fallback by email)
    let approverEmp = null;

    if (adminUserId && mongoose.Types.ObjectId.isValid(String(adminUserId))) {
      approverEmp = await EmployeeHub.findById(adminUserId);
    }

    if (!approverEmp) {
      approverEmp = await EmployeeHub.findOne({ userId: adminUserId });
    }
    if (!approverEmp && req.user?.email) {
      approverEmp = await EmployeeHub.findOne({ email: req.user.email.toString().trim().toLowerCase() });
    }

    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const approverId = approverEmp?._id || leaveRequest.approverId || null;

    if (!approverId) {
      return res.status(400).json({
        success: false,
        message: 'Approver employee record not found. Please link the admin user to an EmployeeHub record.'
      });
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${leaveRequest.status} leave request`
      });
    }

    leaveRequest.status = 'Rejected';
    leaveRequest.approverId = approverId;
    leaveRequest.rejectedBy = approverId; // Track who rejected
    leaveRequest.rejectionReason = rejectionReason;
    leaveRequest.rejectedAt = new Date();
    await leaveRequest.save();

    // Notify employee
    await notifyEmployeeOfRejection(leaveRequest, rejectionReason);

    await leaveRequest.populate('employeeId', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Leave request rejected',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting leave request',
      error: error.message
    });
  }
};

// ==================== ADMIN TIME OFF CREATION ====================

/**
 * Admin creates time off for employee (from calendar "+ Time Off" button)
 * @route POST /api/leave/admin/time-off
 */
exports.createTimeOff = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    
    // Check authentication first
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const adminId = req.user.id || req.user._id;

    if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: employeeId, leaveType, startDate, endDate, reason'
      });
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Create pre-approved leave request
    const leaveRequest = new LeaveRequest({
      employeeId,
      approverId: adminId,
      leaveType,
      startDate: start,
      endDate: end,
      numberOfDays, // Explicitly set it
      reason,
      status: 'Approved',
      adminComment: 'Time off added by admin',
      approvedAt: new Date()
    });

    await leaveRequest.save();

    // Create LeaveRecord
    const leaveTypeMap = {
      'Sick': 'sick',
      'Casual': 'annual',
      'Paid': 'annual',
      'Unpaid': 'unpaid',
      'Maternity': 'annual',
      'Paternity': 'annual',
      'Bereavement': 'annual',
      'Other': 'annual'
    };

    await LeaveRecord.create({
      user: employeeId,
      type: leaveTypeMap[leaveType] || 'annual',
      status: 'approved',
      startDate: start,
      endDate: end,
      days: numberOfDays,
      reason,
      approvedBy: adminId,
      approvedAt: new Date(),
      createdBy: adminId
    });

    // Update balance
    if (leaveType !== 'Unpaid') {
      await updateLeaveBalance(employeeId, leaveRequest.numberOfDays);
    }

    // Cancel shifts
    await cancelShiftsForLeave(leaveRequest);

    // Notify employee
    await notifyEmployeeOfApproval(leaveRequest, 'Time off added by admin');

    res.status(201).json({
      success: true,
      message: 'Time off created successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Create time off error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating time off',
      error: error.message
    });
  }
};

// ==================== EMPLOYEE HUB ABSENCE SECTION ====================

/**
 * Add annual leave for employee (from EmployeeHub Absence section)
 * @route POST /api/leave/employee-hub/annual-leave
 */
exports.addAnnualLeave = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaveRequest = new LeaveRequest({
      employeeId,
      approverId: adminId,
      leaveType: 'Paid',
      startDate: start,
      endDate: end,
      numberOfDays, // Explicitly set it
      reason: reason || 'Annual leave added by admin',
      status: 'Approved',
      adminComment: 'Added from EmployeeHub',
      approvedAt: new Date()
    });

    await leaveRequest.save();

    await LeaveRecord.create({
      user: employeeId,
      type: 'annual',
      status: 'approved',
      startDate: start,
      endDate: end,
      days: numberOfDays,
      reason: reason || 'Annual leave',
      approvedBy: adminId,
      approvedAt: new Date(),
      createdBy: adminId
    });

    await updateLeaveBalance(employeeId, numberOfDays);
    await cancelShiftsForLeave(leaveRequest);

    res.status(201).json({
      success: true,
      message: 'Annual leave added successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Add annual leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding annual leave',
      error: error.message
    });
  }
};

/**
 * Add sickness record
 * @route POST /api/leave/employee-hub/sickness
 */
exports.addSickness = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const sickRecord = await LeaveRecord.create({
      user: employeeId,
      type: 'sick',
      status: 'approved',
      startDate: start,
      endDate: end,
      days,
      reason: reason || 'Sickness',
      approvedBy: adminId,
      approvedAt: new Date(),
      createdBy: adminId
    });

    // Cancel shifts
    await ShiftAssignment.updateMany(
      {
        employeeId,
        date: { $gte: start, $lte: end },
        status: { $in: ['Scheduled', 'Pending'] }
      },
      {
        status: 'Cancelled',
        notes: 'Auto-cancelled due to sickness'
      }
    );

    res.status(201).json({
      success: true,
      message: 'Sickness record added successfully',
      data: sickRecord
    });
  } catch (error) {
    console.error('Add sickness error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding sickness record',
      error: error.message
    });
  }
};

/**
 * Add lateness record
 * @route POST /api/leave/employee-hub/lateness
 */
exports.addLateness = async (req, res) => {
  try {
    const { employeeId, date, lateMinutes, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!employeeId || !date || !lateMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Store as a note in TimeEntry or create a separate tracking mechanism
    const timeEntry = await TimeEntry.findOne({
      employee: employeeId,
      date: new Date(date).toISOString().split('T')[0]
    });

    if (timeEntry) {
      timeEntry.notes = `${timeEntry.notes || ''}\nLateness: ${lateMinutes} minutes - ${reason || 'No reason provided'}`.trim();
      await timeEntry.save();
    }

    res.json({
      success: true,
      message: 'Lateness recorded successfully',
      data: { employeeId, date, lateMinutes, reason }
    });
  } catch (error) {
    console.error('Add lateness error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording lateness',
      error: error.message
    });
  }
};

/**
 * Update carry over days
 * @route PATCH /api/leave/employee-hub/carry-over
 */
exports.updateCarryOver = async (req, res) => {
  try {
    const { employeeId, carryOverDays, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!employeeId || carryOverDays === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const balance = await AnnualLeaveBalance.getCurrentBalance(employeeId);
    if (!balance) {
      return res.status(404).json({
        success: false,
        message: 'No leave balance found for current year'
      });
    }

    balance.carryOverDays = carryOverDays;
    if (reason) {
      balance.adjustments.push({
        days: 0,
        reason: `Carry over updated: ${reason}`,
        adjustedBy: adminId,
        at: new Date()
      });
    }
    await balance.save();

    res.json({
      success: true,
      message: 'Carry over days updated successfully',
      data: balance
    });
  } catch (error) {
    console.error('Update carry over error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating carry over',
      error: error.message
    });
  }
};

/**
 * Get recent absences for employee
 * @route GET /api/leave/employee-hub/absences/:employeeId
 */
exports.getRecentAbsences = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { limit = 10 } = req.query;

    const absences = await LeaveRecord.find({
      user: employeeId,
      type: { $in: ['sick', 'absent'] },
      status: 'approved'
    })
      .sort({ startDate: -1 })
      .limit(parseInt(limit))
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      data: absences
    });
  } catch (error) {
    console.error('Get recent absences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching absences',
      error: error.message
    });
  }
};

// ==================== CALENDAR DATA ====================

/**
 * Get approved leaves for calendar display
 * @route GET /api/leave/calendar
 */
exports.getCalendarLeaves = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;

    let query = { status: 'Approved' };

    // If employee, show only their leaves
    if (userRole === 'employee' || employeeId) {
      query.employeeId = employeeId || userId;
    }

    if (startDate && endDate) {
      query.$or = [
        { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { startDate: { $lte: new Date(startDate) }, endDate: { $gte: new Date(endDate) } }
      ];
    }

    const leaves = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email department')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get calendar leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calendar leaves',
      error: error.message
    });
  }
};

/**
 * Detect overlapping leaves for team/department
 * @route GET /api/leave/overlaps
 */
exports.detectLeaveOverlaps = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    let employeeQuery = { isActive: true };
    if (department) employeeQuery.department = department;

    const employees = await EmployeeHub.find(employeeQuery).select('_id firstName lastName department');
    const employeeIds = employees.map(emp => emp._id);

    const leaves = await LeaveRequest.find({
      employeeId: { $in: employeeIds },
      status: 'Approved',
      $or: [
        { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { startDate: { $lte: new Date(startDate) }, endDate: { $gte: new Date(endDate) } }
      ]
    }).populate('employeeId', 'firstName lastName department');

    // Group by date
    const dateMap = {};
    leaves.forEach(leave => {
      let current = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push({
          employee: leave.employeeId,
          leaveType: leave.leaveType
        });
        current.setDate(current.getDate() + 1);
      }
    });

    const overlaps = Object.entries(dateMap)
      .filter(([date, empList]) => empList.length > 1)
      .map(([date, empList]) => ({
        date,
        employeesOnLeave: empList.length,
        employees: empList
      }))
      .sort((a, b) => b.employeesOnLeave - a.employeesOnLeave);

    res.json({
      success: true,
      totalEmployees: employees.length,
      overlappingDates: overlaps.length,
      data: overlaps
    });
  } catch (error) {
    console.error('Detect leave overlaps error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect leave overlaps',
      error: error.message
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

async function notifyAdminsOfNewRequest(leaveRequest) {
  try {
    const employee = await EmployeeHub.findById(leaveRequest.employeeId);
    const User = require('../models/User');

    const admins = await User.find({
      role: { $in: ['admin', 'super-admin'] },
      isActive: true
    }).select('_id');

    const notifications = admins.map(admin => ({
      userId: admin._id,
      type: 'leave_request',
      title: 'New Leave Request',
      message: `${employee.firstName} ${employee.lastName} has submitted a ${leaveRequest.leaveType} leave request from ${leaveRequest.startDate.toLocaleDateString()} to ${leaveRequest.endDate.toLocaleDateString()}`,
      relatedId: leaveRequest._id,
      priority: 'high',
      read: false
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

async function notifyEmployeeOfApproval(leaveRequest, comment) {
  try {
    const employee = await EmployeeHub.findById(leaveRequest.employeeId);

    await Notification.create({
      recipientType: 'employee',
      employeeRef: leaveRequest.employeeId,
      type: 'leave',
      title: 'Leave Request Approved',
      message: `Your ${leaveRequest.leaveType} leave request for ${leaveRequest.numberOfDays} day(s) has been approved${comment ? ': ' + comment : ''}`,
      priority: 'medium',
      metadata: {
        relatedId: leaveRequest._id,
        leaveType: leaveRequest.leaveType,
        status: 'approved'
      }
    });

    // Send email
    try {
      const { sendLeaveApprovalEmail } = require('../utils/emailService');
      await sendLeaveApprovalEmail(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        leaveRequest.leaveType,
        leaveRequest.startDate.toLocaleDateString(),
        leaveRequest.endDate.toLocaleDateString(),
        comment || 'Your leave request has been approved.',
        'approved'
      );
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }
  } catch (error) {
    console.error('Failed to notify employee of approval:', error);
  }
}

async function notifyEmployeeOfRejection(leaveRequest, reason) {
  try {
    const employee = await EmployeeHub.findById(leaveRequest.employeeId);

    await Notification.create({
      recipientType: 'employee',
      employeeRef: leaveRequest.employeeId,
      type: 'leave',
      title: 'Leave Request Rejected',
      message: `Your ${leaveRequest.leaveType} leave request has been rejected: ${reason}`,
      priority: 'high',
      metadata: {
        relatedId: leaveRequest._id,
        leaveType: leaveRequest.leaveType,
        status: 'rejected',
        rejectionReason: reason
      }
    });

    // Send email
    try {
      const { sendLeaveRejectionEmail } = require('../utils/emailService');
      await sendLeaveRejectionEmail(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        leaveRequest.leaveType,
        leaveRequest.startDate.toLocaleDateString(),
        leaveRequest.endDate.toLocaleDateString(),
        reason
      );
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }
  } catch (error) {
    console.error('Failed to notify employee of rejection:', error);
  }
}

async function notifyTeamOfLeave(leaveRequest) {
  try {
    const employee = await EmployeeHub.findById(leaveRequest.employeeId);

    if (employee && employee.department) {
      const teamMembers = await EmployeeHub.find({
        department: employee.department,
        isActive: true,
        _id: { $ne: employee._id }
      }).select('_id');

      const notifications = teamMembers.map(member => ({
        recipientType: 'employee',
        employeeRef: member._id,
        type: 'leave',
        title: 'Team Member on Leave',
        message: `${employee.firstName} ${employee.lastName} will be on ${leaveRequest.leaveType} leave from ${leaveRequest.startDate.toLocaleDateString()} to ${leaveRequest.endDate.toLocaleDateString()}`,
        priority: 'low',
        metadata: {
          relatedEmployeeId: employee._id,
          leaveType: leaveRequest.leaveType
        }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }
  } catch (error) {
    console.error('Failed to notify team:', error);
  }
}

async function cancelShiftsForLeave(leaveRequest) {
  try {
    const result = await ShiftAssignment.updateMany(
      {
        employeeId: leaveRequest.employeeId,
        date: {
          $gte: leaveRequest.startDate,
          $lte: leaveRequest.endDate
        },
        status: { $in: ['Scheduled', 'Pending'] }
      },
      {
        status: 'Cancelled',
        notes: `Auto-cancelled due to approved ${leaveRequest.leaveType} leave`
      }
    );

    console.log(`Cancelled ${result.modifiedCount} shift assignments for leave`);
  } catch (error) {
    console.error('Failed to cancel shifts:', error);
  }
}

async function updateLeaveBalance(employeeId, days) {
  try {
    const balance = await AnnualLeaveBalance.getCurrentBalance(employeeId);
    if (balance) {
      balance.usedDays = (balance.usedDays || 0) + days;
      await balance.save();
    }
  } catch (error) {
    console.error('Failed to update leave balance:', error);
  }
}

module.exports = exports;
