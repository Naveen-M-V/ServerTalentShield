import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { buildApiUrl } from '../utils/apiConfig';

const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'manager'];

const statusLabels = {
  PENDING_SELF: 'Self-assessment pending',
  PENDING_MANAGER: 'Manager feedback pending',
  COMPLETED: 'Completed'
};

const statusColors = {
  PENDING_SELF: 'bg-yellow-100 text-yellow-800',
  PENDING_MANAGER: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800'
};

const defaultCompetencies = [
  { competency: 'Results', rating: 3, summary: '' },
  { competency: 'Collaboration', rating: 3, summary: '' },
  { competency: 'Communication', rating: 3, summary: '' }
];

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

  const [filters, setFilters] = useState({ status: 'all', employeeId: '' });
  const [employees, setEmployees] = useState([]);

  const [showInitiate, setShowInitiate] = useState(false);
  const [initiateForm, setInitiateForm] = useState({ employeeId: '', cycleId: '' });

  const [selectedReview, setSelectedReview] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showSelfModal, setShowSelfModal] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState(defaultCompetencies);

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerForm, setManagerForm] = useState({ rating: 3, feedback: '', areasForImprovement: '' });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await axios.get(buildApiUrl('/auth/me'), { withCredentials: true });
        setUser(res.data);
        const adminFlag = ADMIN_ROLES.includes(res.data.role);
        const managerFlag = MANAGER_ROLES.includes(res.data.role);
        setIsAdmin(adminFlag);
        setIsManager(managerFlag);
        if (adminFlag) {
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
      const teamView = isAdmin && activeTab === 'team';
      const url = teamView ? '/reviews' : '/reviews/my';
      const params = teamView
        ? {
            status: filters.status !== 'all' ? filters.status : undefined,
            employeeId: filters.employeeId || undefined
          }
        : undefined;

      const res = await axios.get(buildApiUrl(url), { params, withCredentials: true });
      const payload = res.data?.data ?? res.data?.reviews ?? [];
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
      const res = await axios.get(buildApiUrl(`/reviews/${review._id}`), { withCredentials: true });
      setSelectedReview(res.data?.data || review);
      setShowDetail(true);
    } catch (err) {
      console.error('Failed to load review', err);
      toast.error('Could not load review details');
    }
  };

  const openSelfAssessment = (review) => {
    setSelectedReview(review);
    setSelfAssessment(review.selfAssessment?.length ? review.selfAssessment : defaultCompetencies);
    setShowSelfModal(true);
  };

  const saveSelfAssessment = async () => {
    const cleaned = selfAssessment.filter((item) => item.competency && item.rating);
    if (cleaned.length === 0) {
      toast.error('Add at least one competency');
      return;
    }
    try {
      await axios.post(
        buildApiUrl(`/reviews/${selectedReview._id}/self`),
        { selfAssessment: cleaned.map((c) => ({ ...c, rating: Number(c.rating) })) },
        { withCredentials: true }
      );
      toast.success('Self-assessment saved');
      setShowSelfModal(false);
      setSelectedReview(null);
      fetchReviews();
    } catch (err) {
      console.error('Failed to save self-assessment', err);
      toast.error(err.response?.data?.message || 'Failed to save self-assessment');
    }
  };

  const advanceToManager = async (review) => {
    try {
      await axios.post(buildApiUrl(`/reviews/${review._id}/status`), {}, { withCredentials: true });
      toast.success('Moved to manager review');
      fetchReviews();
    } catch (err) {
      console.error('Failed to advance review', err);
      toast.error(err.response?.data?.message || 'Cannot advance review yet');
    }
  };

  const openManagerFeedback = (review) => {
    setSelectedReview(review);
    setManagerForm({ rating: 3, feedback: '', areasForImprovement: '' });
    setShowManagerModal(true);
  };

  const submitManagerFeedback = async () => {
    try {
      await axios.post(
        buildApiUrl(`/reviews/${selectedReview._id}/manager`),
        {
          rating: Number(managerForm.rating),
          feedback: managerForm.feedback.trim(),
          areasForImprovement: managerForm.areasForImprovement.trim()
        },
        { withCredentials: true }
      );
      toast.success('Manager feedback submitted');
      setShowManagerModal(false);
      setSelectedReview(null);
      fetchReviews();
    } catch (err) {
      console.error('Failed to submit manager feedback', err);
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    }
  };

  const initiateReview = async () => {
    if (!initiateForm.employeeId) {
      toast.error('Select an employee');
      return;
    }
    try {
      await axios.post(
        buildApiUrl('/reviews/initiate'),
        { employeeId: initiateForm.employeeId, cycleId: initiateForm.cycleId || undefined },
        { withCredentials: true }
      );
      toast.success('Review initiated');
      setShowInitiate(false);
      setInitiateForm({ employeeId: '', cycleId: '' });
      fetchReviews();
    } catch (err) {
      console.error('Failed to initiate review', err);
      toast.error(err.response?.data?.message || 'Failed to initiate review');
    }
  };

  const addCompetencyRow = () => {
    setSelfAssessment((list) => [...list, { competency: '', rating: 3, summary: '' }]);
  };

  const removeCompetencyRow = (idx) => {
    setSelfAssessment((list) => list.filter((_, i) => i !== idx));
  };

  const teamCounts = useMemo(() => {
    if (!isAdmin) return null;
    return {
      pendingSelf: reviews.filter((r) => r.status === 'PENDING_SELF').length,
      pendingManager: reviews.filter((r) => r.status === 'PENDING_MANAGER').length,
      completed: reviews.filter((r) => r.status === 'COMPLETED').length
    };
  }, [isAdmin, reviews]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Reviews</h1>
            <p className="text-sm text-gray-600">Self-assessments and manager feedback.</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
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
            {isAdmin && (
              <button
                onClick={() => setShowInitiate(true)}
                className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
              >
                + Initiate review
              </button>
            )}
          </div>
        </div>
      </div>

      {isAdmin && teamCounts && activeTab === 'team' && (
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Pending self-assessment</p>
            <p className="text-2xl font-semibold text-gray-900">{teamCounts.pendingSelf}</p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Pending manager</p>
            <p className="text-2xl font-semibold text-gray-900">{teamCounts.pendingManager}</p>
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
                <option value="PENDING_SELF">Self-assessment</option>
                <option value="PENDING_MANAGER">Manager feedback</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            {isAdmin && (
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
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Self assessment</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Manager feedback</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reviews.map((review) => {
                  const employee = review.userId || review.employee;
                  const employeeName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Employee';
                  const ownerId = review.userId?._id || review.userId;
                  const ownerIdValue = typeof ownerId === 'string' ? ownerId : ownerId?.toString?.();
                  const canFillSelf = review.status === 'PENDING_SELF' && ownerIdValue === user?._id;
                  const canAdvance = isAdmin && review.status === 'PENDING_SELF' && (review.selfAssessment?.length || 0) > 0;
                  const canManagerFeedback = isManager && review.status === 'PENDING_MANAGER';

                  return (
                    <tr key={review._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 align-top text-sm text-gray-900">
                        <div className="font-semibold">{employeeName}</div>
                        <div className="text-gray-500">{employee?.employeeId || employee?.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 align-top"><ReviewStatus status={review.status} /></td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">{formatDate(review.createdAt)}</td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">
                        {review.selfAssessment && review.selfAssessment.length > 0 ? (
                          <span className="text-green-700">Submitted</span>
                        ) : (
                          <span className="text-gray-500">Not submitted</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">
                        {review.managerFeedback?.submittedAt ? (
                          <span className="text-green-700">Provided</span>
                        ) : (
                          <span className="text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => openDetail(review)} className="text-blue-600 hover:text-blue-800">View</button>
                          {canFillSelf && (
                            <button onClick={() => openSelfAssessment(review)} className="text-green-600 hover:text-green-800">
                              Self-assess
                            </button>
                          )}
                          {canAdvance && (
                            <button onClick={() => advanceToManager(review)} className="text-purple-700 hover:text-purple-900">
                              Advance
                            </button>
                          )}
                          {canManagerFeedback && (
                            <button onClick={() => openManagerFeedback(review)} className="text-green-700 hover:text-green-900">
                              Manager feedback
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
        open={showInitiate}
        title="Initiate review"
        onClose={() => {
          setShowInitiate(false);
          setInitiateForm({ employeeId: '', cycleId: '' });
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowInitiate(false);
                setInitiateForm({ employeeId: '', cycleId: '' });
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={initiateReview}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Create
            </button>
          </div>
        )}
      >
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Employee</label>
            <select
              value={initiateForm.employeeId}
              onChange={(e) => setInitiateForm((f) => ({ ...f, employeeId: e.target.value }))}
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
            <label className="text-sm font-semibold text-gray-700">Cycle ID (optional)</label>
            <input
              value={initiateForm.cycleId}
              onChange={(e) => setInitiateForm((f) => ({ ...f, cycleId: e.target.value }))}
              placeholder="Link to a review cycle"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showSelfModal}
        title="Self-assessment"
        onClose={() => {
          setShowSelfModal(false);
          setSelectedReview(null);
        }}
        footer={(
          <div className="flex justify-between gap-3">
            <button
              onClick={addCompetencyRow}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              + Add competency
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSelfModal(false);
                  setSelectedReview(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={saveSelfAssessment}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        )}
      >
        <p className="mb-3 text-sm text-gray-600">Rate each competency and add a short summary.</p>
        <div className="space-y-4">
          {selfAssessment.map((item, idx) => (
            <div key={idx} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={item.competency}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelfAssessment((list) => list.map((c, i) => (i === idx ? { ...c, competency: value } : c)));
                  }}
                  placeholder="Competency"
                  className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={item.rating}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSelfAssessment((list) => list.map((c, i) => (i === idx ? { ...c, rating: value } : c)));
                  }}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  onClick={() => removeCompetencyRow(idx)}
                  className="text-red-600 hover:text-red-800"
                  aria-label="Remove competency"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={item.summary}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelfAssessment((list) => list.map((c, i) => (i === idx ? { ...c, summary: value } : c)));
                }}
                rows={2}
                placeholder="Summary or examples"
                className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={showManagerModal}
        title="Manager feedback"
        onClose={() => {
          setShowManagerModal(false);
          setSelectedReview(null);
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowManagerModal(false);
                setSelectedReview(null);
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={submitManagerFeedback}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Submit
            </button>
          </div>
        )}
      >
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Overall rating</label>
            <input
              type="number"
              min="1"
              max="5"
              value={managerForm.rating}
              onChange={(e) => setManagerForm((f) => ({ ...f, rating: Number(e.target.value) }))}
              className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Feedback</label>
            <textarea
              value={managerForm.feedback}
              onChange={(e) => setManagerForm((f) => ({ ...f, feedback: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Strengths, impact, outcomes"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Areas for improvement</label>
            <textarea
              value={managerForm.areasForImprovement}
              onChange={(e) => setManagerForm((f) => ({ ...f, areasForImprovement: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Coaching notes and expectations"
            />
          </div>
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
                  {`${selectedReview.userId?.firstName || ''} ${selectedReview.userId?.lastName || ''}`.trim() || 'Employee'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Status</p>
                <ReviewStatus status={selectedReview.status} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500">Self-assessment</p>
              {selectedReview.selfAssessment?.length ? (
                <div className="space-y-3">
                  {selectedReview.selfAssessment.map((item, idx) => (
                    <div key={idx} className="rounded-md border bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{item.competency}</p>
                        <span className="text-sm text-gray-700">Rating: {item.rating}</span>
                      </div>
                      {item.summary && <p className="mt-1 text-gray-700">{item.summary}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Not submitted.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500">Manager feedback</p>
              {selectedReview.managerFeedback?.submittedAt ? (
                <div className="rounded-md border bg-gray-50 px-3 py-2">
                  <p className="font-semibold text-gray-900">Rating: {selectedReview.managerFeedback.rating}</p>
                  {selectedReview.managerFeedback.feedback && (
                    <p className="mt-1 text-gray-700">{selectedReview.managerFeedback.feedback}</p>
                  )}
                  {selectedReview.managerFeedback.areasForImprovement && (
                    <p className="mt-1 text-gray-700">
                      Areas for improvement: {selectedReview.managerFeedback.areasForImprovement}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Submitted {formatDate(selectedReview.managerFeedback.submittedAt)}</p>
                </div>
              ) : (
                <p className="text-gray-500">Pending manager feedback.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
