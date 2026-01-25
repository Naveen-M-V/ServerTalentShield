/**
 * Goals Controller
 * 
 * Handles goal CRUD operations and admin functions
 * - Users can create, read, update, delete their own goals
 * - Admins can view all goals, approve, and add comments
 * - Includes company-wide summary statistics
 */

const Goal = require('../models/Goal');
const EmployeeHub = require('../models/EmployeesHub');
const mongoose = require('mongoose');

const resolveEmployeeForRequest = async (req) => {
  const authId = req.user?.userId || req.user?.id || req.user?._id || req.session?.userId;
  const authIdStr = authId ? String(authId).trim() : '';
  const isValidObjectId = mongoose.Types.ObjectId.isValid(authIdStr);

  let employee = null;

  if (isValidObjectId) {
    employee = await EmployeeHub.findById(authIdStr);
  }

  if (!employee && isValidObjectId) {
    employee = await EmployeeHub.findOne({ userId: authIdStr });
  }

  if (!employee && req.user?.email) {
    employee = await EmployeeHub.findOne({ email: String(req.user.email).toLowerCase() });
  }

  return employee;
};

/**
 * Get goal by ID
 * GET /api/goals/:id
 */
exports.getGoalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.session?.role;
    const isAdmin = ['admin', 'super-admin', 'hr'].includes(userRole);
    const employee = await resolveEmployeeForRequest(req);

    if (!isAdmin && !employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const goal = await Goal.findById(id)
      .populate('userId', 'firstName lastName email department')
      .populate('createdBy', 'firstName lastName email')
      .populate('adminComments.addedBy', 'firstName lastName email')
      .lean();

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    if (!isAdmin && goal.userId?.toString?.() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this goal'
      });
    }

    res.json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goal',
      error: error.message
    });
  }
};

/**
 * Get user's goals
 * GET /api/goals/my
 */
exports.getUserGoals = async (req, res) => {
  try {
    const employee = await resolveEmployeeForRequest(req);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const goals = await Goal.find({ userId: employee._id })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: goals.length,
      data: goals
    });
  } catch (error) {
    console.error('Error fetching user goals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: error.message
    });
  }
};

/**
 * Create a new goal
 * POST /api/goals
 */
exports.createGoal = async (req, res) => {
  try {
    const { title, description, category, deadline, userId: targetUserId, userIds } = req.body;
    const currentUserId = req.user?._id || req.session?.userId;
    const userRole = req.user?.role || req.session?.role;
    const isAdmin = ['admin', 'super-admin', 'hr'].includes(userRole);

    // Validate required fields
    if (!title || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and deadline are required'
      });
    }

    let goalOwnerIds = [];
    if (isAdmin) {
      if (Array.isArray(userIds) && userIds.length > 0) {
        goalOwnerIds = userIds;
      } else if (targetUserId) {
        goalOwnerIds = [targetUserId];
      }
    }

    if (!goalOwnerIds.length) {
      const employee = await resolveEmployeeForRequest(req);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found'
        });
      }
      goalOwnerIds = [employee._id];
    }

    // Get employee details for each goal owner
    const employeeDocs = await EmployeeHub.find({ _id: { $in: goalOwnerIds } });
    if (!employeeDocs.length) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employeeById = new Map(employeeDocs.map((e) => [e._id.toString(), e]));
    const missing = goalOwnerIds.filter((id) => !employeeById.has(String(id)));
    if (missing.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more employees were not found',
        missingUserIds: missing
      });
    }

    const goalPayload = goalOwnerIds.map((id) => {
      const employee = employeeById.get(String(id));
      return {
        userId: employee._id,
        title: title.trim(),
        description: description.trim(),
        category: category || 'Other',
        deadline: new Date(deadline),
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        createdBy: currentUserId
      };
    });

    const createdGoals = await Goal.insertMany(goalPayload, { ordered: true });

    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      count: createdGoals.length,
      data: createdGoals
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create goal',
      error: error.message
    });
  }
};

/**
 * Update a goal
 * PUT /api/goals/:id
 */
exports.updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, deadline, progress, status } = req.body;
    const userRole = req.user?.role || req.session?.role;
    const isAdmin = ['admin', 'super-admin', 'hr'].includes(userRole);
    const employee = await resolveEmployeeForRequest(req);

    if (!isAdmin && !employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    // Check permissions
    if (!isAdmin && goal.userId.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this goal'
      });
    }

    // Users can only update if not approved
    if (!isAdmin && goal.adminApproved) {
      return res.status(403).json({
        success: false,
        message: 'You cannot modify approved goals'
      });
    }

    // Update allowed fields
    if (title) goal.title = title.trim();
    if (description) goal.description = description.trim();
    if (category) goal.category = category;
    if (deadline) goal.deadline = new Date(deadline);
    if (typeof progress === 'number') goal.progress = Math.min(Math.max(progress, 0), 100);
    if (status && ['TO_DO', 'IN_PROGRESS', 'ACHIEVED', 'OVERDUE'].includes(status)) {
      goal.status = status;
    }

    goal.updatedAt = new Date();
    await goal.save();

    res.json({
      success: true,
      message: 'Goal updated successfully',
      data: goal
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update goal',
      error: error.message
    });
  }
};

/**
 * Delete a goal
 * DELETE /api/goals/:id
 */
exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.session?.role;
    const isAdmin = ['admin', 'super-admin', 'hr'].includes(userRole);
    const employee = await resolveEmployeeForRequest(req);

    if (!isAdmin && !employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    // Users can only delete unapproved goals
    if (!isAdmin && goal.userId.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own goals'
      });
    }

    if (goal.adminApproved) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete approved goals'
      });
    }

    await Goal.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete goal',
      error: error.message
    });
  }
};

/**
 * Get all goals with filters (admin only)
 * GET /api/goals?department=&employee=
 */
exports.getAllGoals = async (req, res) => {
  try {
    const userRole = req.user?.role || req.session?.role;

    // Only admins can view all goals
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view all goals'
      });
    }

    const { department, employee, status, approved } = req.query;
    const query = {};

    if (department) query.department = department;
    if (employee) {
      query.$or = [
        { employeeName: { $regex: employee, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (approved !== undefined) query.adminApproved = approved === 'true';

    const goals = await Goal.find(query)
      .populate('userId', 'firstName lastName email department')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: goals.length,
      data: goals
    });
  } catch (error) {
    console.error('Error fetching all goals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: error.message
    });
  }
};

/**
 * Approve a goal (admin only)
 * POST /api/goals/:id/approve
 */
exports.approveGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.session?.role;

    // Only admins can approve
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve goals'
      });
    }

    // Use findByIdAndUpdate to avoid re-validating unchanged fields
    // This prevents validation errors on denormalized fields (employeeName, department)
    const goal = await Goal.findByIdAndUpdate(
      id,
      { 
        adminApproved: true,
        updatedAt: new Date()
      },
      { 
        new: true,
        runValidators: false  // Skip validation on fields we're not changing
      }
    ).populate('userId', 'firstName lastName email department');

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    res.json({
      success: true,
      message: 'Goal approved successfully',
      data: goal
    });
  } catch (error) {
    console.error('Error approving goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve goal',
      error: error.message
    });
  }
};

/**
 * Add comment to a goal (admin only)
 * POST /api/goals/:id/comment
 */
exports.addCommentToGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userRole = req.user?.role || req.session?.role;
    const userId = req.user?._id || req.user?.id || req.session?.userId;

    // Only admins can comment
    if (!['admin', 'super-admin', 'hr'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to comment on goals'
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    // Determine the model type for the user
    const userModel = req.user?.userType === 'employee' ? 'EmployeeHub' : 'User';

    goal.adminComments.push({
      comment: comment.trim(),
      addedBy: userId,
      addedByModel: userModel,
      addedAt: new Date()
    });

    goal.updatedAt = new Date();
    await goal.save();

    // Populate admin details for response - populate both possible models
    await goal.populate([
      { path: 'adminComments.addedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: goal
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
};

/**
 * Get goal summary - percent achieved company-wide
 * GET /api/goals/summary
 */
exports.getGoalsSummary = async (req, res) => {
  try {
    const userRole = req.user?.role || req.session?.role;

    // Only admins can view summary
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view goal summary'
      });
    }

    const totalGoals = await Goal.countDocuments();
    const achievedGoals = await Goal.countDocuments({ status: 'ACHIEVED' });
    const inProgressGoals = await Goal.countDocuments({ status: 'IN_PROGRESS' });
    const todoGoals = await Goal.countDocuments({ status: 'TO_DO' });
    const overdueGoals = await Goal.countDocuments({ status: 'OVERDUE' });
    const approvedGoals = await Goal.countDocuments({ adminApproved: true });

    const percentAchieved = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

    // Get breakdown by department
    const departmentBreakdown = await Goal.aggregate([
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          achieved: {
            $sum: { $cond: [{ $eq: ['$status', 'ACHIEVED'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          department: '$_id',
          total: 1,
          achieved: 1,
          percentAchieved: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$achieved', '$total'] }, 100] }] },
              0
            ]
          }
        }
      },
      { $sort: { percentAchieved: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalGoals,
        achieved: achievedGoals,
        inProgress: inProgressGoals,
        todo: todoGoals,
        overdue: overdueGoals,
        approved: approvedGoals,
        percentAchieved,
        departmentBreakdown
      }
    });
  } catch (error) {
    console.error('Error getting goals summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get goals summary',
      error: error.message
    });
  }
};
