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
  // === BASIC INFO ===
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeHub',
    required: [true, 'User ID is required'],
    index: true
  },

  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewCycle',
    default: null
  },

  // === SELF-ASSESSMENT (User's Input) ===
  selfAssessment: [{
    competency: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be 1-5'],
      max: [5, 'Rating must be 1-5'],
      required: true
    },
    summary: {
      type: String,
      maxlength: 1000
    }
  }],

  // === MANAGER FEEDBACK (Admin/Manager's Input - Read-only for user) ===
  managerFeedback: {
    rating: {
      type: Number,
      min: [1, 'Rating must be 1-5'],
      max: [5, 'Rating must be 1-5'],
      default: null
    },
    feedback: {
      type: String,
      maxlength: 2000,
      default: null
    },
    areasForImprovement: {
      type: String,
      maxlength: 1000,
      default: null
    },
    submittedAt: {
      type: Date,
      default: null
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },

  // === STATUS & WORKFLOW ===
  status: {
    type: String,
    enum: ['PENDING_SELF', 'PENDING_MANAGER', 'COMPLETED'],
    default: 'PENDING_SELF',
    required: true,
    index: true
  },

  // === FINALIZATION ===
  finalizedAt: {
    type: Date,
    default: null
  },

  // === AUDIT FIELDS ===
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

// === INDEXES ===
reviewSchema.index({ userId: 1, status: 1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ cycleId: 1, status: 1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ 'managerFeedback.submittedBy': 1 });

// === INSTANCE METHODS ===

/**
 * Check if user can edit self-assessment
 */
reviewSchema.methods.canEditSelfAssessment = function() {
  return this.status === 'PENDING_SELF';
};

/**
 * Check if manager can submit feedback
 */
reviewSchema.methods.canSubmitManagerFeedback = function() {
  return this.status === 'PENDING_MANAGER' && this.selfAssessment.length > 0;
};

/**
 * Transition review to next status
 */
reviewSchema.methods.advanceStatus = function() {
  if (this.status === 'PENDING_SELF') {
    this.status = 'PENDING_MANAGER';
    return true;
  } else if (this.status === 'PENDING_MANAGER' && this.managerFeedback.submittedAt) {
    this.status = 'COMPLETED';
    this.finalizedAt = new Date();
    return true;
  }
  return false;
};

module.exports = mongoose.model('Review', reviewSchema);
