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

/**
 * Get user's reviews (history)
 * GET /api/reviews/my
 */
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;

    const reviews = await Review.find({ userId })
      .select('-__v')
      .populate('createdBy', 'firstName lastName email')
      .populate('managerFeedback.submittedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
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
    const userId = req.user?._id || req.session?.userId;
    const userRole = req.user?.role || req.session?.role;

    const review = await Review.findById(id)
      .populate('userId', 'firstName lastName email department')
      .populate('createdBy', 'firstName lastName email')
      .populate('managerFeedback.submittedBy', 'firstName lastName email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check permissions
    const isOwner = review.userId._id.toString() === userId.toString();
    const isAdmin = userRole === 'admin' || userRole === 'super-admin' || userRole === 'hr';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this review'
      });
    }

    res.json({
      success: true,
      data: review
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

/**
 * Submit self-assessment
 * POST /api/reviews/:id/self
 */
exports.submitSelfAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { selfAssessment } = req.body;
    const userId = req.user?._id || req.session?.userId;

    if (!selfAssessment || !Array.isArray(selfAssessment) || selfAssessment.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Self-assessment with at least one competency is required'
      });
    }

    // Validate competencies
    for (const item of selfAssessment) {
      if (!item.competency || typeof item.rating !== 'number' || item.rating < 1 || item.rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Each competency must have a title and rating between 1-5'
        });
      }
    }

    // Find the specific review
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check permissions (user can only edit their own review)
    if (review.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own review'
      });
    }

    // Check if review is in correct status
    if (review.status !== 'PENDING_SELF') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit self-assessment. Review status is ${review.status}`
      });
    }

    // Update self-assessment
    review.selfAssessment = selfAssessment;
    review.updatedBy = userId;
    await review.save();

    res.json({
      success: true,
      message: 'Self-assessment submitted successfully',
      data: review
    });
  } catch (error) {
    console.error('Error submitting self-assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit self-assessment',
      error: error.message
    });
  }
};

/**
 * Initiate review for employee (admin only)
 * POST /api/reviews/initiate
 */
exports.initiateReview = async (req, res) => {
  try {
    const { employeeId, cycleId } = req.body;
    const userRole = req.user?.role || req.session?.role;
    const userId = req.user?._id || req.session?.userId;

    // Only admins can initiate
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to initiate reviews'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Check if employee exists
    const employee = await EmployeeHub.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if review already exists for this employee
    const existingReview = await Review.findOne({
      userId: employeeId,
      status: { $in: ['PENDING_SELF', 'PENDING_MANAGER'] }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Employee already has an active review'
      });
    }

    // Create new review
    const review = new Review({
      userId: employeeId,
      cycleId: cycleId || null,
      createdBy: userId
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Review initiated successfully',
      data: review
    });
  } catch (error) {
    console.error('Error initiating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate review',
      error: error.message
    });
  }
};

/**
 * Submit manager feedback
 * POST /api/reviews/:id/manager
 */
exports.submitManagerFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback, areasForImprovement } = req.body;
    const userRole = req.user?.role || req.session?.role;
    const userId = req.user?._id || req.session?.userId;

    // Only admins/managers can submit
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit manager feedback'
      });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1-5'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status !== 'PENDING_MANAGER') {
      return res.status(400).json({
        success: false,
        message: 'Review must be in PENDING_MANAGER status'
      });
    }

    if (review.selfAssessment.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit manager feedback until self-assessment is complete'
      });
    }

    // Submit manager feedback
    review.managerFeedback = {
      rating,
      feedback: feedback?.trim() || null,
      areasForImprovement: areasForImprovement?.trim() || null,
      submittedAt: new Date(),
      submittedBy: userId
    };

    // Mark as completed when manager feedback is submitted
    review.status = 'COMPLETED';
    review.finalizedAt = new Date();
    review.updatedBy = userId;

    await review.save();

    res.json({
      success: true,
      message: 'Manager feedback submitted and review completed',
      data: review
    });
  } catch (error) {
    console.error('Error submitting manager feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit manager feedback',
      error: error.message
    });
  }
};

/**
 * Advance review status (admin only)
 * POST /api/reviews/:id/status
 */
exports.advanceReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.session?.role;

    // Only admins can advance status
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to advance review status'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status === 'PENDING_SELF' && review.selfAssessment.length > 0) {
      review.status = 'PENDING_MANAGER';
      review.updatedBy = req.user?._id || req.session?.userId;
      await review.save();

      return res.json({
        success: true,
        message: 'Review advanced to PENDING_MANAGER',
        data: review
      });
    }

    res.status(400).json({
      success: false,
      message: 'Review cannot be advanced at this time'
    });
  } catch (error) {
    console.error('Error advancing review status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to advance review status',
      error: error.message
    });
  }
};

/**
 * Get all reviews with filters (admin only)
 * GET /api/reviews?status=&employee=
 */
exports.getAllReviews = async (req, res) => {
  try {
    const userRole = req.user?.role || req.session?.role;

    // Only admins can view all reviews
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view all reviews'
      });
    }

    const { status, employeeId, cycleId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (employeeId) query.userId = employeeId;
    if (cycleId) query.cycleId = cycleId;

    const reviews = await Review.find(query)
      .populate('userId', 'firstName lastName email department employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('managerFeedback.submittedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};
