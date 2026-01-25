/**
 * Goal Model
 * 
 * Tracks employee goals with admin approval workflow
 * - Users can create and manage personal goals
 * - Admins can approve, comment, and view all goals
 * - Goals have progress tracking and status management
 */

const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  // References
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeHub',
    required: [true, 'User ID is required'],
    index: true
  },

  // Goal Details
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  description: {
    type: String,
    required: [true, 'Goal description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  category: {
    type: String,
    enum: ['Technical', 'Leadership', 'Communication', 'Project', 'Personal Development', 'Other'],
    default: 'Other',
    required: true
  },

  // Timing
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },

  // Progress & Status
  progress: {
    type: Number,
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot exceed 100'],
    default: 0
  },

  status: {
    type: String,
    enum: ['TO_DO', 'IN_PROGRESS', 'ACHIEVED', 'OVERDUE'],
    default: 'TO_DO',
    required: true,
    index: true
  },

  // Employee Info (denormalized for quick access)
  employeeName: {
    type: String,
    required: true
  },

  department: {
    type: String,
    required: true
  },

  // Admin Approval Workflow
  adminApproved: {
    type: Boolean,
    default: false,
    index: true
  },

  adminComments: [{
    comment: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      // Can be either User (admin) or EmployeeHub
      refPath: 'adminComments.addedByModel'
    },
    addedByModel: {
      type: String,
      enum: ['User', 'EmployeeHub'],
      default: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, { timestamps: true });

// Index for common queries
goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ department: 1, status: 1 });
goalSchema.index({ adminApproved: 1, status: 1 });

module.exports = mongoose.model('Goal', goalSchema);
