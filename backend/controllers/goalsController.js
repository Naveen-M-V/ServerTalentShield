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

/**
 * Get user's goals
 * GET /api/goals/my
 */
exports.getUserGoals = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    
    const goals = await Goal.find({ userId })
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
    const { title, description, category, deadline, userId: targetUserId } = req.body;
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

    // Determine goal owner:
    // - If admin provides userId in payload, use that (admin assigning to employee)
    // - Otherwise, assign to current user (self-creation)
    const goalOwnerId = (isAdmin && targetUserId) ? targetUserId : currentUserId;

    // Get employee details for the goal owner
    const employee = await EmployeeHub.findById(goalOwnerId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create goal
    const goal = new Goal({
      userId: goalOwnerId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'Other',
      deadline: new Date(deadline),
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      createdBy: currentUserId
    });

    await goal.save();

    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      data: goal
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
    const userId = req.user?._id || req.session?.userId;
    const userRole = req.user?.role || req.session?.role;

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    // Check permissions
    if (goal.userId.toString() !== userId.toString() && 
        userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this goal'
      });
    }

    // Users can only update if not approved
    if (goal.userId.toString() === userId.toString() && goal.adminApproved) {
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
    const userId = req.user?._id || req.session?.userId;

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    // Users can only delete unapproved goals
    if (goal.userId.toString() !== userId.toString()) {
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
    const userId = req.user?._id || req.session?.userId;

    // Only admins can approve
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve goals'
      });
    }

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    goal.adminApproved = true;
    goal.updatedAt = new Date();
    await goal.save();

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
    const userId = req.user?._id || req.session?.userId;

    // Only admins can comment
    if (userRole !== 'admin' && userRole !== 'super-admin' && userRole !== 'hr') {
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

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    goal.adminComments.push({
      comment: comment.trim(),
      addedBy: userId
    });

    goal.updatedAt = new Date();
    await goal.save();

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
