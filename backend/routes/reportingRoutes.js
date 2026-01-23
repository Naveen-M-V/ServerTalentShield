const express = require('express');
const router = express.Router();
const reportingController = require('../controllers/reportingController');

// @route   GET /api/reports/leave-trends
// @desc    Get leave trends report with monthly breakdown and top leave takers
// @access  Private (Manager/Admin)
router.get('/leave-trends', reportingController.getLeaveTrendsReport);

// @route   GET /api/reports/shift-coverage
// @desc    Get shift coverage report with daily coverage and overtime stats
// @access  Private (Manager/Admin)
router.get('/shift-coverage', reportingController.getShiftCoverageReport);

// @route   GET /api/reports/attendance-summary
// @desc    Get attendance summary with punctuality metrics
// @access  Private (Manager/Admin)
router.get('/attendance-summary', reportingController.getAttendanceSummaryReport);

// @route   GET /api/reports/employee-productivity
// @desc    Get employee productivity metrics
// @access  Private (Manager/Admin)
router.get('/employee-productivity', reportingController.getEmployeeProductivity);

module.exports = router;
