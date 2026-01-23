import React, { useEffect, useState } from 'react';
import { notesApi, pipsApi, goalsApi } from '../../utils/performanceApi';
import { reviewsApi } from '../../utils/reviewsApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const PerformanceTab = ({ user, userProfile }) => {
  const [reviews, setReviews] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pips, setPips] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const employeeId = userProfile?._id;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        try {
          const myReviews = await reviewsApi.getMyReviews();
          setReviews(Array.isArray(myReviews) ? myReviews : (myReviews && myReviews.reviews) || []);
        } catch (err) {
          setReviews([]);
        }

        try {
          const myGoals = await goalsApi.getMyGoals();
          setGoals(Array.isArray(myGoals) ? myGoals : (myGoals && myGoals.goals) || []);
        } catch (err) {
          setGoals([]);
        }

        // Notes (only visible to admin/hr/managers)
        if (employeeId) {
          try {
            const notesResp = await notesApi.getNotesForEmployee(employeeId);
            setNotes(Array.isArray(notesResp) ? notesResp : (notesResp && notesResp.notes) || []);
          } catch (err) {
            // not allowed or none
            setNotes([]);
          }
        } else {
          setNotes([]);
        }

        // PIPs
        if (employeeId) {
          try {
            const pipsResp = await pipsApi.getForEmployee(employeeId);
            setPips(Array.isArray(pipsResp) ? pipsResp : (pipsResp && pipsResp.pips) || []);
          } catch (err) {
            setPips([]);
          }
        } else {
          setPips([]);
        }
      } catch (error) {
        console.error('Error loading performance data', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [employeeId, user]);

  if (loading) return <div className="p-4">Loading performance...</div>;

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

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
          <div className="p-10 text-center text-gray-600">No goals found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measurement</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGoals.map((g) => (
                  <tr key={g._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{g.goalName || '-'}</div>
                      <div className="text-sm text-gray-500 max-w-xl truncate">{g.description || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(g.startDate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(g.dueDate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getGoalStatusBadge(g.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{g.measurementType || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceTab;
