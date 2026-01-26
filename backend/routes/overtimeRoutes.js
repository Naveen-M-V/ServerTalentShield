const express = require('express');
const router = express.Router();
const overtimeController = require('../controllers/overtimeController');

// Employee Routes
router.post('/entry', overtimeController.createOvertimeEntry);
router.get('/employee/:employeeId', overtimeController.getEmployeeOvertime);

// Admin Routes
router.get('/pending', overtimeController.getAllPendingOvertime);
router.put('/approve/:overtimeId', overtimeController.approveOvertime);
router.put('/reject/:overtimeId', overtimeController.rejectOvertime);

module.exports = router;
