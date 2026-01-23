const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');

// Goal routes
router.get('/goals', performanceController.getAllGoals);
router.get('/goals/my-goals', performanceController.getMyGoals);
router.get('/goals/:id', performanceController.getGoalById);
router.post('/goals', performanceController.createGoal);
router.put('/goals/:id', performanceController.updateGoal);
router.delete('/goals/:id', performanceController.deleteGoal);

// ⚠️ DEPRECATED: Review routes moved to /api/reviews endpoint
// DO NOT USE /api/performance/reviews* - Use /api/reviews* instead
// Routes kept commented for reference only
/*
router.get('/reviews', performanceController.getAllReviews);
router.get('/reviews/my-reviews', performanceController.getMyReviews);
router.get('/reviews/:id', performanceController.getReviewById);
router.put('/reviews/:id', performanceController.updateReview);
router.delete('/reviews/:id', performanceController.deleteReview);
*/

// Performance Notes
router.post('/notes', performanceController.createNote);
router.get('/notes/:employeeId', performanceController.getNotesForEmployee);
router.delete('/notes/:id', performanceController.deleteNote);

// Disciplinary records
router.post('/disciplinary', performanceController.createDisciplinary);
router.get('/disciplinary/:employeeId', performanceController.getDisciplinaryForEmployee);

// Improvement plans (PIP)
router.post('/pips', performanceController.createImprovementPlan);
router.get('/pips/:employeeId', performanceController.getImprovementPlansForEmployee);

module.exports = router;
