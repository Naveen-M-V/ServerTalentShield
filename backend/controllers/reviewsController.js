/**
 * Reviews Controller
 * 
 * Handles performance review workflow:
 * 1. User submits self-assessment
 * 2. Manager/Admin submits feedback
 * 3. Review completed
 */

const Review = require('../models/Review');
const EmployeeHub = require('../models/EmployeesHub');

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const getUserId = (req) => req.user?._id || req.user?.id || req.session?.userId;
const getUserRole = (req) => req.user?.role || req.session?.role;
const isManager = (req) => MANAGER_ROLES.includes(getUserRole(req));
const getUserModel = (req) => (req.user?.userType === 'profile' ? 'User' : 'EmployeeHub');

const validateReviewType = (reviewType) => ['ANNUAL', 'PROBATION', 'AD_HOC'].includes(reviewType);
const trimOrNull = (v) => {
  if (typeof v !== 'string') return v ?? null;
  const t = v.trim();
  return t ? t : null;
};

const validateRatingOrNull = (rating) => {
  if (rating === null || rating === undefined || rating === '') return null;
  const n = Number(rating);
  if (!Number.isFinite(n) || n < 1 || n > 5) return '__INVALID__';
  return n;
};

/**
 * Get user's reviews (history)
 * GET /api/reviews/my
 */
exports.getMyReviews = async (req, res) => {
  try {
    const employeeId = getUserId(req);
    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const query = { employeeId };
    const reviews = await Review.find(query)
      .select('-__v')
      .populate('employeeId', 'firstName lastName email department employeeId')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = reviews.filter((r) => r.status !== 'DRAFT');

    res.json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('Error fetching my reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
};

exports.listReviews = async (req, res) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const { status, employeeId, reviewType } = req.query;
    const query = {};
    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;
    if (reviewType) query.reviewType = reviewType;

    const reviews = await Review.find(query)
      .select('-__v')
      .populate('employeeId', 'firstName lastName email department employeeId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
};

/**
 * Get a specific review
 * GET /api/reviews/:id
 */
exports.getReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const review = await Review.findById(id)
      .populate('employeeId', 'firstName lastName email department employeeId');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const managerView = isManager(req);
    if (!managerView) {
      const isOwner = userId && review.employeeId?._id?.toString() === userId.toString();
      if (!isOwner || review.status === 'DRAFT') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this review'
        });
      }
    }

    const payload = review.toObject();

    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review',
      error: error.message
    });
  }
};

exports.createReview = async (req, res) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const { employeeId, reviewType, reviewPeriodStart, reviewPeriodEnd, discussionDate, managerFeedback } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    if (reviewType !== undefined && !validateReviewType(reviewType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review type'
      });
    }

    const employee = await EmployeeHub.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const rating = validateRatingOrNull(managerFeedback?.rating);
    if (rating === '__INVALID__') {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1-5'
      });
    }

    const userId = getUserId(req);
    const model = getUserModel(req);

    const review = await Review.create({
      employeeId,
      reviewType: reviewType || 'AD_HOC',
      status: 'DRAFT',
      reviewPeriodStart: reviewPeriodStart || null,
      reviewPeriodEnd: reviewPeriodEnd || null,
      discussionDate: discussionDate || null,
      managerFeedback: {
        rating,
        feedback: trimOrNull(managerFeedback?.feedback),
        areasForImprovement: trimOrNull(managerFeedback?.areasForImprovement)
      },
      createdBy: userId,
      createdByModel: model,
      updatedBy: userId,
      updatedByModel: model
    });

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create review'
    });
  }
};

exports.updateReview = async (req, res) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const review = req.review || await Review.findById(req.params.id);
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

    const { reviewType, reviewPeriodStart, reviewPeriodEnd, discussionDate, managerFeedback } = req.body;
    if (reviewType !== undefined && !validateReviewType(reviewType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review type'
      });
    }

    if (reviewType !== undefined) review.reviewType = reviewType;
    if (reviewPeriodStart !== undefined) review.reviewPeriodStart = reviewPeriodStart || null;
    if (reviewPeriodEnd !== undefined) review.reviewPeriodEnd = reviewPeriodEnd || null;
    if (discussionDate !== undefined) review.discussionDate = discussionDate || null;

    if (managerFeedback !== undefined) {
      const rating = validateRatingOrNull(managerFeedback?.rating);
      if (rating === '__INVALID__') {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1-5'
        });
      }

      review.managerFeedback = {
        rating,
        feedback: trimOrNull(managerFeedback?.feedback),
        areasForImprovement: trimOrNull(managerFeedback?.areasForImprovement)
      };
    }

    const userId = getUserId(req);
    const model = getUserModel(req);
    review.updatedBy = userId;
    review.updatedByModel = model;

    await review.save();
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
};

exports.submitReview = async (req, res) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const review = req.review || await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Only draft reviews can be submitted'
      });
    }

    review.status = 'SUBMITTED';
    review.submittedAt = new Date();
    review.submittedBy = getUserId(req);
    review.submittedByModel = getUserModel(req);
    review.updatedBy = getUserId(req);
    review.updatedByModel = getUserModel(req);

    await review.save();
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
};

exports.addEmployeeComment = async (req, res) => {
  try {
    const review = req.review || await Review.findById(req.params.id);
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

    const comment = trimOrNull(req.body?.comment);
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }
    if (comment.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 2000 characters'
      });
    }

    if (review.employeeComment?.comment) {
      return res.status(400).json({
        success: false,
        message: 'Employee comment has already been added'
      });
    }

    review.employeeComment = {
      comment,
      updatedAt: new Date()
    };
    review.updatedBy = userId;
    review.updatedByModel = getUserModel(req);

    await review.save();
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error adding employee comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
};

exports.closeReview = async (req, res) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Manager/HR access required'
      });
    }

    const review = req.review || await Review.findById(req.params.id);
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

    review.status = 'COMPLETED';
    review.completedAt = new Date();
    review.completedBy = getUserId(req);
    review.completedByModel = getUserModel(req);
    review.updatedBy = getUserId(req);
    review.updatedByModel = getUserModel(req);

    await review.save();
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error closing review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close review'
    });
  }
};
