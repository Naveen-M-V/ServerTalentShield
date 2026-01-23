const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * Authentication Routes
 * Handles dual login system for Employees and Profiles
 */

// POST /api/auth/login/employee - Employee/Admin Login
router.post('/login/employee', authController.employeeLogin);

// POST /api/auth/login/profile - Profile Login
router.post('/login/profile', authController.profileLogin);

// POST /api/auth/login - Unified Login (auto-detect user type)
router.post('/login', authController.unifiedLogin);

// GET /api/auth/me - Get Current User (token validation)
router.get('/me', authController.getCurrentUser);

// POST /api/auth/logout - Logout
router.post('/logout', authController.logout);

// POST /api/auth/change-password - Change Password
router.post('/change-password', authController.changePassword);

// GET /api/auth/approvers - Get admin/super-admin approvers
router.get('/approvers', authController.getApprovers);

module.exports = router;
