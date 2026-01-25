const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const Review = require('../models/Review');

// Admin roles that have full permissions for reviews
// These roles from EmployeeHub table can create, view, and manage all reviews
const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
// Manager roles include all admin roles plus regular managers
// This ensures admin/super-admin from EmployeeHub have the same access as managers
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const getUserId = (req) => req.user?._id || req.user?.id || req.session?.userId;
const getUserRole = (req) => req.user?.role || req.session?.role;
const isManager = (req) => MANAGER_ROLES.includes(getUserRole(req));

const requireManager = (req, res, next) => {
  const userRole = getUserRole(req);
  const isManagerCheck = isManager(req);
  
  console.log('🔑 Manager access check:', {
    userRole,
    isManager: isManagerCheck,
    isAdmin: ADMIN_ROLES.includes(userRole),
    isSuperAdmin: userRole === 'super-admin',
    userType: req.user?.userType
  });
  
  if (!isManagerCheck) {
    console.log('❌ Access denied - user is not a manager/admin/hr');
    return res.status(403).json({
      success: false,
      message: 'Manager/HR access required'
    });
  }
  
  console.log('✅ Manager access granted');
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

    // Managers can always access
    if (isManager(req)) {
      req.review = review;
      return next();
    }

    // For employees, check ownership - but need to resolve employee ID properly
    // Since this involves DB lookup, we'll pass the review and let controller validate
    // Controller has proper resolveEmployeeForRequest function
    
    // Block access to DRAFT reviews for non-managers
    if (review.status === 'DRAFT') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view draft reviews'
      });
    }

    // Pass review to controller for ownership validation
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
    // Block managers from using this endpoint
    if (isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only employees can add comments'
      });
    }

    // Fetch review and validate it exists
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Validate review is in SUBMITTED status
    if (review.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'You can only comment on submitted reviews'
      });
    }

    // Pass review to controller - it will validate ownership with proper employee resolution
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
