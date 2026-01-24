const mongoose = require('mongoose');

/**
 * Performance Review Model - New Version
 * 
 * Implements a 2-step review process:
 * 1. User submits self-assessment with competency ratings
 * 2. Manager submits feedback and final rating
 * 
 * Status flow: PENDING_SELF -> PENDING_MANAGER -> COMPLETED
 * Users cannot edit admin/manager feedback
 */

const reviewSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeHub',
    required: [true, 'Employee ID is required'],
    index: true
  },

  reviewType: {
    type: String,
    enum: ['ANNUAL', 'PROBATION', 'AD_HOC'],
    default: 'AD_HOC',
    required: true,
    index: true
  },

  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'COMPLETED'],
    default: 'DRAFT',
    required: true,
    index: true
  },

  reviewPeriodStart: {
    type: Date,
    default: null
  },

  reviewPeriodEnd: {
    type: Date,
    default: null
  },

  discussionDate: {
    type: Date,
    default: null
  },

  managerFeedback: {
    rating: {
      type: Number,
      min: [1, 'Rating must be 1-5'],
      max: [5, 'Rating must be 1-5'],
      default: null
    },
    feedback: {
      type: String,
      maxlength: 5000,
      default: null
    },
    areasForImprovement: {
      type: String,
      maxlength: 5000,
      default: null
    }
  },

  employeeComment: {
    comment: {
      type: String,
      maxlength: 2000,
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },

  submittedAt: {
    type: Date,
    default: null
  },

  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  submittedByModel: {
    type: String,
    enum: ['EmployeeHub', 'User'],
    default: null
  },

  completedAt: {
    type: Date,
    default: null
  },

  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  completedByModel: {
    type: String,
    enum: ['EmployeeHub', 'User'],
    default: null
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  createdByModel: {
    type: String,
    enum: ['EmployeeHub', 'User'],
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  updatedByModel: {
    type: String,
    enum: ['EmployeeHub', 'User'],
    default: null
  }

}, { timestamps: true });

// === INDEXES ===
reviewSchema.index({ employeeId: 1, status: 1 });
reviewSchema.index({ employeeId: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

// === INSTANCE METHODS ===

/**
 * Check if user can edit self-assessment
 */
reviewSchema.methods.isReadOnly = function() {
  return this.status === 'COMPLETED';
};

/**
 * Check if manager can submit feedback
 */
reviewSchema.methods.canEmployeeView = function() {
  return this.status === 'SUBMITTED' || this.status === 'COMPLETED';
};

/**
 * Transition review to next status
 */
reviewSchema.methods.canEmployeeComment = function() {
  return this.status === 'SUBMITTED';
};

module.exports = mongoose.model('Review', reviewSchema);
