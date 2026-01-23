import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle, Edit, X } from 'lucide-react';
import { getLeaveBalances } from '../utils/leaveApi';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AnnualLeaveBalance = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [error, setError] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    if (user?.role) {
      setUserRole(user.role);
    }
  }, [user]);

  // Fetch real leave balance data from API
  useEffect(() => {
    const fetchLeaveBalances = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching leave balances...');
        const response = await getLeaveBalances({ current: true });
        console.log('API Response:', response);
        
        if (!response || !response.data) {
          console.error('No data in response:', response);
          setError('No leave balance data available');
          setEmployees([]);
          return;
        }
        
        // Transform API data to match component structure
        const transformedData = response.data.map(balance => {
          // API populates 'user' object with firstName, lastName, department from EmployeeHub
          const userName = balance.user 
            ? `${balance.user.firstName || ''} ${balance.user.lastName || ''}`.trim()
            : 'Unknown Employee';
          const userDept = balance.user?.department || 'N/A';
          
          return {
            id: balance._id,
            name: userName,
            department: userDept,
            totalLeave: (balance.entitlementDays || 0) + (balance.carryOverDays || 0),
            takenLeave: balance.usedDays || 0,
            pendingLeave: 0, // Will be calculated from pending leave requests
            remainingLeave: balance.remainingDays || 0,
            status: 'active',
            userId: balance.user?._id,
            yearStart: balance.leaveYearStart,
            yearEnd: balance.leaveYearEnd
          };
        });
        
        console.log('Transformed data:', transformedData);
        setEmployees(transformedData);
      } catch (err) {
        console.error('Failed to fetch leave balances:', err);
        console.error('Error details:', err.response?.data);
        setError(err.response?.data?.message || err.message || 'Failed to load leave balances');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveBalances();
  }, []);

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || employee.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const departments = ['all', ...new Set(employees.map(emp => emp.department))];

  const isAdminUser = ['admin', 'super-admin'].includes(userRole);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'inactive':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getLeaveStatus = (remaining) => {
    if (remaining <= 2) return { color: 'text-red-600', icon: AlertCircle };
    if (remaining <= 5) return { color: 'text-yellow-600', icon: Clock };
    return { color: 'text-green-600', icon: CheckCircle };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && employees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Leave Balances</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Check the browser console (F12) for more details
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leave Balance Data</h3>
          <p className="text-gray-600 mb-4">
            No leave balance records found. Leave balances need to be initialized for employees.
          </p>
          <p className="text-sm text-gray-500">
            Contact your administrator to set up leave balances.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Annual Leave Balance</h1>
          <p className="text-gray-600">Track and manage employee leave balances</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Leave Days</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.reduce((sum, emp) => sum + emp.totalLeave, 0)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Taken Leave</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.reduce((sum, emp) => sum + emp.takenLeave, 0)}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Leave</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.reduce((sum, emp) => sum + emp.pendingLeave, 0)}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Leave
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taken
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {isAdminUser && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee, index) => {
                  const leaveStatus = getLeaveStatus(employee.remainingLeave);
                  const StatusIcon = leaveStatus.icon;
                  
                  return (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{employee.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.totalLeave}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.takenLeave}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.pendingLeave}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center text-sm font-medium ${leaveStatus.color}`}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {employee.remainingLeave}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(employee.status)}`}>
                          {employee.status}
                        </span>
                      </td>
                      {isAdminUser && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setEditingEmployee(employee);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Leave Balance"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Leave Balance Modal */}
        {showEditModal && editingEmployee && (
          <EditLeaveBalanceModal
            employee={editingEmployee}
            onClose={() => {
              setShowEditModal(false);
              setEditingEmployee(null);
            }}
            onSuccess={() => {
              setShowEditModal(false);
              setEditingEmployee(null);
              window.location.reload();
            }}
          />
        )}
      </div>
    </div>
  );
};

// Edit Leave Balance Modal Component
const EditLeaveBalanceModal = ({ employee, onClose, onSuccess }) => {
  const [entitlementDays, setEntitlementDays] = useState(employee.totalLeave || 28);
  const [carryOverDays, setCarryOverDays] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason || reason.trim().length === 0) {
      setError('Please provide a reason for the adjustment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.put(`/api/leave/admin/balance/${employee.userId}`, {
        entitlementDays: parseInt(entitlementDays),
        carryOverDays: parseInt(carryOverDays),
        reason: reason.trim()
      });

      if (response.data.success) {
        alert('Leave balance updated successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error updating leave balance:', err);
      setError(err.response?.data?.message || 'Failed to update leave balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Leave Balance - {employee.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Annual Entitlement (days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={entitlementDays}
              onChange={(e) => setEntitlementDays(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {employee.totalLeave} days | Standard UK: 28 days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carry Over Days
            </label>
            <input
              type="number"
              min="0"
              value={carryOverDays}
              onChange={(e) => setCarryOverDays(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Adjustment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="e.g., Additional days granted, Contractual change"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AnnualLeaveBalance;
