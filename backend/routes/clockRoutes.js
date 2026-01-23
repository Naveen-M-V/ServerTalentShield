const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const TimeEntry = require('../models/TimeEntry');
const User = require('../models/User');
const EmployeesHub = require('../models/EmployeesHub');
const LeaveRecord = require('../models/LeaveRecord');
const AnnualLeaveBalance = require('../models/AnnualLeaveBalance');
const Expense = require('../models/Expense');
const LeaveRequest = require('../models/LeaveRequest');
const {
  findMatchingShift,
  validateClockIn,
  calculateHoursWorked,
  calculateScheduledHours,
  updateShiftStatus
} = require('../utils/shiftTimeLinker');
const crypto = require('crypto');
const employeeService = require('../services/employeeService');

// Import asyncHandler and authentication middleware from server.js
const { asyncHandler, authenticateSession } = require('../server');

/**
 * Clock Routes
 * Handles time tracking and attendance functionality
 * Integrated with leave management system
 */

/**
 * Reverse Geocoding Helper Function
 * Converts GPS coordinates to human-readable address using OpenStreetMap Nominatim API
 * @param {Number} latitude - GPS latitude
 * @param {Number} longitude - GPS longitude
 * @returns {Promise<String>} - Formatted address or null if failed
 */
async function reverseGeocode(latitude, longitude) {
  try {
    const https = require('https');
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'HRMS-App/1.0' // Required by OpenStreetMap
        }
      }, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result && result.display_name) {
              resolve(result.display_name);
            } else {
              resolve(null);
            }
          } catch (e) {
            console.error('Error parsing geocoding response:', e);
            resolve(null);
          }
        });
      }).on('error', (err) => {
        console.error('Reverse geocoding error:', err);
        resolve(null);
      });
    });
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
}

// @route   POST /api/clock/in
// @desc    Clock in an employee with multi-session support
// @access  Private (Admin)
router.post('/in', asyncHandler(async (req, res) => {
  const { employeeId, location, workType, latitude, longitude, accuracy } = req.body;

  console.log('Clock In Request:', { employeeId, location, workType, latitude, longitude, accuracy });

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID is required'
    });
  }

  // Validate employee exists and is active
  const employee = await EmployeesHub.findById(employeeId);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  if (employee.status !== 'Active' || employee.isActive === false || employee.deleted === true) {
    return res.status(400).json({
      success: false,
      message: 'Employee is not active or has been terminated'
    });
  }

  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Check for existing entry with active status
  const existingEntry = await TimeEntry.findOne({
    employee: employeeId,
    date: today,
    status: { $in: ['clocked_in', 'on_break'] }
  });

  if (existingEntry) {
    return res.status(400).json({
      success: false,
      message: `Employee is currently ${existingEntry.status.replace('_', ' ')}. Please clock out first.`
    });
  }

  // Create new time entry using legacy fields
  // Store as UTC Date object - MongoDB will handle timezone conversion
  const clockInTime = new Date();
  const entry = new TimeEntry({
    employee: employeeId,
    date: today,
    status: 'clocked_in',
    clockIn: clockInTime,
    location: location || 'Office',
    workType: workType || 'Regular',
    createdBy: req.user?._id || req.user?.userId || req.user?.id
  });

  // Add GPS location if provided
  if (latitude && longitude) {
    entry.gpsLocationIn = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      timestamp: new Date()
    };
  }

  // Check for scheduled shift and detect lateness
  const ShiftAssignment = require('../models/ShiftAssignment');
  const todayStart = new Date(today + 'T00:00:00Z');
  const todayEnd = new Date(today + 'T23:59:59Z');

  try {
    const shift = await ShiftAssignment.findOne({
      employeeId: employeeId,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    if (shift && shift.startTime) {
      const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
      const shiftStartTime = new Date(clockInTime);
      shiftStartTime.setHours(shiftHour, shiftMin, 0, 0);

      const minutesLate = (clockInTime - shiftStartTime) / (1000 * 60);
      const gracePeriod = 5;

      if (minutesLate > gracePeriod) {
        // Create lateness record
        const LatenessRecord = require('../models/LatenessRecord');
        try {
          await LatenessRecord.create({
            employee: employeeId,
            date: clockInTime,
            scheduledStart: shiftStartTime,
            actualStart: clockInTime,
            minutesLate: Math.round(minutesLate),
            shift: shift._id,
            excused: false
          });
          console.log(`⏰ Admin clock-in: Lateness record created for ${employee.firstName}: ${Math.round(minutesLate)} minutes late`);
        } catch (lateErr) {
          console.error('Failed to create lateness record:', lateErr);
        }
      }
    }
  } catch (shiftErr) {
    console.warn('Shift lookup failed (non-blocking):', shiftErr.message);
  }

  await entry.save();
  console.log('✅ Clock in saved successfully for employee:', employeeId);

  // Create notification
  try {
    const Notification = require('../models/Notification');
    const adminUserId = req.user?._id || req.user?.userId || req.user?.id;
    const adminUser = await User.findById(adminUserId);
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    await Notification.create({
      userId: employeeId,
      type: 'system',
      title: 'Clocked In by Admin',
      message: `${adminName} clocked you in at ${new Date().toLocaleTimeString()}`,
      priority: 'medium'
    });
  } catch (notifError) {
    console.error('Failed to create notification:', notifError);
    // Don't fail the clock-in if notification fails
  }

  res.json({
    success: true,
    message: 'Employee clocked in successfully',
    entry: entry
  });
}));

// @route   POST /api/clock/out
// @desc    Clock out an employee with proper validation
// @access  Private (Admin)
router.post('/out', asyncHandler(async (req, res) => {
  const { employeeId, latitude, longitude, accuracy } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID is required'
    });
  }

  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const entry = await TimeEntry.findOne({
    employee: employeeId,
    date: today
  });

  // VALIDATION CHECKS
  if (!entry) {
    return res.status(400).json({
      success: false,
      message: "No TimeEntry found for today"
    });
  }

  if (!entry.clockIn) {
    return res.status(400).json({
      success: false,
      message: "Employee not clocked in"
    });
  }

  if (entry.clockOut) {
    return res.status(400).json({
      success: false,
      message: "Already clocked out"
    });
  }

  // Set clock out time - store as UTC Date object
  const now = new Date();
  entry.clockOut = now;
  entry.status = 'clocked_out';

  // Clear break status if on break
  if (entry.onBreakStart) {
    entry.onBreakStart = null;
  }

  // Update GPS location if provided
  if (latitude && longitude) {
    entry.gpsLocationOut = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      timestamp: now
    };
  }

  // 🟩 SAFE SAVE OPERATION - Prevent server crashes
  await entry.save();
  console.log('✅ Clock out saved successfully for employee:', employeeId);

  // Create notification
  try {
    const Notification = require('../models/Notification');
    const adminUserId = req.user?._id || req.user?.userId || req.user?.id;
    const User = require('../models/User');
    const adminUser = adminUserId ? await User.findById(adminUserId) : null;
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    await Notification.create({
      userId: employeeId,
      type: 'system',
      title: 'Clocked Out by Admin',
      message: `${adminName} clocked you out at ${now.toLocaleTimeString()}`,
      priority: 'medium'
    });
  } catch (notifError) {
    console.error('⚠️ Failed to create notification:', notifError);
    // Don't fail the clock out if notification fails
  }

  return res.json({
    success: true,
    message: 'Employee clocked out successfully',
    entry: entry
  });
}));

// @route   GET /api/clock/dashboard
// @desc    Get dashboard statistics (includes admins by default)
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Format today's date as YYYY-MM-DD string for TimeEntry query
    const todayString = today.toISOString().slice(0, 10);

    // Get EmployeeHub model to count total active employees with userType='employee'
    const ShiftAssignment = require('../models/ShiftAssignment');

    // Get only ACTIVE employees with valid user accounts (userType='employee')
    const employees = await EmployeesHub.find({
      userId: { $exists: true, $ne: null }
    })
      .populate({
        path: 'userId',
        match: { userType: 'employee', isActive: { $ne: false }, deleted: { $ne: true } }
      })
      .lean();

    // Filter out employees without valid userId
    const validEmployees = employees.filter(emp =>
      emp.userId &&
      emp.userId._id &&
      emp.userId.userType === 'employee'
    );

    // Also include admin users for clock-in tracking
    const employeeUserIds = validEmployees.map(e => e.userId._id.toString()).filter(Boolean);
    const adminUsers = await User.find({
      role: 'admin',
      _id: { $nin: employeeUserIds },
      isActive: { $ne: false },
      deleted: { $ne: true }
    }).select('_id').lean();

    const totalEmployees = validEmployees.length + adminUsers.length;
    const allUserIds = [
      ...validEmployees.map(e => e.userId._id),
      ...adminUsers.map(a => a._id)
    ];

    // Get today's time entries for ALL users (employees + admins)
    // Note: date field in TimeEntry is stored as YYYY-MM-DD string
    const timeEntries = await TimeEntry.find({
      date: todayString,
      employee: { $in: allUserIds }
    }).sort({ createdAt: -1 }); // Sort by most recent first

    // Get today's shift assignments
    const shiftAssignments = await ShiftAssignment.find({
      date: { $gte: today, $lt: tomorrow },
      employeeId: { $in: allUserIds }
    }).lean();

    // Create a map of shift assignments by employee ID
    const shiftMap = new Map();
    shiftAssignments.forEach(shift => {
      shiftMap.set(shift.employeeId.toString(), shift);
    });

    // Count only CURRENT status - each user counted once based on latest entry
    const employeeStatusMap = new Map();

    timeEntries.forEach(entry => {
      const empId = entry.employee.toString();
      // Only set if not already set (since we sorted by most recent first)
      if (!employeeStatusMap.has(empId)) {
        employeeStatusMap.set(empId, entry.status);
      }
    });

    // Count statuses from the map
    let clockedIn = 0;
    let onBreak = 0;
    let clockedOut = 0;
    let absent = 0;

    employeeStatusMap.forEach(status => {
      if (status === 'clocked_in') clockedIn++;
      else if (status === 'on_break') onBreak++;
      else if (status === 'clocked_out') clockedOut++;
    });

    // Calculate absent: only count as absent if they have a shift today and haven't clocked in
    // after their shift start time has passed
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    allUserIds.forEach(userId => {
      const empId = userId.toString();
      const hasTimeEntry = employeeStatusMap.has(empId);
      const shift = shiftMap.get(empId);

      // Only mark as absent if:
      // 1. They have a shift assigned today
      // 2. They haven't clocked in yet
      // 3. Current time is past their shift start time
      if (shift && !hasTimeEntry && currentTime > shift.startTime) {
        absent++;
      }
    });

    const stats = {
      clockedIn,
      onBreak,
      clockedOut,
      absent,
      total: totalEmployees
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard data'
    });
  }
});

// @route   GET /api/clock/status
// @desc    Get current clock status for all active employees (multi-session support)
// @access  Private (Admin)
router.get('/status', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const includeAdmins = req.query.includeAdmins === 'true';

  // Step 1: Fetch only valid, active employees from EmployeesHub
  const validEmployees = await EmployeesHub.find({
    status: 'Active',
    isActive: true,
    deleted: { $ne: true }
  })
    .select('firstName lastName email department jobTitle employeeId team office role')
    .lean();

  console.log(`📊 Found ${validEmployees.length} active employees`);

  const employeeIds = validEmployees.map(emp => emp._id);

  let adminUsers = [];
  if (includeAdmins) {
    const employeeEmails = new Set(
      validEmployees
        .map(e => e.email)
        .filter(Boolean)
        .map(e => e.toLowerCase())
    );

    adminUsers = await User.find({
      role: { $in: ['admin', 'super-admin'] },
      isActive: { $ne: false },
      deleted: { $ne: true }
    })
      .select('firstName lastName email role department jobTitle')
      .lean();

    adminUsers = adminUsers.filter(u => !u.email || !employeeEmails.has(u.email.toLowerCase()));
  }

  const adminUserIds = adminUsers.map(u => u._id);

  // Step 2: Get today's time entries for employees (and optionally admins)
  const timeEntries = await TimeEntry.find({
    employee: { $in: [...employeeIds, ...adminUserIds] },
    date: today
  }).lean();

  // Step 3: Calculate clock status for each employee
  const allEmployees = [];
  const clockedIn = [];
  const clockedOut = [];
  const onBreak = [];

  // Create a map of time entries by employee ID
  const timeEntryMap = new Map();
  timeEntries.forEach(entry => {
    timeEntryMap.set(entry.employee.toString(), entry);
  });

  // Process each employee
  validEmployees.forEach(employee => {
    const empId = employee._id.toString();
    const timeEntry = timeEntryMap.get(empId);

    let status = 'clocked_out'; // Default status
    let clockIn = null;
    let clockOut = null;
    let breakIn = null;
    let breakOut = null;

    if (timeEntry) {
      // First, try to use the direct status field if available
      if (timeEntry.status) {
        // Normalize status values
        const normalizedStatus = timeEntry.status.replace(/-/g, '_');
        status = normalizedStatus;
        clockIn = timeEntry.clockIn;
        clockOut = timeEntry.clockOut;
        breakIn = timeEntry.onBreakStart || null;
        breakOut = null;
      }
      // Fallback: Calculate status based on multi-session TimeEntry
      else if (timeEntry.sessions && timeEntry.sessions.length > 0) {
        const lastSession = timeEntry.sessions[timeEntry.sessions.length - 1];

        clockIn = lastSession.clockIn;
        clockOut = lastSession.clockOut;
        breakIn = lastSession.breakIn;
        breakOut = lastSession.breakOut;

        // Apply the status calculation logic
        if (!clockIn) {
          // No clock in today
          status = 'clocked_out';
        } else if (clockIn && !clockOut) {
          // Clocked in but not clocked out
          if (breakIn && !breakOut) {
            // Currently on break
            status = 'on_break';
          } else {
            // Clocked in and working
            status = 'clocked_in';
          }
        } else {
          // Both clock in and clock out exist
          status = 'clocked_out';
        }
      }
    }

    const employeeWithStatus = {
      _id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      jobTitle: employee.jobTitle,
      employeeId: employee.employeeId,
      team: employee.team,
      office: employee.office || '-',
      role: employee.role || 'employee',
      status: status,
      clockIn: clockIn,
      clockOut: clockOut,
      breakIn: breakIn,
      breakOut: breakOut,
      timeEntryId: timeEntry?._id || null
    };

    // Add to appropriate arrays
    allEmployees.push(employeeWithStatus);

    if (status === 'clocked_in') {
      clockedIn.push(employeeWithStatus);
    } else if (status === 'on_break') {
      onBreak.push(employeeWithStatus);
    } else {
      clockedOut.push(employeeWithStatus);
    }
  });

  if (adminUsers.length > 0) {
    adminUsers.forEach(adminUser => {
      const adminId = adminUser._id.toString();
      const timeEntry = timeEntryMap.get(adminId);

      let status = 'clocked_out';
      let clockIn = null;
      let clockOut = null;
      let breakIn = null;
      let breakOut = null;

      if (timeEntry) {
        if (timeEntry.status) {
          const normalizedStatus = timeEntry.status.replace(/-/g, '_');
          status = normalizedStatus;
          clockIn = timeEntry.clockIn;
          clockOut = timeEntry.clockOut;
          breakIn = timeEntry.onBreakStart || null;
          breakOut = null;
        } else if (timeEntry.sessions && timeEntry.sessions.length > 0) {
          const lastSession = timeEntry.sessions[timeEntry.sessions.length - 1];

          clockIn = lastSession.clockIn;
          clockOut = lastSession.clockOut;
          breakIn = lastSession.breakIn;
          breakOut = lastSession.breakOut;

          if (!clockIn) {
            status = 'clocked_out';
          } else if (clockIn && !clockOut) {
            if (breakIn && !breakOut) {
              status = 'on_break';
            } else {
              status = 'clocked_in';
            }
          } else {
            status = 'clocked_out';
          }
        }
      }

      const adminWithStatus = {
        _id: adminUser._id,
        id: adminUser._id,
        firstName: adminUser.firstName || '',
        lastName: adminUser.lastName || '',
        email: adminUser.email,
        department: adminUser.department || '-',
        jobTitle: adminUser.jobTitle || '-',
        employeeId: null,
        team: '-',
        office: '-',
        role: adminUser.role || 'admin',
        status: status,
        clockIn: clockIn,
        clockOut: clockOut,
        breakIn: breakIn,
        breakOut: breakOut,
        timeEntryId: timeEntry?._id || null,
        isAdmin: true
      };

      allEmployees.push(adminWithStatus);

      if (status === 'clocked_in') {
        clockedIn.push(adminWithStatus);
      } else if (status === 'on_break') {
        onBreak.push(adminWithStatus);
      } else {
        clockedOut.push(adminWithStatus);
      }
    });
  }

  console.log(`📊 Status summary: ${clockedIn.length} clocked in, ${onBreak.length} on break, ${clockedOut.length} clocked out`);

  // Step 4: Return the response in the new format
  const responseData = {
    success: true,
    data: {
      allEmployees,
      clockedIn,
      clockedOut,
      break: onBreak, // Using 'break' as requested
      employees: allEmployees // For backward compatibility
    }
  };

  console.log('✅ Clock status fetch completed successfully');
  return res.json(responseData);
}));

// @route   GET /api/clock/status/:employeeId
// @desc    Get current clock status for a specific employee (SINGLE SOURCE OF TRUTH)
// @access  Private (Admin/Employee)
router.get('/status/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`📊 Fetching clock status for employee: ${employeeId}, date: ${today}`);

  // Find the employee
  const employee = await EmployeesHub.findById(employeeId)
    .select('firstName lastName email department jobTitle employeeId')
    .lean();

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Get today's time entry
  const timeEntry = await TimeEntry.findOne({
    employee: employeeId,
    date: today
  }).lean();

  let currentStatus = 'CLOCKED_OUT';
  let lastPunchType = null;
  let lastPunchTime = null;
  let clockIn = null;
  let clockOut = null;

  if (timeEntry) {
    // Determine current status based on TimeEntry
    if (timeEntry.status) {
      const normalizedStatus = timeEntry.status.toUpperCase().replace(/-/g, '_');

      if (normalizedStatus === 'CLOCKED_IN') {
        currentStatus = 'CLOCKED_IN';
        lastPunchType = 'CLOCK_IN';
        lastPunchTime = timeEntry.clockIn;
      } else if (normalizedStatus === 'ON_BREAK') {
        currentStatus = 'ON_BREAK';
        lastPunchType = 'BREAK';
        lastPunchTime = timeEntry.onBreakStart || timeEntry.clockIn;
      } else if (normalizedStatus === 'CLOCKED_OUT' && timeEntry.clockOut) {
        currentStatus = 'CLOCKED_OUT';
        lastPunchType = 'CLOCK_OUT';
        lastPunchTime = timeEntry.clockOut;
      }

      clockIn = timeEntry.clockIn;
      clockOut = timeEntry.clockOut;
    }
  }

  const statusData = {
    employeeId: employee._id,
    currentStatus,
    lastPunchType,
    lastPunchTime,
    clockIn,
    clockOut,
    employee: {
      _id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      jobTitle: employee.jobTitle,
      employeeId: employee.employeeId
    }
  };

  console.log(`✅ Clock status for ${employee.firstName}: ${currentStatus}`);

  res.json({
    success: true,
    data: statusData
  });
}));

// @route   GET /api/clock/entries
// @desc    Get time entries with optional filters
// @access  Private (Admin)
router.get('/entries', async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    let query = {};

    // Date range filter - use string comparison since date is stored as YYYY-MM-DD string
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // startDate is already in YYYY-MM-DD format
        query.date.$gte = startDate;
      }
      if (endDate) {
        // endDate is already in YYYY-MM-DD format
        query.date.$lte = endDate;
      }
    }

    // Employee filter
    if (employeeId) {
      query.employee = employeeId;
    }

    console.log('📋 Time entries query:', query);

    const timeEntries = await TimeEntry.find(query)
      .populate('employee', 'firstName lastName email department vtid')
      .populate('createdBy', 'firstName lastName')
      .populate('shiftId', 'startTime endTime location')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    console.log(`📋 Found ${timeEntries.length} time entries`);

    // Filter out entries with deleted employees (employee is null after populate)
    const validEntries = timeEntries.filter(entry => entry.employee !== null);

    if (validEntries.length < timeEntries.length) {
      console.log(`⚠️ Filtered out ${timeEntries.length - validEntries.length} entries with deleted employees`);
    }

    // Process entries to add shift hours, overtime, and format for frontend
    const processedEntries = validEntries.map(entry => {
      let shiftHours = null;
      let shiftStartTime = null;
      let shiftEndTime = null;
      let overtime = 0;
      let hoursWorked = 0;

      // Calculate shift hours if shift is assigned
      if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
        shiftHours = calculateScheduledHours(entry.shiftId.startTime, entry.shiftId.endTime);
        shiftStartTime = entry.shiftId.startTime;
        shiftEndTime = entry.shiftId.endTime;
      }

      // Format clockIn and clockOut for display (convert ISO to HH:MM format)
      let clockInTime = null;
      let clockOutTime = null;

      if (entry.clockIn) {
        const clockInDate = new Date(entry.clockIn);
        clockInTime = clockInDate.toTimeString().slice(0, 5);
      }

      if (entry.clockOut) {
        const clockOutDate = new Date(entry.clockOut);
        clockOutTime = clockOutDate.toTimeString().slice(0, 5);

        // Calculate hours worked and overtime if both clockIn and clockOut exist
        if (entry.clockIn) {
          hoursWorked = calculateHoursWorked(entry.clockIn, entry.clockOut, entry.breaks || []);

          // Calculate overtime (hours beyond standard 8-hour day)
          if (hoursWorked > 8) {
            overtime = hoursWorked - 8;
          }
        }
      }

      return {
        ...entry,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        shiftHours: shiftHours ? shiftHours.toFixed(2) : null,
        shiftStartTime: shiftStartTime,
        shiftEndTime: shiftEndTime,
        hoursWorked: hoursWorked > 0 ? hoursWorked.toFixed(2) : null,
        overtime: overtime > 0 ? overtime.toFixed(2) : '0.00'
      };
    });

    res.json({
      success: true,
      data: processedEntries
    });

  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching time entries'
    });
  }
});

// @route   POST /api/clock/entry
// @desc    Add manual time entry
// @access  Private (Admin)
router.post('/entry', async (req, res) => {
  try {
    const { employeeId, location, workType, clockIn, clockOut, breaks } = req.body;

    if (!employeeId || !clockIn) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and clock in time are required'
      });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Parse date and time from clockIn
    const clockInDate = new Date(clockIn);
    const clockInTime = clockInDate.toTimeString().slice(0, 5);

    let clockOutTime = null;
    if (clockOut) {
      const clockOutDate = new Date(clockOut);
      clockOutTime = clockOutDate.toTimeString().slice(0, 5);
    }

    // Process breaks
    const processedBreaks = (breaks || []).map(breakItem => ({
      startTime: breakItem.startTime || '12:00',
      endTime: breakItem.endTime || '12:30',
      duration: breakItem.duration || 30,
      type: breakItem.type || 'other'
    }));

    const timeEntry = new TimeEntry({
      employee: employeeId,
      date: clockInDate,
      clockIn: clockInTime,
      clockOut: clockOutTime,
      location: location || 'Office - Main',
      workType: workType || 'Regular Shift',
      breaks: processedBreaks,
      status: clockOutTime ? 'clocked_out' : 'clocked_in',
      isManualEntry: true,
      createdBy: req.user.id
    });

    await timeEntry.save();

    res.json({
      success: true,
      message: 'Time entry added successfully',
      data: timeEntry
    });

  } catch (error) {
    console.error('Add time entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding time entry'
    });
  }
});

// @route   PUT /api/clock/entry/:id
// @desc    Update time entry
// @access  Private (Admin)
router.put('/entry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('🔄 Updating time entry:', id);
    console.log('📝 Update data:', updates);

    // Validate MongoDB ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time entry ID format'
      });
    }

    // Prepare updates - handle time string conversion to Date objects
    const updateData = { ...updates, updatedAt: new Date() };

    // Convert HH:mm time strings to full Date objects
    if (updates.clockIn && typeof updates.clockIn === 'string' && !updates.clockIn.includes('T')) {
      console.log('⏰ Converting clock in time from HH:mm format:', updates.clockIn);
      const [hours, minutes] = updates.clockIn.split(':');
      const date = updates.date ? new Date(updates.date) : new Date();
      date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      updateData.clockIn = date;
    }

    if (updates.clockOut && typeof updates.clockOut === 'string' && !updates.clockOut.includes('T')) {
      console.log('⏰ Converting clock out time from HH:mm format:', updates.clockOut);
      const [hours, minutes] = updates.clockOut.split(':');
      const date = updates.date ? new Date(updates.date) : new Date();
      date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      updateData.clockOut = date;
    }

    const timeEntry = await TimeEntry.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('employee', 'firstName lastName email department');

    if (!timeEntry) {
      console.warn('⚠️ Time entry not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Time entry not found'
      });
    }

    console.log('✅ Time entry updated successfully:', timeEntry._id);

    res.json({
      success: true,
      message: 'Time entry updated successfully',
      data: timeEntry
    });

  } catch (error) {
    console.error('❌ Update time entry error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error updating time entry',
      error: error.message
    });
  }
});

// @route   DELETE /api/clock/entry/:id
// @desc    Delete time entry
// @access  Private (Admin)
router.delete('/entry/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const timeEntry = await TimeEntry.findById(id);

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message: 'Time entry not found'
      });
    }

    // If this time entry is linked to a shift, reset the shift status
    if (timeEntry.shiftId) {
      const ShiftAssignment = require('../models/ShiftAssignment');
      const shift = await ShiftAssignment.findById(timeEntry.shiftId);

      if (shift) {
        shift.status = 'Scheduled';
        shift.actualStartTime = null;
        shift.actualEndTime = null;
        shift.timeEntryId = null;
        await shift.save();
        console.log(`Shift ${shift._id} reset to Scheduled after time entry deletion`);
      }
    }

    await TimeEntry.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Time entry deleted successfully'
    });

  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting time entry'
    });
  }
});

// @route   POST /api/clock/entry/:id/break
// @desc    Add break to time entry
// @access  Private (Admin)
router.post('/entry/:id/break', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, duration, type } = req.body;

  const timeEntry = await TimeEntry.findById(id);

  if (!timeEntry) {
    return res.status(404).json({
      success: false,
      message: 'Time entry not found'
    });
  }

  const newBreak = {
    startTime: startTime || '12:00',
    endTime: endTime || '12:30',
    duration: duration || 30,
    type: type || 'other'
  };

  timeEntry.breaks.push(newBreak);
  await timeEntry.save();

  res.json({
    success: true,
    message: 'Break added successfully',
    data: timeEntry
  });
}));

// @route   POST /api/clock/onbreak
// @desc    Set employee on break
// @access  Private (Admin)
router.post('/onbreak', asyncHandler(async (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID is required'
    });
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  const entry = await TimeEntry.findOne({
    employee: employeeId,
    date: today
  });

  // VALIDATION CHECKS
  if (!entry) {
    return res.status(400).json({
      success: false,
      message: "No TimeEntry found for today. Employee must clock in first."
    });
  }

  if (!entry.clockIn) {
    return res.status(400).json({
      success: false,
      message: "Employee must clock in first."
    });
  }

  if (entry.clockOut) {
    return res.status(400).json({
      success: false,
      message: "Already clocked out. Cannot start break."
    });
  }

  if (entry.onBreakStart) {
    return res.status(400).json({
      success: false,
      message: "Already on break"
    });
  }

  // Set break start time - store as UTC Date object
  entry.onBreakStart = new Date();
  entry.status = 'on_break';

  await entry.save();
  console.log('✅ Break started successfully for employee:', employeeId);

  // Create notification
  try {
    const Notification = require('../models/Notification');
    const adminUserId = req.user?._id || req.user?.userId || req.user?.id;
    const User = require('../models/User');
    const adminUser = adminUserId ? await User.findById(adminUserId) : null;
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    await Notification.create({
      userId: employeeId,
      type: 'system',
      title: 'Break Started by Admin',
      message: `${adminName} started your break at ${new Date().toLocaleTimeString()}`,
      priority: 'low'
    });
  } catch (notifError) {
    console.error('❌ Failed to create notification:', notifError);
  }

  return res.json({
    success: true,
    message: 'Break started successfully',
    entry: entry
  });
}));

// @route   POST /api/clock/endbreak
// @desc    End employee break (resume work)
// @access  Private (Admin)
router.post('/endbreak', asyncHandler(async (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID is required'
    });
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  const entry = await TimeEntry.findOne({
    employee: employeeId,
    date: today
  });

  // VALIDATION CHECKS
  if (!entry) {
    return res.status(400).json({
      success: false,
      message: "No TimeEntry found for today"
    });
  }

  if (!entry.clockIn) {
    return res.status(400).json({
      success: false,
      message: "Employee not clocked in"
    });
  }

  if (entry.clockOut) {
    return res.status(400).json({
      success: false,
      message: "Already clocked out"
    });
  }

  if (!entry.onBreakStart) {
    return res.status(400).json({
      success: false,
      message: "Not on break"
    });
  }

  // Calculate break duration and add to breaks array
  // Store as UTC Date object
  const breakEnd = new Date();
  const breakDuration = (breakEnd - entry.onBreakStart) / 1000 / 60; // minutes

  if (!entry.breaks) {
    entry.breaks = [];
  }

  entry.breaks.push({
    start: entry.onBreakStart,
    end: breakEnd,
    duration: breakDuration
  });

  // Clear break status and resume work
  entry.onBreakStart = null;
  entry.status = 'clocked_in';

  await entry.save();
  console.log('✅ Break ended successfully for employee:', employeeId);

  // Create notification
  try {
    const Notification = require('../models/Notification');
    const adminUserId = req.user?._id || req.user?.userId || req.user?.id;
    const User = require('../models/User');
    const adminUser = adminUserId ? await User.findById(adminUserId) : null;
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    await Notification.create({
      userId: employeeId,
      type: 'system',
      title: 'Break Ended by Admin',
      message: `${adminName} ended your break at ${new Date().toLocaleTimeString()}`,
      priority: 'medium'
    });
  } catch (notifError) {
    console.error('❌ Failed to create notification:', notifError);
  }

  return res.json({
    success: true,
    message: 'Break ended successfully',
    entry: entry
  });
}));

// @route   POST /api/clock/resume
// @desc    Resume work (end break) for employee
// @access  Private (Admin)
router.post('/resume', asyncHandler(async (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID is required'
    });
  }

  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const entry = await TimeEntry.findOne({
    employee: employeeId,
    date: today
  });

  // VALIDATION CHECKS
  if (!entry) {
    return res.status(400).json({
      success: false,
      message: "No TimeEntry found for today"
    });
  }

  if (!entry.sessions || entry.sessions.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No active session found"
    });
  }

  const last = entry.sessions[entry.sessions.length - 1];

  if (!last.clockIn) {
    return res.status(400).json({
      success: false,
      message: "Invalid session"
    });
  }

  if (last.clockOut) {
    return res.status(400).json({
      success: false,
      message: "Session already closed"
    });
  }

  if (!last.breakIn) {
    return res.status(400).json({
      success: false,
      message: "Not on break"
    });
  }

  if (last.breakOut) {
    return res.status(400).json({
      success: false,
      message: "Break already ended"
    });
  }

  // UTC TIMESTAMP - End break
  last.breakOut = new Date().toISOString();
  entry.status = 'clocked_in';

  await entry.save();
  console.log(' Break ended successfully for employee:', employeeId);

  // Create notification
  try {
    const Notification = require('../models/Notification');
    const adminUserId = req.user?._id || req.user?.userId || req.user?.id;
    const User = require('../models/User');
    const adminUser = adminUserId ? await User.findById(adminUserId) : null;
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    await Notification.create({
      userId: employeeId,
      type: 'system',
      title: 'Break Ended by Admin',
      message: `${adminName} ended your break at ${new Date().toLocaleTimeString()}`,
      priority: 'medium'
    });
  } catch (notifError) {
    console.error(' Failed to create notification:', notifError);
  }

  return res.json({
    success: true,
    message: 'Break ended successfully',
    entry: entry
  });
}));

// @route   POST /api/clock/admin/status
// @desc    Admin change employee status (clocked_in, clocked_out, on_break, absent, on_leave)
// @access  Private (Admin)
router.post('/admin/status', async (req, res) => {
  try {
    const { employeeId, status, location, workType, reason } = req.body;

    if (!employeeId || !status) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and status are required'
      });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    let result;

    switch (status) {
      case 'clocked_in':
        // Check if employee is currently on break - if so, resume work
        const breakEntry = await TimeEntry.findOne({
          employee: employeeId,
          date: today,
          status: 'on_break'
        });

        if (breakEntry) {
          // Resume work from break
          const now = new Date();

          // Calculate break duration and add to breaks array
          if (breakEntry.onBreakStart) {
            const breakDuration = (now - breakEntry.onBreakStart) / 1000 / 60; // minutes

            if (!breakEntry.breaks) {
              breakEntry.breaks = [];
            }

            breakEntry.breaks.push({
              start: breakEntry.onBreakStart,
              end: now,
              duration: breakDuration
            });

            // Clear break status
            breakEntry.onBreakStart = null;
          }

          breakEntry.status = 'clocked_in';
          await breakEntry.save();

          // Update shift status to In Progress when resuming work
          if (breakEntry.shiftId) {
            console.log('Resume work: Updating shift to In Progress:', breakEntry.shiftId._id);
            await updateShiftStatus(breakEntry.shiftId._id, 'In Progress');
          }

          result = { message: 'Employee resumed work successfully', data: breakEntry };
          break;
        }

        // Check if employee already has any time entry for today
        const existingEntry = await TimeEntry.findOne({
          employee: employeeId,
          date: today,
          status: { $in: ['clocked_in', 'on_break'] }
        });

        if (existingEntry) {
          return res.status(400).json({
            success: false,
            message: `Employee already has an active time entry. Current status: ${existingEntry.status.replace('_', ' ')}`
          });
        }

        // Create new time entry using legacy fields
        const timeEntry = new TimeEntry({
          employee: employeeId,
          date: today,
          clockIn: new Date(),
          location: location || 'Work From Office',
          workType: workType || 'Regular',
          status: 'clocked_in',
          isManualEntry: true,
          createdBy: req.user.id
        });

        await timeEntry.save();
        result = { message: 'Employee clocked in successfully', data: timeEntry };
        break;

      case 'clocked_out':
        // Find active entry
        const activeEntry = await TimeEntry.findOne({
          employee: employeeId,
          date: today,
          status: { $in: ['clocked_in', 'on_break'] }
        });

        if (!activeEntry) {
          return res.status(400).json({
            success: false,
            message: 'No active clock-in found for today'
          });
        }

        activeEntry.clockOut = new Date();
        activeEntry.status = 'clocked_out';

        // Clear break status if on break
        if (activeEntry.onBreakStart) {
          activeEntry.onBreakStart = null;
        }
        await activeEntry.save();
        result = { message: 'Employee clocked out successfully', data: activeEntry };
        break;

      case 'on_break':
        // Find today's entry
        const clockedInEntry = await TimeEntry.findOne({
          employee: employeeId,
          date: today,
          status: 'clocked_in'
        });

        if (!clockedInEntry) {
          return res.status(400).json({
            success: false,
            message: 'Employee must be clocked in to take a break'
          });
        }

        if (clockedInEntry.onBreakStart) {
          return res.status(400).json({
            success: false,
            message: 'Employee is already on break'
          });
        }

        clockedInEntry.onBreakStart = new Date();
        clockedInEntry.status = 'on_break';
        await clockedInEntry.save();

        // Update shift status to On Break
        if (clockedInEntry.shiftId) {
          console.log('Break started: Updating shift to On Break:', clockedInEntry.shiftId._id);
          await updateShiftStatus(clockedInEntry.shiftId._id, 'On Break');
        }

        result = { message: 'Break started successfully', data: clockedInEntry };
        break;

      case 'absent':
      case 'on_leave':
        // Create a leave record for today
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const leaveRecord = new LeaveRecord({
          user: employeeId,
          type: status === 'absent' ? 'absent' : 'annual',
          status: 'approved',
          startDate: todayDate,
          endDate: todayDate,
          days: 1,
          reason: reason || 'Admin marked',
          createdBy: req.user.id,
          approvedBy: req.user.id,
          approvedAt: new Date()
        });

        await leaveRecord.save();
        result = { message: `Employee marked as ${status} successfully`, data: leaveRecord };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be: clocked_in, clocked_out, on_break, absent, or on_leave'
        });
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Admin change status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing employee status'
    });
  }
});

// @route   GET /api/clock/export
// @desc    Export time entries to CSV
// @access  Private (Admin)
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    // Date field is stored as string (YYYY-MM-DD), so use string comparison
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const timeEntries = await TimeEntry.find(query)
      .populate('employee', 'firstName lastName email department vtid')
      .sort({ date: -1 });

    // Generate CSV
    let csv = 'Date,Employee Name,VTID,Clock In,Clock Out,Total Hours,Breaks,Location\n';

    timeEntries.forEach(entry => {
      // Skip entries with deleted/missing employees
      if (!entry.employee) {
        return;
      }
      
      const employeeName = `${entry.employee.firstName} ${entry.employee.lastName}`;
      const vtid = entry.employee?.vtid || '';
      
      // Date is already a string in YYYY-MM-DD format, convert to DD/MM/YYYY
      let date = '';
      if (entry.date) {
        const [year, month, day] = entry.date.split('-');
        date = `${day}/${month}/${year}`;
      }
      
      // Get first session's clock in/out times
      let clockIn = '';
      let clockOut = '';
      if (entry.sessions && entry.sessions.length > 0) {
        const firstSession = entry.sessions[0];
        if (firstSession.clockIn) {
          clockIn = new Date(firstSession.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (firstSession.clockOut) {
          clockOut = new Date(firstSession.clockOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
      }
      
      // Calculate total hours from all sessions
      let totalHours = '0.00';
      if (entry.sessions && entry.sessions.length > 0) {
        let totalMs = 0;
        entry.sessions.forEach(session => {
          if (session.clockIn && session.clockOut) {
            const start = new Date(session.clockIn);
            const end = new Date(session.clockOut);
            totalMs += (end - start);
          }
        });
        totalHours = (totalMs / (1000 * 60 * 60)).toFixed(2);
      }
      
      // Calculate break time safely
      let breakHours = '0.00';
      if (entry.breaks && Array.isArray(entry.breaks)) {
        const totalBreakMinutes = entry.breaks.reduce((total, b) => total + (b.duration || 0), 0);
        breakHours = (totalBreakMinutes / 60).toFixed(2);
      }
      
      const location = entry.location || '';

      csv += `${date},"${employeeName}",${vtid},${clockIn},${clockOut},${totalHours},${breakHours},"${location}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="time-entries-${startDate}-to-${endDate}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Export time entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting time entries'
    });
  }
});

// User-specific routes (employees can only manage their own time)

// @route   GET /api/clock/user/status
// @desc    Get current user's clock status
// @access  Private (User)

// User-specific routes (employees can only manage their own time)

// @route   GET /api/clock/user/status
// @desc    Get current user's clock status
// @access  Private (User)
router.get('/user/status', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/status. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id || req.user._id || req.user.userId;

    // Use UK timezone for date comparison
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10);

    // (keep your existing logic below this line)

    console.log('📊 User status query - userId:', userId, 'dateString:', dateString);

    // Query for today's entry (supports both employee and admin users)
    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: userId },
        { employee: userId }
      ],
      date: dateString,
      status: { $in: ['clocked_in', 'clocked_out', 'on_break'] }
    })
      .sort({ clockIn: -1 }) // Get the most recent entry
      .populate('employee', 'firstName lastName email vtid');

    console.log('📊 Found time entry:', timeEntry ? {
      status: timeEntry.status,
      clockIn: timeEntry.clockIn,
      clockOut: timeEntry.clockOut,
      date: timeEntry.date
    } : 'NO ENTRY FOUND');

    if (!timeEntry) {
      return res.json({
        success: true,
        data: {
          status: 'not_clocked_in',
          clockIn: null,
          clockOut: null,
          location: null,
          workType: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: timeEntry.status,
        clockIn: timeEntry.clockIn,
        clockOut: timeEntry.clockOut,
        location: timeEntry.location,
        workType: timeEntry.workType,
        breaks: timeEntry.breaks
      }
    });

  } catch (error) {
    console.error('Get user clock status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching clock status'
    });
  }
});

// @route   POST /api/clock/user/in
// @desc    Clock in current user (employee or admin)
// @access  Private (User)
router.post('/user/in', authenticateSession, async (req, res) => {
  try {
    console.log('🔵 Clock-in request received');
    console.log('req.user:', req.user);
    console.log('AUTH HEADER (user/in):', req.headers.authorization);

    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/in. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;
    // Extract GPS coordinates from request body
    const { workType, location, latitude, longitude, accuracy } = req.body;

    console.log('📍 Clock-in parameters:', { userId, workType, location, latitude, longitude });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Allow multiple clock-ins per day for split shifts or multiple work sessions
    // Check only if there's an ACTIVE clock-in (not clocked out)
    // Use UK timezone for date comparison
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const today = new Date(ukNow);
    today.setHours(0, 0, 0, 0);

    // Format date as YYYY-MM-DD string (required by schema)
    const dateString = ukNow.toISOString().slice(0, 10);

    // For admins, use userId directly; for employees, use employee field
    const employeeId = userId;

    const existingEntry = await TimeEntry.findOne({
      $or: [
        { employee: employeeId },
        { employee: userId }
      ],
      date: dateString,
      status: { $in: ['clocked_in', 'on_break'] }
    });

    if (existingEntry) {
      console.log('❌ User already has active clock-in:', {
        userId: userId,
        status: existingEntry.status,
        clockIn: existingEntry.clockIn,
        date: existingEntry.date,
        dateString: dateString,
        entryId: existingEntry._id,
        breaks: existingEntry.breaks,
        onBreakStart: existingEntry.onBreakStart
      });
      return res.status(400).json({
        success: false,
        message: `You are currently ${existingEntry.status.replace('_', ' ')}. Please clock out or end break before clocking in again.`,
        currentStatus: {
          status: existingEntry.status,
          clockIn: existingEntry.clockIn,
          clockOut: existingEntry.clockOut,
          location: existingEntry.location,
          workType: existingEntry.workType
        }
      });
    }

    // User can clock in again after clocking out (creates a new time entry for the same day)

    // Get current UK time
    const currentTime = ukNow.toTimeString().slice(0, 5); // HH:MM format for display

    // Find matching shift (non-blocking for admins)
    let shift = null;
    try {
      shift = await findMatchingShift(userId, ukNow, location);
    } catch (shiftError) {
      console.warn('Shift lookup failed (non-blocking):', shiftError.message);
      // Continue without shift - admins may not have shifts
    }

    let timeEntryData = {
      employee: employeeId,
      date: dateString,
      clockIn: new Date(), // Store as UTC Date object
      location: location || 'Work From Office',
      workType: workType || 'Regular',
      status: 'clocked_in',
      createdBy: userId
    };

    // ========== GPS LOCATION PROCESSING ==========
    // If GPS coordinates are provided, save them and attempt reverse geocoding
    if (latitude && longitude) {
      console.log('GPS coordinates received:', { latitude, longitude, accuracy });

      // Initialize GPS location object (use gpsLocationIn for clock-in)
      timeEntryData.gpsLocationIn = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        timestamp: new Date()
      };

      // Attempt reverse geocoding to get address (non-blocking)
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          console.log('Reverse geocoded address:', address);
          // Store address in notes if needed
          timeEntryData.notes = (timeEntryData.notes || '') + ` Location: ${address}`;
        }
      } catch (geocodeError) {
        console.error('Reverse geocoding failed, continuing without address:', geocodeError);
        // Don't fail the clock-in if geocoding fails
      }
    }
    // ============================================

    let attendanceStatus = 'Unscheduled';
    let validationResult = null;

    if (shift) {
      try {
        validationResult = validateClockIn(currentTime, shift);
        attendanceStatus = validationResult.status;

        timeEntryData.shiftId = shift._id;
        timeEntryData.attendanceStatus = attendanceStatus;
        timeEntryData.scheduledHours = calculateScheduledHours(shift) || 0;

        // Check for lateness and create record
        const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
        const shiftStartTime = new Date(ukNow);
        shiftStartTime.setHours(shiftHour, shiftMin, 0, 0);

        const minutesLate = (ukNow - shiftStartTime) / (1000 * 60);
        const gracePeriod = 5; // 5 minute grace period

        if (minutesLate > gracePeriod && attendanceStatus === 'Late') {
          // Create lateness record
          const LatenessRecord = require('../models/LatenessRecord');
          try {
            await LatenessRecord.create({
              employee: employeeId,
              date: ukNow,
              scheduledStart: shiftStartTime,
              actualStart: ukNow,
              minutesLate: Math.round(minutesLate),
              shift: shift._id,
              excused: false
            });
            console.log(`⏰ Lateness record created: ${Math.round(minutesLate)} minutes late`);
          } catch (lateErr) {
            console.error('Failed to create lateness record:', lateErr);
            // Don't fail clock-in if lateness record fails
          }
        }
      } catch (shiftCalcError) {
        console.warn('Shift calculation failed (non-blocking):', shiftCalcError.message);
        timeEntryData.attendanceStatus = 'Unscheduled';
        timeEntryData.notes = 'Shift validation failed but clock-in allowed';
      }
    } else {
      timeEntryData.attendanceStatus = 'Unscheduled';
      timeEntryData.notes = 'No scheduled shift found for today';
    }

    console.log('📝 Creating TimeEntry with data:', {
      employee: timeEntryData.employee,
      date: timeEntryData.date,
      status: timeEntryData.status,
      location: timeEntryData.location,
      workType: timeEntryData.workType
    });

    const timeEntry = new TimeEntry(timeEntryData);
    await timeEntry.save();

    console.log('✅ TimeEntry saved successfully:', timeEntry._id);

    if (shift) {
      console.log('User clock-in: Updating shift to In Progress:', shift._id);
      await updateShiftStatus(shift._id, 'In Progress', {
        actualStartTime: currentTime,
        timeEntryId: timeEntry._id
      });
      // updateShiftStatus returns null on error - doesn't throw
    }

    // Create notification for clock-in
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: userId,
        type: 'system',
        title: 'Clocked In',
        message: `You clocked in at ${currentTime} - ${location}`,
        priority: 'medium'
      });
    } catch (notifError) {
      console.error('Failed to create clock-in notification:', notifError);
    }

    res.json({
      success: true,
      message: validationResult ? validationResult.message : 'Clocked in successfully',
      data: {
        timeEntry,
        shift: shift ? { _id: shift._id, startTime: shift.startTime, endTime: shift.endTime } : null,
        attendanceStatus,
        validation: validationResult
      }
    });

  } catch (error) {
    console.error('User clock in error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'Server error during clock in',
      error: error.message
    });
  }
});

// @route   POST /api/clock/user/out
// @desc    Clock out current user (employee or admin)
// @access  Private (User)
router.post('/user/out', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/out. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;
    // Extract GPS coordinates from request body for clock-out
    const { latitude, longitude, accuracy } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find today's active time entry using UK timezone
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const today = new Date(ukNow);
    today.setHours(0, 0, 0, 0);

    // Format date as YYYY-MM-DD string (required by schema)
    const dateString = ukNow.toISOString().slice(0, 10);

    // For admins, use userId directly; for employees, use employee field
    const employeeId = userId;

    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: employeeId },
        { employee: userId }
      ],
      date: dateString,
      status: { $in: ['clocked_in', 'on_break'] }
    }).populate('shiftId');

    if (!timeEntry) {
      console.log('Clock-out failed: No active entry found for user:', userId, 'after date:', today);
      return res.status(400).json({
        success: false,
        message: 'No active clock-in found for today'
      });
    }

    // Update clock out time - store as UTC Date object
    const currentTime = ukNow.toTimeString().slice(0, 5); // HH:MM format for display
    timeEntry.clockOut = new Date(); // Store as UTC Date object
    timeEntry.status = 'clocked_out';

    // ========== GPS LOCATION PROCESSING FOR CLOCK-OUT ==========
    // If GPS coordinates are provided, save them and attempt reverse geocoding
    if (latitude && longitude) {
      console.log('GPS coordinates received for clock-out:', { latitude, longitude, accuracy });

      // Initialize GPS location object for clock-out
      timeEntry.gpsLocationOut = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        capturedAt: new Date()
      };

      // Attempt reverse geocoding to get address (non-blocking)
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          timeEntry.gpsLocationOut.address = address;
          console.log('Reverse geocoded address for clock-out:', address);
        }
      } catch (geocodeError) {
        console.error('Reverse geocoding failed for clock-out, continuing without address:', geocodeError);
        // Don't fail the clock-out if geocoding fails
      }
    }
    // ===========================================================

    // Calculate hours worked - handle both Date objects and time strings
    const clockInTime = timeEntry.clockIn instanceof Date
      ? timeEntry.clockIn.toTimeString().slice(0, 5)
      : timeEntry.clockIn;

    const hoursWorked = calculateHoursWorked(clockInTime, currentTime, timeEntry.breaks || []);
    timeEntry.hoursWorked = hoursWorked;
    timeEntry.totalHours = hoursWorked;

    if (timeEntry.scheduledHours && timeEntry.scheduledHours > 0) {
      timeEntry.variance = hoursWorked - timeEntry.scheduledHours;
    } else {
      timeEntry.variance = 0; // Default variance to 0 if no scheduled hours
    }

    await timeEntry.save();

    if (timeEntry.shiftId) {
      console.log('User clock-out: Marking shift as Completed');
      await updateShiftStatus(timeEntry.shiftId._id, 'Completed', {
        actualEndTime: currentTime
      });
      // updateShiftStatus returns null on error - doesn't throw
    }

    // Create notification for clock-out
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: userId,
        type: 'system',
        title: 'Clocked Out',
        message: `You clocked out at ${currentTime}. Hours worked: ${hoursWorked.toFixed(2)}h`,
        priority: 'medium'
      });
    } catch (notifError) {
      console.error('Failed to create clock-out notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Clocked out successfully',
      data: {
        timeEntry,
        hoursWorked,
        variance: timeEntry.variance
      }
    });

  } catch (error) {
    console.error('User clock out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during clock out'
    });
  }
});

// @route   POST /api/clock/user/break
// @desc    Add break for current user
// @access  Private (User)
router.post('/user/break', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/break. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;
    const { duration = 30, type = 'other' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find today's active time entry using UK timezone
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10); // YYYY-MM-DD format

    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: userId },
        { employee: userId }
      ],
      date: dateString,
      status: 'clocked_in'
    }).populate('shiftId');

    if (!timeEntry) {
      return res.status(400).json({
        success: false,
        message: 'You must be clocked in to add a break'
      });
    }

    // Add break
    const currentTime = new Date().toTimeString().slice(0, 5);
    const breakEndTime = new Date();
    breakEndTime.setMinutes(breakEndTime.getMinutes() + duration);
    const endTime = breakEndTime.toTimeString().slice(0, 5);

    const newBreak = {
      startTime: currentTime,
      endTime: endTime,
      duration: duration,
      type: type
    };

    timeEntry.breaks.push(newBreak);
    timeEntry.status = 'on_break';
    await timeEntry.save();

    // Note: Shift status stays "In Progress" during break
    // (not changing to "On Break" to keep it simple)

    res.json({
      success: true,
      message: 'Break added successfully',
      data: timeEntry
    });

  } catch (error) {
    console.error('Add user break error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding break'
    });
  }
});

// @route   POST /api/clock/user/start-break
// @desc    Start break for current user
// @access  Private (User)
router.post('/user/start-break', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/start-break. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find today's active time entry using UK timezone
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10); // YYYY-MM-DD format

    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: userId },
        { employee: userId }
      ],
      date: dateString,
      status: 'clocked_in'
    }).populate('employee', 'firstName lastName email');

    if (!timeEntry) {
      return res.status(400).json({
        success: false,
        message: 'You must be clocked in to start a break'
      });
    }

    // Set break status
    const currentTime = new Date().toTimeString().slice(0, 5);
    timeEntry.status = 'on_break';
    timeEntry.onBreakStart = currentTime;

    await timeEntry.save();

    // Create notification
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: userId,
        type: 'system',
        title: 'Break Started',
        message: `Break started at ${currentTime}`,
        priority: 'low'
      });
    } catch (notifError) {
      console.error('Failed to create break notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Break started successfully',
      data: timeEntry
    });

  } catch (error) {
    console.error('Start break error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting break'
    });
  }
});

// @route   POST /api/clock/user/resume-work
// @desc    Resume work from break for current user
// @access  Private (User)
router.post('/user/resume-work', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/resume-work. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find today's time entry that's on break using UK timezone
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10); // YYYY-MM-DD format

    console.log('🔵 Resume work request:', {
      userId,
      dateString,
      ukNow: ukNow.toISOString()
    });

    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: userId },
        { employee: userId }
      ],
      date: dateString,
      status: 'on_break'
    }).populate('employee', 'firstName lastName email');

    if (!timeEntry) {
      console.log('❌ No on_break entry found for user:', userId, 'date:', dateString);
      return res.status(400).json({
        success: false,
        message: 'You are not currently on break'
      });
    }

    console.log('✅ Found on_break entry:', {
      entryId: timeEntry._id,
      status: timeEntry.status,
      onBreakStart: timeEntry.onBreakStart
    });

    // Calculate break duration
    const currentTime = new Date().toTimeString().slice(0, 5);
    const breakStart = timeEntry.onBreakStart;

    if (breakStart) {
      const [startHour, startMin] = breakStart.split(':').map(Number);
      const [endHour, endMin] = currentTime.split(':').map(Number);
      const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

      // Add break to breaks array
      timeEntry.breaks.push({
        startTime: breakStart,
        endTime: currentTime,
        duration: duration > 0 ? duration : 0,
        type: 'other'
      });
    }

    // Resume work status
    timeEntry.status = 'clocked_in';
    timeEntry.onBreakStart = null;

    await timeEntry.save();

    console.log('✅ Work resumed successfully:', {
      entryId: timeEntry._id,
      newStatus: timeEntry.status
    });

    // Create notification
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: userId,
        type: 'system',
        title: 'Work Resumed',
        message: `Work resumed at ${currentTime}`,
        priority: 'low'
      });
    } catch (notifError) {
      console.error('Failed to create resume notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Work resumed successfully',
      data: timeEntry
    });

  } catch (error) {
    console.error('Resume work error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting break'
    });
  }
});

// @route   GET /api/clock/user/entries
// @desc    Get current user's time entries
// @access  Private (User)
router.get('/user/entries', authenticateSession, async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in /api/clock/user/entries. Authentication is missing or auth middleware not applied.');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user._id || req.user.userId || req.user.id;
    const { startDate, endDate } = req.query;

    let query = { employee: userId };

    // Date range filter - date field is stored as string (YYYY-MM-DD)
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const timeEntries = await TimeEntry.find(query)
      .populate('employee', 'firstName lastName email vtid')
      .populate('shiftId', 'startTime endTime location')
      .sort({ date: -1, clockIn: -1 })
      .limit(50) // Limit to recent entries
      .lean();

    // Process entries to add shift hours
    const processedEntries = timeEntries.map(entry => {
      let shiftHours = null;
      let shiftStartTime = null;
      let shiftEndTime = null;

      if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
        shiftHours = calculateScheduledHours(entry.shiftId.startTime, entry.shiftId.endTime);
        shiftStartTime = entry.shiftId.startTime;
        shiftEndTime = entry.shiftId.endTime;
      }

      return {
        ...entry,
        shiftHours: shiftHours ? shiftHours.toFixed(2) : null,
        shiftStartTime: shiftStartTime,
        shiftEndTime: shiftEndTime
      };
    });

    res.json({
      success: true,
      data: processedEntries
    });

  } catch (error) {
    console.error('Get user time entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching time entries'
    });
  }
});

// @route   DELETE /api/clock/entries/:id
// @desc    Delete a time entry (Admin only)
// @access  Private (Admin)
router.delete('/entries/:id', async (req, res) => {
  try {
    const entryId = req.params.id;

    // Find the time entry
    const timeEntry = await TimeEntry.findById(entryId);

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message: 'Time entry not found'
      });
    }

    // Delete the time entry
    await TimeEntry.findByIdAndDelete(entryId);

    res.json({
      success: true,
      message: 'Time entry deleted successfully'
    });

  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting time entry'
    });
  }
});

// @route   GET /api/clock/timesheet/:employeeId
// @desc    Get weekly timesheet data for an employee
// @access  Private (Admin)
router.get('/timesheet/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    console.log('📊 Fetching timesheet for employee:', employeeId);
    console.log('📅 Date range:', startDate, 'to', endDate);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Parse dates - TimeEntry.date is stored as String (YYYY-MM-DD format)
    const startDateStr = startDate; // Already in YYYY-MM-DD format
    const endDateStr = endDate;     // Already in YYYY-MM-DD format

    console.log('📅 Querying with date strings:', startDateStr, 'to', endDateStr);

    // Fetch time entries for the employee within the date range
    const timeEntries = await TimeEntry.find({
      employee: employeeId,
      date: {
        $gte: startDateStr,
        $lte: endDateStr
      }
    })
      .sort({ date: 1, clockIn: 1 }) // Sort by date, then by clock-in time for multiple sessions
      .lean();

    console.log(`✅ Found ${timeEntries.length} time entries`);

    // Manually populate employee data from EmployeesHub
    const employeeData = await EmployeesHub.findById(employeeId).select('firstName lastName email vtid').lean();

    if (!employeeData) {
      // Fallback to User model if not found in EmployeesHub
      const userData = await User.findById(employeeId).select('firstName lastName email vtid').lean();
      if (userData) {
        timeEntries.forEach(entry => {
          entry.employee = userData;
        });
      }
    } else {
      timeEntries.forEach(entry => {
        entry.employee = employeeData;
      });
    }

    // Populate shift data
    for (let entry of timeEntries) {
      if (entry.shiftId) {
        const Shift = require('../models/Shift');
        const shiftData = await Shift.findById(entry.shiftId).select('startTime endTime location').lean();
        entry.shiftId = shiftData;
      }
    }

    // Calculate statistics
    let totalHoursWorked = 0;
    let totalOvertime = 0;
    let totalNegativeHours = 0;

    const processedEntries = timeEntries.map(entry => {
      let hoursWorked = 0;
      let overtime = 0;
      let negativeHours = 0;

      // Calculate hours worked using the utility function
      if (entry.clockIn && entry.clockOut) {
        // Use the calculateHoursWorked utility which properly handles HH:mm format
        hoursWorked = parseFloat(calculateHoursWorked(entry.clockIn, entry.clockOut, entry.breaks || []));

        totalHoursWorked += hoursWorked;

        // Calculate overtime (if worked more than 8 hours)
        if (hoursWorked > 8) {
          overtime = hoursWorked - 8;
          totalOvertime += overtime;
        }

        // Calculate negative hours (if worked less than expected shift hours)
        if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
          const expectedHours = calculateScheduledHours(entry.shiftId.startTime, entry.shiftId.endTime);

          if (hoursWorked < expectedHours) {
            negativeHours = expectedHours - hoursWorked;
            totalNegativeHours += negativeHours;
          }
        }
      } else if (entry.clockIn && !entry.clockOut) {
        // Employee is still clocked in - calculate hours up to now
        const currentTime = new Date().toTimeString().slice(0, 5);
        hoursWorked = parseFloat(calculateHoursWorked(entry.clockIn, currentTime, entry.breaks || []));
      }

      // Calculate shift hours if shift data is available
      let shiftHours = null;
      let shiftStartTime = null;
      let shiftEndTime = null;

      if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
        shiftHours = calculateScheduledHours(entry.shiftId.startTime, entry.shiftId.endTime);
        shiftStartTime = entry.shiftId.startTime;
        shiftEndTime = entry.shiftId.endTime;
      }

      return {
        ...entry,
        hoursWorked: hoursWorked.toFixed(2),
        overtime: overtime.toFixed(2),
        negativeHours: negativeHours.toFixed(2),
        shiftHours: shiftHours ? shiftHours.toFixed(2) : null,
        shiftStartTime: shiftStartTime,
        shiftEndTime: shiftEndTime
      };
    });

    res.json({
      success: true,
      entries: processedEntries,
      statistics: {
        totalHoursWorked: totalHoursWorked.toFixed(2),
        totalOvertime: totalOvertime.toFixed(2),
        totalNegativeHours: totalNegativeHours.toFixed(2),
        totalDays: timeEntries.length
      }
    });

  } catch (error) {
    console.error('❌ Fetch timesheet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/employees/count
 * Get total count of active employees in the system
 * Uses employeeService.getActiveEmployeeCount for consistency with Home and Clock pages
 */
router.get('/employees/count', async (req, res) => {
  try {
    const includeProfiles = req.query.includeProfiles === 'true';
    const includeAdmins = req.query.includeAdmins !== 'false'; // Default to true
    
    const totalCount = await employeeService.getActiveEmployeeCount({
      includeProfiles,
      includeAdmins
    });

    res.json({
      success: true,
      total: totalCount
    });
  } catch (error) {
    console.error('Error fetching employee count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee count',
      error: error.message
    });
  }
});

/**
 * GET /api/clock/dashboard-stats
 * Get dashboard statistics for admin overview
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Get UK timezone date for today's records
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10); // YYYY-MM-DD format
    const today = moment().tz('Europe/London').startOf('day');

    // Get all employees count using employeeService for consistency
    const totalEmployees = await employeeService.getActiveEmployeeCount({
      includeProfiles: false,
      includeAdmins: true
    });

    // Get today's time entries
    const timeEntries = await TimeEntry.find({
      date: dateString
    }).populate('employee', 'firstName lastName email');

    // Count by status
    const activeEmployees = timeEntries.filter(entry => entry.status === 'clocked_in').length;
    const onBreakEmployees = timeEntries.filter(entry => entry.status === 'on_break').length;
    const offlineEmployees = totalEmployees - activeEmployees - onBreakEmployees;

    // Calculate absence/late statistics
    const Shift = require('../models/Shift');
    const ShiftAssignment = require('../models/ShiftAssignment');
    
    const todayShifts = await ShiftAssignment.find({
      date: {
        $gte: today.toDate(),
        $lt: today.clone().add(1, 'day').toDate()
      }
    }).populate('employeeId', 'firstName lastName email vtid');
    
    let absentCount = 0;
    let lateCount = 0;
    
    for (const shift of todayShifts) {
      if (!shift.employeeId || !shift.employeeId._id) continue;
      
      const employeeId = shift.employeeId._id;
      
      // Check if on leave
      const leaveToday = await LeaveRecord.findOne({
        user: employeeId,
        status: 'approved',
        startDate: { $lte: today.toDate() },
        endDate: { $gte: today.toDate() }
      });
      
      if (leaveToday) continue;
      
      // Check clock-in
      const clockInToday = await TimeEntry.findOne({
        employeeId: employeeId,
        date: {
          $gte: today.toDate(),
          $lt: today.clone().add(1, 'day').toDate()
        },
        clockIn: { $exists: true, $ne: null }
      }).sort({ clockIn: 1 });
      
      const [shiftHour, shiftMinute] = shift.startTime.split(':').map(Number);
      const shiftStartTime = today.clone().hour(shiftHour).minute(shiftMinute);
      const threeHoursAfterShift = shiftStartTime.clone().add(3, 'hours');
      
      if (!clockInToday) {
        const now = moment().tz('Europe/London');
        if (now.isAfter(threeHoursAfterShift)) {
          absentCount++;
        }
      } else {
        const clockInTime = moment(clockInToday.clockIn).tz('Europe/London');
        
        if (clockInTime.isAfter(shiftStartTime) && clockInTime.isSameOrBefore(threeHoursAfterShift)) {
          lateCount++;
        } else if (clockInTime.isAfter(threeHoursAfterShift)) {
          absentCount++;
        }
      }
    }

    // Get expiring certificates (example - you may need to adjust based on your Certificate model)
    let expiringCertificates = 0;
    try {
      const Certificate = require('../models/Certificate');
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      expiringCertificates = await Certificate.countDocuments({
        expiryDate: {
          $gte: new Date(),
          $lte: thirtyDaysFromNow
        },
        status: { $ne: 'expired' }
      });
    } catch (certError) {
      console.warn('Certificate count failed:', certError.message);
    }

    res.json({
      totalEmployees,
      activeEmployees,
      onBreakEmployees,
      offlineEmployees,
      absentEmployees: absentCount,
      lateEmployees: lateCount,
      totalCertificates: 0, // Placeholder
      expiringCertificates
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

router.get('/compliance-insights', async (req, res) => {
  try {
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10);
    const today = moment().tz('Europe/London').startOf('day');
    const now = moment().tz('Europe/London');

    // Use unified employee service for consistent counting
    const totalEmployeesCount = await employeeService.getActiveEmployeeCount({
      includeProfiles: false,
      includeAdmins: true
    });

    // Get employee details for display (using same service logic)
    const employees = await employeeService.getActiveEmployees({
      includeProfiles: false,
      includeAdmins: true
    });

    const activeEntries = await TimeEntry.find({
      date: dateString,
      status: { $in: ['clocked_in', 'on_break', 'clocked-in', 'break'] }
    })
      .populate('employee', 'firstName lastName email employeeId department jobTitle')
      .sort({ clockIn: 1 })
      .lean();

    const activeEmployees = activeEntries
      .map(e => e.employee)
      .filter(Boolean);

    const ShiftAssignment = require('../models/ShiftAssignment');
    const todayStart = today.toDate();
    const todayEnd = today.clone().add(1, 'day').toDate();

    const todayAssignments = await ShiftAssignment.find({
      date: { $gte: todayStart, $lt: todayEnd }
    })
      .populate('employeeId', 'firstName lastName email employeeId department jobTitle')
      .lean();

    const assignmentEmployeeIds = Array.from(
      new Set(
        todayAssignments
          .map(a => a.employeeId?._id)
          .filter(Boolean)
          .map(id => id.toString())
      )
    );

    const leaveRecords = await LeaveRecord.find({
      user: { $in: assignmentEmployeeIds },
      status: 'approved',
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart }
    })
      .select('user')
      .lean();
    const leaveUserSet = new Set(leaveRecords.map(r => r.user?.toString()).filter(Boolean));

    const timeEntriesForAssignments = await TimeEntry.find({
      employee: { $in: assignmentEmployeeIds },
      date: dateString
    })
      .select('employee clockIn status')
      .lean();

    const timeEntryByEmployeeId = new Map();
    for (const entry of timeEntriesForAssignments) {
      if (!entry.employee) continue;
      const key = entry.employee.toString();
      if (!timeEntryByEmployeeId.has(key)) {
        timeEntryByEmployeeId.set(key, entry);
      }
    }

    const absentees = [];
    for (const assignment of todayAssignments) {
      const employee = assignment.employeeId;
      if (!employee?._id) continue;
      const employeeId = employee._id.toString();
      if (leaveUserSet.has(employeeId)) continue;

      if (!assignment.startTime || typeof assignment.startTime !== 'string') continue;
      const [shiftHour, shiftMinute] = assignment.startTime.split(':').map(Number);
      if (Number.isNaN(shiftHour) || Number.isNaN(shiftMinute)) continue;

      const shiftStartTime = today.clone().hour(shiftHour).minute(shiftMinute).second(0).millisecond(0);
      const cutoff = shiftStartTime.clone().add(2, 'hours');

      if (now.isSameOrBefore(cutoff)) {
        continue;
      }

      const timeEntry = timeEntryByEmployeeId.get(employeeId);
      const clockInTime = timeEntry?.clockIn ? moment(timeEntry.clockIn).tz('Europe/London') : null;

      if (!clockInTime || clockInTime.isAfter(cutoff)) {
        absentees.push({
          employee,
          shiftName: assignment.shiftName || '',
          startTime: assignment.startTime,
          endTime: assignment.endTime || '',
          location: assignment.location || '',
          workType: assignment.workType || '',
          clockIn: clockInTime ? clockInTime.toISOString() : null
        });
      }
    }

    const pendingExpenseApprovals = await Expense.find({ status: 'pending' })
      .populate('employee', 'firstName lastName email employeeId department jobTitle')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const pendingLeaveApprovals = await LeaveRequest.find({ status: 'Pending' })
      .populate('employeeId', 'firstName lastName email employeeId department jobTitle')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: {
        totalEmployees: {
          count: totalEmployeesCount,
          employees
        },
        activeEmployees: {
          count: activeEmployees.length,
          employees: activeEmployees
        },
        absentees: {
          count: absentees.length,
          employees: absentees
        },
        expenseApprovals: {
          count: await Expense.countDocuments({ status: 'pending' }),
          expenses: pendingExpenseApprovals
        },
        leaveApprovals: {
          count: await LeaveRequest.countDocuments({ status: 'Pending' }),
          leaveRequests: pendingLeaveApprovals
        }
      }
    });
  } catch (error) {
    console.error('Error fetching compliance insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch compliance insights',
      error: error.message
    });
  }
});

/**
 * POST /api/clock/force-reset/:employeeId
 * Force reset an employee's clock status (admin only)
 */
router.post('/force-reset/:employeeId', authenticateSession, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Use UK timezone for today's date
    const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const dateString = ukNow.toISOString().slice(0, 10);

    console.log('🔧 Force reset requested for employee:', employeeId, 'date:', dateString);

    // Find and reset today's time entry
    const timeEntry = await TimeEntry.findOne({
      $or: [
        { employee: employeeId },
        { employee: employeeId }
      ],
      date: dateString,
      status: { $in: ['clocked_in', 'on_break'] }
    });

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message: 'No active time entry found for this employee today'
      });
    }

    console.log('✅ Found time entry to reset:', {
      entryId: timeEntry._id,
      currentStatus: timeEntry.status,
      clockIn: timeEntry.clockIn
    });

    // Force clock out
    const currentTime = ukNow.toTimeString().slice(0, 5);
    timeEntry.clockOut = ukNow;
    timeEntry.status = 'clocked_out';
    timeEntry.onBreakStart = null;

    // Calculate hours
    const clockInTime = timeEntry.clockIn instanceof Date
      ? timeEntry.clockIn.toTimeString().slice(0, 5)
      : timeEntry.clockIn;

    const hoursWorked = calculateHoursWorked(clockInTime, currentTime, timeEntry.breaks || []);
    timeEntry.hoursWorked = hoursWorked;
    timeEntry.totalHours = hoursWorked;

    if (timeEntry.scheduledHours && timeEntry.scheduledHours > 0) {
      timeEntry.variance = hoursWorked - timeEntry.scheduledHours;
    } else {
      timeEntry.variance = 0;
    }

    await timeEntry.save();

    console.log('✅ Time entry force reset complete:', {
      entryId: timeEntry._id,
      newStatus: timeEntry.status,
      hoursWorked
    });

    res.json({
      success: true,
      message: 'Employee clock status has been reset',
      data: timeEntry
    });

  } catch (error) {
    console.error('Error forcing clock reset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset clock status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/clock/attendance-status
 * @desc    Get attendance status (on-time, late, absent) for employees with shifts today
 * @access  Admin
 * @businessRules
 *   - ON-TIME: Clock-in BEFORE shift.startTime
 *   - LATE: Clock-in AFTER shift.startTime BUT WITHIN 3 hours
 *   - ABSENT: NO clock-in OR clock-in AFTER 3 hours from shift.startTime
 */
router.get('/attendance-status', authenticateSession, asyncHandler(async (req, res) => {
  try {
    const Shift = require('../models/Shift');
    const ShiftAssignment = require('../models/ShiftAssignment');
    
    // Get today's date at start of day (normalize timezone)
    const today = moment().tz('Europe/London').startOf('day');
    const todayStr = today.format('YYYY-MM-DD');
    
    console.log(`📊 Calculating attendance status for ${todayStr}`);
    
    // Find all shift assignments for today
    const todayShifts = await ShiftAssignment.find({
      date: {
        $gte: today.toDate(),
        $lt: today.clone().add(1, 'day').toDate()
      }
    }).populate('employeeId', 'firstName lastName email vtid');
    
    console.log(`✅ Found ${todayShifts.length} shifts scheduled for today`);
    
    const onTimeEmployees = [];
    const lateEmployees = [];
    const absentEmployees = [];
    
    for (const shift of todayShifts) {
      // Skip if no employee assigned
      if (!shift.employeeId || !shift.employeeId._id) {
        console.log(`⚠️ Shift ${shift._id} has no employee assigned`);
        continue;
      }
      
      const employeeId = shift.employeeId._id;
      const employeeName = `${shift.employeeId.firstName} ${shift.employeeId.lastName}`;
      
      // Check if employee is on approved leave today
      const leaveToday = await LeaveRecord.findOne({
        user: employeeId,
        status: 'approved',
        startDate: { $lte: today.toDate() },
        endDate: { $gte: today.toDate() }
      });
      
      if (leaveToday) {
        console.log(`🏖️ ${employeeName} is on approved leave - skipping`);
        continue;
      }
      
      // Check if employee has clocked in today
      const clockInToday = await TimeEntry.findOne({
        employeeId: employeeId,
        date: {
          $gte: today.toDate(),
          $lt: today.clone().add(1, 'day').toDate()
        },
        clockIn: { $exists: true, $ne: null }
      }).sort({ clockIn: 1 }); // Get first clock-in of the day
      
      // Parse shift start time
      const [shiftHour, shiftMinute] = shift.startTime.split(':').map(Number);
      const shiftStartTime = today.clone().hour(shiftHour).minute(shiftMinute);
      const threeHoursAfterShift = shiftStartTime.clone().add(3, 'hours');
      
      const employeeData = {
        employeeId: employeeId,
        name: employeeName,
        email: shift.employeeId.email,
        vtid: shift.employeeId.vtid,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        location: shift.location
      };
      
      if (!clockInToday) {
        // No clock-in = ABSENT (only if shift start time has passed by 3 hours)
        const now = moment().tz('Europe/London');
        if (now.isAfter(threeHoursAfterShift)) {
          employeeData.status = 'ABSENT';
          employeeData.reason = 'No clock-in recorded';
          absentEmployees.push(employeeData);
          console.log(`❌ ${employeeName} - ABSENT (no clock-in, 3+ hours past shift)`);
        } else {
          // Shift hasn't started yet or within grace period - don't mark as absent yet
          console.log(`⏳ ${employeeName} - Waiting (shift starts at ${shift.startTime}, currently within grace period)`);
        }
      } else {
        // Employee clocked in - check if on-time or late
        const clockInTime = moment(clockInToday.clockIn).tz('Europe/London');
        employeeData.clockInTime = clockInTime.format('HH:mm');
        
        if (clockInTime.isSameOrBefore(shiftStartTime)) {
          // ON-TIME
          employeeData.status = 'ON_TIME';
          onTimeEmployees.push(employeeData);
          console.log(`✅ ${employeeName} - ON-TIME (clocked in at ${employeeData.clockInTime})`);
        } else if (clockInTime.isAfter(shiftStartTime) && clockInTime.isSameOrBefore(threeHoursAfterShift)) {
          // LATE (within 3 hours)
          const minutesLate = clockInTime.diff(shiftStartTime, 'minutes');
          employeeData.status = 'LATE';
          employeeData.minutesLate = minutesLate;
          employeeData.reason = `${minutesLate} minutes late`;
          lateEmployees.push(employeeData);
          console.log(`⚠️ ${employeeName} - LATE (${minutesLate} minutes)`);
        } else {
          // Clocked in MORE than 3 hours after shift start = ABSENT
          const minutesLate = clockInTime.diff(shiftStartTime, 'minutes');
          employeeData.status = 'ABSENT';
          employeeData.reason = `Clocked in ${minutesLate} minutes after shift start (>3 hours)`;
          employeeData.clockInTime = clockInTime.format('HH:mm');
          absentEmployees.push(employeeData);
          console.log(`❌ ${employeeName} - ABSENT (clocked in ${minutesLate} minutes late)`);
        }
      }
    }
    
    const summary = {
      date: todayStr,
      totalScheduled: todayShifts.length,
      onTime: onTimeEmployees.length,
      late: lateEmployees.length,
      absent: absentEmployees.length
    };
    
    console.log('📊 Attendance Summary:', summary);
    
    res.json({
      success: true,
      data: {
        summary,
        onTimeEmployees,
        lateEmployees,
        absentEmployees
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating attendance status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate attendance status',
      error: error.message
    });
  }
}));

module.exports = router;
