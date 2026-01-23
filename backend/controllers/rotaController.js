const Rota = require('../models/Rota');
const Shift = require('../models/Shift');
const ShiftAssignment = require('../models/ShiftAssignment');
const User = require('../models/User');
const EmployeesHub = require('../models/EmployeesHub');
const TimeEntry = require('../models/TimeEntry');
const mongoose = require('mongoose');
const { getUKStartOfDay, getUKEndOfDay } = require('../utils/timeFormatter');

const nextDay = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const buildGroupedShiftAssignments = (assignments) => {
  const groups = new Map();

  const getLegacyGroupKey = (a) => {
    const createdAt = a.createdAt ? new Date(a.createdAt) : null;
    const createdBucket = createdAt && !Number.isNaN(createdAt.valueOf())
      ? createdAt.toISOString().slice(0, 16)
      : '';

    const assignedById = a.assignedBy && typeof a.assignedBy === 'object'
      ? (a.assignedBy._id || a.assignedBy.id)
      : a.assignedBy;

    return `legacy:${a.shiftName || ''}|${a.startTime || ''}|${a.endTime || ''}|${a.location || ''}|${a.workType || ''}|${(assignedById || '').toString()}|${createdBucket}`;
  };

  for (const a of assignments) {
    const key = a.groupId ? `group:${a.groupId}` : getLegacyGroupKey(a);

    if (!groups.has(key)) {
      const derivedStart = a.startDate || a.date;
      const derivedEnd = a.endDate || a.date;
      groups.set(key, {
        _id: a.groupId || a._id,
        groupId: a.groupId || null,
        shiftName: a.shiftName || '',
        startDate: derivedStart,
        endDate: derivedEnd,
        startTime: a.startTime,
        endTime: a.endTime,
        location: a.location,
        workType: a.workType,
        assignedBy: a.assignedBy, // Include who assigned the shift
        assignedEmployees: [],
        assignmentIds: []
      });
    }

    const g = groups.get(key);
    g.assignmentIds.push(a._id);

    const employeeId = a.employeeId && typeof a.employeeId === 'object'
      ? (a.employeeId._id || a.employeeId.id)
      : a.employeeId;

    if (employeeId) {
      const exists = g.assignedEmployees.some(e => (e.employeeId || '').toString() === employeeId.toString());
      if (!exists) {
        const employeeName = a.employeeId && typeof a.employeeId === 'object' && a.employeeId.firstName
          ? `${a.employeeId.firstName} ${a.employeeId.lastName}`
          : '';
        const email = a.employeeId && typeof a.employeeId === 'object'
          ? (a.employeeId.email || '')
          : '';

        g.assignedEmployees.push({
          employeeId,
          employeeName,
          email,
          startTime: a.startTime,
          endTime: a.endTime
        });
      }
    }

    // Expand derived date range based on actual per-day rows
    const d = a.date;
    if (d) {
      const ds = new Date(d);
      if (!g.startDate || ds < new Date(g.startDate)) g.startDate = ds;
      if (!g.endDate || ds > new Date(g.endDate)) g.endDate = ds;
    }
  }

  return Array.from(groups.values()).sort((x, y) => new Date(x.startDate) - new Date(y.startDate));
};

exports.getGroupedShiftAssignments = async (req, res) => {
  try {
    const { tab = 'all', startDate, endDate, employeeId, location, workType, status } = req.query;

    const query = {};
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (workType) query.workType = workType;
    if (status) query.status = status;

    const todayStartUK = getUKStartOfDay(new Date());
    const todayEndUK = getUKEndOfDay(new Date());

    if (tab === 'active') {
      query.date = { $gte: todayStartUK, $lte: todayEndUK };
    } else if (tab === 'old') {
      const dateQuery = { $lt: todayStartUK };
      const rangeStart = startDate ? getUKStartOfDay(new Date(startDate)) : null;
      const rangeEnd = endDate ? getUKEndOfDay(new Date(endDate)) : null;

      if (rangeStart && !Number.isNaN(rangeStart.valueOf())) {
        dateQuery.$gte = rangeStart;
      }
      if (rangeEnd && !Number.isNaN(rangeEnd.valueOf())) {
        const maxEnd = rangeEnd < todayStartUK ? rangeEnd : new Date(todayStartUK.getTime() - 1);
        dateQuery.$lte = maxEnd;
      }

      query.date = dateQuery;
    } else {
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
          query.date = { $gte: start, $lte: end };
        }
      }
    }

    const assignments = await ShiftAssignment.find(query)
      .populate({
        path: 'employeeId',
        select: '_id firstName lastName email role',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedBy',
        select: '_id firstName lastName',
        options: { strictPopulate: false }
      })
      .sort({ date: 1, startTime: 1 })
      .lean();

    const grouped = buildGroupedShiftAssignments(assignments);

    res.status(200).json({
      success: true,
      count: grouped.length,
      data: grouped
    });
  } catch (error) {
    console.error('Get grouped shift assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grouped shift assignments',
      error: error.message
    });
  }
};

exports.deleteShiftAssignmentGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'groupId is required'
      });
    }

    const result = await ShiftAssignment.deleteMany({ groupId });
    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: 'Shift group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shift group deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete shift group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete shift group',
      error: error.message
    });
  }
};

const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
};

exports.detectShiftConflicts = async (employeeId, startTime, endTime, date, excludeShiftId = null) => {
  try {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const query = {
      employeeId,
      date: { $gte: dateStart, $lte: dateEnd },
      status: { $nin: ['Cancelled', 'Swapped'] }
    };

    if (excludeShiftId) {
      query._id = { $ne: excludeShiftId };
    }

    const existingShifts = await ShiftAssignment.find(query);

    const conflicts = existingShifts.filter(shift => {
      const shiftStart = shift.startTime;
      const shiftEnd = shift.endTime;
      return (
        (startTime >= shiftStart && startTime < shiftEnd) ||
        (endTime > shiftStart && endTime <= shiftEnd) ||
        (startTime <= shiftStart && endTime >= shiftEnd)
      );
    });

    return conflicts;
  } catch (error) {
    console.error('Detect conflicts error:', error);
    throw error;
  }
};

exports.getAllRotas = async (req, res) => {
  try {
    const { employeeId, location, workType, status } = req.query;

    const query = {};
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (workType) query.workType = workType;
    if (status) query.status = status;

    const shifts = await ShiftAssignment.find(query)
      .populate({
        path: 'employeeId',
        select: '_id firstName lastName email role',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedBy',
        select: '_id firstName lastName',
        options: { strictPopulate: false }
      })
      .sort({ date: -1, startTime: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('Get all rotas error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all rotas',
      error: error.message
    });
  }
};

exports.getActiveRotas = async (req, res) => {
  try {
    // Get TODAY's date boundaries in UK timezone
    const todayStartUK = getUKStartOfDay(new Date());
    const todayEndUK = getUKEndOfDay(new Date());

    const { employeeId, location, workType, status } = req.query;

    // Active rotas = shifts occurring TODAY only
    const dateQuery = { 
      $gte: todayStartUK,
      $lte: todayEndUK
    };

    const query = { date: dateQuery };
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (workType) query.workType = workType;
    if (status) query.status = status;

    const shifts = await ShiftAssignment.find(query)
      .populate({
        path: 'employeeId',
        select: '_id firstName lastName email role',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedBy',
        select: '_id firstName lastName',
        options: { strictPopulate: false }
      })
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('Get active rotas error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active rotas',
      error: error.message
    });
  }
};

exports.getOldRotas = async (req, res) => {
  try {
    const todayStartUK = getUKStartOfDay(new Date());

    const { startDate, endDate, employeeId, location, workType, status } = req.query;
    
    const rangeStart = startDate ? getUKStartOfDay(new Date(startDate)) : null;
    const rangeEnd = endDate ? getUKEndOfDay(new Date(endDate)) : null;

    const dateQuery = { $lt: todayStartUK };
    if (rangeStart && !Number.isNaN(rangeStart.valueOf())) {
      dateQuery.$gte = rangeStart;
    }
    if (rangeEnd && !Number.isNaN(rangeEnd.valueOf())) {
      const maxEnd = rangeEnd < todayStartUK ? rangeEnd : new Date(todayStartUK.getTime() - 1);
      dateQuery.$lte = maxEnd;
    }

    const query = { date: dateQuery };
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (workType) query.workType = workType;
    if (status) query.status = status;

    const shifts = await ShiftAssignment.find(query)
      .populate({
        path: 'employeeId',
        select: '_id firstName lastName email role',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedBy',
        select: '_id firstName lastName',
        options: { strictPopulate: false }
      })
      .sort({ date: -1, startTime: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('Get old rotas error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch old rotas',
      error: error.message
    });
  }
};

exports.assignShiftToEmployee = async (req, res) => {
  try {
    console.log('=== Assign Shift Request ===');
    console.log('User from session:', req.user);
    console.log('Session ID:', req.session?.id);
    
    const { employeeId, shiftName, date, startTime, endTime, location, workType, breakDuration, notes, groupId, startDate, endDate } = req.body;

    if (!employeeId || !date || !startTime || !endTime || !location || !workType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: employeeId, date, startTime, endTime, location, workType'
      });
    }

    const assignedByUserId = req.user?._id || req.user?.userId || req.user?.id;
    
    if (!req.user || !assignedByUserId) {
      console.error('Authentication failed - req.user:', req.user);
      console.error('Available user fields:', Object.keys(req.user || {}));
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User not found in session.',
        debug: {
          hasUser: !!req.user,
          hasSession: !!req.session,
          sessionUser: req.session?.user,
          userKeys: Object.keys(req.user || {})
        }
      });
    }

    // Check if employee exists in EmployeesHub collection
    console.log('Looking up employee with ID:', employeeId);
    const employee = await EmployeesHub.findById(employeeId);
    
    if (!employee) {
      console.error('Employee not found in EmployeesHub:', employeeId);
      return res.status(404).json({
        success: false,
        message: 'Employee is inactive or not found',
        debug: {
          searchedId: employeeId,
          checkedEmployeesHub: true
        }
      });
    }

    // Validate employee status
    if (employee.status !== 'Active' || employee.isActive !== true || employee.deleted === true) {
      console.error('Employee is inactive or deleted:', {
        employeeId,
        status: employee.status,
        isActive: employee.isActive,
        deleted: employee.deleted
      });
      return res.status(400).json({
        success: false,
        message: 'Employee is inactive or not found',
        debug: {
          employeeId,
          status: employee.status,
          isActive: employee.isActive,
          deleted: employee.deleted
        }
      });
    }

    console.log('✅ Employee validated:', {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      status: employee.status,
      isActive: employee.isActive
    });

    // Use the EmployeesHub _id for shift assignment
    const actualEmployeeId = employee._id;
    console.log('Using employee ID for shift assignment:', actualEmployeeId);

    const conflicts = await exports.detectShiftConflicts(actualEmployeeId, startTime, endTime, date);
    if (conflicts.length > 0) {
      console.log('⚠️ Shift conflicts detected:', conflicts.length);
      conflicts.forEach((c, i) => {
        console.log(`Conflict ${i + 1}:`, {
          id: c._id,
          date: c.date,
          time: `${c.startTime} - ${c.endTime}`,
          location: c.location,
          status: c.status
        });
      });
      
      return res.status(400).json({
        success: false,
        message: `Shift conflict detected. Employee already has ${conflicts.length} shift(s) on ${new Date(date).toLocaleDateString()} that overlap with ${startTime} - ${endTime}.`,
        conflicts: conflicts.map(c => ({
          id: c._id,
          date: c.date,
          startTime: c.startTime,
          endTime: c.endTime,
          location: c.location,
          status: c.status
        }))
      });
    }

    const shiftAssignment = new ShiftAssignment({
      employeeId: actualEmployeeId,
      groupId: groupId || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      shiftName: shiftName || '',
      date: new Date(date),
      startTime,
      endTime,
      location,
      workType,
      breakDuration: breakDuration || 0,
      assignedBy: assignedByUserId,
      notes: notes || '',
      status: 'Scheduled'
    });

    await shiftAssignment.save();
    console.log('✅ Shift saved with employeeId:', shiftAssignment.employeeId);

    // Populate with EmployeesHub data instead of User data
    const populatedShift = await ShiftAssignment.findById(shiftAssignment._id)
      .populate('employeeId', 'firstName lastName email role')
      .populate('assignedBy', 'firstName lastName role');
    
    console.log('📤 Populated shift data:', {
      shiftId: populatedShift._id,
      employeeId: populatedShift.employeeId,
      employeeIdType: typeof populatedShift.employeeId,
      hasFirstName: populatedShift.employeeId?.firstName,
      employeeName: populatedShift.employeeId?.firstName ? `${populatedShift.employeeId.firstName} ${populatedShift.employeeId.lastName}` : 'NOT POPULATED'
    });

    // Create notification for shift assignment
    try {
      const Notification = require('../models/Notification');
      const assignedByName = populatedShift.assignedBy 
        ? `${populatedShift.assignedBy.firstName} ${populatedShift.assignedBy.lastName}`
        : 'Admin';
      
      // Determine recipient type and reference
      const notificationData = {
        recipientType: 'employee',
        employeeRef: actualEmployeeId,
        type: 'shift_assigned',
        title: 'Shift Assigned',
        message: `New shift assigned by ${assignedByName} on ${new Date(date).toLocaleDateString()} from ${startTime} to ${endTime} at ${location}`,
        priority: 'medium',
        metadata: {
          shiftId: shiftAssignment._id,
          date: date,
          startTime: startTime,
          endTime: endTime,
          location: location,
          assignedBy: assignedByName,
          assignedAt: new Date().toISOString()
        }
      };
      
      await Notification.create(notificationData);
      console.log('Shift assignment notification created for employee:', actualEmployeeId);
    } catch (notifError) {
      console.error('Failed to create shift assignment notification:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Shift assigned successfully',
      data: populatedShift
    });

  } catch (error) {
    console.error('======= Assign Shift Error =======');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('User info:', req.user);
    console.error('===================================');
    
    res.status(500).json({
      success: false,
      message: 'Failed to assign shift',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.assignShiftToTeam = async (req, res) => {
  try {
    console.log('=== Assign Shift to Team Request ===');
    const { teamId, shiftName, date, startTime, endTime, location, workType, breakDuration, notes } = req.body;

    if (!teamId || !date || !startTime || !endTime || !location || !workType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: teamId, date, startTime, endTime, location, workType'
      });
    }

    const assignedByUserId = req.user?._id || req.user?.userId || req.user?.id;
    
    if (!req.user || !assignedByUserId) {
      console.error('Authentication failed - req.user:', req.user);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User not found in session.'
      });
    }

    // Fetch team with filtered active members
    const Team = require('../models/Team');
    const team = await Team.findById(teamId)
      .populate({
        path: 'members',
        select: 'firstName lastName email status isActive deleted',
        match: { 
          status: 'Active', 
          isActive: true, 
          deleted: { $ne: true } 
        }
      });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Auto-clean invalid member IDs (null, undefined, or non-existent)
    const validMembers = team.members.filter(member => member != null);
    if (validMembers.length !== team.members.length) {
      console.log(`🧹 Cleaning ${team.members.length - validMembers.length} invalid member IDs from team ${team._id}`);
      await Team.updateOne(
        { _id: team._id },
        { $pull: { members: null } }
      );
      team.members = validMembers;
    }

    if (team.members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active members found in this team'
      });
    }

    console.log(`👥 Assigning shift to ${team.members.length} active members in team: ${team.name}`);

    const results = {
      successful: [],
      failed: []
    };

    // Assign shift to each active team member
    for (const member of team.members) {
      try {
        const employeeId = member._id;
        
        // Check for conflicts
        const conflicts = await exports.detectShiftConflicts(employeeId, startTime, endTime, date);
        if (conflicts.length > 0) {
          results.failed.push({
            employee: member,
            reason: 'Shift conflict detected'
          });
          continue;
        }

        // Create shift assignment
        const shiftAssignment = new ShiftAssignment({
          employeeId,
          shiftName: shiftName || '',
          date: new Date(date),
          startTime,
          endTime,
          location,
          workType,
          breakDuration: breakDuration || 0,
          assignedBy: assignedByUserId,
          notes: notes || '',
          status: 'Scheduled'
        });

        await shiftAssignment.save();
        results.successful.push({
          employee: member,
          shiftId: shiftAssignment._id
        });

        console.log(`✅ Shift assigned to ${member.firstName} ${member.lastName}`);

      } catch (error) {
        console.error(`❌ Failed to assign shift to ${member.firstName} ${member.lastName}:`, error);
        results.failed.push({
          employee: member,
          reason: error.message
        });
      }
    }

    console.log(`📊 Team shift assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`);

    res.status(201).json({
      success: true,
      message: `Shift assignment to team completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });

  } catch (error) {
    console.error('Assign shift to team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign shift to team',
      error: error.message
    });
  }
};

exports.requestShiftSwap = async (req, res) => {
  try {
    const { shiftId, swapWithEmployeeId, reason } = req.body;

    if (!shiftId || !swapWithEmployeeId) {
      return res.status(400).json({
        success: false,
        message: 'Shift ID and swap target employee ID are required'
      });
    }

    const shift = await ShiftAssignment.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (shift.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only request swap for your own shifts'
      });
    }

    if (shift.swapRequest.status === 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'A swap request is already pending for this shift'
      });
    }

    // Check if target employee exists in EmployeesHub (excludes profile users)
    const targetEmployee = await EmployeesHub.findById(swapWithEmployeeId);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Target employee not found or is not eligible for shift swaps'
      });
    }

    shift.swapRequest = {
      requestedBy: req.user._id,
      requestedWith: swapWithEmployeeId,
      status: 'Pending',
      reason: reason || '',
      requestedAt: new Date()
    };

    await shift.save();

    const populatedShift = await ShiftAssignment.findById(shift._id)
      .populate('employeeId', 'firstName lastName email role')
      .populate('swapRequest.requestedWith', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      message: 'Shift swap request submitted',
      data: populatedShift
    });

  } catch (error) {
    console.error('Request shift swap error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request shift swap',
      error: error.message
    });
  }
};

exports.approveShiftSwap = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be Approved or Rejected'
      });
    }

    const shift = await ShiftAssignment.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (shift.swapRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending swap request for this shift'
      });
    }

    if (status === 'Approved') {
      const originalEmployeeId = shift.employeeId;
      const swapEmployeeId = shift.swapRequest.requestedWith;

      shift.employeeId = swapEmployeeId;
      shift.status = 'Swapped';
      shift.swapRequest.status = 'Approved';
      shift.swapRequest.reviewedBy = req.user._id;
      shift.swapRequest.reviewedAt = new Date();
    } else {
      shift.swapRequest.status = 'Rejected';
      shift.swapRequest.reviewedBy = req.user._id;
      shift.swapRequest.reviewedAt = new Date();
    }

    await shift.save();

    const populatedShift = await ShiftAssignment.findById(shift._id)
      .populate('employeeId', 'firstName lastName email role')
      .populate('swapRequest.requestedBy', 'firstName lastName role')
      .populate('swapRequest.requestedWith', 'firstName lastName role')
      .populate('swapRequest.reviewedBy', 'firstName lastName role');

    res.status(200).json({
      success: true,
      message: `Shift swap ${status.toLowerCase()}`,
      data: populatedShift
    });

  } catch (error) {
    console.error('Approve shift swap error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process shift swap',
      error: error.message
    });
  }
};

exports.getShiftsByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { startDate, endDate } = req.query;

    const query = { location };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const shifts = await ShiftAssignment.find(query)
      .populate('employeeId', 'firstName lastName email role')
      .populate('assignedBy', 'firstName lastName role')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });

  } catch (error) {
    console.error('Get shifts by location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shifts by location',
      error: error.message
    });
  }
};

exports.getShiftStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const shifts = await ShiftAssignment.find(query);

    const stats = {
      totalShifts: shifts.length,
      byLocation: {
        Office: shifts.filter(s => s.location === 'Office').length,
        Home: shifts.filter(s => s.location === 'Home').length,
        Field: shifts.filter(s => s.location === 'Field').length,
        'Client Site': shifts.filter(s => s.location === 'Client Site').length
      },
      byWorkType: {
        Regular: shifts.filter(s => s.workType === 'Regular').length,
        Overtime: shifts.filter(s => s.workType === 'Overtime').length,
        'Weekend overtime': shifts.filter(s => s.workType === 'Weekend overtime').length,
        'Client side overtime': shifts.filter(s => s.workType === 'Client side overtime').length
      },
      byStatus: {
        Scheduled: shifts.filter(s => s.status === 'Scheduled').length,
        Completed: shifts.filter(s => s.status === 'Completed').length,
        Missed: shifts.filter(s => s.status === 'Missed').length,
        Swapped: shifts.filter(s => s.status === 'Swapped').length,
        Cancelled: shifts.filter(s => s.status === 'Cancelled').length
      },
      totalHours: shifts.reduce((acc, shift) => {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        return acc + hours - (shift.breakDuration / 60);
      }, 0).toFixed(2),
      uniqueEmployees: new Set(shifts.map(s => s.employeeId.toString())).size
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get shift statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shift statistics',
      error: error.message
    });
  }
};

exports.getAllShiftAssignments = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, location, workType, status } = req.query;

    const query = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Validate dates before querying
      if (!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
        query.date = {
          $gte: start,
          $lte: end
        };
      } else {
        console.error('Invalid date range:', { startDate, endDate });
      }
    }

    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (workType) query.workType = workType;
    if (status) query.status = status;

    let shifts = await ShiftAssignment.find(query)
      .populate({
        path: 'employeeId',
        select: '_id firstName lastName email role', // Include _id explicitly
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedBy',
        select: '_id firstName lastName', // Include _id explicitly
        options: { strictPopulate: false }
      })
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Handle cases where populate failed (employeeId is still an ObjectId)
    for (let shift of shifts) {
      if (shift.employeeId && typeof shift.employeeId === 'object') {
        // Check if it's a populated employee object (has firstName) or just an ObjectId
        if (!shift.employeeId.firstName) {
          // Populate failed or incomplete, try to find the employee manually from EmployeesHub
          console.log(`⚠️ Populate failed for shift ${shift._id}, manually looking up employeeId:`, shift.employeeId);
          const employee = await EmployeesHub.findById(shift.employeeId).select('_id firstName lastName email').lean();
          if (employee) {
            console.log(`✅ Found employee:`, employee.firstName, employee.lastName, `(_id: ${employee._id})`);
            shift.employeeId = employee;
          } else {
            // Employee not found, set to null to indicate missing reference
            console.warn(`❌ Employee not found for shift ${shift._id}, employeeId: ${shift.employeeId}`);
            shift.employeeId = null;
          }
        } else {
          // Successfully populated
          console.log(`✅ Shift ${shift._id} has populated employeeId:`, shift.employeeId.firstName, shift.employeeId.lastName, `(_id: ${shift.employeeId._id})`);
        }
      } else if (!shift.employeeId) {
        console.warn(`⚠️ Shift ${shift._id} has no employeeId`);
      }
      
      // For assignedBy, check both User and EmployeesHub (admins can be in either collection)
      if (shift.assignedBy && typeof shift.assignedBy === 'object' && !shift.assignedBy.firstName) {
        let assignedByUser = await EmployeesHub.findById(shift.assignedBy).select('firstName lastName').lean();
        if (!assignedByUser) {
          // If not in EmployeesHub, check User collection (for admin/super-admin)
          assignedByUser = await User.findById(shift.assignedBy).select('firstName lastName').lean();
        }
        if (assignedByUser) {
          shift.assignedBy = assignedByUser;
        } else {
          shift.assignedBy = null;
        }
      }
    }

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });

  } catch (error) {
    console.error('Get all shift assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shift assignments',
      error: error.message
    });
  }
};

exports.getEmployeeShifts = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { employeeId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const shifts = await ShiftAssignment.find(query)
      .populate('assignedBy', 'firstName lastName')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });

  } catch (error) {
    console.error('Get employee shifts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee shifts',
      error: error.message
    });
  }
};

exports.updateShiftAssignment = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { shiftName, date, startTime, endTime, location, workType, breakDuration, status, notes } = req.body;

    const shift = await ShiftAssignment.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    if (startTime && endTime && date) {
      const conflicts = await exports.detectShiftConflicts(
        shift.employeeId,
        startTime,
        endTime,
        date,
        shiftId
      );
      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Shift conflict detected',
          conflicts
        });
      }
    }

    if (date) shift.date = new Date(date);
    if (shiftName !== undefined) shift.shiftName = shiftName || '';
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (location) shift.location = location;
    if (workType) shift.workType = workType;
    if (breakDuration !== undefined) shift.breakDuration = breakDuration;
    if (status) shift.status = status;
    if (notes !== undefined) shift.notes = notes;

    await shift.save();

    const populatedShift = await ShiftAssignment.findById(shift._id)
      .populate('employeeId', 'firstName lastName email role')
      .populate('assignedBy', 'firstName lastName role');

    res.status(200).json({
      success: true,
      message: 'Shift updated successfully',
      data: populatedShift
    });

  } catch (error) {
    console.error('Update shift assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shift',
      error: error.message
    });
  }
};

exports.deleteShiftAssignment = async (req, res) => {
  try {
    const { shiftId } = req.params;

    const shift = await ShiftAssignment.findByIdAndDelete(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shift deleted successfully'
    });

  } catch (error) {
    console.error('Delete shift assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete shift',
      error: error.message
    });
  }
};

exports.generateRota = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Fetch only actual employees from EmployeesHub (excludes profile users)
    const employees = await EmployeesHub.find({ 
      isActive: true, 
      status: 'Active',
      deleted: { $ne: true }
    });
    const shifts = await Shift.find().sort({ name: 1 });

    if (employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active employees found'
      });
    }

    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No shifts found. Please create shifts first.'
      });
    }

    await Rota.deleteMany({
      date: { $gte: start, $lte: end }
    });

    let shiftIndex = 0;
    const rotaEntries = [];

    for (let date = new Date(start); date <= end; date = nextDay(date)) {
      if (isWeekend(date)) continue;

      for (const emp of employees) {
        const shift = shifts[shiftIndex % shifts.length];
        
        rotaEntries.push({
          employee: emp._id,
          shift: shift._id,
          date: new Date(date),
          status: 'Assigned'
        });

        shiftIndex++;
      }
    }

    await Rota.insertMany(rotaEntries);

    res.status(201).json({
      success: true,
      message: `Rota generated successfully for ${rotaEntries.length} assignments`,
      count: rotaEntries.length
    });

  } catch (error) {
    console.error('Generate Rota Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate rota',
      error: error.message
    });
  }
};

exports.getEmployeeRota = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    const query = { employee: employeeId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const rotas = await Rota.find(query)
      .populate('shift', 'name startTime endTime color')
      .populate('employee', 'firstName lastName email')
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: rotas.length,
      data: rotas
    });

  } catch (error) {
    console.error('Get Employee Rota Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee rota',
      error: error.message
    });
  }
};

exports.getAllRota = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const rotas = await Rota.find(query)
      .populate('employee', 'firstName lastName email')
      .populate('shift', 'name startTime endTime color')
      .sort({ date: 1, employee: 1 });

    res.status(200).json({
      success: true,
      count: rotas.length,
      data: rotas
    });

  } catch (error) {
    console.error('Get All Rota Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rota',
      error: error.message
    });
  }
};

exports.updateRota = async (req, res) => {
  try {
    const { rotaId } = req.params;
    const { shift, status, notes } = req.body;

    const updateData = {};
    if (shift) updateData.shift = shift;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const rota = await Rota.findByIdAndUpdate(
      rotaId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('employee', 'firstName lastName email')
      .populate('shift', 'name startTime endTime color');

    if (!rota) {
      return res.status(404).json({
        success: false,
        message: 'Rota entry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Rota updated successfully',
      data: rota
    });

  } catch (error) {
    console.error('Update Rota Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rota',
      error: error.message
    });
  }
};

exports.deleteRota = async (req, res) => {
  try {
    const { rotaId } = req.params;

    const rota = await Rota.findByIdAndDelete(rotaId);

    if (!rota) {
      return res.status(404).json({
        success: false,
        message: 'Rota entry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Rota entry deleted successfully'
    });

  } catch (error) {
    console.error('Delete Rota Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rota',
      error: error.message
    });
  }
};

exports.initializeShifts = async (req, res) => {
  try {
    const existingShifts = await Shift.countDocuments();

    if (existingShifts > 0) {
      return res.status(200).json({
        success: true,
        message: 'Shifts already initialized',
        count: existingShifts
      });
    }

    const defaultShifts = [
      { name: 'Morning', startTime: '09:00', endTime: '17:00', color: '#3b82f6' },
      { name: 'Evening', startTime: '17:00', endTime: '01:00', color: '#f59e0b' },
      { name: 'Night', startTime: '01:00', endTime: '09:00', color: '#8b5cf6' }
    ];

    await Shift.insertMany(defaultShifts);

    res.status(201).json({
      success: true,
      message: 'Default shifts created successfully',
      count: defaultShifts.length
    });

  } catch (error) {
    console.error('Initialize Shifts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize shifts',
      error: error.message
    });
  }
};
