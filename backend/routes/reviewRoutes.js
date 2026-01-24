const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const Review = require('../models/Review');

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const getUserId = (req) => req.user?._id || req.user?.id || req.session?.userId;
const getUserRole = (req) => req.user?.role || req.session?.role;
const isManager = (req) => MANAGER_ROLES.includes(getUserRole(req));

const requireManager = (req, res, next) => {
  if (!isManager(req)) {
    return res.status(403).json({
      success: false,
      message: 'Manager/HR access required'
    });
  }
  next();
};

const canAccessReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (isManager(req)) {
      req.review = review;
      return next();
    }

    const userId = getUserId(req);
    const isOwner = userId && review.employeeId?.toString() === userId.toString();
    if (!isOwner || review.status === 'DRAFT') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this review'
      });
    }

    req.review = review;
    next();
  } catch (error) {
    console.error('Review access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authorize review access'
    });
  }
};

const requireDraftAndManager = async (req, res, next) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Only draft reviews can be edited'
      });
    }

    req.review = review;
    next();
  } catch (error) {
    console.error('Review draft check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authorize review edit'
    });
  }
};

const requireSubmittedAndManager = async (req, res, next) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted reviews can be closed'
      });
    }

    req.review = review;
    next();
  } catch (error) {
    console.error('Review submitted check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authorize review close'
    });
  }
};

const requireEmployeeSubmitted = async (req, res, next) => {
  try {
    if (isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only employees can add comments'
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const userId = getUserId(req);
    const isOwner = userId && review.employeeId?.toString() === userId.toString();
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only comment on your own reviews'
      });
    }

    if (review.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'You can only comment on submitted reviews'
      });
    }

    req.review = review;
    next();
  } catch (error) {
    console.error('Review comment auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authorize employee comment'
    });
  }
};

/**
 * User review endpoints
 */

router.get('/my', reviewsController.getMyReviews);

router.get('/', requireManager, reviewsController.listReviews);

router.post('/', requireManager, reviewsController.createReview);

router.get('/:id', canAccessReview, reviewsController.getReview);

router.put('/:id', requireDraftAndManager, reviewsController.updateReview);

router.post('/:id/submit', requireDraftAndManager, reviewsController.submitReview);

router.post('/:id/comment', requireEmployeeSubmitted, reviewsController.addEmployeeComment);

router.post('/:id/close', requireSubmittedAndManager, reviewsController.closeReview);

module.exports = router;
