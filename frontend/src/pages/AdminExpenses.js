import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { format } from 'date-fns';
import ModernDatePicker from '../components/ModernDatePicker';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import AddExpense from './AddExpense';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Filter, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const AdminExpenses = () => {
  const [tab, setTab] = useState('approvals'); // default to approvals for admin
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState('receipt');
  const [filters, setFilters] = useState({
    employeeId: '',
    category: '',
    tags: '',
    status: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 25
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [tab, filters]);

  const fetchEmployees = async () => {
    try {
      // Backend mounts employee hub routes at `/api/employees`
      const res = await axios.get('/api/employees');
      // Normalize possible response shapes. API may return { success, count, data: [...] }
      let data = res.data;
      if (data && data.data) data = data.data;
      if (!Array.isArray(data)) {
        console.warn('Unexpected /api/employeeHub response shape, normalizing to empty array', res.data);
        data = [];
      }
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      params.page = filters.page || 1;
      params.limit = filters.limit || 25;

      let url = '/api/expenses/approvals';
      if (tab === 'my-expenses') url = '/api/expenses';

      const res = await axios.get(url, { params });
      // Normalize response shapes: backend may return { expenses, pagination } or wrapper { success, data: { expenses, pagination }}
      let payload = res.data;
      if (payload && payload.data) payload = payload.data;
      const expenseList = Array.isArray(payload?.expenses) ? payload.expenses : Array.isArray(payload) ? payload : [];
      setExpenses(expenseList);
      setPagination(payload?.pagination || { total: 0, page: 1, pages: 1, limit: 25 });
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this expense?')) return;
    try {
      await axios.post(`/api/expenses/${id}/approve`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleDecline = async (id) => {
    const reason = window.prompt('Reason for declining:');
    if (!reason) return;
    try {
      await axios.post(`/api/expenses/${id}/decline`, { reason });
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline');
    }
  };

  const [viewingId, setViewingId] = useState(null);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Expenses (Admin)</h1>

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

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setTab('my-expenses')} className={`px-4 py-2 ${tab === 'my-expenses' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}>My expenses</button>
        <button onClick={() => setTab('approvals')} className={`px-4 py-2 ${tab === 'approvals' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}>Approvals</button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <Select
              value={filters.employeeId || 'all'}
              onValueChange={(v) => handleFilterChange('employeeId', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp._id} value={String(emp._id)}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId || ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category / Tag</label>
            <input type="text" value={filters.tags} onChange={(e) => handleFilterChange('tags', e.target.value)} placeholder="Category or tag" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select
              value={filters.status || 'any'}
              onValueChange={(v) => handleFilterChange('status', v === 'any' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <ModernDatePicker name="fromDate" label={"From"} value={filters.fromDate} onChange={(e) => handleFilterChange('fromDate', e.target.value)} />
          </div>

          <div>
            <ModernDatePicker name="toDate" label={"To"} value={filters.toDate} onChange={(e) => handleFilterChange('toDate', e.target.value)} />
          </div>

          <div className="flex items-end">
            <button onClick={() => { setFilters({ employeeId: '', category: '', tags: '', status: '', fromDate: '', toDate: '', page: 1, limit: filters.limit }); fetchExpenses(); }} className="px-4 py-2 bg-white border border-gray-300 rounded">Reset</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted On</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Options</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((exp) => (
                <tr key={exp._id} className="hover:bg-blue-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{exp.claimType || exp.category}</td>
                  <td className="px-6 py-4 text-sm">{exp.status}</td>
                  <td className="px-6 py-4 text-sm">{exp.submittedBy ? `${exp.submittedBy.firstName} ${exp.submittedBy.lastName}` : ''}</td>
                  <td className="px-6 py-4 text-sm">{exp.submittedOn ? format(new Date(exp.submittedOn), 'dd/MM/yyyy') : (exp.date ? format(new Date(exp.date), 'dd/MM/yyyy') : '')}</td>
                  <td className="px-6 py-4 text-sm">{exp.currency || ''} {exp.totalAmount != null ? Number(exp.totalAmount).toFixed(2) : ''}</td>
                  <td className="px-6 py-4 text-sm">
                    {exp.status === 'approved' || exp.status === 'paid' ? (
                      exp.approvedBy ? `${exp.approvedBy.firstName} ${exp.approvedBy.lastName}` : '-'
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => setViewingId(exp._id)} className="px-3 py-1 border rounded">View</button>
                      {exp.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(exp._id)} className="px-3 py-1 bg-green-600 text-white rounded">Approve</button>
                          <button onClick={() => handleDecline(exp._id)} className="px-3 py-1 bg-red-600 text-white rounded">Decline</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleFilterChange('page', Math.max(1, pagination.page - 1))} disabled={pagination.page === 1} className="px-3 py-1 bg-white border rounded"> <ChevronLeft size={16} /> </button>
              <span className="px-4 py-1">Page {pagination.page} of {pagination.pages}</span>
              <button onClick={() => handleFilterChange('page', Math.min(pagination.pages, pagination.page + 1))} disabled={pagination.page === pagination.pages} className="px-3 py-1 bg-white border rounded"> <ChevronRight size={16} /> </button>
            </div>
          </div>
        )}
      </div>

      {viewingId && (
        <ExpenseDetailsModal id={viewingId} onClose={() => { setViewingId(null); fetchExpenses(); }} onUpdated={() => { setViewingId(null); fetchExpenses(); }} />
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

export default AdminExpenses;
