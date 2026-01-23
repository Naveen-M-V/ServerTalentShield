const mongoose = require('mongoose');

/**
 * Employee Model
 * Stores employee information for rota management
 * Tracks the last assigned shift for rotation logic
 */
const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  lastShift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
