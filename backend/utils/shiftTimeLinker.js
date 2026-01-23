const ShiftAssignment = require('../models/ShiftAssignment');
const TimeEntry = require('../models/TimeEntry');

/**
 * Shift Time Linker Utility
 * Links clock-in/out records with shift assignments
 * Validates timing and calculates attendance status
 */

/**
 * Find matching shift for an employee on a specific date
 * @param {String} employeeId - Employee's user ID
 * @param {Date} date - Date to check
 * @param {String} location - Clock-in location
 * @returns {Object|null} Matching shift or null
 */
const findMatchingShift = async (employeeId, date, location = null) => {
  try {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const query = {
      employeeId,
      date: { $gte: dateStart, $lte: dateEnd },
      status: { $in: ['Scheduled', 'In Progress'] }
    };

    // Optional location matching
    if (location) {
      // Try exact match first
      let shift = await ShiftAssignment.findOne({ ...query, location });
      if (shift) return shift;
      
      // If no exact match, find any shift for that day
      shift = await ShiftAssignment.findOne(query);
      if (shift) {
        // Return shift with location mismatch flag
        shift._locationMismatch = true;
        return shift;
      }
    }

    // Find any scheduled shift for the day
    return await ShiftAssignment.findOne(query);
  } catch (error) {
    console.error('Find matching shift error:', error);
    return null;
  }
};

/**
 * Validate clock-in time against shift
 * @param {String} clockInTime - Time in HH:MM format
 * @param {Object} shift - Shift assignment object
 * @param {Number} bufferMinutes - Tolerance in minutes (default 15)
 * @returns {Object} { status, minutesLate, isValid }
 */
const validateClockIn = (clockInTime, shift, bufferMinutes = 15) => {
  try {
    const clockIn = new Date(`2000-01-01T${clockInTime}`);
    const shiftStart = new Date(`2000-01-01T${shift.startTime}`);
    const shiftEnd = new Date(`2000-01-01T${shift.endTime}`);
    
    // Calculate difference in minutes
    const diffMinutes = (clockIn - shiftStart) / (1000 * 60);
    
    // Determine status
    if (diffMinutes < -bufferMinutes) {
      // Clocked in more than buffer before shift
      return {
        status: 'Early',
        minutesLate: Math.abs(diffMinutes),
        isValid: true,
        message: `Clocked in ${Math.abs(Math.round(diffMinutes))} minutes early`
      };
    } else if (diffMinutes <= bufferMinutes) {
      // Within acceptable range
      return {
        status: 'On Time',
        minutesLate: 0,
        isValid: true,
        message: 'Clocked in on time'
      };
    } else if (diffMinutes <= 60) {
      // Late but within 1 hour
      return {
        status: 'Late',
        minutesLate: diffMinutes,
        isValid: true,
        message: `Clocked in ${Math.round(diffMinutes)} minutes late`
      };
    } else {
      // Very late (more than 1 hour)
      return {
        status: 'Late',
        minutesLate: diffMinutes,
        isValid: true,
        requiresApproval: true,
        message: `Clocked in ${Math.round(diffMinutes)} minutes late - requires manager approval`
      };
    }
  } catch (error) {
    console.error('Validate clock-in error:', error);
    return {
      status: 'On Time',
      minutesLate: 0,
      isValid: true,
      message: 'Clock-in validated'
    };
  }
};

/**
 * Calculate hours worked between clock-in and clock-out
 * @param {String} clockIn - Clock-in time (HH:MM)
 * @param {String} clockOut - Clock-out time (HH:MM)
 * @param {Array} breaks - Array of break objects with duration
 * @returns {Number} Hours worked (decimal)
 */
const calculateHoursWorked = (clockIn, clockOut, breaks = []) => {
  try {
    const clockInTime = new Date(`2000-01-01T${clockIn}`);
    const clockOutTime = new Date(`2000-01-01T${clockOut}`);
    
    // Calculate total minutes
    let totalMinutes = (clockOutTime - clockInTime) / (1000 * 60);
    
    // Subtract break time
    const totalBreakMinutes = breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    totalMinutes -= totalBreakMinutes;
    
    // Convert to hours (rounded to 2 decimals)
    return Math.round((totalMinutes / 60) * 100) / 100;
  } catch (error) {
    console.error('Calculate hours error:', error);
    return 0;
  }
};

/**
 * Calculate scheduled hours from shift or two time strings
 * @param {Object|String} shiftOrStartTime - Shift object OR startTime string in HH:MM format
 * @param {String} endTime - endTime string in HH:MM format (only if first param is string)
 * @returns {Number} Scheduled hours (decimal)
 */
const calculateScheduledHours = (shiftOrStartTime, endTime) => {
  try {
    let startTime, finalEndTime;
    
    // Handle both function signatures
    if (typeof shiftOrStartTime === 'string') {
      // Called with (startTime, endTime) as strings
      startTime = shiftOrStartTime;
      finalEndTime = endTime;
    } else if (typeof shiftOrStartTime === 'object' && shiftOrStartTime !== null) {
      // Called with shift object
      startTime = shiftOrStartTime.startTime;
      finalEndTime = shiftOrStartTime.endTime;
    } else {
      console.warn('calculateScheduledHours: Invalid parameters');
      return 8; // Default 8 hours
    }
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${finalEndTime}`);
    
    let totalMinutes = (end - start) / (1000 * 60);
    
    // Subtract break duration if shift object was provided
    if (typeof shiftOrStartTime === 'object' && shiftOrStartTime !== null) {
      totalMinutes -= shiftOrStartTime.breakDuration || 0;
    }
    
    return Math.round((totalMinutes / 60) * 100) / 100;
  } catch (error) {
    console.error('Calculate scheduled hours error:', error);
    return 8; // Default 8 hours
  }
};

/**
 * Update shift status
 * @param {String} shiftId - Shift assignment ID
 * @param {String} status - New status
 * @param {Object} additionalData - Additional fields to update
 * @returns {Object} Updated shift or null if error
 */
const updateShiftStatus = async (shiftId, status, additionalData = {}) => {
  try {
    if (!shiftId) {
      console.warn('updateShiftStatus: No shiftId provided');
      return null;
    }
    
    const updateData = { status, ...additionalData };
    
    const shift = await ShiftAssignment.findByIdAndUpdate(
      shiftId,
      updateData,
      { new: true }
    );
    
    if (!shift) {
      console.warn('updateShiftStatus: Shift not found for ID:', shiftId);
      return null;
    }
    
    return shift;
  } catch (error) {
    console.error('Update shift status error:', error.message);
    // Return null instead of throwing - don't block clock operations
    return null;
  }
};

/**
 * Link time entry to shift
 * Creates bidirectional reference
 * @param {String} timeEntryId - Time entry ID
 * @param {String} shiftId - Shift assignment ID
 * @returns {Object} { timeEntry, shift }
 */
const linkTimeEntryToShift = async (timeEntryId, shiftId) => {
  try {
    // Update time entry with shift reference
    const timeEntry = await TimeEntry.findByIdAndUpdate(
      timeEntryId,
      { shiftId },
      { new: true }
    );
    
    // Update shift with time entry reference
    const shift = await ShiftAssignment.findByIdAndUpdate(
      shiftId,
      { timeEntryId },
      { new: true }
    );
    
    return { timeEntry, shift };
  } catch (error) {
    console.error('Link time entry to shift error:', error);
    throw error;
  }
};

/**
 * Mark missed shifts (scheduled but no clock-in)
 * Should be run as a daily cron job
 * @param {Date} date - Date to check (default: yesterday)
 * @returns {Number} Number of shifts marked as missed
 */
const markMissedShifts = async (date = null) => {
  try {
    const checkDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    checkDate.setHours(0, 0, 0, 0);
    const endDate = new Date(checkDate);
    endDate.setHours(23, 59, 59, 999);
    
    // Find all scheduled shifts for that day
    const scheduledShifts = await ShiftAssignment.find({
      date: { $gte: checkDate, $lte: endDate },
      status: 'Scheduled'
    });
    
    let missedCount = 0;
    
    for (const shift of scheduledShifts) {
      // Check if there's a time entry for this shift
      const timeEntry = await TimeEntry.findOne({
        employee: shift.employeeId,
        date: { $gte: checkDate, $lte: endDate }
      });
      
      if (!timeEntry) {
        // No clock-in found - mark as missed
        await ShiftAssignment.findByIdAndUpdate(shift._id, {
          status: 'Missed'
        });
        missedCount++;
      }
    }
    
    return missedCount;
  } catch (error) {
    console.error('Mark missed shifts error:', error);
    return 0;
  }
};

/**
 * Get attendance summary for an employee
 * @param {String} employeeId - Employee user ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Summary statistics
 */
const getAttendanceSummary = async (employeeId, startDate, endDate) => {
  try {
    const timeEntries = await TimeEntry.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });
    
    const summary = {
      totalDays: timeEntries.length,
      onTime: timeEntries.filter(e => e.attendanceStatus === 'On Time').length,
      late: timeEntries.filter(e => e.attendanceStatus === 'Late').length,
      early: timeEntries.filter(e => e.attendanceStatus === 'Early').length,
      unscheduled: timeEntries.filter(e => e.attendanceStatus === 'Unscheduled').length,
      totalHours: timeEntries.reduce((sum, e) => sum + e.hoursWorked, 0),
      averageHours: 0
    };
    
    if (summary.totalDays > 0) {
      summary.averageHours = Math.round((summary.totalHours / summary.totalDays) * 100) / 100;
    }
    
    return summary;
  } catch (error) {
    console.error('Get attendance summary error:', error);
    return null;
  }
};

module.exports = {
  findMatchingShift,
  validateClockIn,
  calculateHoursWorked,
  calculateScheduledHours,
  updateShiftStatus,
  linkTimeEntryToShift,
  markMissedShifts,
  getAttendanceSummary
};
