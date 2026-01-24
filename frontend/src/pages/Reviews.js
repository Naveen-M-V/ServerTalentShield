import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { buildApiUrl } from '../utils/apiConfig';
import { reviewsApi } from '../utils/reviewsApi';

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const statusLabels = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  COMPLETED: 'Completed'
};

const statusColors = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800'
};

const reviewTypeLabels = {
  ANNUAL: 'Annual',
  PROBATION: 'Probation',
  AD_HOC: 'Ad-hoc'
};

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function ReviewStatus({ status }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export default function Reviews() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [activeTab, setActiveTab] = useState('mine');

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ status: 'all', employeeId: '', reviewType: 'all' });
  const [employees, setEmployees] = useState([]);

  const [selectedReview, setSelectedReview] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editForm, setEditForm] = useState({
    employeeId: '',
    reviewType: 'AD_HOC',
    reviewPeriodStart: '',
    reviewPeriodEnd: '',
    discussionDate: '',
    rating: '',
    feedback: '',
    areasForImprovement: ''
  });

  const [showComment, setShowComment] = useState(false);
  const [commentReview, setCommentReview] = useState(null);
  const [employeeComment, setEmployeeComment] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await axios.get(buildApiUrl('/auth/me'), { withCredentials: true });
        setUser(res.data);
        const adminFlag = ADMIN_ROLES.includes(res.data.role);
        const managerFlag = MANAGER_ROLES.includes(res.data.role);
        setIsAdmin(adminFlag);
        setIsManager(managerFlag);
        if (managerFlag) {
          setActiveTab('team');
          fetchEmployees();
        }
      } catch (err) {
        console.error('Failed to load user', err);
        toast.error('Could not load user info');
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab, filters]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(buildApiUrl('/employees'), { withCredentials: true });
      const payload = Array.isArray(res.data) ? res.data : res.data.employees || res.data.data || [];
      setEmployees(payload);
    } catch (err) {
      console.error('Failed to load employees', err);
      setEmployees([]);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const teamView = isManager && activeTab === 'team';
      const resp = teamView
        ? await reviewsApi.getAllReviews({
            status: filters.status,
            employeeId: filters.employeeId,
            reviewType: filters.reviewType
          })
        : await reviewsApi.getMyReviews();

      const payload = resp?.data ?? resp?.reviews ?? [];
      setReviews(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Failed to load reviews', err);
      toast.error('Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (review) => {
    try {
      const res = await reviewsApi.getReviewById(review._id);
      setSelectedReview(res?.data || review);
      setShowDetail(true);
    } catch (err) {
      console.error('Failed to load review', err);
      toast.error('Could not load review details');
    }
  };

  const openCreate = () => {
    setEditingReview(null);
    setEditForm({
      employeeId: '',
      reviewType: 'AD_HOC',
      reviewPeriodStart: '',
      reviewPeriodEnd: '',
      discussionDate: '',
      rating: '',
      feedback: '',
      areasForImprovement: ''
    });
    setShowEdit(true);
  };

  const openEdit = async (review) => {
    try {
      const res = await reviewsApi.getReviewById(review._id);
      const data = res?.data || review;
      setEditingReview(data);
      setEditForm({
        employeeId: data.employeeId?._id || data.employeeId || '',
        reviewType: data.reviewType || 'AD_HOC',
        reviewPeriodStart: data.reviewPeriodStart ? String(data.reviewPeriodStart).slice(0, 10) : '',
        reviewPeriodEnd: data.reviewPeriodEnd ? String(data.reviewPeriodEnd).slice(0, 10) : '',
        discussionDate: data.discussionDate ? String(data.discussionDate).slice(0, 10) : '',
        rating: data.managerFeedback?.rating ?? '',
        feedback: data.managerFeedback?.feedback ?? '',
        areasForImprovement: data.managerFeedback?.areasForImprovement ?? ''
      });
      setShowEdit(true);
    } catch (err) {
      console.error('Failed to load review for edit', err);
      toast.error('Could not load review');
    }
  };

  const saveDraft = async () => {
    if (!editForm.employeeId) {
      toast.error('Select an employee');
      return;
    }

    try {
      const payload = {
        employeeId: editForm.employeeId,
        reviewType: editForm.reviewType,
        reviewPeriodStart: editForm.reviewPeriodStart || null,
        reviewPeriodEnd: editForm.reviewPeriodEnd || null,
        discussionDate: editForm.discussionDate || null,
        managerFeedback: {
          rating: editForm.rating === '' ? null : Number(editForm.rating),
          feedback: editForm.feedback,
          areasForImprovement: editForm.areasForImprovement
        }
      };

      if (editingReview?._id) {
        await reviewsApi.updateReview(editingReview._id, payload);
        toast.success('Review updated');
      } else {
        await reviewsApi.createReview(payload);
        toast.success('Review created');
      }

      setShowEdit(false);
      setEditingReview(null);
      fetchReviews();
    } catch (err) {
      console.error('Failed to save review', err);
      toast.error(err.response?.data?.message || 'Failed to save review');
    }
  };

  const submitDraft = async (review) => {
    try {
      await reviewsApi.submitReview(review._id);
      toast.success('Review submitted');
      fetchReviews();
    } catch (err) {
      console.error('Failed to submit review', err);
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
  };

  const closeSubmitted = async (review) => {
    try {
      await reviewsApi.closeReview(review._id);
      toast.success('Review completed');
      fetchReviews();
    } catch (err) {
      console.error('Failed to close review', err);
      toast.error(err.response?.data?.message || 'Failed to complete review');
    }
  };

  const openEmployeeComment = async (review) => {
    try {
      const res = await reviewsApi.getReviewById(review._id);
      const data = res?.data || review;
      setCommentReview(data);
      setEmployeeComment('');
      setShowComment(true);
    } catch (err) {
      console.error('Failed to load review for comment', err);
      toast.error('Could not load review');
    }
  };

  const submitEmployeeComment = async () => {
    const comment = (employeeComment || '').trim();
    if (!comment) {
      toast.error('Enter a comment');
      return;
    }

    try {
      await reviewsApi.addEmployeeComment(commentReview._id, comment);
      toast.success('Comment submitted');
      setShowComment(false);
      setCommentReview(null);
      setEmployeeComment('');
      fetchReviews();
    } catch (err) {
      console.error('Failed to submit comment', err);
      toast.error(err.response?.data?.message || 'Failed to submit comment');
    }
  };

  const teamCounts = useMemo(() => {
    if (!isManager) return null;
    return {
      draft: reviews.filter((r) => r.status === 'DRAFT').length,
      submitted: reviews.filter((r) => r.status === 'SUBMITTED').length,
      completed: reviews.filter((r) => r.status === 'COMPLETED').length
    };
  }, [isManager, reviews]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Reviews</h1>
            <p className="text-sm text-gray-600">Self-assessments and manager feedback.</p>
          </div>
          <div className="flex gap-3">
            {isManager && (
              <div className="flex rounded-lg border p-1 text-sm font-medium">
                <button
                  className={`rounded-md px-3 py-2 ${activeTab === 'team' ? 'bg-green-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('team')}
                >
                  Team reviews
                </button>
                <button
                  className={`rounded-md px-3 py-2 ${activeTab === 'mine' ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('mine')}
                >
                  My reviews
                </button>
              </div>
            )}
            {isManager && activeTab === 'team' && (
              <button
                onClick={openCreate}
                className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
              >
                + Create review
              </button>
            )}
          </div>
        </div>
      </div>

      {isManager && teamCounts && activeTab === 'team' && (
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Draft</p>
            <p className="text-2xl font-semibold text-gray-900">{teamCounts.draft}</p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Submitted</p>
            <p className="text-2xl font-semibold text-gray-900">{teamCounts.submitted}</p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-semibold text-gray-900">{teamCounts.completed}</p>
          </div>
        </div>
      )}

      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-44 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="all">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            {isManager && activeTab === 'team' && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Employee</label>
                <select
                  value={filters.employeeId}
                  onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
                  className="mt-1 w-52 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">All employees</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isManager && activeTab === 'team' && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Review type</label>
                <select
                  value={filters.reviewType}
                  onChange={(e) => setFilters((f) => ({ ...f, reviewType: e.target.value }))}
                  className="mt-1 w-44 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="all">All types</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="PROBATION">Probation</option>
                  <option value="AD_HOC">Ad-hoc</option>
                </select>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">{reviews.length} review{reviews.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-lg border bg-white py-16 text-center text-gray-600 shadow-sm">No reviews found.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reviews.map((review) => {
                  const employee = review.employeeId;
                  const employeeName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Employee';
                  const canEdit = isManager && review.status === 'DRAFT' && activeTab === 'team';
                  const canSubmit = isManager && review.status === 'DRAFT' && activeTab === 'team';
                  const canClose = isManager && review.status === 'SUBMITTED' && activeTab === 'team';
                  const canEmployeeComment = !isManager && review.status === 'SUBMITTED' && activeTab === 'mine';

                  return (
                    <tr key={review._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 align-top text-sm text-gray-900">
                        <div className="font-semibold">{employeeName}</div>
                        <div className="text-gray-500">{employee?.employeeId || employee?.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">{reviewTypeLabels[review.reviewType] || review.reviewType || '-'}</td>
                      <td className="px-6 py-4 align-top"><ReviewStatus status={review.status} /></td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">{formatDate(review.createdAt)}</td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => openDetail(review)} className="text-blue-600 hover:text-blue-800">View</button>
                          {canEdit && (
                            <button onClick={() => openEdit(review)} className="text-green-700 hover:text-green-900">
                              Edit
                            </button>
                          )}
                          {canSubmit && (
                            <button onClick={() => submitDraft(review)} className="text-purple-700 hover:text-purple-900">
                              Submit
                            </button>
                          )}
                          {canClose && (
                            <button onClick={() => closeSubmitted(review)} className="text-green-700 hover:text-green-900">
                              Close
                            </button>
                          )}
                          {canEmployeeComment && (
                            <button onClick={() => openEmployeeComment(review)} className="text-green-700 hover:text-green-900">
                              Add comment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showEdit}
        title={editingReview ? 'Edit review (draft)' : 'Create review'}
        onClose={() => {
          setShowEdit(false);
          setEditingReview(null);
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowEdit(false);
                setEditingReview(null);
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={saveDraft}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save
            </button>
          </div>
        )}
      >
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Employee</label>
            <select
              value={editForm.employeeId}
              onChange={(e) => setEditForm((f) => ({ ...f, employeeId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Review type</label>
            <select
              value={editForm.reviewType}
              onChange={(e) => setEditForm((f) => ({ ...f, reviewType: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="ANNUAL">Annual</option>
              <option value="PROBATION">Probation</option>
              <option value="AD_HOC">Ad-hoc</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">Review period start</label>
              <input
                type="date"
                value={editForm.reviewPeriodStart}
                onChange={(e) => setEditForm((f) => ({ ...f, reviewPeriodStart: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Review period end</label>
              <input
                type="date"
                value={editForm.reviewPeriodEnd}
                onChange={(e) => setEditForm((f) => ({ ...f, reviewPeriodEnd: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Discussion date</label>
            <input
              type="date"
              value={editForm.discussionDate}
              onChange={(e) => setEditForm((f) => ({ ...f, discussionDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Rating (1-5)</label>
            <input
              type="number"
              min="1"
              max="5"
              value={editForm.rating}
              onChange={(e) => setEditForm((f) => ({ ...f, rating: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Manager feedback</label>
            <textarea
              value={editForm.feedback}
              onChange={(e) => setEditForm((f) => ({ ...f, feedback: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Areas for improvement</label>
            <textarea
              value={editForm.areasForImprovement}
              onChange={(e) => setEditForm((f) => ({ ...f, areasForImprovement: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showComment}
        title="Add comment"
        onClose={() => {
          setShowComment(false);
          setCommentReview(null);
          setEmployeeComment('');
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowComment(false);
                setCommentReview(null);
                setEmployeeComment('');
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={submitEmployeeComment}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Submit
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <p className="text-sm text-gray-600">Your comment will be visible to your manager/HR.</p>
          <textarea
            value={employeeComment}
            onChange={(e) => setEmployeeComment(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </Modal>

      <Modal
        open={showDetail}
        title="Review details"
        onClose={() => {
          setShowDetail(false);
          setSelectedReview(null);
        }}
      >
        {selectedReview && (
          <div className="space-y-4 text-sm text-gray-800">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">Employee</p>
                <p className="text-base font-semibold text-gray-900">
                  {`${selectedReview.employeeId?.firstName || ''} ${selectedReview.employeeId?.lastName || ''}`.trim() || 'Employee'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Status</p>
                <ReviewStatus status={selectedReview.status} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">Review type</p>
                <p className="text-sm text-gray-900">{reviewTypeLabels[selectedReview.reviewType] || selectedReview.reviewType || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Created</p>
                <p className="text-sm text-gray-900">{formatDate(selectedReview.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500">Manager feedback</p>
              {selectedReview.managerFeedback?.rating || selectedReview.managerFeedback?.feedback || selectedReview.managerFeedback?.areasForImprovement ? (
                <div className="rounded-md border bg-gray-50 px-3 py-2">
                  <p className="font-semibold text-gray-900">Rating: {selectedReview.managerFeedback?.rating ?? '-'}</p>
                  {selectedReview.managerFeedback?.feedback && (
                    <p className="mt-1 text-gray-700">{selectedReview.managerFeedback.feedback}</p>
                  )}
                  {selectedReview.managerFeedback?.areasForImprovement && (
                    <p className="mt-1 text-gray-700">Areas for improvement: {selectedReview.managerFeedback.areasForImprovement}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No manager feedback.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500">Employee comment</p>
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
        )}
      </Modal>
    </div>
  );
}
