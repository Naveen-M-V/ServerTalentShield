import React, { useState, useEffect, useRef } from 'react';
import axios from '../utils/axiosConfig';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Calendar,
  Tag,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AddExpense from './AddExpense';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ModernDatePicker from '../components/ModernDatePicker';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Expenses = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-expenses');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState('employee');

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    tags: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 25
  });

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState('receipt');
  const [viewingId, setViewingId] = useState(null);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    limit: 25
  });

  // Fetch user role
  useEffect(() => {
    // Ensure we use role from stored session when available
    if (user?.role) setUserRole(user.role);
  }, []);

  // Fetch expenses
  useEffect(() => {
    fetchExpenses();
  }, [activeTab, filters]);

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      // For employee-specific route, always fetch only the logged-in user's expenses
      const endpoint = activeTab === 'my-expenses' ? '/api/expenses' : '/api/expenses/approvals';
      const params = { ...filters };
      // Always include employee identifier to scope results to the logged-in user
      params.employeeId = user?.id || user?._id || user?.employeeId || user?.email;
      const response = await axios.get(endpoint, { params });
      setExpenses(response.data.expenses || []);
      setPagination(response.data.pagination || { total: 0, page: 1, pages: 1, limit: 25 });
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError(err.response?.data?.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleApprove = async (expenseId) => {
    if (!window.confirm('Are you sure you want to approve this expense claim?')) return;
    
    try {
      await axios.post(`/api/expenses/${expenseId}/approve`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve expense');
    }
  };

  const handleDecline = async (expenseId) => {
    const reason = window.prompt('Please provide a reason for declining this expense claim:');
    if (!reason || reason.trim().length === 0) {
      alert('Decline reason is required');
      return;
    }
    
    try {
      await axios.post(`/api/expenses/${expenseId}/decline`, { reason });
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline expense');
    }
  };

  const handleDelete = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense claim?')) return;
    
    try {
      await axios.delete(`/api/expenses/${expenseId}`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const handleExportCSV = async () => {
    // Client-side CSV export of currently visible rows
    try {
      if (!expenses || expenses.length === 0) return;
      const visible = expenses;
      const headers = ['Type', 'Status', 'Submitted On', 'Total'];
      const rows = visible.map((r) => [
        r.category || r.type || 'Expense',
        (r.status || '').toString(),
        r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '',
        r.totalAmount != null ? `${r.currency || ''} ${Number(r.totalAmount).toFixed(2)}` : ''
      ]);

      let csv = headers.join(',') + '\n';
      rows.forEach((row) => {
        csv += row.map((cell) => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed', err);
      alert('Failed to export expenses');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      declined: { color: 'bg-red-100 text-red-800', label: 'Declined' },
      paid: { color: 'bg-blue-100 text-blue-800', label: 'Paid' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatSubmittedDate = (expense) => {
    const v = expense?.submittedOn || expense?.createdAt || expense?.date;
    if (!v) return '';
    try {
      return format(new Date(v), 'EEE dd LLL yyyy');
    } catch {
      return '';
    }
  };

  const formatClaimType = (expense) => {
    const v = (expense?.claimType || expense?.type || '').toString();
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const getApprovedByName = (expense) => {
    const approver = expense?.approvedBy || expense?.declinedBy || expense?.paidBy;
    if (!approver) return '';
    const first = approver?.firstName || '';
    const last = approver?.lastName || '';
    return `${first} ${last}`.trim();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">Expenses</div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                  <Plus size={18} />
                  Add new claim
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 right-0">
                <button
                  onClick={() => { setAddType('receipt'); setShowAddForm(true); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Receipt
                </button>
                <button
                  onClick={() => { setAddType('mileage'); setShowAddForm(true); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Mileage
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('my-expenses')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'my-expenses'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My expenses
        </button>
        {['admin', 'super-admin'].includes(userRole) && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'approvals'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Approvals
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date From */}
          <div>
            <ModernDatePicker
              name="fromDate"
              label={<><Calendar size={16} className="inline mr-1" /> From</>}
              value={filters.fromDate}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <ModernDatePicker
              name="toDate"
              label={<><Calendar size={16} className="inline mr-1" /> To</>}
              value={filters.toDate}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
            />
          </div>

          {/* Category/Tags Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search size={16} className="inline mr-1" />
              Category / Tags
            </label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.tags}
              onChange={(e) => handleFilterChange('tags', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter size={16} className="inline mr-1" />
              Status
            </label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => handleFilterChange('status', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
            <Select
              value={String(filters.limit)}
              onValueChange={(v) => handleFilterChange('limit', parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="25" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <div>
          Showing <span className="font-medium">{expenses.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0}</span>-<span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total || expenses.length)}</span> of <span className="font-medium">{pagination.total || expenses.length}</span> expenses.
          <button onClick={() => {
            setFilters({ status: '', category: '', tags: '', fromDate: '', toDate: '', page: 1, limit: filters.limit });
            fetchExpenses();
          }} className="ml-2 text-blue-600 underline">Reset filters</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View</span>
            <div className="w-[110px]">
              <Select
                value={String(filters.limit)}
                onValueChange={(v) => handleFilterChange('limit', parseInt(v))}
              >
                <SelectTrigger className="h-8 px-2">
                  <SelectValue placeholder="25" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 border border-pink-500 text-pink-600 rounded hover:bg-pink-50"
            disabled={expenses.length === 0}
          >
            Export to CSV
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expenses...</p>
        </div>
      ) : expenses.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Nothing to see here.</h3>
          <p className="text-gray-500">There are no expenses to review.</p>
        </div>
      ) : (
        /* Expenses Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50 border-b border-blue-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SI No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Submitted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved by</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense, idx) => (
                  <motion.tr
                    key={expense._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`transition ${idx % 2 === 0 ? 'bg-blue-50' : ''} hover:bg-blue-100`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatSubmittedDate(expense)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">
                      <button onClick={() => setViewingId(expense._id)} className="text-left font-medium text-blue-700 hover:underline">
                        {expense.category || ''}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatClaimType(expense)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {expense.currency ? `${expense.currency} ` : ''}{expense.totalAmount != null ? Number(expense.totalAmount).toFixed(2) : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">{getStatusBadge(expense.status)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getApprovedByName(expense) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewingId(expense._id)}
                          className="p-2 rounded hover:bg-gray-100 text-gray-700"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/user-dashboard?tab=expenses&action=edit&id=${expense._id}`)}
                          className={`p-2 rounded hover:bg-gray-100 ${expense.status === 'pending' ? 'text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                          title={expense.status === 'pending' ? 'Edit' : 'Only pending expenses can be edited'}
                          disabled={expense.status !== 'pending'}
                        >
                          <Edit size={16} />
                        </button>

                        {expense.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(expense._id)}
                            className="p-2 rounded hover:bg-red-50 text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-1 text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {viewingId && (
        <ExpenseDetailsModal id={viewingId} onClose={() => setViewingId(null)} onUpdated={() => { setViewingId(null); fetchExpenses(); }} />
      )}
      {/* Embedded Add Expense Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black bg-opacity-40">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg">
            <div className="p-4">
              <AddExpense
                embed
                initialType={addType}
                onClose={(opts) => {
                  setShowAddForm(false);
                  // If an expense was created, refresh the list
                  if (opts && opts.created) {
                    fetchExpenses();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
