import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { buildApiUrl } from '../utils/apiConfig';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
const ADMIN_ROLES = ['admin', 'super-admin', 'hr'];

const statusLabels = {
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  ACHIEVED: 'Achieved',
  OVERDUE: 'Overdue'
};

const statusColors = {
  TO_DO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ACHIEVED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800'
};

const categories = [
  'Technical',
  'Leadership',
  'Communication',
  'Project',
  'Personal Development',
  'Other'
];

const initialForm = {
  title: '',
  description: '',
  category: 'Other',
  deadline: '',
  progress: 0,
  status: 'TO_DO',
  userId: '' // For admin to assign goal to employee
};

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
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

function ProgressBar({ value }) {
  const clamped = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-green-600" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function GoalRowActions({ goal, isOwner, isAdmin, onEdit, onDelete, onApprove, onComment, onView }) {
  return (
    <div className="flex justify-end gap-3 text-sm">
      <button onClick={() => onView(goal)} className="text-blue-600 hover:text-blue-800">View</button>
      {isOwner && !goal.adminApproved && (
        <>
          <button onClick={() => onEdit(goal)} className="text-green-600 hover:text-green-800">Edit</button>
          <button onClick={() => onDelete(goal)} className="text-red-600 hover:text-red-800">Delete</button>
        </>
      )}
      {isAdmin && (
        <>
          {!goal.adminApproved && (
            <button onClick={() => onApprove(goal)} className="text-green-700 hover:text-green-900">Approve</button>
          )}
          <button onClick={() => onComment(goal)} className="text-purple-700 hover:text-purple-900">Comment</button>
        </>
      )}
    </div>
  );
}

export default function Goals() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('mine');
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [summary, setSummary] = useState(null);

  const [filters, setFilters] = useState({ status: 'all', department: '', employee: '', approved: 'all' });

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentGoal, setCommentGoal] = useState(null);

  const [showDetail, setShowDetail] = useState(false);
  const [detailGoal, setDetailGoal] = useState(null);

  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true });
        setUser(res.data);
        const adminFlag = ADMIN_ROLES.includes(res.data.role);
        setIsAdmin(adminFlag);
        if (adminFlag) {
          setActiveTab('team');
          fetchSummary();
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
      fetchGoals();
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

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE}/goals/summary/all`, { withCredentials: true });
      setSummary(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load goals summary', err);
      setSummary(null);
    }
  };

  const fetchGoals = async () => {
    try {
      setLoadingGoals(true);
      const isTeamView = isAdmin && activeTab === 'team';
      const url = isTeamView ? '/goals' : '/goals/my';

      const params = isTeamView
        ? {
            status: filters.status !== 'all' ? filters.status : undefined,
            department: filters.department || undefined,
            employee: filters.employee || undefined,
            approved: filters.approved === 'all' ? undefined : filters.approved === 'approved'
          }
        : undefined;

      const res = await axios.get(`${API_BASE}${url}`, { params, withCredentials: true });
      const payload = res.data?.data ?? res.data ?? [];
      setGoals(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Failed to load goals', err);
      toast.error('Failed to load goals');
      setGoals([]);
    } finally {
      setLoadingGoals(false);
    }
  };

  const openCreate = () => {
    setEditingGoal(null);
    setFormData(initialForm);
    setShowForm(true);
  };

  const openEdit = (goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title || '',
      description: goal.description || '',
      category: goal.category || 'Other',
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      progress: goal.progress ?? 0,
      status: goal.status || 'TO_DO',
      userId: goal.userId?._id || goal.userId || '' // Preserve userId for admin edits
    });
    setShowForm(true);
  };

  const saveGoal = async () => {
    if (!formData.title || !formData.description || !formData.deadline) {
      toast.error('Title, description, and deadline are required');
      return;
    }

    // Admin creating goal for employee: userId is required
    if (isAdmin && !editingGoal && !formData.userId) {
      toast.error('Please select an employee');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      deadline: formData.deadline,
      progress: Number(formData.progress) || 0,
      status: formData.status
    };

    // Include userId if admin is creating/editing and userId is set
    if (isAdmin && formData.userId) {
      payload.userId = formData.userId;
    }

    try {
      if (editingGoal) {
        await axios.put(`${API_BASE}/goals/${editingGoal._id}`, payload, { withCredentials: true });
        toast.success('Goal updated');
      } else {
        await axios.post(`${API_BASE}/goals`, payload, { withCredentials: true });
        toast.success('Goal created');
      }
      setShowForm(false);
      setEditingGoal(null);
      setFormData(initialForm);
      fetchGoals();
      if (isAdmin) fetchSummary();
    } catch (err) {
      console.error('Failed to save goal', err);
      toast.error(err.response?.data?.message || 'Failed to save goal');
    }
  };

  const deleteGoal = async (goal) => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE}/goals/${goal._id}`, { withCredentials: true });
      toast.success('Goal deleted');
      fetchGoals();
      if (isAdmin) fetchSummary();
    } catch (err) {
      console.error('Failed to delete goal', err);
      toast.error(err.response?.data?.message || 'Failed to delete goal');
    }
  };

  const approveGoal = async (goal) => {
    try {
      await axios.post(`${API_BASE}/goals/${goal._id}/approve`, {}, { withCredentials: true });
      toast.success('Goal approved');
      fetchGoals();
      fetchSummary();
    } catch (err) {
      console.error('Failed to approve goal', err);
      toast.error(err.response?.data?.message || 'Failed to approve goal');
    }
  };

  const openComment = (goal) => {
    setCommentGoal(goal);
    setCommentText('');
    setShowCommentModal(true);
  };

  const submitComment = async () => {
    if (!commentText.trim()) {
      toast.error('Comment is required');
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/goals/${commentGoal._id}/comment`,
        { comment: commentText.trim() },
        { withCredentials: true }
      );
      toast.success('Comment added');
      setShowCommentModal(false);
      setCommentGoal(null);
      setCommentText('');
      fetchGoals();
    } catch (err) {
      console.error('Failed to add comment', err);
      toast.error(err.response?.data?.message || 'Failed to add comment');
    }
  };

  const openDetail = (goal) => {
    setDetailGoal(goal);
    setShowDetail(true);
  };

  const statusCounts = useMemo(() => {
    if (!summary) return null;
    return [
      { label: 'Total', value: summary.total },
      { label: 'Achieved', value: summary.achieved },
      { label: 'In progress', value: summary.inProgress },
      { label: 'Overdue', value: summary.overdue },
      { label: 'Approved', value: summary.approved }
    ];
  }, [summary]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
            <p className="text-sm text-gray-600">Track goals, approvals, and progress.</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <div className="flex rounded-lg border p-1 text-sm font-medium">
                <button
                  className={`rounded-md px-3 py-2 ${activeTab === 'team' ? 'bg-green-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('team')}
                >
                  Team goals
                </button>
                <button
                  className={`rounded-md px-3 py-2 ${activeTab === 'mine' ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('mine')}
                >
                  My goals
                </button>
              </div>
            )}
            <button
              onClick={openCreate}
              className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              + New goal
            </button>
          </div>
        </div>
      </div>

      {isAdmin && summary && (
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-5">
          {statusCounts?.map((item) => (
            <div key={item.label} className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{item.value ?? 0}</p>
            </div>
          ))}
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
                <option value="TO_DO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="ACHIEVED">Achieved</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            {isAdmin && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Department</label>
                  <input
                    value={filters.department}
                    onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                    placeholder="Any department"
                    className="mt-1 w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Employee</label>
                  <input
                    value={filters.employee}
                    onChange={(e) => setFilters((f) => ({ ...f, employee: e.target.value }))}
                    placeholder="Name search"
                    className="mt-1 w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Approval</label>
                  <select
                    value={filters.approved}
                    onChange={(e) => setFilters((f) => ({ ...f, approved: e.target.value }))}
                    className="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="all">All</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="text-sm text-gray-500">{goals.length} goal{goals.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="px-6 py-6">
        {loadingGoals ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-600"></div>
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg border bg-white py-16 text-center text-gray-600 shadow-sm">
            No goals found for this view.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Deadline</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Approval</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {goals.map((goal) => {
                  const owner = goal.userId || {};
                  const ownerName = goal.employeeName || `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
                  const ownerId = goal.userId?._id || goal.userId;
                  const isOwner = user && ownerId?.toString?.() === user._id;
                  return (
                    <tr key={goal._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900">{goal.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">{goal.description}</div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-900">{ownerName || 'Unknown'}</td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">{goal.department || owner.department || '-'}</td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">{formatDate(goal.deadline)}</td>
                      <td className="px-6 py-4 align-top">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[goal.status] || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[goal.status] || goal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-32"><ProgressBar value={goal.progress} /></div>
                          <span className="text-sm text-gray-700">{goal.progress ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {goal.adminApproved ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Approved</span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700">
                        <GoalRowActions
                          goal={goal}
                          isOwner={!!isOwner}
                          isAdmin={isAdmin}
                          onEdit={openEdit}
                          onDelete={deleteGoal}
                          onApprove={approveGoal}
                          onComment={openComment}
                          onView={openDetail}
                        />
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
        open={showForm}
        title={editingGoal ? 'Update goal' : 'Create goal'}
        onClose={() => {
          setShowForm(false);
          setEditingGoal(null);
          setFormData(initialForm);
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingGoal(null);
                setFormData(initialForm);
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={saveGoal}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save
            </button>
          </div>
        )}
      >
        <div className="grid gap-4">
          {isAdmin && !editingGoal && (
            <div>
              <label className="text-sm font-semibold text-gray-700">Assign to Employee *</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData((f) => ({ ...f, userId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId || emp.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700">Title</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Goal title"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="What is the goal?"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Deadline</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData((f) => ({ ...f, deadline: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">Progress</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData((f) => ({ ...f, progress: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="TO_DO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="ACHIEVED">Achieved</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showCommentModal}
        title="Add admin comment"
        onClose={() => {
          setShowCommentModal(false);
          setCommentGoal(null);
          setCommentText('');
        }}
        footer={(
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCommentModal(false);
                setCommentGoal(null);
                setCommentText('');
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={submitComment}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Add comment
            </button>
          </div>
        )}
      >
        <p className="mb-2 text-sm text-gray-700">
          Comments are visible to the employee and help clarify approval decisions.
        </p>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          placeholder="Add feedback or context"
        />
      </Modal>

      <Modal
        open={showDetail && detailGoal}
        title="Goal details"
        onClose={() => {
          setShowDetail(false);
          setDetailGoal(null);
        }}
      >
        {detailGoal && (
          <div className="space-y-4 text-sm text-gray-800">
            <div>
              <p className="text-xs font-semibold text-gray-500">Title</p>
              <p className="text-base font-semibold text-gray-900">{detailGoal.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Description</p>
              <p>{detailGoal.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">Category</p>
                <p>{detailGoal.category}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Deadline</p>
                <p>{formatDate(detailGoal.deadline)}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">Status</p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[detailGoal.status] || 'bg-gray-100 text-gray-800'}`}>
                  {statusLabels[detailGoal.status] || detailGoal.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Progress</p>
                <p>{detailGoal.progress ?? 0}%</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Admin comments</p>
              {detailGoal.adminComments && detailGoal.adminComments.length > 0 ? (
                <div className="space-y-2">
                  {detailGoal.adminComments.map((c, idx) => (
                    <div key={idx} className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-800">
                      <p>{c.comment}</p>
                      <p className="text-xs text-gray-500">{formatDate(c.addedAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No admin comments yet.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
