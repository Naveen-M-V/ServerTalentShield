const express = require('express');
const router = express.Router();
const reportLibraryController = require('../controllers/reportLibraryController');

// Get all available report types
router.get('/types', reportLibraryController.getReportTypes);

// Absence Report
router.post('/absence', reportLibraryController.generateAbsenceReport);

// Annual Leave Report
router.post('/annual-leave', reportLibraryController.generateAnnualLeaveReport);

// Lateness Report
router.post('/lateness', reportLibraryController.generateLatenessReport);

// Overtime Report
router.post('/overtime', reportLibraryController.generateOvertimeReport);

// Rota Report
router.post('/rota', reportLibraryController.generateRotaReport);

// Sickness Report
router.post('/sickness', reportLibraryController.generateSicknessReport);

// Employee Details Report
router.post('/employee-details', reportLibraryController.generateEmployeeDetailsReport);

// Payroll Exceptions Report
router.post('/payroll-exceptions', reportLibraryController.generatePayrollExceptionsReport);

// Expenses Report
router.post('/expenses', reportLibraryController.generateExpensesReport);

// Length of Service Report
router.post('/length-of-service', reportLibraryController.generateLengthOfServiceReport);

// Turnover & Retention Report
router.post('/turnover', reportLibraryController.generateTurnoverReport);

// Working Status Report
router.post('/working-status', reportLibraryController.generateWorkingStatusReport);

// Sensitive Information Report
router.post('/sensitive-info', reportLibraryController.generateSensitiveInfoReport);

// Furloughed Employees Report
router.post('/furloughed', reportLibraryController.generateFurloughedReport);

// Export routes (CSV/PDF) - POST to send report data
router.post('/export/csv', reportLibraryController.exportReportCSV);
router.post('/export/pdf', reportLibraryController.exportReportPDF);

module.exports = router;
