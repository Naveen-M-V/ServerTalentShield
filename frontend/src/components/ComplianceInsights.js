import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { formatDateDDMMYY } from '../utils/dateFormatter';
import { buildApiUrl } from '../utils/apiConfig';

const ComplianceInsights = () => {
  const [insights, setInsights] = useState({
    totalEmployees: { count: 0, employees: [] },
    activeEmployees: { count: 0, employees: [] },
    absentees: { count: 0, employees: [] },
    expenseApprovals: { count: 0, expenses: [] },
    leaveApprovals: { count: 0, leaveRequests: [] }
  });

  const [loading, setLoading] = useState(true);
  
  const [selectedSection, setSelectedSection] = useState(null);

  // Format date to show only date without timestamp
  const formatDate = (date) => {
    if (!date) return "N/A";
    return formatDateDDMMYY(date);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchInsights = async () => {
      try {
        setLoading(true);
        const response = await fetch(buildApiUrl('/clock/compliance-insights'), {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || `Failed to fetch compliance insights (${response.status})`);
        }

        if (!cancelled) {
          setInsights(data.data);
        }
      } catch (error) {
        if (!cancelled) {
          setInsights({
            totalEmployees: { count: 0, employees: [] },
            activeEmployees: { count: 0, employees: [] },
            absentees: { count: 0, employees: [] },
            expenseApprovals: { count: 0, expenses: [] },
            leaveApprovals: { count: 0, leaveRequests: [] }
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'expired':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const renderEmployeesTable = (employees, title) => {
    if (!employees || employees.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No {title.toLowerCase()} found
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((emp) => (
                <tr key={emp._id || emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <AcademicCapIcon className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <div className="font-medium text-gray-900">{`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.email || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.department || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.jobTitle || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/employee/${emp._id || emp.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors font-medium"
                      title="View Employee"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAbsenteesTable = (rows, title) => {
    if (!rows || rows.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No {title.toLowerCase()} found
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, idx) => (
                <tr key={row.employee?._id || idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {`${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim() || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.shiftName || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.startTime || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.endTime || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/employee/${row.employee?._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors font-medium"
                      title="View Employee"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderExpensesTable = (expenses, title) => {
    if (!expenses || expenses.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No {title.toLowerCase()} found
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((exp) => (
                <tr key={exp._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {`${exp.employee?.firstName || ''} ${exp.employee?.lastName || ''}`.trim() || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(exp.date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{exp.category || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{typeof exp.totalAmount === 'number' ? exp.totalAmount.toFixed(2) : 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(exp.status)}`}>
                      {getStatusIcon(exp.status)}
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/expenses/${exp._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors font-medium"
                      title="View Expense"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLeaveApprovalsTable = (requests, title) => {
    if (!requests || requests.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No {title.toLowerCase()} found
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {`${req.employeeId?.firstName || ''} ${req.employeeId?.lastName || ''}`.trim() || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{req.leaveType || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(req.startDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(req.endDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(req.status)}`}>
                      {getStatusIcon(req.status)}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to="/manager-approvals"
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors font-medium"
                      title="Open Approvals"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Compliance Insights</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Total Certificates */}
        <button
          onClick={() => setSelectedSection(selectedSection === 'total' ? null : 'total')}
          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
            selectedSection === 'total' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-3xl font-bold text-emerald-600">{insights.totalEmployees?.count ?? 0}</div>
          <div className="text-sm text-gray-600 mt-1">Total Employees</div>
        </button>

        {/* Expiring Soon */}
        <button
          onClick={() => setSelectedSection(selectedSection === 'expiring' ? null : 'expiring')}
          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
            selectedSection === 'expiring' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-600">{insights.absentees?.count ?? 0}</div>
          <div className="text-sm text-gray-600 mt-1">Absentees</div>
        </button>

        {/* Expired */}
        <button
          onClick={() => setSelectedSection(selectedSection === 'expired' ? null : 'expired')}
          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
            selectedSection === 'expired' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{insights.expenseApprovals?.count ?? 0}</div>
          <div className="text-sm text-gray-600 mt-1">Expense Approvals</div>
        </button>

        {/* Pending */}
        <button
          onClick={() => setSelectedSection(selectedSection === 'pending' ? null : 'pending')}
          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
            selectedSection === 'pending' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="text-3xl font-bold text-blue-600">{insights.leaveApprovals?.count ?? 0}</div>
          <div className="text-sm text-gray-600 mt-1">Leave Approvals</div>
        </button>
      </div>

      {/* Filtered Tables */}
      {selectedSection === 'total' && renderEmployeesTable(insights.totalEmployees?.employees, 'All Employees')}
      {selectedSection === 'active' && renderEmployeesTable(insights.activeEmployees?.employees, 'Active Employees')}
      {selectedSection === 'expiring' && renderAbsenteesTable(insights.absentees?.employees, 'Absentees')}
      {selectedSection === 'expired' && renderExpensesTable(insights.expenseApprovals?.expenses, 'Expenses Pending Approval')}
      {selectedSection === 'pending' && renderLeaveApprovalsTable(insights.leaveApprovals?.leaveRequests, 'Leave Requests Pending Approval')}
    </div>
  );
};

export default ComplianceInsights;
