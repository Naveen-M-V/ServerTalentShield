const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const { authenticateSession } = require('../middleware/authenticateSession');
const {
  canAccessReview,
  canEditSelfAssessment,
  canSubmitManagerFeedback,
  preventAdminFieldsEdit
} = require('../middleware/goalsReviewsRBAC');

// All routes require authentication
router.use(authenticateSession);

/**
 * User review endpoints
 */

// Get user's reviews (history)
router.get('/my', reviewsController.getUserReviews);

/**
 * Admin-only endpoints
 */

// Initiate review for employee (admin only) - Must be before /:id
router.post('/initiate', reviewsController.initiateReview);

/**
 * Dynamic routes - MUST be last
 */

// Get specific review
router.get('/:id', canAccessReview, reviewsController.getReview);

// Submit self-assessment
router.post('/:id/self', canEditSelfAssessment, reviewsController.submitSelfAssessment);

// Submit manager feedback (admin only)
router.post('/:id/manager', canSubmitManagerFeedback, reviewsController.submitManagerFeedback);

// Advance review status (admin only)
router.post('/:id/status', reviewsController.advanceReviewStatus);

// Get all reviews with filters (admin only) - Must be last GET
router.get('/', reviewsController.getAllReviews);

module.exports = router;
