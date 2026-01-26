import React, { useEffect, useState } from 'react';
import { notesApi, pipsApi, goalsApi } from '../../utils/performanceApi';
import { reviewsApi } from '../../utils/reviewsApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const PerformanceTab = ({ user, userProfile }) => {
  const navigate = useNavigate();
  const isManager = user?.role && MANAGER_ROLES.includes(user.role);
  const [reviews, setReviews] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pips, setPips] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedReview, setSelectedReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const employeeId = userProfile?._id;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        try {
          const myReviews = await reviewsApi.getMyReviews();
          const reviewsData = myReviews?.data || myReviews?.reviews || myReviews;
          const normalized = Array.isArray(reviewsData) ? reviewsData : [];
          setReviews(normalized);
        } catch (err) {
          console.error('Failed to load reviews', err);
          setReviews([]);
        }

        try {
          const goalsResp = await goalsApi.getMyGoals();
          // Handle response from /api/goals/my endpoint
          const goalsData = goalsResp?.data || goalsResp?.goals || goalsResp;
          setGoals(Array.isArray(goalsData) ? goalsData : []);
        } catch (err) {
          console.error('Failed to load goals', err);
          setGoals([]);
        }

        // Notes (only visible to admin/hr/managers) - Skip for now as endpoint may not exist
        setNotes([]);

        // PIPs - Skip for now as endpoint may not exist
        setPips([]);
      } catch (error) {
        console.error('Error loading performance data', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [employeeId, user]);

  const loadGoals = async () => {
    try {
      const goalsResp = await goalsApi.getMyGoals();
      const goalsData = goalsResp?.data || goalsResp?.goals || goalsResp;
      setGoals(Array.isArray(goalsData) ? goalsData : []);
    } catch (err) {
      console.error('Failed to load goals', err);
    }
  };

  const loadReviews = async () => {
    try {
      const myReviews = await reviewsApi.getMyReviews();
      const reviewsData = myReviews?.data || myReviews?.reviews || myReviews;
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
    } catch (err) {
      console.error('Failed to load reviews', err);
    }
  };

  const handleCreateGoal = () => {
    // Open create goal modal instead of navigating away
    setShowCreateGoalModal(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setShowEditGoalModal(true);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    
    try {
      await goalsApi.deleteGoal(goalId);
      toast.success('Goal deleted successfully');
      await loadGoals();
    } catch (error) {
      console.error('Failed to delete goal', error);
      toast.error(error.response?.data?.message || 'Failed to delete goal');
    }
  };

  const handleViewGoal = async (goal) => {
    try {
      const res = await goalsApi.getGoalById(goal._id);
      setSelectedGoal(res?.data || goal);
      setShowGoalModal(true);
    } catch (err) {
      console.error('Failed to load goal details', err);
      setSelectedGoal(goal);
      setShowGoalModal(true);
    }
  };

  const handleAddComment = (review) => {
    setSelectedReview(review);
    setCommentText('');
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      await reviewsApi.addEmployeeComment(selectedReview._id, commentText);
      toast.success('Comment added successfully');
      setShowCommentModal(false);
      setCommentText('');
      await loadReviews();
    } catch (error) {
      console.error('Failed to add comment', error);
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  if (loading) return <div className="p-4">Loading performance...</div>;

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const openReviewDetail = async (review) => {
    try {
      const res = await reviewsApi.getReviewById(review._id);
      setSelectedReview(res?.data || review);
      setShowReviewModal(true);
    } catch (err) {
      console.error('Failed to load review details', err);
      setSelectedReview(review);
      setShowReviewModal(true);
    }
  };

  const getApprovalBadge = (approval) => {
    if (approval === 'Approved') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Approved</span>;
    } else if (approval === 'Rejected') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Rejected</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    }
  };

  const completedReviews = (Array.isArray(reviews) ? reviews : []).filter((r) => r?.status === 'COMPLETED');
  const submittedReviews = (Array.isArray(reviews) ? reviews : []).filter((r) => r?.status === 'SUBMITTED');
  const activeReviews = [...submittedReviews, ...completedReviews];

  const getGoalStatusBadge = (status) => {
    const statusColors = {
      'Not started': 'bg-gray-100 text-gray-800',
      'In progress': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800',
      'Overdue': 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status || '-'}
      </span>
    );
  };

  const normalizedGoals = Array.isArray(goals) ? goals : [];
  const goalsTotal = normalizedGoals.length;
  const reviewsTotal = Array.isArray(reviews) ? reviews.length : 0;
  const inProgressCount = normalizedGoals.filter((g) => g?.status === 'In progress').length;
  const completedCount = normalizedGoals.filter((g) => g?.status === 'Completed').length;

  const filteredGoals = normalizedGoals.filter((g) => {
    const matchesStatus = statusFilter === 'all' ? true : g?.status === statusFilter;
    const s = (searchTerm || '').trim().toLowerCase();
    const matchesSearch = !s
      ? true
      : `${g?.goalName || ''} ${g?.description || ''}`.toLowerCase().includes(s);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-120px)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Goals</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{goalsTotal}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Reviews</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{reviewsTotal}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8m-8 4h8m-9 5h10a2 2 0 002-2V7a2 2 0 00-2-2H9.414a1 1 0 01-.707-.293L7.293 3.293A1 1 0 006.586 3H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">In progress</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{inProgressCount}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{completedCount}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-lg font-semibold text-gray-900">My Goals</div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={handleCreateGoal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Goal
            </button>
            <div className="flex-1 min-w-[280px]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search goals by name or description"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="w-full sm:w-[200px]">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-full focus:ring-green-500 focus:ring-offset-0">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Not started">Not started</SelectItem>
                  <SelectItem value="In progress">In progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {filteredGoals.length === 0 ? (
          <div className="p-10 text-center">
            <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No goals found</h3>
            <p className="text-gray-500 mb-4">Start by creating your first goal</p>
            <button
              onClick={handleCreateGoal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm inline-flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Goal
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGoals.map((g) => {
                  const isPending = g.approval === 'Pending' || !g.approval;
                  const isApproved = g.approval === 'Approved';
                  
                  return (
                    <tr key={g._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{g.goalName || g.title || '-'}</div>
                        <div className="text-sm text-gray-500 max-w-xl truncate">{g.description || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(g.startDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(g.dueDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getGoalStatusBadge(g.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getApprovalBadge(g.approval)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                        <button
                          onClick={() => handleViewGoal(g)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleEditGoal(g)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteGoal(g._id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="text-lg font-semibold text-gray-900">My Reviews</div>
          <div className="text-sm text-gray-500 mt-1">View and comment on your performance reviews</div>
        </div>

        {activeReviews.length === 0 ? (
          <div className="p-10 text-center">
            <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h3>
            <p className="text-gray-500">
              {isManager 
                ? "You don't have any personal reviews yet. To manage team reviews, use the sidebar menu."
                : "Your manager hasn't created a review for you yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discussion Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeReviews.map((r) => {
                  const isSubmitted = r.status === 'SUBMITTED';
                  
                  return (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.reviewType || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          r.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                          r.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {r.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(r.discussionDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.managerFeedback?.rating ?? '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                        <button
                          onClick={() => openReviewDetail(r)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                        {isSubmitted && (
                          <button
                            onClick={() => handleAddComment(r)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Add Comment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Review Details</h3>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedReview(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              {selectedReview ? (
                <div className="space-y-4 text-sm text-gray-800">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Status</p>
                      <p className="text-sm text-gray-900">{selectedReview.status || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Review Type</p>
                      <p className="text-sm text-gray-900">{selectedReview.reviewType || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500">Manager Feedback</p>
                    {selectedReview.managerFeedback?.rating || selectedReview.managerFeedback?.feedback || selectedReview.managerFeedback?.areasForImprovement ? (
                      <div className="rounded-md border bg-gray-50 px-3 py-2">
                        <p className="font-semibold text-gray-900">Rating: {selectedReview.managerFeedback?.rating ?? '-'}</p>
                        {selectedReview.managerFeedback?.feedback && (
                          <p className="mt-1 text-gray-700 whitespace-pre-wrap">{selectedReview.managerFeedback.feedback}</p>
                        )}
                        {selectedReview.managerFeedback?.areasForImprovement && (
                          <p className="mt-1 text-gray-700 whitespace-pre-wrap">Areas for improvement: {selectedReview.managerFeedback.areasForImprovement}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">No manager feedback.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500">Your Comment</p>
                    {selectedReview.employeeComment?.comment ? (
                      <div className="rounded-md border bg-gray-50 px-3 py-2">
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedReview.employeeComment.comment}</p>
                        {selectedReview.employeeComment.updatedAt && (
                          <p className="mt-1 text-xs text-gray-500">Updated {formatDate(selectedReview.employeeComment.updatedAt)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">No comment.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">Loading...</div>
              )}
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedReview(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Goal Details</h3>
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setSelectedGoal(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              {selectedGoal ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-500">Title</p>
                    <p className="text-base text-gray-900 font-medium">{selectedGoal.goalName || selectedGoal.title || '-'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedGoal.description || '-'}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Status</p>
                      <div className="mt-1">{getGoalStatusBadge(selectedGoal.status)}</div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Approval</p>
                      <div className="mt-1">{getApprovalBadge(selectedGoal.approval)}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Start Date</p>
                      <p className="text-sm text-gray-900">{formatDate(selectedGoal.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Due Date</p>
                      <p className="text-sm text-gray-900">{formatDate(selectedGoal.dueDate)}</p>
                    </div>
                  </div>

                  {selectedGoal.adminComments && selectedGoal.adminComments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Manager Comments</p>
                      <div className="space-y-2">
                        {selectedGoal.adminComments.map((comment, idx) => (
                          <div key={idx} className="rounded-md border bg-gray-50 px-3 py-2">
                            <p className="text-sm text-gray-900">{comment.comment || comment}</p>
                            {comment.addedBy && (
                              <p className="mt-1 text-xs text-gray-500">
                                By {comment.addedBy} {comment.addedAt && `on ${formatDate(comment.addedAt)}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-600">Loading...</div>
              )}
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setSelectedGoal(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommentModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Comment</h3>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Comment
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Share your thoughts on this review..."
              />
            </div>
            <div className="border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                }}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700"
              >
                Submit Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreateGoalModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Goal</h3>
              <button
                onClick={() => setShowCreateGoalModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  await goalsApi.createGoal({
                    title: formData.get('title'),
                    description: formData.get('description'),
                    category: formData.get('category') || 'Other',
                    deadline: formData.get('deadline'),
                    progress: 0,
                    status: 'TO_DO'
                  });
                  toast.success('Goal created successfully');
                  setShowCreateGoalModal(false);
                  loadGoals();
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Failed to create goal');
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
                    <input
                      type="text"
                      name="title"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Complete React certification"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <textarea
                      name="description"
                      required
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Describe your goal..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        name="category"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="Technical">Technical</option>
                        <option value="Leadership">Leadership</option>
                        <option value="Communication">Communication</option>
                        <option value="Project">Project</option>
                        <option value="Personal Development">Personal Development</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                      <input
                        type="date"
                        name="deadline"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-t mt-6 pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateGoalModal(false)}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700"
                  >
                    Create Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {showEditGoalModal && editingGoal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Goal</h3>
              <button
                onClick={() => {
                  setShowEditGoalModal(false);
                  setEditingGoal(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  await goalsApi.updateGoal(editingGoal._id, {
                    title: formData.get('title'),
                    description: formData.get('description'),
                    category: formData.get('category'),
                    deadline: formData.get('deadline'),
                    progress: Number(formData.get('progress')) || 0,
                    status: formData.get('status')
                  });
                  toast.success('Goal updated successfully');
                  setShowEditGoalModal(false);
                  setEditingGoal(null);
                  loadGoals();
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Failed to update goal');
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
                    <input
                      type="text"
                      name="title"
                      required
                      defaultValue={editingGoal.goalName || editingGoal.title}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <textarea
                      name="description"
                      required
                      rows={4}
                      defaultValue={editingGoal.description}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        name="category"
                        defaultValue={editingGoal.category}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="Technical">Technical</option>
                        <option value="Leadership">Leadership</option>
                        <option value="Communication">Communication</option>
                        <option value="Project">Project</option>
                        <option value="Personal Development">Personal Development</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                      <input
                        type="date"
                        name="deadline"
                        required
                        defaultValue={editingGoal.dueDate?.slice(0, 10) || editingGoal.deadline?.slice(0, 10)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Progress (%)</label>
                      <input
                        type="number"
                        name="progress"
                        min="0"
                        max="100"
                        defaultValue={editingGoal.progress || 0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        name="status"
                        defaultValue={editingGoal.status}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="Not started">Not started</option>
                        <option value="In progress">In progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="border-t mt-6 pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditGoalModal(false);
                      setEditingGoal(null);
                    }}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700"
                  >
                    Update Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTab;
