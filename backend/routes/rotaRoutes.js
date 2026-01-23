const express = require('express');
const router = express.Router();
const rotaController = require('../controllers/rotaController');
const { validateShiftAssignment, validateBulkShiftAssignments } = require('../middleware/shiftValidation');

router.post('/generate', rotaController.generateRota);
router.post('/init-shifts', rotaController.initializeShifts);

// Shift Assignment Routes (with leave validation)
router.post('/assign-shift', validateShiftAssignment, rotaController.assignShiftToEmployee); // NEW: Direct assign-shift route
router.post('/shift-assignments', validateShiftAssignment, rotaController.assignShiftToEmployee); // Legacy route for backward compatibility

router.get('/shift-assignments/all', rotaController.getAllShiftAssignments);
router.get('/shift-assignments/grouped', rotaController.getGroupedShiftAssignments);
router.get('/shift-assignments/statistics', rotaController.getShiftStatistics);
router.get('/shift-assignments/location/:location', rotaController.getShiftsByLocation);
router.get('/shift-assignments/employee/:employeeId', rotaController.getEmployeeShifts);

router.put('/shift-assignments/:shiftId', rotaController.updateShiftAssignment);
router.delete('/shift-assignments/:shiftId', rotaController.deleteShiftAssignment);
router.delete('/shift-assignments/group/:groupId', rotaController.deleteShiftAssignmentGroup);

router.post('/shift-assignments/:shiftId/swap-request', rotaController.requestShiftSwap);
router.post('/shift-assignments/:shiftId/swap-approve', rotaController.approveShiftSwap);

// Rota Routes
router.get('/all', rotaController.getAllRotas);
router.get('/active', rotaController.getActiveRotas);
router.get('/old', rotaController.getOldRotas);
router.get('/', rotaController.getAllRota);
router.get('/:employeeId', rotaController.getEmployeeRota);
router.put('/:rotaId', rotaController.updateRota);
router.delete('/:rotaId', rotaController.deleteRota);

module.exports = router;
