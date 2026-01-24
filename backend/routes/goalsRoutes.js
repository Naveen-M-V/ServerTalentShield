const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');

/**
 * User goals endpoints
 */

// Get user's goals
router.get('/my', goalsController.getUserGoals);

// Get goals summary (admin only) - MUST be before /:id routes
router.get('/summary/all', goalsController.getGoalsSummary);

// Create new goal
router.post('/', goalsController.createGoal);

// Update goal (user can update own unapproved goals)
router.put('/:id', goalsController.updateGoal);

// Delete goal (user can delete own unapproved goals)
router.delete('/:id', goalsController.deleteGoal);

/**
 * Admin-only endpoints
 */

// Approve goal (admin only)
router.post('/:id/approve', goalsController.approveGoal);

// Add comment to goal (admin only)
router.post('/:id/comment', goalsController.addCommentToGoal);

// Get all goals (admin only) - MUST be last
router.get('/', goalsController.getAllGoals);

module.exports = router;
